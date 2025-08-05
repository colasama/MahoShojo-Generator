import { z } from 'zod';
import { generateWithAI, GenerationConfig } from '../../lib/ai';

export const config = {
  runtime: 'edge',
};

const BattleStorySchema = z.object({
  title: z.string().describe("一个轻小说或网文风格的，富有想象力且能概括故事核心的标题。"),
  story: z.object({
    cause: z.string().describe("故事的开头部分。作为引子，通过设问、对话、心理描写等写作技巧吸引读者注意，引出战斗的起因，说明这些魔法少女为何会发生冲突，字数约100-150字。"),
    progression: z.string().describe("故事的详细经过。承接开头，生动地描绘她们如何运用各自的能力进行战斗，战斗场面和策略，字数约300-600字。"),
    result: z.string().describe("故事的结局。为这段战斗故事做收尾，描述战斗是如何结束的，以及最终的结局，字数约100-150字。"),
  }),
  report: z.object({
    summary: z.string().describe("战斗的简要总结报告，客观地概括整个事件。"),
    winner: z.string().describe("胜利者的魔法少女代号。如果是平局，则返回'平局'。"),
    outcome: z.string().describe("战斗带来的最终影响，包括对参战者和环境的后续影响，告诉读者“后来怎么样了”。"),
  })
});

type BattleReport = z.infer<typeof BattleStorySchema>;

// Define the generation configuration
const battleStoryConfig: GenerationConfig<BattleReport, any[]> = {
  systemPrompt: `你是一位资深的轻小说与网文作家，擅长分析和描绘魔法少女之间的冲突与战斗。你的任务是根据提供的魔法少女的角色设定，创作一场她们之间互相对战的精彩故事和一份专业的战斗结算报告。

故事要求：
1. 逻辑连贯：故事必须有明确的起因、经过和结果。
2. 角色驱动：战斗过程需要紧密结合每位魔法少女的设定，包括她们的外貌、能力、性格和武器（魔力构装）。她们的行动和决策应符合其性格。
3. 场面生动：战斗描写需要充满想象力，画面感强。
4. 结局合理：战斗的胜负或结果需要基于她们能力的克制关系、战术策略和性格因素，得出合乎逻辑的结论。

报告要求：
1. 客观简洁：战斗报告需要用客观、中立的语言进行总结。
2. 要素齐全：报告需明确指出胜者（或平局）以及战斗的最终影响。

请严格按照提供的JSON schema格式返回故事和报告。`,
  temperature: 0.9,
  promptBuilder: (magicalGirls: any[]) => {
    const profiles = magicalGirls.map((mg, index) =>
        `--- 角色 #${index + 1} ---\n${JSON.stringify(mg, null, 2)}`
    ).join('\n\n');
    return `这是本次对战的魔法少女们的设定文件：\n\n${profiles}\n\n请根据以上设定，创作她们之间的战斗故事和结算报告。`;
  },
  schema: BattleStorySchema,
  taskName: "生成魔法少女战斗故事",
  maxTokens: 8192,
};


async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const { magicalGirls } = await req.json();

    if (!Array.isArray(magicalGirls) || magicalGirls.length < 2 || magicalGirls.length > 6) {
      return new Response(JSON.stringify({ error: '必须提供2到6个魔法少女的设定' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const battleReport = await generateWithAI(magicalGirls, battleStoryConfig);

    return new Response(JSON.stringify(battleReport), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('生成战斗故事失败:', error);
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    return new Response(JSON.stringify({ error: '生成失败，请稍后重试', message: errorMessage }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export default handler;