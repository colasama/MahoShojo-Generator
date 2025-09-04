// pages/api/generate-sublimation.ts

import { z } from 'zod';
import { generateWithAI, GenerationConfig } from '../../lib/ai';
import { getLogger } from '../../lib/logger';
import { quickCheck } from '@/lib/sensitive-word-filter';
import { NextRequest } from 'next/server';
import { generateSignature, verifySignature } from '@/lib/signature';
import magicalGirlQuestionnaire from '../../public/questionnaire.json';
import { config as appConfig } from '../../lib/config';
import { webcrypto } from 'crypto';

// 兼容 Edge 和 Node.js 环境的 crypto API
const randomUUID = typeof crypto !== 'undefined' ? crypto.randomUUID.bind(crypto) : webcrypto.randomUUID.bind(webcrypto);

const log = getLogger('api-gen-sublimation');

export const config = {
  runtime: 'edge',
};

// =================================================================
// 1. Zod Schema 定义
// =================================================================

// 定义了所有可能被AI修改的字段的基础Schema
const BaseMagicalGirlSublimationPayloadSchema = z.object({
  codename: z.string().describe("角色的新代号，必须包含原始代号并在后面加上一个「称号」。例如，如果原始代号是'代号'，新代号可以是'代号「称号」'。"),
  appearance: z.object({
    outfit: z.string(),
    accessories: z.string(),
    colorScheme: z.string(),
    overallLook: z.string(),
  }).describe("根据角色经历更新后的外观描述。"),
  magicConstruct: z.object({
    form: z.string().describe("魔装形态的演变。"),
    basicAbilities: z.array(z.string()).describe("基础能力的进化或新增，不得重复。"),
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

const BaseCanshouSublimationPayloadSchema = z.object({
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
  userAnswers: z.array(z.string()).optional().describe("根据残兽的成长，对问卷问题的全新回答。"),
});


// 升华事件的通用Schema
const SublimationEventSchema = z.object({
    title: z.string().describe("描述本次升华事件的标题。"),
    impact: z.string().describe("对本次升华事件的描述，解释角色是如何被过往经历影响，最终蜕变到新状态的。")
}).describe("描述角色如何升华的事件。");


/**
 * 核心修改：动态构建Zod Schema的函数。
 * @param baseSchema 基础的Zod Schema。
 * @param fieldsToPreserve 一个字符串数组，包含需要从Schema中移除的字段名。
 * @returns 返回一个新的、移除了指定字段的Zod Schema。
 */
const createDynamicSchema = (baseSchema: z.ZodObject<any>, fieldsToPreserve: string[]) => {
    let dynamicSchema = baseSchema;
    for (const field of fieldsToPreserve) {
        if (field in baseSchema.shape) {
            dynamicSchema = dynamicSchema.omit({ [field]: true });
        }
    }
    // 无论如何，AI都需要生成一个升华事件
    return z.object({
        updatedCharacterData: dynamicSchema.describe("一个JSON对象，包含所有被AI更新后的可变字段。"),
        sublimationEvent: SublimationEventSchema
    });
};

// =================================================================
// 2. AI Prompt 配置
// =================================================================

const createGenerationConfig = (characterData: any, language: string, userGuidance: string | null, fieldsToPreserve: string[]): GenerationConfig<any, any> => {
  const isMagicalGirl = !!characterData.codename;
  const characterType = isMagicalGirl ? '魔法少女' : '残兽';
  const nameField = isMagicalGirl ? 'codename' : 'name';

  // 明确定义不可变字段
  let immutableFields = isMagicalGirl
    ? "`magicConstruct.name`, `wonderlandRule`, `blooming`"
    : "无";
  
  // 将用户选择保留的字段也加入不可变列表
  if (fieldsToPreserve.length > 0) {
      immutableFields += `, 以及用户指定的保留字段: \`${fieldsToPreserve.join('`, `')}\``;
  }

  const promptBuilder = () => {
    const dataForPrompt = { ...characterData };
    delete dataForPrompt.signature;

    const historyText = (dataForPrompt.arena_history?.entries || [])
      .map((entry: any) => `- 事件“${entry.title}”：胜利者是${entry.winner}，对我的影响是“${entry.impact}”`)
      .join('\n') || "无";
    
    let userAnswersReviewSection = "";
    if (isMagicalGirl) {
        const questions = magicalGirlQuestionnaire.questions;
        const userAnswersText = (dataForPrompt.userAnswers && Array.isArray(dataForPrompt.userAnswers)) 
            ? dataForPrompt.userAnswers.map((answer: string, i: number) => `Q: ${questions[i] || `问题 ${i+1}`}\nA: ${answer}`).join('\n')
            : "无问卷回答记录。";
        userAnswersReviewSection = `## 问卷回答回顾 (用于理解角色深层性格)\n${userAnswersText}`;
    }

    let guidanceInstruction = '';
    if (userGuidance) {
      guidanceInstruction = `\n## 成长方向引导\n角色可以朝这个方向成长升华：“${userGuidance}”。请在重塑角色时将此作为最重要的参考。`;
    }

    return `
# 角色成长升华任务
你是一位资深的角色设定师。你的任务是为一个${characterType}角色进行“成长升华”。
该角色经历了诸多事件，现在需要你基于其完整的设定和所有“历战记录”，对其进行一次全面的重塑和升级，以体现其成长与蜕变。

${guidanceInstruction}

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
    * **不可变字段**: 绝对不能修改以下字段的内容：${immutableFields}。在你的JSON输出中，**不要包含**这些字段。
    * **半可变字段**: \`${nameField}\` 字段。该字段的结构为 \`{代号/名称}\` 或 \`{代号/名称}「{称号}」\`。你 **不可** 修改 \`{代号/名称}\` 部分，但 **必须** 为其生成或更新一个4个字左右（1~8个字）的 \`{称号}\`，并以「」包裹，以体现其新状态。

2.  **体现成长**:
    * **可变字段**: 除了上述不可变字段外，其他所有字段都应该被你重写，以反映角色从历战记录中的成长、感悟和变化。
    * 请确保更新后的设定在逻辑上与角色的经历自洽，并且有创意，不得抄袭已有内容。

3.  **生成升华事件**:
    * 你还需要创作一个“升华事件”，简要描述角色是如何从这些经历中收获成长，升华到新状态的。

请严格按照提供的JSON Schema格式返回结果，使用【${language}】进行内容创作。`;
  };

  // 动态选择基础Schema并构建最终Schema
  const baseSchema = isMagicalGirl ? BaseMagicalGirlSublimationPayloadSchema : BaseCanshouSublimationPayloadSchema;
  const finalSchema = createDynamicSchema(baseSchema, fieldsToPreserve);

  return {
    systemPrompt: "你是一位资深的角色设定师，擅长根据角色的经历描绘其成长与蜕变。",
    temperature: 0.7,
    promptBuilder,
    schema: finalSchema,
    taskName: "角色成长升华",
    maxTokens: 8192,
  };
};


// =================================================================
// 3. 辅助函数
// =================================================================

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

// =================================================================
// 4. API Handler
// =================================================================

async function handler(req: NextRequest): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  try {
    const body = await req.json();
    const { language = 'zh-CN', userGuidance = '', fieldsToPreserve = [], ...originalCharacterData } = body; 
    const finalUserGuidance = userGuidance.trim() || null;

    // 安全检查
    const textToCheck = extractTextForCheck(originalCharacterData) + " " + (finalUserGuidance || '');
    if ((await quickCheck(textToCheck)).hasSensitiveWords) {
        return new Response(JSON.stringify({ error: '输入内容不合规', shouldRedirect: true, reason: '上传的角色档案或引导内容包含危险符文' }), { status: 400 });
    }

    if (!originalCharacterData.arena_history) {
      return new Response(JSON.stringify({ error: '角色数据缺少历战记录 (arena_history)，无法进行升华' }), { status: 400 });
    }

    const isNative = await verifySignature(originalCharacterData);
    const generationConfig = createGenerationConfig(originalCharacterData, language, finalUserGuidance, fieldsToPreserve);
    
    const aiResult = await generateWithAI(null, generationConfig);
    const updatedDataFromAI = aiResult.updatedCharacterData;

    // --- 数据整合与安全处理 ---
    let sublimatedData: any = JSON.parse(JSON.stringify(originalCharacterData));

    // 使用安全合并，将AI生成的部分覆盖到原始数据上
    sublimatedData = safeDeepMerge(sublimatedData, updatedDataFromAI);

    // [核心修改] 找出真正被保留的字段，用于前端提示
    const unchangedFields = fieldsToPreserve;

    // 应用不可变字段规则和称号生成逻辑
    const isMagicalGirl = 'codename' in originalCharacterData;
    let finalName: string;

    if (isMagicalGirl) {
      // 强制保留不可变字段
      sublimatedData.magicConstruct.name = originalCharacterData.magicConstruct.name;
      sublimatedData.wonderlandRule = originalCharacterData.wonderlandRule;
      sublimatedData.blooming = originalCharacterData.blooming;
      
      const originalFullName = originalCharacterData.codename as string;
      const originalBaseName = originalFullName.split('「')[0];
      const newNameFromAI = updatedDataFromAI.codename as string;
      const newTitleMatch = newNameFromAI ? newNameFromAI.match(/「(.{1,8})」/) : null;

      if (newTitleMatch && newTitleMatch[1]) {
        sublimatedData.codename = `${originalBaseName}「${newTitleMatch[1]}」`;
      } else {
        sublimatedData.codename = originalFullName.includes('「') ? originalFullName : `${originalBaseName}「历战」`;
      }
      finalName = sublimatedData.codename;
    } else {
      const originalFullName = originalCharacterData.name as string;
      const originalBaseName = originalFullName.split('「')[0];
      const newNameFromAI = updatedDataFromAI.name as string;
      const newTitleMatch = newNameFromAI ? newNameFromAI.match(/「(.{1,8})」/) : null;

      if (newTitleMatch && newTitleMatch[1]) {
        sublimatedData.name = `${originalBaseName}「${newTitleMatch[1]}」`;
      } else {
        sublimatedData.name = originalFullName.includes('「') ? originalFullName : `${originalBaseName}「历战」`;
      }
      finalName = sublimatedData.name;
    }

    // 更新历战记录
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
      metadata: { user_guidance: finalUserGuidance, scenario_title: null, non_native_data_involved: !isNative || !!finalUserGuidance }
    });
    sublimatedData.arena_history.entries = sublimationEntries;

    const nowISO = new Date().toISOString();
    sublimatedData.arena_history.attributes.sublimation_count = (originalCharacterData.arena_history.attributes.sublimation_count || 0) + 1;
    sublimatedData.arena_history.attributes.updated_at = nowISO;
    sublimatedData.arena_history.attributes.last_sublimation_at = nowISO;

    // 签名处理 (SRS 4.1, updated logic)
    // 默认情况下，有引导的升华会失去原生性
    let shouldSign = isNative && !finalUserGuidance;
    // 但是，如果管理员在配置中开启了特例，则即使有引导也进行签名
    if (isNative && finalUserGuidance && appConfig.ALLOW_GUIDED_SUBLIMATION_NATIVE_SIGNING) {
      shouldSign = true;
    }

    if (shouldSign) {
        sublimatedData.signature = await generateSignature(sublimatedData);
    } else {
        delete sublimatedData.signature;
    }

    const finalResponse = {
        sublimatedData,
        unchangedFields
    };

    return new Response(JSON.stringify(finalResponse), { status: 200, headers: { 'Content-Type': 'application/json' } });

  } catch (error) {
    log.error('成长升华失败', { error });
    const errorMessage = error instanceof Error ? `角色成长升华失败: ${error.message}` : '角色成长升华失败: 发生未知错误';
    return new Response(JSON.stringify({ error: errorMessage, message: errorMessage }), { status: 500 });
  }
}

/**
 * 递归提取对象中所有字符串值的函数，用于敏感词检查。
 * @param data 要提取文本的对象。
 * @returns 连接所有字符串值的单个字符串。
 */
const extractTextForCheck = (data: any): string => {
    let textContent = '';
    if (typeof data === 'string') {
        textContent += data + ' ';
    } else if (Array.isArray(data)) {
        data.forEach(item => { textContent += extractTextForCheck(item); });
    } else if (typeof data === 'object' && data !== null) {
        for (const key in data) {
            if (key !== 'signature' && key !== 'userAnswers') {
                textContent += extractTextForCheck(data[key]);
            }
        }
    }
    return textContent;
};

export default handler;