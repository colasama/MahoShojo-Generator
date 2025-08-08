// pages/api/generate-battle-story.ts

import { z } from 'zod';
import { generateWithAI, GenerationConfig } from '../../lib/ai';
import { queryFromD1 } from '../../lib/d1';
import { getLogger } from '../../lib/logger';
import questionnaire from '../../public/questionnaire.json';
import { getRandomJournalist } from '../../lib/random-choose-journalist';

const log = getLogger('api-gen-battle-story');

export const config = {
  runtime: 'edge',
};

// 为 AI 定义一个更专注的核心 Schema，不再包含记者信息
const BattleReportCoreSchema = z.object({
  headline: z.string().describe("本场比赛的新闻标题，可以使用震惊体等技巧来吸引读者。"),
  article: z.object({
    body: z.string().describe("战斗简报的正文。"),
    analysis: z.string().describe("记者的分析与猜测。这部分内容可以带有记者的主观色彩，看热闹不嫌事大，进行一些有逻辑但可能不完全真实的猜测和引申，制造“爆点”，字数约100-150字。")
  }),
  officialReport: z.object({
    winner: z.string().describe("胜利者的魔法少女代号。如果是平局，则返回'平局'。"),
    impact: z.string().describe("对本次事件的总结点评，描述战斗带来的最终影响，包括对参战者和比赛的后续影响。"),
  })
});

// 从组件中导入的类型，用于最终返回给前端的完整数据结构
import { NewsReport } from '../../components/BattleReportCard';

// AI 生成配置现在只关注核心内容生成
const createNewsReportConfig = (questions: string[], selectedLevel?: string): GenerationConfig<z.infer<typeof BattleReportCoreSchema>, { magicalGirls: any[] }> => ({
  systemPrompt: `
  现在魔法少女在 A.R.E.N.A. 也就是 Awakened Rune Enchantress Nova Arena 中展开竞技性的战斗，请根据以下规则生成战斗简报：
  战斗推演核心规则：
1.  等级与能力限制：魔法少女的能力与她的等级严格挂钩。在推演开始前，请根据角色设定的强度，为每位魔法少女分配合理的等级以确保战斗的平衡性和观赏性。
    * 平衡原则：通常，参加战斗的魔法少女等级应当是一致的。但作为最后的平衡手段，能力设定严重过强的角色可以比其他人低1级，而设定严重过弱的角色则可以比其他人高1级。
    * 等级体系：
        * 种级: 新成为魔法少女。
        * 芽级: 可使用【魔装】。
        * 叶级: 可使用各种【术式】（法术）。
        * 蕾级: 可使用【奇境】。
        * 花级: 可使用【繁开】。
        * 花牌: 魔力大幅增强（基础花级的2倍以上）。
    * 能力锁定：角色不能使用未达到对应等级解锁的能力。例如，叶级魔法少女无法使用奇境和繁开，但可以使用魔装与术式。

2.  常规战斗模式：绝大多数战斗都围绕着魔法少女的【基本能力】、【魔装】和【术式】展开，极少情况下才可能使用【奇境】及【繁开】。

3.  【奇境】的战术运用：
    * 高昂代价：开启【奇境】会付出巨大代价，因此通常只在面临你死我活的阵营冲突的情况下，蕾级及以上的魔法少女才会考虑使用。
    * 战术博弈：可以描绘角色【权衡和考虑】是否要开启奇境，以此来制造战术紧张感，但她们不一定会真的发动。
    * 反制手段：奇境并非无敌，它可以被对方的奇境【抵消】，或被强大的魔力直接【破坏】。

4.  【繁开】的最终手段：
    * 使用时机：只有花级及以上的魔法少女，在这么写更有益于战斗的展开的情况下，才【极小概率】允许使用【繁开】。
    * 强度限制：所使用的繁开能力必须是【有代价、可被理解和应对的】，绝不能是无法破解的必胜技能。严禁使用干涉命运、时间、世界等过于强大的繁开能力，持有此类繁开的魔法少女基本无法觉醒至花级。

请严格遵守以上战斗规则进行推演，构建一场等级合理、有来有回、充满战术博弈的精彩战斗，而不是一场单纯的能力碾压。
`,
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

    // 根据 selectedLevel 是否存在，构建不同的最终指令
    let finalPrompt = `这是本次对战的魔法少女们的情报信息。每个角色包含【角色核心设定】和【问卷回答】两部分。请务必综合分析所有信息，特别是通过问卷回答来理解角色的深层性格，并以此为基础进行创作：\n\n${profiles}\n\n`;

    if (selectedLevel && selectedLevel.trim() !== '') {
      finalPrompt += `注意：请将本次战斗的参与者的平均等级设定为【${selectedLevel}】，并严格根据该等级的能力限制进行战斗推演和描述。`;
    } else {
      finalPrompt += `请根据以上设定，创作她们之间的冲突新闻稿。`;
    }

    return finalPrompt;
  },
  schema: BattleReportCoreSchema,
  taskName: "生成魔法少女新闻报道",
  maxTokens: 8192,
});


