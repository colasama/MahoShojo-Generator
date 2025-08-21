// pages/api/generate-scenario.ts

import { z } from 'zod';
import { generateWithAI, GenerationConfig } from '../../lib/ai';
import { getLogger } from '../../lib/logger';
import { quickCheck } from '@/lib/sensitive-word-filter';
import { NextRequest } from 'next/server';
import { generateSignature } from '@/lib/signature';

const log = getLogger('api-gen-scenario');

export const config = {
  runtime: 'edge',
};

// =================================================================
// 1. Zod Schema 定义
// =================================================================

// AI需要返回的情景数据结构的Schema (SRS 3.3.3)
const ScenarioSchema = z.object({
  title: z.string().describe("情景的标题【必需】。根据用户回答，为这个情景取一个简洁而富有吸引力的标题。"),
  scenario_type: z.string().describe("情景类型【必需】。根据情景的核心内容，为其分类（例如：日常、互动、考试、竞技比赛、调查、采访等）。"),
  description: z.string().describe("情景的简短描述。"),
  elements: z.object({
    scene: z.object({
        time: z.string().optional().describe("故事发生的时间。"),
        place: z.string().optional().describe("故事发生的地点。"),
        features: z.string().optional().describe("环境特征和陈设等。"),
    }).describe("场景描述。如果用户未提供，可留空或注明“未指定”。"),
    roles: z.array(z.object({
        name: z.string().describe("角色名称或身份。"),
        description: z.string().describe("该角色的设定、目标或行为准则。")
    })).optional().describe("预设的NPC角色信息，可留空。"),
    events: z.string().describe("核心事件描述 (角色需要做什么？会怎么互动？有什么冲突？)。"),
    atmosphere: z.string().describe("故事的情感基调和氛围。"),
    development: z.array(z.string()).describe("故事可能的多个发展方向。"),
  }),
}).describe("一个结构化的情景设定，用于魔法少女竞技场。");


// =================================================================
// 2. AI Prompt 配置
// =================================================================

const createGenerationConfig = (
  answers: Record<string, string>
): GenerationConfig<z.infer<typeof ScenarioSchema>, any> => {
  const promptBuilder = () => {
    const answerText = Object.entries(answers)
      .filter(([, value]) => value.trim() !== '')
      .map(([key, value]) => `【${key}】\n${value}\n`)
      .join('\n');

    return `
你是一个富有想象力的故事场景设计师。你的任务是根据用户提供的几个核心要素，构思并生成一个结构化的、可供后续故事使用的自定义情景（Scenario）文件。

## 核心创作原则

1.  **世界观一致性**：你创作的所有内容，都必须严格遵循“魔法少女”这一核心世界观。情景可以多样，但不能出现与魔法少女主题严重冲突的元素（例如：星际舰队、现代战争等），并且应当符合公序良俗。
2.  **创意与整合**：你的核心工作是将用户零散的回答，富有创意地整合成一个逻辑自洽、充满想象力的完整情景。你需要发掘回答背后隐藏的动机与深层含义，并将其反映在情景的各个要素中。
3.  **结构化输出**：你必须严格按照我提供的JSON Schema格式返回结果，不得有任何遗漏或格式错误。
4.  **处理留白**：用户可能不会回答所有问题，或者回答得很模糊。在这种情况下，你拥有一定的创作自由度。对于留空的核心要素（如“角色”），请直接将其设定为空值或空数组，并在描述中注明“未指定”或“待定”，以便用户后续添加。

## 用户的回答
${answerText}

现在，请开始你的创作。
`;
  };

  return {
    systemPrompt: "你是一位富有想象力的世界观构架师和剧本作家，擅长将零散的想法整合成结构化的故事场景。",
    temperature: 0.7,
    promptBuilder,
    schema: ScenarioSchema,
    taskName: "生成情景",
    maxTokens: 4096,
  };
};

// =================================================================
// 3. API Handler
// =================================================================

async function handler(req: NextRequest): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  try {
    const { answers } = await req.json();

    if (!answers || typeof answers !== 'object' || Object.keys(answers).length === 0) {
      return new Response(JSON.stringify({ error: 'Answers object is required' }), { status: 400 });
    }
    
    // 安全检查 (SRS 3.3.4)
    if ((await quickCheck(JSON.stringify(answers))).hasSensitiveWords) {
      return new Response(JSON.stringify({ error: '输入内容不合规', shouldRedirect: true }), { status: 400 });
    }

    const generationConfig = createGenerationConfig(answers);
    const scenarioData = await generateWithAI(null, generationConfig);

    // 附加元数据和签名 (SRS 3.3.3 & 4.1)
    const finalScenario = {
      ...scenarioData,
      metadata: {
        created_at: new Date().toISOString(),
        signature: '', // 占位
      }
    };

    const signature = await generateSignature(finalScenario);
    finalScenario.metadata.signature = signature || '';

    return new Response(JSON.stringify(finalScenario), { status: 200 });

  } catch (error) {
    log.error('情景生成失败', { error });
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    return new Response(JSON.stringify({ error: '生成失败', message: errorMessage }), { status: 500 });
  }
}

export default handler;