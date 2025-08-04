import { generateObject, NoObjectGeneratedError } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { z } from "zod";
import { config, AIProvider } from "./config";

// 延迟函数
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// 生成配置接口
export interface GenerationConfig<T, I = string> {
  systemPrompt: string;
  temperature: number;
  promptBuilder: (input: I) => string;
  schema: z.ZodSchema<T>;
  taskName: string;
  maxTokens: number;
}

const createAIClient = (provider: AIProvider) => {
  if (provider.type === 'google') {
    return createGoogleGenerativeAI({
      apiKey: provider.apiKey,
      baseURL: provider.baseUrl,
    });
  } else {
    return createOpenAI({
      apiKey: provider.apiKey,
      baseURL: provider.baseUrl,
      compatibility: "compatible",
    });
  }
};

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

  // 遍历所有提供商
  for (let providerIndex = 0; providerIndex < providers.length; providerIndex++) {
    const provider = providers[providerIndex];

    // 检查是否跳过此提供商（第一个提供商不跳过）
    if (providerIndex > 0 && Math.random() < (provider.skipProbability ?? 0)) {
      console.log(`跳过提供商: ${provider.name} (跳过概率: ${provider.skipProbability})`);
      continue;
    }

    const retryCount = provider.retryCount ?? 1;
    console.log(`使用提供商: ${provider.name}，模型: ${provider.model}，重试次数: ${retryCount}`);

    // 对当前提供商进行重试
    for (let attempt = 0; attempt < retryCount; attempt++) {
      try {
        console.log(`提供商 ${provider.name} 第 ${attempt + 1}/${retryCount} 次尝试`);

        const llm = createAIClient(provider);

        const generateOptions = {
          model: llm(provider.model),
          system: generationConfig.systemPrompt,
          prompt: generationConfig.promptBuilder(input),
          schema: generationConfig.schema,
          temperature: generationConfig.temperature,
          maxTokens: generationConfig.maxTokens,
          retryCount: 1,
          mode: provider.mode || 'auto',
          experimental_repairText: provider.mode === 'json' ? async (options: any) => {
            options.text = options.text.replace('```json\n', '').replace('\n```', '');
            return options.text;
          } : undefined,
        };

        const { object } = await generateObject(generateOptions);

        console.log(`提供商 ${provider.name} 第 ${attempt + 1} 次尝试成功`);
        return object as T;
      } catch (error) {
        lastError = error;
        console.error(`提供商 ${provider.name} 第 ${attempt + 1} 次尝试失败:`, error);

        if (NoObjectGeneratedError.isInstance(error)) {
          console.log("NoObjectGeneratedError 详情:");
          console.log("Cause:", error.cause);
          console.log("Text:", error.text);
          console.log("Response:", error.response);
          console.log("Usage:", error.usage);
          console.log("Finish Reason:", error.finishReason);
        }

        // 如果不是最后一次尝试，等待后再重试
        if (attempt < retryCount - 1) {
          const waitTime = (attempt + 1) * 200; // 递增等待时间
          console.log(`等待 ${waitTime} 毫秒后重试...`);
          await sleep(waitTime);
        }
      }
    }

    console.log(`提供商 ${provider.name} 所有尝试都失败了`);
  }

  console.error("所有提供商都失败了:", lastError);
  throw new Error(`${generationConfig.taskName}失败: ${lastError}`);
}
