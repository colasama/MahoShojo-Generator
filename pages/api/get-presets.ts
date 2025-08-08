// pages/api/get-presets.ts

import { NextRequest } from 'next/server';

export const config = {
  runtime: 'edge',
};

// 定义预设角色的数据结构
export interface PresetMagicalGirl {
  name: string;
  description: string;
  filename: string;
}

// 预设角色列表 - 在 Edge Runtime 中无法读取文件系统，因此在此处直接定义
// 注释：Edge Runtime 环境没有 NodeJS 的文件系统（fs）模块，无法在运行时动态读取目录。
// 因此，我们将预设角色的列表直接定义在这里。
// 未来如果增加新的预设角色，也需要在此数组中添加对应的条目。
const PRESET_LIST: PresetMagicalGirl[] = [
  {
    name: "白百合",
    description: "测试用角色：神圣典雅的圣女型魔法少女。",
    filename: "white_lily.json"
  },
  {
    name: "翠雀",
    description: "樊笼下的蓝翠雀：身经百战的前辈，外冷内热的魔法少女。",
    filename: "centaurea.json"
  },
  {
    name: "白玫",
    description: "小草包：渴望认可的理想主义者，以“翠雀”为目标努力的成长型新人。",
    filename: "white_rose.json"
  },
  {
    name: "小锦",
    description: "拿最多的信息，打最少的输出：天赋异禀但缺乏安全感的魔法少女，渴望真正的'家'。",
    filename: "little_brocade.json"
  },
  {
    name: "薄雪",
    description: "野兽心境：以治愈之力行复仇之事的战斗天才。",
    filename: "thin_snow.json"
  },
  {
    name: "麻雀",
    description: "牢雀：正被关在调查院地牢里承受挠痒痒酷刑。",
    filename: "sparrow.json"
  },
  {
    name: "玛格丽特",
    description: "调酒师：以情绪为武器的万能'润滑剂'，张扬自信的调查院前辈。",
    filename: "margaret.json"
  },
  {
    name: "朝颜",
    description: "祖母绿的科技与狠活：背负他人身影的'记录者'，活在悔恨与爱恋中的败犬，让人怀疑她是不是有在吃代餐。",
    filename: "asagao.json"
  },
  {
    name: "鸢",
    description: "爪痕兽心：只相信自身技艺的武痴，行走于阴影中的反权威者。",
    filename: "kite.json"
  },
  {
    name: "松花",
    description: "圣地巡礼：热衷圣地巡礼的摸鱼少女，能将回忆凝固为琥珀。",
    filename: "pine_flower.json"
  },
  {
    name: "艾草",
    description: "言出必行：言出法随的靠谱魔法少女，能将记录的话语化为力量。",
    filename: "mugwort.json"
  },
  {
    name: "向日葵",
    description: "旧景重现：追逐大新闻的乐子人，能将照片中的景象再现。",
    filename: "sunflower.json"
  }
  // 如果有更多预设，可以像下面这样继续添加：
  // {
  //   name: "另一位魔法少女",
  //   description: "她的简介",
  //   filename: "another_preset.json"
  // }
];

export default async function handler(req: NextRequest) {
  if (req.method !== 'GET') {
    return new Response(
      JSON.stringify({ error: 'Method Not Allowed' }),
      { status: 405, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    return new Response(
      JSON.stringify(PRESET_LIST),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('获取预设角色失败:', error);
    return new Response(
      JSON.stringify({ error: '无法加载预设角色列表' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}