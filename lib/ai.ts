import { generateObject, NoObjectGeneratedError } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";
import { config } from "./config";

export const MainColor = {
  Red: '红色',
  Orange: '橙色',
  Cyan: '青色',
  Blue: '蓝色',
  Purple: '紫色',
  Pink: '粉色',
  Yellow: '黄色',
  Green: '绿色'
} as const;

export type MainColor = typeof MainColor[keyof typeof MainColor];

// 定义魔法少女生成的 schema（排除 level 相关字段）
const MagicalGirlGenerationSchema = z.object({
  flowerName: z.string().describe(`魔法少女的花名，应该与真实姓名有一定关联，但是不能包含真实姓名，
    必须是一种花比如百合 / 丁香 / 茉莉，大部分时候输出常用中文名，有时候可以使用英文音译为中文或者拉丁文音译为中文增加酷炫度，
    但是不要出现魔法少女字样`),
  flowerDescription: z.string().describe("生成的 flowerName 在大众文化中的花语，大概 20 字左右，不要出现魔法少女字样"),
  appearance: z.object({
    height: z.string().describe('身高，格式如 "160cm"'),
    weight: z.string().describe('体重，格式如 "45kg"'),
    hairColor: z.string().describe("头发颜色，会出现渐变和挑染"),
    hairStyle: z.string().describe(`发型，具体到头发长度、发型样式、发饰等，可以是各种各样形状和颜色的发卡，
      发挥你的想象力，符合审美即可，尽量不出现花形状的发饰，也可能是帽子、发卡、发箍之类的`),
    eyeColor: z.string().describe("眼睛颜色，有几率出现异瞳，比如一只蓝色一只绿色"),
    skinTone: z.string().describe("肤色，通常是白皙，但是偶尔会出现其他肤色，根据人物设定生成"),
    wearing: z.string().describe('人物身穿的服装样式，需要描述具体的颜色和式样款式，一般比较华丽，不要拘泥于花形状，符合主色调即可，其他形制在符合花语的情况下自由发挥'),
    specialFeature: z.string().describe("特征，一般是反映人物性格的常见表情、动作、特征等"),
    mainColor: z.enum(Object.values(MainColor) as [string, ...string[]]).describe(
      `魔法少女的主色调，请参考 hairColor 选择最接近的一项，如果 hairColor 是渐变，请选择最接近的渐变主色调`),
    firstPageColor: z.string().describe("根据 mainColor 产生第一个渐变色，格式以 #000000 给出"),
    secondPageColor: z.string().describe("根据 mainColor 产生第二个渐变色，格式以 #000000 给出"),
  }),
  spell: z.string().describe(`很酷的变身咒语，提供日语版和对应的中文翻译，使用 \n 换行，参考常见的日本魔法少女中的变身，通常 20 字到 40 字左右。
    - 参考格式1：
        "黒よりも黒く、闇よりも暗い。ここに我が真の真紅の黄金の光を託す。目覚めの時が来た。不条理な教会の腐敗した論理" \n
        "比黑色更黑 比黑暗更暗的漆黑 在此寄讬吾真红的金光吧 觉醒之时的到来 荒谬教会的堕落章理"`),
});

export type AIGeneratedMagicalGirl = z.infer<
  typeof MagicalGirlGenerationSchema
>;

// 延迟函数
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// 生成魔法少女的函数
export async function generateMagicalGirlWithAI(
  realName: string
): Promise<AIGeneratedMagicalGirl> {
  const providers = config.PROVIDERS;

  if (providers.length === 0) {
    console.error("没有配置 API Key");
    throw new Error("没有配置 API Key");
  }

  let lastError: unknown = null;

  // 第一阶段：优先使用第一个配置，尝试3次
  const firstProvider = providers[0];
  console.log(`优先使用第一个提供商: ${firstProvider.name}，模型: ${firstProvider.model}`);

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      console.log(`第一个提供商第 ${attempt + 1} 次尝试`);

      const llm = createOpenAI({
        apiKey: firstProvider.apiKey,
        baseURL: firstProvider.baseUrl,
        compatibility: "compatible",
      });

      const { object } = await generateObject({
        model: llm(firstProvider.model),
        system: config.MAGICAL_GIRL_GENERATION.systemPrompt,
        prompt: `请为名叫"${realName}"的人设计一个魔法少女角色。真实姓名：${realName}`,
        schema: MagicalGirlGenerationSchema,
        temperature: config.MAGICAL_GIRL_GENERATION.temperature,
      });

      console.log(`第一个提供商第 ${attempt + 1} 次尝试成功`);
      return object;
    } catch (error) {
      lastError = error;
      console.error(`第一个提供商第 ${attempt + 1} 次尝试失败:`, error);

      if (NoObjectGeneratedError.isInstance(error)) {
        console.log("NoObjectGeneratedError 详情:");
        console.log("Cause:", error.cause);
        console.log("Text:", error.text);
        console.log("Response:", error.response);
        console.log("Usage:", error.usage);
        console.log("Finish Reason:", error.finishReason);
      }

      // 如果不是最后一次尝试，等待2秒后再重试
      if (attempt < 2) {
        console.log(`等待 2 秒后重试...`);
        await sleep(2000);
      }
    }
  }

  // 第二阶段：如果第一个配置3次都失败，按顺序使用后续配置，每个配置尝试一次
  console.log(`第一个提供商失败，开始尝试后续提供商`);

  for (let providerIndex = 1; providerIndex < providers.length; providerIndex++) {
    const provider = providers[providerIndex];

    // 增加 0.3 - 0.1 * providerIndex 的几率跳过这个提供商
    if (Math.random() < 0.4 - 0.1 * providerIndex) {
      console.log(`跳过提供商: ${provider.name}`);
      continue;
    }

    try {
      console.log(`尝试提供商: ${provider.name}，模型: ${provider.model}`);

      const llm = createOpenAI({
        apiKey: provider.apiKey,
        baseURL: provider.baseUrl,
        compatibility: "compatible",
      });

      const { object } = await generateObject({
        model: llm(provider.model),
        system: config.MAGICAL_GIRL_GENERATION.systemPrompt,
        prompt: `请为名叫"${realName}"的人设计一个魔法少女角色。真实姓名：${realName}`,
        schema: MagicalGirlGenerationSchema,
        temperature: config.MAGICAL_GIRL_GENERATION.temperature,
      });

      console.log(`提供商 ${provider.name} 尝试成功`);
      return object;
    } catch (error) {
      lastError = error;
      console.error(`提供商 ${provider.name} 尝试失败:`, error);

      if (NoObjectGeneratedError.isInstance(error)) {
        console.log("NoObjectGeneratedError 详情:");
        console.log("Cause:", error.cause);
        console.log("Text:", error.text);
        console.log("Response:", error.response);
        console.log("Usage:", error.usage);
        console.log("Finish Reason:", error.finishReason);
      }
    }
  }

  console.error("所有提供商都失败了:", lastError);
  throw new Error(`生成魔法少女失败: ${lastError}`);
}
