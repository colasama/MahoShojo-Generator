import { z } from 'zod';
import { generateWithAI, GenerationConfig } from '../../lib/ai';
import { queryFromD1 } from '../../lib/d1'; // 导入 D1 查询函数
import { getLogger } from '../../lib/logger';

const log = getLogger('api-gen-battle-story');

export const config = {
  runtime: 'edge',
};

// 定义AI响应的Zod schema
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

// 预先加载问卷数据（在模块级别）
let questionsCache: string[] | null = null;

async function loadQuestions(): Promise<string[]> {
  if (questionsCache) {
    return questionsCache;
  }

  try {
    // 使用 fetch 在函数内部加载 json 文件
    const response = await fetch(`/questionnaire.json`);
    if (!response.ok) {
      throw new Error(`Failed to fetch questions: ${response.status}`);
    }
    const data = await response.json();
    questionsCache = data.questions as string[];
    return questionsCache;
  } catch (error) {
    log.error('加载问卷数据失败:', { error });
    return [];
  }
}

// 定义生成配置
const createBattleStoryConfig = (questions: string[]): GenerationConfig<BattleReport, any[]> => ({
  systemPrompt: `你是一位资深的轻小说与网文作家，擅长分析和描绘魔法少女之间的冲突与战斗。你的任务是根据提供的魔法少女的角色设定，创作一场她们之间互相对战的精彩故事和一份专业的战斗结算报告。

故事要求：
1. 逻辑连贯：故事必须有明确的起因、经过和结果。
2. 角色驱动：战斗过程需要紧密结合每位魔法少女的设定，特别是要深入理解她们在问卷回答中体现出的性格和理念。她们的行动和决策应符合其性格。
3. 场面生动：战斗描写需要充满想象力，画面感强。
4. 结局合理：战斗的胜负或结果需要基于她们能力的克制关系、战术策略和性格因素，得出合乎逻辑的结论。

报告要求：
1. 客观简洁：战斗报告需要用客观、中立的语言进行总结。
2. 要素齐全：报告需明确指出胜者（或平局）以及战斗的最终影响。

请严格按照提供的JSON schema格式返回故事和报告。`,
  temperature: 0.9,
  promptBuilder: (magicalGirls: any[]) => {
    const profiles = magicalGirls.map((mg, index) => {
      // isPreset 字段是前端添加的，不需要给 AI
      // 将用户答案和AI生成的其余设定分离开
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { userAnswers, isPreset: _, ...restOfProfile } = mg;
      let profileString = `--- 角色 #${index + 1} ---\n`;

      profileString += `// AI生成的角色核心设定\n${JSON.stringify(restOfProfile, null, 2)}\n`;

      // 如果存在用户问卷回答，则将其与问题配对
      if (userAnswers && Array.isArray(userAnswers)) {
        profileString += `\n// 用户问卷回答 (用于理解角色深层性格与理念)\n`;
        const qaBlock = userAnswers.map((answer, i) => {
          // 使用索引从问卷中找到对应的问题
          const question = questions[i] || `问题 ${i + 1}`; // 如果问题列表长度不够，则使用备用标题
          return `Q: ${question}\nA: ${answer}`;
        }).join('\n');
        profileString += qaBlock;
      }

      return profileString;
    }).join('\n\n');

    return `这是本次对战的魔法少女们的设定文件。每个角色包含【AI生成的角色核心设定】和【用户问卷回答】两部分。请务必综合分析所有信息，特别是通过问卷回答来理解角色的深层性格，并以此为基础进行创作：\n\n${profiles}\n\n请根据以上设定，创作她们之间的战斗故事和结算报告。`;
  },
  schema: BattleStorySchema,
  taskName: "生成魔法少女战斗故事",
  maxTokens: 8192,
});

/**
 * 新增：更新数据库中的战斗统计信息
 * @param winnerName 胜利者名字
 * @param participants 所有参战者信息
 */
async function updateBattleStats(winnerName: string, participants: any[]) {
  try {
    const participantNames = participants.map(p => p.codename || p.name);

    // 1. 更新每个参战者的统计数据
    for (const participant of participants) {
      const name = participant.codename || participant.name;
      const isPreset = !!participant.isPreset;
      const isWinner = name === winnerName;

      // 插入或忽略已存在的角色
      await queryFromD1(
        "INSERT INTO characters (name, is_preset) VALUES (?, ?) ON CONFLICT(name) DO NOTHING;",
        [name, isPreset ? 1 : 0]
      );

      // 更新胜/负场次和参战次数
      if (isWinner) {
        await queryFromD1(
          'UPDATE characters SET wins = wins + 1, participations = participations + 1 WHERE name = ?;',
          [name]
        );
      } else if (winnerName !== '平局') {
        await queryFromD1(
          'UPDATE characters SET losses = losses + 1, participations = participations + 1 WHERE name = ?;',
          [name]
        );
      } else {
        await queryFromD1(
          'UPDATE characters SET participations = participations + 1 WHERE name = ?;',
          [name]
        );
      }
    }

    // 2. 记录本次战斗
    await queryFromD1(
      "INSERT INTO battles (winner_name, participants_json, created_at) VALUES (?, ?, ?);",
      [winnerName, JSON.stringify(participantNames), new Date().toISOString()]
    );

    console.log('成功更新战斗统计数据到 D1');
  } catch (error) {
    // D1 更新失败不应阻塞主流程，只记录错误
    console.error('更新 D1 数据库失败:', error);
  }
}


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

    // 预先加载问卷数据
    const questions = await loadQuestions();

    // 生成战斗报告
    const battleStoryConfig = createBattleStoryConfig(questions);
    const battleReport = await generateWithAI(magicalGirls, battleStoryConfig);

    // -- 新增逻辑 --
    // 在返回结果前，异步更新数据库，不阻塞响应
    // 注意：在 Vercel Edge/Cloudflare Workers 中，需要用特殊方式确保异步任务在响应后继续执行
    const updatePromise = updateBattleStats(battleReport.report.winner, magicalGirls);

    // Cloudflare Workers/Pages 环境下，可以将 promise 传递给 waitUntil
    const executionContext = (req as any).context;
    if (executionContext && typeof executionContext.waitUntil === 'function') {
      executionContext.waitUntil(updatePromise);
    }
    // -- 新增逻辑结束 --

    return new Response(JSON.stringify(battleReport), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('生成战斗故事失败:', error);
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    return new Response(JSON.stringify({ error: '生成失败，当前服务器可能正忙，请稍后重试', message: errorMessage }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export default handler;