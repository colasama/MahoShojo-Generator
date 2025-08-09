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

// 残兽设定，硬编码以兼容Edge Runtime
const canshouLore = `
# 残兽设定整理

## 概述
残兽是突然出现在人类城市，进行无差别破坏与杀戮的神秘怪物。普通的物理攻击，即使是高威力的热武器，也无法对其造成有效伤害。因此，魔法少女是讨伐残兽的主力。

## 进化阶段
残兽拥有类似于昆虫的进化阶段，每一次进化都会带来断崖式的实力增强。已知的阶段包括：

* **卵 (Egg)**: 最初级的阶段，也是最弱小的形态。通常表现为巨大的肉块状，行动迟缓，凭本能进行破坏。
* **蠖 (Caterpillar/Larva)**: 比“卵”更高级的阶段，实力和速度都有显著提升。
* **蛹 (Pupa)**: 此阶段的残兽会筑巢，拥有近似野兽的智慧，并会吸引低级残兽。
* **蜕 (Molt)**: “蛹”之后的更高阶进化形态，实力远超之前的阶段。可以形成自己的“规则”，在特定区域内改写物理法则。包括“半蜕”、“蜕”和“王蜕”等亚种。
* **羽 (Wing)**: “蜕”之上的最终进化形态，强度远超花级魔法少女，基本上无人能敌。
`;


// 为 AI 定义一个更专注的核心 Schema，不再包含记者信息
const BattleReportCoreSchema = z.object({
  headline: z.string().describe("本场比赛的新闻标题，可以使用震惊体等技巧来吸引读者。"),
  article: z.object({
    body: z.string().describe("战斗简报的正文。"),
    analysis: z.string().describe("记者的分析与猜测。这部分内容可以带有记者的主观色彩，看热闹不嫌事大，进行一些有逻辑但可能不完全真实的猜测和引申，制造“爆点”，字数约100-150字。")
  }),
  officialReport: z.object({
    winner: z.string().describe("胜利者的魔法少女代号或残兽名称。如果是平局，则返回'平局'。"),
    impact: z.string().describe("对本次事件的总结点评，描述战斗带来的最终影响，包括对参战者和比赛的后续影响。"),
  })
});

// 从组件中导入的类型，用于最终返回给前端的完整数据结构
import { NewsReport } from '../../components/BattleReportCard';

