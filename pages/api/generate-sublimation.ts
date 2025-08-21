// pages/api/generate-sublimation.ts

import { z } from 'zod';
import { generateWithAI, GenerationConfig } from '../../lib/ai';
import { getLogger } from '../../lib/logger';
import { quickCheck } from '@/lib/sensitive-word-filter';
import { NextRequest } from 'next/server';
import { generateSignature, verifySignature } from '@/lib/signature';
import questionnaire from '../../public/questionnaire.json';

const log = getLogger('api-gen-sublimation');

export const config = {
  runtime: 'edge',
};

// =================================================================
// 1. Zod Schema 定义
// =================================================================

// AI需要返回的升华结果的Schema
// 注意：这里我们不使用完整的角色Schema，因为AI只需要返回可变字段。
// 不可变和半可变字段将在后端逻辑中处理，以确保安全。
const SublimationResultSchema = z.object({
  updatedCharacterData: z.any().describe("一个JSON对象，包含所有被AI更新后的可变字段。例如'appearance', 'analysis', 'magicConstruct'的部分字段等。"),
  sublimationEvent: z.object({
    title: z.string().describe("描述本次升华事件的标题，例如‘在XX之战后，XX领悟了新的力量’。"),
    impact: z.string().describe("对本次升华事件的详细描述。可以包含角色是如何从过往经历中获得成长，最终蜕变到新状态的过程。内容可以比竞技场的impact更丰富。")
  }).describe("描述角色如何升华的事件。")
}).describe("基于角色完整经历生成的升华后设定。");


// =================================================================
// 2. AI Prompt 配置
// =================================================================

const createGenerationConfig = (
  characterData: any,
  questions: string[]
): GenerationConfig<z.infer<typeof SublimationResultSchema>, any> => {

  const characterType = characterData.codename ? '魔法少女' : '残兽';
  const nameField = characterType === '魔法少女' ? 'codename' : 'name';
  const immutableFields = characterType === '魔法少女'
    ? "`magicConstruct.name`, `wonderlandRule`, `blooming`"
    : "无";

  const promptBuilder = () => {
    const dataForPrompt = { ...characterData };
    delete dataForPrompt.signature;
    const history = dataForPrompt.arena_history?.entries || [];

    const historyText = history.length > 0
      ? history.map((entry: any) => `- 事件“${entry.title}”：胜利者是${entry.winner}，对我的影响是“${entry.impact}”`).join('\n')
      : "无";
    
    // 为 AI 提供问卷上下文
    const userAnswersText = (dataForPrompt.userAnswers && Array.isArray(dataForPrompt.userAnswers)) 
        ? dataForPrompt.userAnswers.map((answer: string, i: number) => `Q: ${questions[i] || `问题 ${i+1}`}\nA: ${answer}`).join('\n')
        : "无问卷回答记录。";

    const prompt = `
# 角色成长升华任务

你是一位资深的角色设定师。你的任务是为一个${characterType}进行“成长升华”。
该角色经历了诸多事件，现在需要你基于其完整的设定和所有“历战记录”，对其进行一次全面的重塑和升级，以体现其成长与蜕变。

## 原始角色设定
\`\`\`json
${JSON.stringify(dataForPrompt, null, 2)}
\`\`\`

## 历战记录回顾
${historyText}

## 问卷回答回顾 (用于理解角色深层性格)
${userAnswersText}

## 升华规则
你必须严格遵守以下规则来更新角色设定：

1.  **核心身份不变**:
    * **不可变字段**: 绝对不能修改以下字段的内容：${immutableFields}。
    * **半可变字段**: \`${nameField}\` 字段。该字段的结构为 \`{代号/名称}\` 或 \`{代号/名称}「{称号}」\`。你 **不可** 修改 \`{代号/名称}\` 部分，但 **必须** 为其生成或更新一个4个字左右（1~8个字）的 \`{称号}\`，并以「」包裹，以体现其新状态。

2.  **体现成长**:
    * **可变字段**: 除了上述字段外，其他所有字段（如 \`appearance\`, \`magicConstruct\` (除name外), \`analysis\`, \`userAnswers\` 等）都可以被你重写，以反映角色从历战记录中的成长、感悟和变化。
    * 请确保更新后的设定在逻辑上与角色的经历自洽。

3.  **生成升华事件**:
    * 你还需要创作一个“升华事件”，简要描述角色是如何从这些经历中收获成长，升华到新状态的。

请严格按照提供的JSON Schema格式返回结果。
`;
    return prompt;
  };

  return {
    systemPrompt: "你是一位资深的角色设定师，擅长根据角色的经历描绘其成长与蜕变。",
    temperature: 0.7,
    promptBuilder,
    schema: SublimationResultSchema,
    taskName: "角色成长升华",
    maxTokens: 8192,
  };
};

/**
 * 安全地深度合并两个对象。
 * @param target 目标对象
 * @param source 源对象
 * @returns 合并后的新对象
 */
function safeDeepMerge(target: any, source: any): any {
    const output = { ...target };
    if (isObject(target) && isObject(source)) {
        Object.keys(source).forEach(key => {
            if (isObject(source[key])) {
                if (!(key in target)) {
                    Object.assign(output, { [key]: source[key] });
                } else {
                    output[key] = safeDeepMerge(target[key], source[key]);
                }
            } else {
                Object.assign(output, { [key]: source[key] });
            }
        });
    }
    return output;
}

