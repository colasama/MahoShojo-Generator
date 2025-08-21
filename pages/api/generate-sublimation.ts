// pages/api/generate-sublimation.ts

import { z } from 'zod';
import { generateWithAI, GenerationConfig } from '../../lib/ai';
import { getLogger } from '../../lib/logger';
import { quickCheck } from '@/lib/sensitive-word-filter';
import { NextRequest } from 'next/server';
import { generateSignature, verifySignature } from '@/lib/signature';
import magicalGirlQuestionnaire from '../../public/questionnaire.json';


const log = getLogger('api-gen-sublimation');

export const config = {
  runtime: 'edge',
};

// =================================================================
// 1. Zod Schema 定义 (SRS 3.2.2)
// =================================================================

// 为 AI 返回的可变字段定义严格的 Schema，不再使用 z.any()
// Schema for Magical Girl Sublimation
const MagicalGirlSublimationPayloadSchema = z.object({
  codename: z.string().describe("角色的新代号，必须包含原始代号并在后面加上一个「称号」。例如，如果原始代号是'代号'，新代号可以是'代号「称号」'。"),
  appearance: z.object({
    outfit: z.string(),
    accessories: z.string(),
    colorScheme: z.string(),
    overallLook: z.string(),
  }).describe("根据角色经历更新后的外观描述。"),
  magicConstruct: z.object({
    form: z.string().describe("魔装形态的演变。"),
    basicAbilities: z.array(z.string()).describe("基础能力的进化或新增。"),
    description: z.string().describe("对魔装当前状态的全新描述。"),
  }).describe("魔力构装的更新，但名字（name）不能改变。"),
  analysis: z.object({
    personalityAnalysis: z.string().describe("角色经历一系列事件后的性格分析。"),
    abilityReasoning: z.string().describe("能力进化的内在逻辑和原因。"),
    coreTraits: z.array(z.string()).describe("更新后的核心性格关键词。"),
    predictionBasis: z.string().describe("对角色未来发展的预测依据。"),
    background: z.object({
      belief: z.string().describe("角色信念的演变或深化。"),
      bonds: z.string().describe("角色情感羁绊的变化。"),
    }).describe("角色背景故事的演进。")
  }).describe("对角色分析的全面更新。"),
  userAnswers: z.array(z.string()).optional().describe("根据角色的成长，对问卷问题的全新回答。"),
});

// Schema for Canshou Sublimation
const CanshouSublimationPayloadSchema = z.object({
  name: z.string().describe("残兽的新名称，必须包含原始名称并在后面加上一个「称号」。例如，如果原始名称是'名称'，新名称可以是'名称「称号」'。"),
  coreConcept: z.string(),
  coreEmotion: z.string(),
  evolutionStage: z.string(),
  appearance: z.string(),
  materialAndSkin: z.string(),
  featuresAndAppendages: z.string(),
  attackMethod: z.string(),
  specialAbility: z.string(),
  origin: z.string(),
  birthEnvironment: z.string(),
  researcherNotes: z.string().describe("研究员对这次升华的补充笔记。"),
});

// AI需要返回的完整结果的Schema
const SublimationResultSchema = z.object({
  updatedCharacterData: z.union([MagicalGirlSublimationPayloadSchema, CanshouSublimationPayloadSchema])
    .describe("一个JSON对象，包含所有被AI更新后的可变字段。"),
  sublimationEvent: z.object({
    title: z.string().describe("描述本次升华事件的标题。"),
    impact: z.string().describe("对本次升华事件的描述，解释角色是如何被过往经历影响，最终蜕变到新状态的。")
  }).describe("描述角色如何升华的事件。")
});


