// AI 提供商配置接口
export interface AIProvider {
  name: string;
  apiKey: string;
  baseUrl: string;
  model: string | string[]; // 支持单个模型或多个模型数组
  type: 'openai' | 'google';
  retryCount?: number;
  skipProbability?: number;
  mode?: 'json' | 'auto' | 'tool' | undefined;
  weight?: number; // 负载均衡权重，数值越大被选中概率越高
}

// 解析 AI 提供商配置的函数
const parseAIProviders = (): AIProvider[] => {
  // JSON 配置方式
  if (process.env.AI_PROVIDERS_CONFIG) {
    try {
      const providers = JSON.parse(process.env.AI_PROVIDERS_CONFIG) as AIProvider[];
      return providers
        .filter(p => p.apiKey && p.baseUrl && p.model && p.type)
        .map(p => ({
          ...p,
          retryCount: p.retryCount ?? 1,
          skipProbability: p.skipProbability ?? 0
        }));
    } catch (error) {
      console.warn('解析 AI_PROVIDERS_CONFIG 失败，回退到简单配置:', error);
    }
  }

  // 向后兼容：单个 API Key 方式
  const singleKey = process.env.AI_API_KEY;
  const singleUrl = process.env.AI_BASE_URL || 'https://api.openai.com/v1';
  const singleModel = process.env.AI_MODEL || 'gemini-2.0-flash';

  if (singleKey) {
    return [{
      name: 'default_provider',
      apiKey: singleKey,
      baseUrl: singleUrl,
      model: singleModel,
      type: singleUrl.includes('googleapis.com') ? 'google' : 'openai',
      retryCount: 1,
      skipProbability: 0
    }];
  }

  return [];
};

// 获取有效的 API 提供商（按配置顺序）
const getAPIProviders = (): AIProvider[] => {
  return parseAIProviders();
};

// 为了保持向后兼容，转换为原有的格式
const parseApiPairs = () => {
  const providers = getAPIProviders();
  return providers.map(provider => ({
    apiKey: provider.apiKey,
    baseUrl: provider.baseUrl,
    name: provider.name,
    model: provider.model,
    mode: provider?.mode || 'auto'
  }));
};

// 获取第一个提供商的模型
const getDefaultModel = (): string | string[] => {
  const providers = getAPIProviders();
  if (providers.length > 0) {
    return providers[0].model;
  }
  return 'gemini-2.5-flash';
};

// 获取负载均衡策略
const getLoadBalanceStrategy = (): string => {
  return process.env.AI_LOAD_BALANCE_STRATEGY || 'random';
};

export const config = {
  // Vercel AI 配置
  API_PAIRS: parseApiPairs(),
  MODEL: getDefaultModel(),
  PROVIDERS: getAPIProviders(),
  LOAD_BALANCE_STRATEGY: getLoadBalanceStrategy(),

  // 魔法少女生成配置
  MAGICAL_GIRL_GENERATION: {
    temperature: 0.8,

    // 系统提示词
    systemPrompt: `你是一个专业的魔法少女角色设计师。请根据用户输入的真实姓名，设计一个独特的魔法少女角色。

设计要求：
1. 魔法少女名字应该以花名为主题，要与用户的真实姓名有某种关联性或呼应
2. 外貌特征要协调统一，符合魔法少女的设定
3. 变身咒语要朗朗上口，充满魔法感

请严格按照提供的 JSON schema 格式返回结果。`
  }
} 