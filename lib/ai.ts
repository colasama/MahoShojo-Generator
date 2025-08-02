import { generateObject, NoObjectGeneratedError } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";
import { config } from "./config";

// 延迟函数
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// 生成配置接口
export interface GenerationConfig<T, I = string> {
  systemPrompt: string;
  temperature: number;
  promptBuilder: (input: I) => string;
  schema: z.ZodSchema<T>;
  taskName: string;
}

// 通用 AI 生成函数
export async function generateWithAI<T, I = string>(
  input: I,
  generationConfig: GenerationConfig<T, I>
): Promise<T> {
  const providers = config.PROVIDERS;

  if (providers.length === 0) {
    console.error("没有配置 API Key");
    throw new Error("没有配置 API Key");
  }

  let lastError: unknown = null;

  // 第一阶段：优先使用第一个配置，尝试1次
  const firstProvider = providers[0];
  console.log(`优先使用第一个提供商: ${firstProvider.name}，模型: ${firstProvider.model}`);

  for (let attempt = 0; attempt < 1; attempt++) {
    try {
      console.log(`第一个提供商第 ${attempt + 1} 次尝试`);

      const llm = createOpenAI({
        apiKey: firstProvider.apiKey,
        baseURL: firstProvider.baseUrl,
        compatibility: "compatible",
      });

      const { object } = await generateObject({
        model: llm(firstProvider.model),
        system: generationConfig.systemPrompt,
        prompt: generationConfig.promptBuilder(input),
        schema: generationConfig.schema,
        temperature: generationConfig.temperature,
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

      // 如果不是最后一次尝试，等待0.2秒后再重试
      if (attempt < 0) {
        console.log(`等待 0.2 秒后重试...`);
        await sleep(200);
      }
    }
  }

  // 第二阶段：如果第一个配置失败，按顺序使用后续配置，每个配置尝试一次
  console.log(`第一个提供商失败，开始尝试后续提供商`);

  for (let providerIndex = 1; providerIndex < providers.length; providerIndex++) {
    const provider = providers[providerIndex];

    // 增加 0.3 - 0.1 * providerIndex 的几率跳过这个提供商
    if (Math.random() < 0.3 - 0.1 * providerIndex) {
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
        system: generationConfig.systemPrompt,
        prompt: generationConfig.promptBuilder(input),
        schema: generationConfig.schema,
        temperature: generationConfig.temperature,
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
  throw new Error(`${generationConfig.taskName}失败: ${lastError}`);
}
