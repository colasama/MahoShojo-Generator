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
    
    const userAnswersText = (dataForPrompt.userAnswers || []).map((answer: string, i: number) => `Q: ${questions[i]}\nA: ${answer}`).join('\n');

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
    * **半可变字段**: \`${nameField}\` 字段。该字段的结构为 \`{代号/名称}\` 或 \`{代号/名称}「{称号}」\`。你 **不可** 修改 \`{代号/名称}\` 部分，但 **必须** 为其生成或更新一个4个字左右（最多8个字）的 \`{称号}\`，并以「」包裹，以体现其新状态。例如，如果原名是“翠雀”，升华后可以是“翠雀「命运织者」”。

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

// =================================================================
// 3. API Handler
// =================================================================

async function handler(req: NextRequest): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  try {
    const originalCharacterData = await req.json();

    // 安全检查
    if ((await quickCheck(JSON.stringify(originalCharacterData))).hasSensitiveWords) {
      return new Response(JSON.stringify({ error: '输入内容不合规', shouldRedirect: true }), { status: 400 });
    }

    if (!originalCharacterData.arena_history) {
      return new Response(JSON.stringify({ error: '角色数据缺少历战记录 (arena_history)，无法进行升华' }), { status: 400 });
    }

    const isNative = await verifySignature(originalCharacterData);

    // 调用AI生成升华结果
    const generationConfig = createGenerationConfig(originalCharacterData, questionnaire.questions);
    const aiResult = await generateWithAI(null, generationConfig);

    // --- 数据整合与处理 ---
    const sublimatedData = { ...originalCharacterData, ...aiResult.updatedCharacterData };

    const characterType = originalCharacterData.codename ? '魔法少女' : '残兽';
    const nameField = characterType === '魔法少女' ? 'codename' : 'name';
    
    // 1. 处理半可变字段：称号
    const originalName = (originalCharacterData[nameField] as string).split('「')[0];
    const newTitle = (sublimatedData[nameField] as string).match(/「(.+)」/)?.[1];
    if (newTitle) {
      sublimatedData[nameField] = `${originalName}「${newTitle}」`;
    } else {
      // 如果AI没有正确生成称号，则保留原名
      sublimatedData[nameField] = originalName;
    }

    // 2. 历战记录处理 (SRS 3.2.4)
    const oldHistory = sublimatedData.arena_history.entries || [];
    const newHistory = oldHistory.filter((entry: any) => entry.type === 'sublimation');
    const lastEntryId = newHistory.length > 0 ? newHistory[newHistory.length - 1].id : oldHistory.length;

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

    // 3. 属性更新 (SRS 3.2.5)
    const nowISO = new Date().toISOString();
    sublimatedData.arena_history.attributes.sublimation_count += 1;
    sublimatedData.arena_history.attributes.updated_at = nowISO;
    sublimatedData.arena_history.attributes.last_sublimation_at = nowISO;

    // 4. 签名处理 (SRS 4.1)
    if (isNative) {
      sublimatedData.signature = await generateSignature(sublimatedData);
    } else {
      delete sublimatedData.signature;
    }

    return new Response(JSON.stringify(sublimatedData), { status: 200 });

  } catch (error) {
    log.error('成长升华失败', { error });
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    return new Response(JSON.stringify({ error: '生成失败', message: errorMessage }), { status: 500 });
  }
}

export default handler;