/**
  * 更新数据库中的战斗统计信息
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

      // 插入或忽略已存在的角色，确保角色信息被记录
      await queryFromD1(
        "INSERT INTO characters (name, is_preset) VALUES (?, ?) ON CONFLICT(name) DO NOTHING;",
        [name, isPreset ? 1 : 0]
      );

      // 根据胜负情况更新 wins, losses 和 participations 字段
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

    // 2. 将本次战斗记录插入 battles 表
    await queryFromD1(
      "INSERT INTO battles (winner_name, participants_json, created_at) VALUES (?, ?, ?);",
      [winnerName, JSON.stringify(participantNames), new Date().toISOString()]
    );

    log.info('成功更新战斗统计数据到 D1');
  } catch (error) {
    // D1 更新失败不应阻塞主流程，只记录错误日志
    log.error('更新 D1 数据库失败:', { error });
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
    // 从请求体中解构出 magicalGirls 和 selectedLevel
    const { magicalGirls, selectedLevel } = await req.json();

    if (!Array.isArray(magicalGirls) || magicalGirls.length < 2 || magicalGirls.length > 6) {
      return new Response(JSON.stringify({ error: '必须提供2到6个魔法少女的设定' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const questions = questionnaire.questions;
    // 将 selectedLevel 传递给配置生成函数
    const newsReportConfig = createNewsReportConfig(questionnaire.questions, selectedLevel);
    // 将 magicalGirls 传递给 AI 生成函数
    const aiResult = await generateWithAI(magicalGirls, newsReportConfig);

    const reporterInfo = getRandomJournalist();

    const fullReport: NewsReport = {
      ...aiResult,
      reporterInfo: {
        name: reporterInfo.name,
        publication: reporterInfo.publication,
      },
    };

    // 异步更新数据库，不阻塞对用户的响应
    const updatePromise = updateBattleStats(fullReport.officialReport.winner, magicalGirls);
    const executionContext = (req as any).context;
    if (executionContext && typeof executionContext.waitUntil === 'function') {
      executionContext.waitUntil(updatePromise);
    } else {
      updatePromise.catch(err => log.error('更新战斗统计失败（非阻塞）', err));
    }

    return new Response(JSON.stringify(fullReport), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    // --- 增强日志记录 ---
    const errorMessage = error instanceof Error ? error.message : '未知错误';

    // 记录完整的错误对象，包括堆栈信息，而不仅仅是消息字符串
    log.error('生成新闻报道时发生顶层错误', {
        error, // 这会包含堆栈等详细信息
        errorMessage: errorMessage
    });

    return new Response(JSON.stringify({ error: '生成失败，当前服务器可能正忙，请稍后重试', message: errorMessage }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export default handler;