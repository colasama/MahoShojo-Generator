import { NextRequest } from 'next/server';
import { getLogger } from '../../lib/logger';
import { generateSignature } from '../../lib/signature';

// 直接导入JSON文件，这在Edge Runtime中是支持的
import mgCodenameAppearance from '../../public/random-assets/magical-girl/codename_appearance.json';
import mgMagicConstruct from '../../public/random-assets/magical-girl/magicConstruct.json';
import mgWonderlandRule from '../../public/random-assets/magical-girl/wonderlandRule.json';
import mgBlooming from '../../public/random-assets/magical-girl/blooming.json';
import mgAnalysis from '../../public/random-assets/magical-girl/analysis.json';

import canshouNameAppearance from '../../public/random-assets/canshou/name_appearance.json';
import canshouCore from '../../public/random-assets/canshou/core.json';
import canshouStage from '../../public/random-assets/canshou/stage.json';
import canshouAbilities from '../../public/random-assets/canshou/abilities.json';
import canshouLore from '../../public/random-assets/canshou/lore.json';

export const config = {
  runtime: 'edge',
};

const log = getLogger('api-gen-random-char');

/**
 * 从数组中随机选择一个元素。
 * @param arr - 来源数组。
 * @returns 数组中的一个随机元素。
 */
const getRandomElement = <T>(arr: T[]): T => {
  return arr[Math.floor(Math.random() * arr.length)];
};

/**
 * 生成一个随机的魔法少女角色。
 * @returns {Promise<any>} 包含完整设定的魔法少女对象。
 */
const generateRandomMagicalGirl = async (): Promise<any> => {
  const data = {
    ...getRandomElement(mgCodenameAppearance),
    magicConstruct: getRandomElement(mgMagicConstruct),
    wonderlandRule: getRandomElement(mgWonderlandRule),
    blooming: getRandomElement(mgBlooming),
    analysis: getRandomElement(mgAnalysis),
    templateId: "魔法少女/心之花/魔法少女（问卷生成）", // 问卷模板更完整
  };
  const signature = await generateSignature(data);
  return { ...data, signature };
};

/**
 * 生成一个随机的残兽角色。
 * @returns {Promise<any>} 包含完整设定的残兽对象。
 */
const generateRandomCanshou = async (): Promise<any> => {
  const data = {
    ...getRandomElement(canshouNameAppearance),
    ...getRandomElement(canshouCore),
    ...getRandomElement(canshouStage),
    ...getRandomElement(canshouAbilities),
    ...getRandomElement(canshouLore),
    templateId: "魔法少女/心之花/残兽（问卷生成）",
  };
  const signature = await generateSignature(data);
  return { ...data, signature };
};

/**
 * API主处理函数。
 * @param req - NextRequest对象。
 * @returns {Promise<Response>} 返回生成的角色数据或错误信息。
 */
async function handler(req: NextRequest) {
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type');

  try {
    let characterData;
    if (type === 'magical-girl') {
      characterData = await generateRandomMagicalGirl();
    } else if (type === 'canshou') {
      characterData = await generateRandomCanshou();
    } else {
      return new Response(JSON.stringify({ error: 'Invalid type specified. Use "magical-girl" or "canshou".' }), { status: 400 });
    }

    return new Response(JSON.stringify(characterData), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    log.error('随机角色生成失败', { error });
    const errorMessage = error instanceof Error ? error.message : '服务器内部错误';
    return new Response(JSON.stringify({ error: '生成失败', message: errorMessage }), { status: 500 });
  }
}

export default handler;