function isObject(item: any): boolean {
    return (item && typeof item === 'object' && !Array.isArray(item));
}

// =================================================================
// 3. API Handler
// =================================================================

async function handler(req: NextRequest): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  try {
    const originalCharacterData = await req.json();

    if ((await quickCheck(JSON.stringify(originalCharacterData))).hasSensitiveWords) {
      return new Response(JSON.stringify({ error: '输入内容不合规', shouldRedirect: true }), { status: 400 });
    }

    if (!originalCharacterData.arena_history) {
      return new Response(JSON.stringify({ error: '角色数据缺少历战记录 (arena_history)，无法进行升华' }), { status: 400 });
    }

    const isNative = await verifySignature(originalCharacterData);
    const generationConfig = createGenerationConfig(originalCharacterData, questionnaire.questions);
    const aiResult = await generateWithAI(null, generationConfig);

    // --- 数据整合与处理 ---
    // 【错误修复】确保AI返回的数据是对象格式
    let updatedDataFromAI;
    if (typeof aiResult.updatedCharacterData === 'string') {
        try {
            updatedDataFromAI = JSON.parse(aiResult.updatedCharacterData);
        } catch (e) {
            log.error(`AI返回的updatedCharacterData是字符串但无法解析为JSON：${e}`, { rawString: aiResult.updatedCharacterData });
            throw new Error("AI返回了格式错误的成长数据。");
        }
    } else {
        updatedDataFromAI = aiResult.updatedCharacterData;
    }
    
    if (!isObject(updatedDataFromAI)) {
        throw new Error("AI未生成有效的角色更新数据对象。");
    }

    // 【错误修复】使用安全的深度合并
    const sublimatedData = safeDeepMerge(originalCharacterData, updatedDataFromAI);

    const characterType = originalCharacterData.codename ? '魔法少女' : '残兽';

    // 【SRS 3.2.3】强制确保不可变字段不被修改
    if (characterType === '魔法少女') {
        if (originalCharacterData.magicConstruct?.name) {
            sublimatedData.magicConstruct.name = originalCharacterData.magicConstruct.name;
        }
        if (originalCharacterData.wonderlandRule) {
            sublimatedData.wonderlandRule = originalCharacterData.wonderlandRule;
        }
        if (originalCharacterData.blooming) {
            sublimatedData.blooming = originalCharacterData.blooming;
        }
    }

    // 【SRS 3.2.3】处理半可变字段：称号
    const nameField = characterType === '魔法少女' ? 'codename' : 'name';
    const originalName = (originalCharacterData[nameField] as string).split('「')[0];
    const newNameFromAI = sublimatedData[nameField] as string;
    
    // 提取AI生成的新称号，如果AI直接返回了 `xxx「称号」` 的格式
    let newTitle = newNameFromAI.match(/「(.{1,8})」/)?.[1];
    
    // 如果AI没有返回带括号的格式，而是直接返回了称号
    if (!newTitle && newNameFromAI !== originalName) {
        newTitle = newNameFromAI;
    }

    if (newTitle) {
      sublimatedData[nameField] = `${originalName}「${newTitle.substring(0, 8)}」`;
    } else if (!originalCharacterData[nameField].includes('「')) {
      // 如果AI没有生成任何新称号，且原名没有称号，则添加一个默认称号
      sublimatedData[nameField] = `${originalName}「历战」`;
    } else {
      // 如果AI没生成，但原来有，则保留原来的称号
      sublimatedData[nameField] = originalCharacterData[nameField];
    }


    // 【SRS 3.2.4】历战记录处理
    const oldHistory = originalCharacterData.arena_history.entries || [];
    // 保留所有旧的升华记录
    const newHistory = oldHistory.filter((entry: any) => entry.type === 'sublimation');
    const lastEntryId = oldHistory.length > 0 ? Math.max(...oldHistory.map((e: any) => e.id)) : 0;

    // 添加新的升华事件记录
    newHistory.push({
      id: lastEntryId + 1,
      type: 'sublimation',
      title: aiResult.sublimationEvent.title,
      participants: [sublimatedData.codename || sublimatedData.name],
      winner: sublimatedData.codename || sublimatedData.name,
      impact: aiResult.sublimationEvent.impact,
      metadata: { user_guidance: null, scenario_title: null, non_native_data_involved: !isNative }
    });
    sublimatedData.arena_history.entries = newHistory;

    // 【SRS 3.2.5】属性更新
    const nowISO = new Date().toISOString();
    sublimatedData.arena_history.attributes.sublimation_count = (originalCharacterData.arena_history.attributes.sublimation_count || 0) + 1;
    sublimatedData.arena_history.attributes.updated_at = nowISO;
    sublimatedData.arena_history.attributes.last_sublimation_at = nowISO;

    // 【SRS 4.1】签名处理
    if (isNative) {
      sublimatedData.signature = await generateSignature(sublimatedData);
    } else {
      delete sublimatedData.signature;
    }

    return new Response(JSON.stringify(sublimatedData), { status: 200 });

  } catch (error) {
    log.error('成长升华失败', { error });
    const errorMessage = error instanceof Error ? `角色成长升华失败: ${error.message}` : '角色成长升华失败: 发生未知错误';
    return new Response(JSON.stringify({ error: errorMessage, message: errorMessage }), { status: 500 });
  }
}

export default handler;