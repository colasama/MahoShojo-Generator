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

/**
 * 随机打乱数组的函数 (Fisher-Yates shuffle)
 */
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * 根据权重随机选择元素
 */
function weightedRandomSelect<T extends { weight?: number }>(items: T[]): T[] {
  if (items.length === 0) return [];
  
  // 如果没有权重，返回随机打乱的数组
  if (!items.some(item => item.weight)) {
    return shuffleArray(items);
  }
  
  const sorted = [...items].sort((a, b) => {
    const weightA = a.weight || 1;
    const weightB = b.weight || 1;
    // 添加随机因子，权重高的更容易被选中，但不是绝对的
    return (weightB + Math.random() * 0.5) - (weightA + Math.random() * 0.5);
  });
  
  return sorted;
}

/**
 * 从模型数组中随机选择一个模型
 */
function selectRandomModel(models: string | string[]): string {
  if (typeof models === 'string') {
    return models;
  }
  if (Array.isArray(models) && models.length > 0) {
    return models[Math.floor(Math.random() * models.length)];
  }
  throw new Error('无效的模型配置');
}

/**
 * 展开提供商的多模型配置，为每个模型创建单独的提供商实例
 */
function expandProviders(providers: AIProvider[]): AIProvider[] {
  const expandedProviders: AIProvider[] = [];
  
  providers.forEach(provider => {
    if (typeof provider.model === 'string') {
      // 单个模型，直接添加
      expandedProviders.push(provider);
    } else if (Array.isArray(provider.model)) {
      // 多个模型，为每个模型创建单独的提供商实例
      provider.model.forEach((model, index) => {
        expandedProviders.push({
          ...provider,
          name: `${provider.name}_model_${index + 1}`,
          model,
          weight: provider.weight || 1
        });
      });
    }
  });
  
  return expandedProviders;
}

/**
 * 负载均衡策略枚举
 */
export enum LoadBalanceStrategy {
  SEQUENTIAL = 'sequential',  // 顺序执行（原有逻辑）
  RANDOM = 'random',         // 随机选择
  ROUND_ROBIN = 'round_robin' // 轮询（暂时不实现）
}

// 全局轮询计数器（用于轮询策略）
let roundRobinCounter = 0;

// 通用 AI 生成函数
export async function generateWithAI<T, I = string>(
  input: I,
  generationConfig: GenerationConfig<T, I>,
  loadBalanceStrategy?: LoadBalanceStrategy
): Promise<T> {
  const baseProviders = config.PROVIDERS;

  if (baseProviders.length === 0) {
    console.error("没有配置 API Key");
    throw new Error("没有配置 API Key");
  }

  // 展开多模型配置
  const expandedProviders = expandProviders(baseProviders);
  console.log(`[负载均衡] 展开后的提供商数量: ${expandedProviders.length}`);

  // 如果没有指定策略，从配置中读取
  const strategy = loadBalanceStrategy || (config.LOAD_BALANCE_STRATEGY as LoadBalanceStrategy) || LoadBalanceStrategy.RANDOM;

  let lastError: unknown = null;
  let providersToTry: AIProvider[] = [];

  // 根据负载均衡策略决定提供商顺序
  switch (strategy) {
    case LoadBalanceStrategy.RANDOM:
      // 使用权重随机选择
      providersToTry = weightedRandomSelect(expandedProviders);
      console.log(`[负载均衡] 使用加权随机策略，提供商顺序: ${providersToTry.map(p => `${p.name}(${typeof p.model === 'string' ? p.model : 'multi'})`).join(' -> ')}`);
      break;
    
    case LoadBalanceStrategy.ROUND_ROBIN:
      // 轮询选择提供商
      const startIndex = roundRobinCounter % expandedProviders.length;
      providersToTry = [
        ...expandedProviders.slice(startIndex),
        ...expandedProviders.slice(0, startIndex)
      ];
      roundRobinCounter++;
      console.log(`[负载均衡] 使用轮询策略，从第 ${startIndex + 1} 个提供商开始: ${providersToTry.map(p => `${p.name}(${typeof p.model === 'string' ? p.model : 'multi'})`).join(' -> ')}`);
      break;
    
    case LoadBalanceStrategy.SEQUENTIAL:
    default:
      // 顺序执行（原有逻辑）
      providersToTry = [...expandedProviders];
      console.log(`[负载均衡] 使用顺序策略: ${providersToTry.map(p => `${p.name}(${typeof p.model === 'string' ? p.model : 'multi'})`).join(' -> ')}`);
      break;
  }

  // 遍历所有提供商
  for (let providerIndex = 0; providerIndex < providersToTry.length; providerIndex++) {
    const provider = providersToTry[providerIndex];

    // 检查是否跳过此提供商（第一个提供商不跳过）
    if (providerIndex > 0 && Math.random() < (provider.skipProbability ?? 0)) {
      console.log(`跳过提供商: ${provider.name} (跳过概率: ${provider.skipProbability})`);
      continue;
    }

    const retryCount = provider.retryCount ?? 1;
    // 从可能的多个模型中选择一个
    const selectedModel = selectRandomModel(provider.model);
    console.log(`使用提供商: ${provider.name}，模型: ${selectedModel}，重试次数: ${retryCount}`);

    // 对当前提供商进行重试
    for (let attempt = 0; attempt < retryCount; attempt++) {
      try {
        console.log(`提供商 ${provider.name} 第 ${attempt + 1}/${retryCount} 次尝试，使用模型: ${selectedModel}`);

        const llm = createAIClient(provider);

        const generateOptions = {
          model: llm(selectedModel),
          system: generationConfig.systemPrompt,
          prompt: generationConfig.promptBuilder(input),
          schema: generationConfig.schema,
          temperature: generationConfig.temperature,
          maxTokens: generationConfig.maxTokens,
          retryCount: 1,
          mode: provider.mode || 'auto',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
