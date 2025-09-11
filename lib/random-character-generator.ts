// lib/random-character-generator.ts

/**
 * @fileoverview 客户端随机角色生成工具。
 * 该模块将原有的后端API逻辑迁移至客户端，以避免API速率限制问题。
 * 功能包括生成随机魔法少女、随机残兽，并为生成的数据附加原生签名。
 */

import { generateSignature } from './signature';

// 导入所有需要的预设素材库JSON文件
import mgCodenameAppearance from '../public/random-assets/magical-girl/codename_appearance.json';
import mgMagicConstruct from '../public/random-assets/magical-girl/magicConstruct.json';
import mgWonderlandRule from '../public/random-assets/magical-girl/wonderlandRule.json';
import mgBlooming from '../public/random-assets/magical-girl/blooming.json';
import mgAnalysis from '../public/random-assets/magical-girl/analysis.json';

import canshouNameAppearance from '../public/random-assets/canshou/name_appearance.json';
import canshouCore from '../public/random-assets/canshou/core.json';
import canshouStage from '../public/random-assets/canshou/stage.json';
import canshouAbilities from '../public/random-assets/canshou/abilities.json';
import canshouLore from '../public/random-assets/canshou/lore.json';

/**
 * 从数组中随机选择一个元素。
 * 这是一个通用的辅助函数。
 * @param arr - 来源数组。
 * @returns 数组中的一个随机元素。
 */
const getRandomElement = <T>(arr: T[]): T => {
  if (!arr || arr.length === 0) {
    // 在数组为空或未定义时返回一个空对象，防止运行时错误
    return {} as T;
  }
  return arr[Math.floor(Math.random() * arr.length)];
};

/**
 * 异步生成一个包含完整设定的随机魔法少女对象。
 * 该函数在客户端执行，生成后会附加原生签名。
 * @returns {Promise<any>} 返回一个包含签名和完整设定的魔法少女对象。
 */
export const generateRandomMagicalGirl = async (): Promise<any> => {
  // 1. 从各个JSON模块中随机抽取部分来组合成一个完整的角色
  const data = {
    ...getRandomElement(mgCodenameAppearance),
    magicConstruct: getRandomElement(mgMagicConstruct),
    wonderlandRule: getRandomElement(mgWonderlandRule),
    blooming: getRandomElement(mgBlooming),
    analysis: getRandomElement(mgAnalysis),
    // 2. 附加模板ID，使其结构与问卷生成的高级角色保持一致
    templateId: "魔法少女/心之花/魔法少女（问卷生成）",
  };
  
  // 3. 为生成的角色数据生成原生签名
  const signature = await generateSignature(data);
  
  // 4. 返回包含签名和所有数据的最终对象
  return { ...data, signature };
};

/**
 * 异步生成一个包含完整设定的随机残兽对象。
 * 该函数在客户端执行，生成后会附加原生签名。
 * @returns {Promise<any>} 返回一个包含签名和完整设定的残兽对象。
 */
export const generateRandomCanshou = async (): Promise<any> => {
  // 1. 从各个JSON模块中随机抽取部分来组合成一个完整的角色
  const data = {
    ...getRandomElement(canshouNameAppearance),
    ...getRandomElement(canshouCore),
    ...getRandomElement(canshouStage),
    ...getRandomElement(canshouAbilities),
    ...getRandomElement(canshouLore),
    // 2. 附加模板ID
    templateId: "魔法少女/心之花/残兽（问卷生成）",
  };

  // 3. 为生成的角色数据生成原生签名
  const signature = await generateSignature(data);

  // 4. 返回包含签名和所有数据的最终对象
  return { ...data, signature };
};