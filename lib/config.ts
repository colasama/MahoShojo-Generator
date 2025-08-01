// 解析环境变量中的数组
const parseApiPairs = () => {
  const apiKeys = (process.env.NEXT_PUBLIC_AI_API_KEYS || '').split(',').filter(Boolean);
  const baseUrls = (process.env.NEXT_PUBLIC_AI_BASE_URLS || '').split(',').filter(Boolean);

  // 如果没有配置数组，fallback 到旧的单个配置
  if (apiKeys.length === 0) {
    const singleKey = process.env.NEXT_PUBLIC_AI_API_KEY;
    const singleUrl = process.env.NEXT_PUBLIC_AI_BASE_URL || 'https://api.openai.com/v1';
    return singleKey ? [{ apiKey: singleKey, baseUrl: singleUrl }] : [];
  }

  // 确保 API keys 和 URLs 数量匹配
  const pairs = apiKeys.map((apiKey, index) => ({
    apiKey: apiKey.trim(),
    baseUrl: (baseUrls[index] || 'https://api.openai.com/v1').trim()
  }));

  return pairs;
};

export const config = {
  // Vercel AI 配置
  API_PAIRS: parseApiPairs(),
  MODEL: process.env.NEXT_PUBLIC_AI_MODEL || 'gemini-2.0-flash',

  // 魔法少女生成配置
  MAGICAL_GIRL_GENERATION: {
    temperature: 0.8,
    maxTokens: 1000,

    // 可选的花名列表作为参考
    flowerNames: [
      '樱花', '玫瑰', '百合', '茉莉', '牡丹', '芍药', '紫罗兰', '薰衣草',
      '向日葵', '郁金香', '水仙', '康乃馨', '栀子花', '桔梗', '风信子',
      '绣球花', '茶花', '杜鹃', '蔷薇', '丁香', '海棠', '梅花', '兰花',
      '菊花', '莲花', '桃花', '梨花', '杏花', '紫藤', '月季'
    ],

    // 系统提示词
    systemPrompt: `你是一个专业的魔法少女角色设计师。请根据用户输入的真实姓名，设计一个独特的魔法少女角色。

设计要求：
1. 魔法少女名字应该以花名为主题，要与用户的真实姓名有某种关联性或呼应
2. 外貌特征要协调统一，符合魔法少女的设定
3. 变身咒语要朗朗上口，充满魔法感

请严格按照提供的 JSON schema 格式返回结果。`
  }
}

// 类型定义
export type Config = typeof config 