// 场景一：魔法少女 vs 魔法少女
const createMagicalGirlVsMagicalGirlConfig = (questions: string[], selectedLevel?: string): GenerationConfig<z.infer<typeof BattleReportCoreSchema>, { magicalGirls: any[]; cans hou: any[] }> => ({
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
  promptBuilder: (input: { magicalGirls: any[]; canshou: any[] }) => {
    const { magicalGirls } = input;
    const profiles = magicalGirls.map((mg, index) => {
      // isPreset 字段是前端添加的，不需要给 AI
      // 将用户答案和AI生成的其余设定分离开
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { userAnswers, isPreset: _, ...restOfProfile } = mg.data;
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
  taskName: "生成魔法少女对战新闻报道",
  maxTokens: 8192,
});

// 场景二：魔法少女 vs 残兽
const createMagicalGirlVsCanshouConfig = (): GenerationConfig<z.infer<typeof BattleReportCoreSchema>, { magicalGirls: any[]; canshou: any[] }> => ({
  systemPrompt: `你是一名战地记者，负责报道魔法少女与残兽之间的战斗。
  --- 残兽核心设定 ---
  ${canshouLore}
  --- 报道规则 ---
  1. 战斗风格：魔法少女的战斗应体现其战术和能力特性，而残兽的行动应更多基于其本能、欲望和进化阶段所赋予的能力。
  2. 实力平衡：请根据残兽的进化阶段和魔法少女的设定，合理推演战斗过程，确保战斗具有悬念和看点。不要出现一边倒的碾压局。
  3. 报道口吻：你的报道应充满紧张感，突出战斗的激烈、残兽的可怖以及魔法少女的英勇。
  4. 重点描述：重点描写双方能力和战术的碰撞，以及战斗对周围环境造成的影响。
  `,
  temperature: 0.9,
  promptBuilder: (input: { magicalGirls: any[]; canshou: any[] }) => {
    const magicalGirlProfiles = input.magicalGirls.map((mg, index) => {
      // isPreset 字段是前端添加的，不需要给 AI
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { userAnswers, isPreset: _, ...restOfProfile } = mg.data;
      return `--- 魔法少女 #${index + 1} ---\n${JSON.stringify(restOfProfile, null, 2)}`;
    }).join('\n\n');

    const canshouProfiles = input.canshou.map((c, index) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { userAnswers, isPreset: _, ...restOfProfile } = c.data;
      return `--- 残兽 #${index + 1} ---\n${JSON.stringify(restOfProfile, null, 2)}`;
    }).join('\n\n');

    return `以下是本次事件的参战方情报：\n\n${magicalGirlProfiles}\n\n${canshouProfiles}\n\n请根据以上设定，创作一篇关于他们之间战斗的新闻报道。`;
  },
  schema: BattleReportCoreSchema,
  taskName: "生成魔法少女对战残兽新闻报道",
  maxTokens: 8192,
});


// 场景三：残兽 vs 残兽
const createCanshouVsCanshouConfig = (): GenerationConfig<z.infer<typeof BattleReportCoreSchema>, { magicalGirls: any[]; canshou: any[] }> => ({
    systemPrompt: `你是魔法国度研究院所属的魔法少女，你被研究院首席祖母绿大人要求观察并记录一场残兽之间的内斗。你的报告需要客观、冷静，并带有生物学和神秘学角度的分析。
  --- 残兽核心设定 ---
  ${canshouLore}
  --- 报告规则 ---
  1. 战斗风格：战斗应是野性的、残酷的，充满本能与暴力的碰撞。重点描述它们的攻击方式、特殊能力以及进化阶段带来的差异。
  2. 战斗动机：推测它们战斗的动机，可能是为了吞噬对方以进化、争夺领地，或是纯粹的混沌本能。
  3. 报告口吻：使用研究报告的口吻，可以加入一些学术性的猜测和对残兽生态的分析。
  4. 胜利者判断：根据它们的设定和战斗逻辑，合理判断出胜利者。也可能两败俱伤或被第三方（例如魔法少女或环境因素）终结。
  `,
    temperature: 0.8,
    promptBuilder: (input: { magicalGirls: any[]; canshou: any[] }) => {
        const canshouProfiles = input.canshou.map((c, index) => {
            const { userAnswers, isPreset: _, ...restOfProfile } = c.data;
            return `--- 残兽 #${index + 1} ---\n${JSON.stringify(restOfProfile, null, 2)}`;
        }).join('\n\n');

        return `观察对象情报如下：\n\n${canshouProfiles}\n\n请根据以上数据，撰写一份关于它们之间战斗的研究观察报告。`;
    },
    schema: BattleReportCoreSchema,
    taskName: "生成残兽对战报告",
    maxTokens: 8192,
});


/**
  * 更新数据库中的战斗统计信息
  * @param winnerName 胜利者名字
  * @param participants 所有参战者信息
*/
async function updateBattleStats(winnerName: string, participants: any[]) {
  try {
    const participantNames = participants.map(p => p.data.codename || p.data.name);

    for (const participant of participants) {
      const name = participant.data.codename || participant.data.name;
      const isPreset = !!participant.data.isPreset;
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
    const { combatants, selectedLevel } = await req.json();

    if (!Array.isArray(combatants) || combatants.length < 2 || combatants.length > 6) {
      return new Response(JSON.stringify({ error: '必须提供2到6位参战者' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 根据类型区分参战者
    const magicalGirls = combatants.filter(c => c.type === 'magical-girl');
    const canshou = combatants.filter(c => c.type === 'canshou');

    let generationConfig;

    // 根据参战者构成选择不同的生成配置
    if (canshou.length === 0) {
      // 全是魔法少女
      log.info('场景：魔法少女内战');
      generationConfig = createMagicalGirlVsMagicalGirlConfig(questionnaire.questions, selectedLevel);
    } else if (magicalGirls.length === 0) {
      // 全是残兽
      log.info('场景：残兽内战');
      generationConfig = createCanshouVsCanshouConfig();
    } else {
      // 混合对战
      log.info('场景：魔法少女 vs 残兽');
      generationConfig = createMagicalGirlVsCanshouConfig();
    }

    const aiResult = await generateWithAI({ magicalGirls, canshou }, generationConfig);

    const reporterInfo = getRandomJournalist();

    const fullReport: NewsReport = {
      ...aiResult,
      reporterInfo: {
        name: reporterInfo.name,
        publication: reporterInfo.publication,
      },
    };

    // 异步更新数据库，不阻塞对用户的响应
    const updatePromise = updateBattleStats(fullReport.officialReport.winner, combatants);
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
    log.error('生成战斗报告时发生顶层错误', {
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