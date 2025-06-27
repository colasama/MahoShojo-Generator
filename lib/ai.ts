import { generateObject, NoObjectGeneratedError } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";
import { config } from "./config";

// 定义魔法少女生成的 schema（排除 level 相关字段）
const MagicalGirlGenerationSchema = z.object({
  name: z.string().describe("魔法少女的花名，应该与真实姓名有关联"),
  appearance: z.object({
    height: z.string().describe('身高，格式如 "160cm"'),
    weight: z.string().describe('体重，格式如 "45kg"'),
    hairColor: z.string().describe("头发颜色"),
    hairStyle: z.string().describe("发型"),
    eyeColor: z.string().describe("眼睛颜色"),
    skinTone: z.string().describe("肤色"),
    specialFeature: z.string().describe("特殊特征或标记"),
  }),
  spell: z.string().describe("变身咒语，包含魔法少女名字"),
});

export type AIGeneratedMagicalGirl = z.infer<
  typeof MagicalGirlGenerationSchema
>;

// 生成魔法少女的函数
export async function generateMagicalGirlWithAI(
  realName: string
): Promise<AIGeneratedMagicalGirl> {
  try {
    const llm = createOpenAI({
      apiKey: config.API_KEY,
      baseURL: config.BASE_URL,
      compatibility: "compatible",
    });
    try {
      const { object } = await generateObject({
        model: llm(config.MODEL),
        system: config.MAGICAL_GIRL_GENERATION.systemPrompt,
        prompt: `请为名叫"${realName}"的人设计一个魔法少女角色。真实姓名：${realName}`,
        schema: MagicalGirlGenerationSchema,
        // temperature: config.MAGICAL_GIRL_GENERATION.temperature,
        // maxTokens: config.MAGICAL_GIRL_GENERATION.maxTokens,
      });
      return object;
    } catch (error) {
      if (NoObjectGeneratedError.isInstance(error)) {
        console.log("NoObjectGeneratedError");
        console.log("Cause:", error.cause);
        console.log("Text:", error.text);
        console.log("Response:", error.response);
        console.log("Usage:", error.usage);
        console.log("Finish Reason:", error.finishReason);
      }
    }
  } catch (error) {
    console.error("AI 生成魔法少女失败:", error);
  }
  // 如果 AI 生成失败，返回一个基础的默认值
  return {
    name: `${realName}之花`,
    appearance: {
      height: "158cm",
      weight: "45kg",
      hairColor: "粉红色",
      hairStyle: "长直发",
      eyeColor: "蓝色",
      skinTone: "白皙",
      specialFeature: "星星形胎记",
    },
    spell: `星光闪耀，${realName}之花变身！`,
  };
}
