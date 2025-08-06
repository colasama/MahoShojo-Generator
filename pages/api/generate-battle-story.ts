// pages/api/generate-battle-story.ts

import { z } from 'zod';
import { generateWithAI, GenerationConfig } from '../../lib/ai';
import { queryFromD1 } from '../../lib/d1'; // 导入 D1 查询函数
import { getLogger } from '../../lib/logger';

const log = getLogger('api-gen-battle-story');

export const config = {
  runtime: 'edge',
};

// 定义AI响应的Zod schema - 已从战斗故事更新为新闻报道
const NewsReportSchema = z.object({
  headline: z.string().describe("一个引人注目、充满噱头的新闻标题，可以使用震惊体等技巧来吸引读者。"),
  reporterInfo: z.object({
    name: z.string().describe("一位虚构的新闻记者的名字，如果是魔法少女则应当按照格式“魔法少女[花名]”。"),
    publication: z.string().describe("一个虚构的、听起来像是魔法少女世界观下的新闻媒体或自媒体的名称（例如：《国度日报》、《祖母绿周刊》、《卢恩诺雷每日速报》）。")
  }),
  article: z.object({
    body: z.string().describe("新闻正文。以新闻报道的口吻，生动地叙述魔法少女之间冲突的事件经过。可以适当夸张，但要基于角色设定，字数约300-600字。"),
    analysis: z.string().describe("记者的分析与猜测。这部分内容可以带有记者的主观色彩，看热闹不嫌事大，进行一些有逻辑但可能不完全真实的猜测和引申，制造“爆点”，字数约100-150字。")
  }),
  officialReport: z.object({
    summary: z.string().describe("战斗的简要总结报告，客观地概括整个事件。"),
    winner: z.string().describe("记者观察到的胜利者的魔法少女代号。如果是平局，则返回'平局'。"),
    impact: z.string().describe("对本次事件的总结点评，描述战斗带来的最终影响，包括对参战者和环境的后续影响。"),
  })
});

type NewsReport = z.infer<typeof NewsReportSchema>;

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

// 定义生成配置 - 已更新为新闻报道
const createNewsReportConfig = (questions: string[]): GenerationConfig<NewsReport, any[]> => ({
  systemPrompt: `你是一位魔法少女世界观下的资深新闻记者，供职于一家追求“爆点”和“噱头”的自媒体。有目击报告称几位魔法少女之间存在冲突，并且发生了战斗。你的任务是根据提供的几位魔法少女的情报信息，撰写一篇关于她们之间冲突的、能够吸引大量读者眼球的新闻稿。

写作要求：
1. 新闻风格：使用新闻报道的口吻，但可以夸张、渲染这起事件，制造戏剧性冲突。你是那种看热闹不嫌事大的记者。
2. 标题党：新闻标题必须引人注目，可以使用“震惊体”、“标题党”等技巧。
3. 逻辑与虚构：报道的核心事件需基于角色设定（特别是问卷回答所体现的性格和理念），她们在事件中的行动和决策应符合其性格，但你可以在事实基础上进行大胆的猜测、编造细节甚至挑拨离间，只要整体逻辑自洽且足够精彩。
4. 角色深度：深入分析角色问卷回答，挖掘她们性格中的冲突点，并以此作为新闻的核心矛盾，甚至可以据此编造一些虚构的“幕后消息”。
5. 结构清晰：严格按照提供的JSON schema格式返回新闻稿，包含标题、记者信息、正文、分析和官方报告。`,
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

    return `这是本次对战的魔法少女们的情报信息。每个角色包含【角色核心设定】和【问卷回答】两部分。请务必综合分析所有信息，特别是通过问卷回答来理解角色的深层性格，并以此为基础进行创作：\n\n${profiles}\n\n请根据以上设定，创作她们之间的冲突新闻稿。`;
  },
  schema: NewsReportSchema,
  taskName: "生成魔法少女新闻报道",
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

    // 生成新闻报道
    const newsReportConfig = createNewsReportConfig(questions);
    const newsReport = await generateWithAI(magicalGirls, newsReportConfig);

    // 在返回结果前，异步更新数据库，不阻塞响应
    const updatePromise = updateBattleStats(newsReport.officialReport.winner, magicalGirls);

    // Cloudflare Workers/Pages 环境下，可以将 promise 传递给 waitUntil
    const executionContext = (req as any).context;
    if (executionContext && typeof executionContext.waitUntil === 'function') {
      executionContext.waitUntil(updatePromise);
    }

    return new Response(JSON.stringify(newsReport), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('生成新闻报道失败:', error);
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    return new Response(JSON.stringify({ error: '生成失败，当前服务器可能正忙，请稍后重试', message: errorMessage }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export default handler;