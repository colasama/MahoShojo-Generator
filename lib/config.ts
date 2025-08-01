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

    // 系统提示词
    systemPrompt: `你是一个专业的魔法少女角色设计师。请根据用户输入的真实姓名，设计一个独特的魔法少女角色。

设计要求：
1. 魔法少女名字应该以花名为主题，要与用户的真实姓名有某种关联性或呼应
2. 外貌特征要协调统一，符合魔法少女的设定
3. 变身咒语要朗朗上口，充满魔法感

请严格按照提供的 JSON schema 格式返回结果。`
  }
} 