// =================================================================
// 2. AI Prompt 配置 (SRS 3.2.2)
// =================================================================
const createGenerationConfig = (characterData: any): GenerationConfig<z.infer<typeof SublimationResultSchema>, any> => {
  const isMagicalGirl = !!characterData.codename;
  const characterType = isMagicalGirl ? '魔法少女' : '残兽';
  const nameField = isMagicalGirl ? 'codename' : 'name';

  // 明确定义不可变字段，增强AI指令的约束力
  const immutableFields = isMagicalGirl
    ? "`magicConstruct.name`, `wonderlandRule`, `blooming`"
    : "无";

  const promptBuilder = () => {
    // 移除签名，避免干扰AI
    const dataForPrompt = { ...characterData };
    delete dataForPrompt.signature;

    const historyText = (dataForPrompt.arena_history?.entries || [])
      .map((entry: any) => `- 事件“${entry.title}”：胜利者是${entry.winner}，对我的影响是“${entry.impact}”`)
      .join('\n') || "无";
    
    // [核心修正] 仅当角色是魔法少女时，才处理和展示问卷回答
    let userAnswersReviewSection = "";
    if (isMagicalGirl) {
        const questions = magicalGirlQuestionnaire.questions;
        const userAnswersText = (dataForPrompt.userAnswers && Array.isArray(dataForPrompt.userAnswers)) 
            ? dataForPrompt.userAnswers.map((answer: string, i: number) => `Q: ${questions[i] || `问题 ${i+1}`}\nA: ${answer}`).join('\n')
            : "无问卷回答记录。";
        userAnswersReviewSection = `## 问卷回答回顾 (用于理解角色深层性格)\n${userAnswersText}`;
    }

    return `
# 角色成长升华任务

你是一位资深的角色设定师。你的任务是为一个${characterType}角色进行“成长升华”。
该角色经历了诸多事件，现在需要你基于其完整的设定和所有“历战记录”，对其进行一次全面的重塑和升级，以体现其成长与蜕变。

## 原始角色设定
\`\`\`json
${JSON.stringify(dataForPrompt, null, 2)}
\`\`\`

## 历战记录回顾
${historyText}

${userAnswersReviewSection}

## 升华规则
你必须严格遵守以下规则来更新角色设定：

1.  **核心身份不变**:
    * **不可变字段**: 绝对不能修改以下字段的内容：${immutableFields}。
    * **半可变字段**: \`${nameField}\` 字段。该字段的结构为 \`{代号/名称}\` 或 \`{代号/名称}「{称号}」\`。你 **不可** 修改 \`{代号/名称}\` 部分，但 **必须** 为其生成或更新一个4个字左右（1~8个字）的 \`{称号}\`，并以「」包裹，以体现其新状态。

2.  **体现成长**:
    * **可变字段**: 除了上述字段外，其他所有字段都可以被你重写，以反映角色从历战记录中的成长、感悟和变化。
    * 请确保更新后的设定在逻辑上与角色的经历自洽。

3.  **生成升华事件**:
    * 你还需要创作一个“升华事件”，简要描述角色是如何从这些经历中收获成长，升华到新状态的。

请严格按照提供的JSON Schema格式返回结果。
`;
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

// =================================================================
// 3. 辅助函数
// =================================================================
/**
 * 检查一个值是否为可以遍历的对象（非数组、非null）。
 * @param item - 要检查的值。
 * @returns {boolean} 如果是对象则返回true，否则返回false。
 */
function isObject(item: any): boolean {
    return (item && typeof item === 'object' && !Array.isArray(item));
}

/**
 * 安全地深度合并两个对象。源对象的属性会覆盖目标对象的属性。
 * @param target - 目标对象，将被覆盖。
 * @param source - 源对象，提供更新数据。
 * @returns {any} 返回一个合并后的新对象。
 */
function safeDeepMerge(target: any, source: any): any {
    const output = { ...target };
    if (isObject(target) && isObject(source)) {
        Object.keys(source).forEach(key => {
            if (isObject(source[key]) && key in target && isObject(target[key])) {
                output[key] = safeDeepMerge(target[key], source[key]);
            } else {
                output[key] = source[key];
            }
        });
    }
    return output;
}

/**
 * [新增] 递归比较两个对象，找出在 source 对象中未被改变的字段路径。
 * @param original - 原始对象。
 * @param updated - AI返回的更新对象。
 * @param path - 当前递归路径（内部使用）。
 * @returns {string[]} 返回一个包含未改变字段路径的字符串数组。
 */
function findUnchangedFields(original: any, updated: any, path: string = ''): string[] {
    let unchanged: string[] = [];
    if (!isObject(updated)) {
        return [];
    }
    
    for (const key in original) {
        if (key === 'userAnswers') continue; // 不比较 userAnswers
        if (!isObject(original[key]) || !(key in updated) || JSON.stringify(original[key]) === JSON.stringify(updated[key])) {
            // 如果字段不是对象，或者AI的返回中没有这个字段，或者字段内容完全相同，则视为未更新
            continue;
        }
        
        const newPath = path ? `${path} -> ${key}` : key;
        const subUnchanged = findUnchangedFields(original[key], updated[key], newPath);
        
        if (subUnchanged.length === 0 && JSON.stringify(original[key]) !== JSON.stringify(updated[key])) {
            // 如果所有子字段都变了，那么父字段本身就算是被更新了
        } else if (subUnchanged.length === Object.keys(original[key]).length) {
            // 如果所有子字段都没变，那么父字段就算没变
            unchanged.push(newPath);
        } else {
            // 如果部分子字段变了，那么只记录那些没变的子字段
            unchanged = unchanged.concat(subUnchanged);
        }
    }
    return unchanged;
}


// =================================================================
// 4. API Handler
// =================================================================

async function handler(req: NextRequest): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  try {
    const originalCharacterData = await req.json();

    // 安全检查
    const textToCheck = extractTextForCheck(originalCharacterData);
    if ((await quickCheck(textToCheck)).hasSensitiveWords) {
        return new Response(JSON.stringify({ error: '输入内容不合规', shouldRedirect: true, reason: '上传的角色档案包含危险符文' }), { status: 400 });
    }

    if (!originalCharacterData.arena_history) {
      return new Response(JSON.stringify({ error: '角色数据缺少历战记录 (arena_history)，无法进行升华' }), { status: 400 });
    }

    const isNative = await verifySignature(originalCharacterData);
    const generationConfig = createGenerationConfig(originalCharacterData);
    
    // --- AI 生成 ---
    const aiResult = await generateWithAI(null, generationConfig);
    const updatedDataFromAI = aiResult.updatedCharacterData;

    // --- 数据整合与安全处理 (SRS 3.2.3, 3.2.4, 3.2.5, 4.1) ---
    // 1. 创建一个原始数据的深拷贝作为基础
    const sublimatedData: any = JSON.parse(JSON.stringify(originalCharacterData));

    // 2. [新增] 找出未被AI更新的字段，用于前端提示
    const unchangedFields = findUnchangedFields(originalCharacterData, updatedDataFromAI);

    // 3. 安全地合并AI返回的更新
    for (const key in updatedDataFromAI) {
        if (key in sublimatedData) {
            // 使用类型断言来解决TypeScript的索引签名问题
            sublimatedData[key] = safeDeepMerge(sublimatedData[key], (updatedDataFromAI as any)[key]);
        } else {
            sublimatedData[key] = (updatedDataFromAI as any)[key];
        }
    }

    // 4. 使用类型守卫来区分角色类型并安全地操作
    let finalName: string;
    const isMagicalGirl = 'codename' in originalCharacterData;

    // [修改] 使用 'in' 操作符作为类型守卫，同时检查 originalCharacterData 和 updatedDataFromAI 的类型一致性
    if (isMagicalGirl && 'codename' in updatedDataFromAI) {
        // 强制执行不可变字段规则 (SRS 3.2.3)
        sublimatedData.magicConstruct.name = originalCharacterData.magicConstruct.name;
        sublimatedData.wonderlandRule = originalCharacterData.wonderlandRule;
        sublimatedData.blooming = originalCharacterData.blooming;

        // [增强] 处理半可变字段：称号 (SRS 3.2.2)
        const originalFullName = originalCharacterData.codename as string;
        const originalBaseName = originalFullName.split('「')[0];
        const newNameFromAI = updatedDataFromAI.codename as string; // 此处现在是类型安全的
        
        const newTitleMatch = newNameFromAI.match(/「(.{1,8})」/);
        if (newTitleMatch && newTitleMatch[1]) {
          sublimatedData.codename = `${originalBaseName}「${newTitleMatch[1]}」`;
        } else {
          if (!originalFullName.includes('「')) {
            sublimatedData.codename = `${originalBaseName}「历战」`;
          } else {
            sublimatedData.codename = originalFullName;
          }
          log.warn('AI未能为魔法少女生成新称号，已执行回退逻辑。', { originalName: originalFullName, aiName: newNameFromAI });
        }
        finalName = sublimatedData.codename;

    } else if (!isMagicalGirl && 'name' in updatedDataFromAI) { // 是残兽
        const originalFullName = originalCharacterData.name as string;
        const originalBaseName = originalFullName.split('「')[0];
        const newNameFromAI = updatedDataFromAI.name as string; // 此处现在是类型安全的

        const newTitleMatch = newNameFromAI.match(/「(.{1,8})」/);
        if (newTitleMatch && newTitleMatch[1]) {
            sublimatedData.name = `${originalBaseName}「${newTitleMatch[1]}」`;
        } else {
            if (!originalFullName.includes('「')) {
                sublimatedData.name = `${originalBaseName}「历战」`;
            } else {
                sublimatedData.name = originalFullName;
            }
            log.warn('AI未能为残兽生成新称号，已执行回退逻辑。', { originalName: originalFullName, aiName: newNameFromAI });
        }
        finalName = sublimatedData.name;
    } else {
        // 增加一个错误处理，防止AI返回了错误类型的角色数据
        log.error("AI返回的角色类型与原始角色类型不匹配", { isMagicalGirl, aiResponse: updatedDataFromAI });
        throw new Error("AI返回的角色类型与原始角色类型不匹配。");
    }

    // 5. 更新历战记录 (SRS 3.2.4)
    const oldEntries = originalCharacterData.arena_history.entries || [];
    const sublimationEntries = oldEntries.filter((entry: any) => entry.type === 'sublimation');
    const lastEntryId = oldEntries.length > 0 ? Math.max(...oldEntries.map((e: any) => e.id)) : 0;

    sublimationEntries.push({
      id: lastEntryId + 1,
      type: 'sublimation',
      title: aiResult.sublimationEvent.title,
      participants: [finalName],
      winner: finalName,
      impact: aiResult.sublimationEvent.impact,
      metadata: { user_guidance: null, scenario_title: null, non_native_data_involved: !isNative }
    });
    sublimatedData.arena_history.entries = sublimationEntries;

    // 6. 更新历战记录属性 (SRS 3.2.5)
    const nowISO = new Date().toISOString();
    sublimatedData.arena_history.attributes.sublimation_count = (originalCharacterData.arena_history.attributes.sublimation_count || 0) + 1;
    sublimatedData.arena_history.attributes.updated_at = nowISO;
    sublimatedData.arena_history.attributes.last_sublimation_at = nowISO;

    // 7. 签名处理 (SRS 4.1)
    if (isNative) {
      sublimatedData.signature = await generateSignature(sublimatedData);
    } else {
      delete sublimatedData.signature;
    }

    // 如果角色是残兽，确保最终数据中不包含 userAnswers，以防万一
    if (!isMagicalGirl) {
        delete (updatedDataFromAI as any).userAnswers;
    }

    // 8. 构造新的API响应体
    const finalResponse = {
        sublimatedData,
        unchangedFields
    };

    return new Response(JSON.stringify(finalResponse), { status: 200 });

  } catch (error) {
    log.error('成长升华失败', { error });
    const errorMessage = error instanceof Error ? `角色成长升华失败: ${error.message}` : '角色成长升华失败: 发生未知错误';
    return new Response(JSON.stringify({ error: errorMessage, message: errorMessage }), { status: 500 });
  }
}

// 递归提取对象中所有字符串值的函数，用于敏感词检查
const extractTextForCheck = (data: any): string => {
    let textContent = '';
    if (typeof data === 'string') {
        textContent += data + ' ';
    } else if (Array.isArray(data)) {
        data.forEach(item => {
            textContent += extractTextForCheck(item);
        });
    } else if (typeof data === 'object' && data !== null) {
        for (const key in data) {
            // 排除签名和答案存档，这些不是用户生成内容，避免误判
            if (key !== 'signature' && key !== 'userAnswers') {
                textContent += extractTextForCheck(data[key]);
            }
        }
    }
    return textContent;
};

export default handler;