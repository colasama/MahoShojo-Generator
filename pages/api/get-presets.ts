// pages/api/get-presets.ts

import { NextRequest } from 'next/server';

export const config = {
  runtime: 'edge',
};

// 定义预设角色的数据结构 - 增加 type 字段
export interface Preset {
  name: string;
  description: string;
  filename: string;
  type: 'magical-girl' | 'canshou'; // 新增类型字段
}

// 预设列表 - 在 Edge Runtime 中无法读取文件系统，因此在此处直接定义
// 注释：Edge Runtime 环境没有 NodeJS 的文件系统（fs）模块，无法在运行时动态读取目录。
// 因此，我们将预设角色的列表直接定义在这里。
// 未来如果增加新的预设角色，也需要在此数组中添加对应的条目。
const PRESET_LIST: Preset[] = [
  // 魔法少女
  {
    name: "翠雀",
    description: "樊笼下的蓝翠雀：身经百战的前辈，外冷内热的魔法少女。",
    filename: "M01_centaurea.json",
    type: "magical-girl"
  },
  {
    name: "白玫",
    description: "小草包：渴望认可的理想主义者，以“翠雀”为目标努力的成长型新人。",
    filename: "M02_white_rose.json",
    type: "magical-girl"
  },
  {
    name: "小锦",
    description: "拿最多的信息，打最少的输出：天赋异禀但缺乏安全感的魔法少女，渴望真正的'家'。",
    filename: "M03_little_brocade.json",
    type: "magical-girl"
  },
  {
    name: "薄雪",
    description: "野兽心境：以治愈之力行复仇之事的战斗天才。",
    filename: "M04_boxue.json",
    type: "magical-girl"
  },
  {
    name: "鸢",
    description: "爪痕兽心：只相信自身技艺的武痴，行走于阴影中的反权威者。",
    filename: "M05_kite.json",
    type: "magical-girl"
  },
  {
    name: "麻雀",
    description: "牢雀：正被关在调查院地牢里承受挠痒痒酷刑。",
    filename: "M06_sparrow.json",
    type: "magical-girl"
  },
  {
    name: "玛格丽特",
    description: "调酒师：以情绪为武器的万能'润滑剂'，张扬自信的调查院前辈。",
    filename: "M07_margaret.json",
    type: "magical-girl"
  },
  {
    name: "朝颜",
    description: "科技与狠活：背负他人身影的'记录者'，活在悔恨与爱恋中的败犬，让人怀疑她是不是有在吃代餐。",
    filename: "M08_asagao.json",
    type: "magical-girl"
  },
  {
    name: "松花",
    description: "圣地巡礼：热衷圣地巡礼的摸鱼少女，能将回忆凝固为琥珀。",
    filename: "M09_pine_flower.json",
    type: "magical-girl"
  },
  {
    name: "艾草",
    description: "言出必行：言出法随的靠谱魔法少女，能将记录的话语化为力量。",
    filename: "M10_mugwort.json",
    type: "magical-girl"
  },
  {
    name: "向日葵",
    description: "旧景重现：追逐大新闻的乐子人，能将照片中的景象再现。",
    filename: "M11_sunflower.json",
    type: "magical-girl"
  },
  {
    name: "雪绒",
    description: "大道至简：专打机制怪和说书人，大概是鸢师傅Alter",
    filename: "M12_greatness_in_simplicity.json",
    type: "magical-girl"
  },
  {
    name: "千日红",
    description: "大道至繁：星穹的魔女，大道至简的对立面，头脑简单的莽夫之大敌。",
    filename: "M13_greatness_in_complexity.json",
    type: "magical-girl"
  },
  {
    name: "白百合",
    description: "测试用角色：神圣典雅的圣女型魔法少女。",
    filename: "M00_white_lily.json",
    type: "magical-girl"
  },
  // 如果有更多预设，可以像下面这样继续添加：
  // {
  //   name: "另一位魔法少女",
  //   description: "她的简介",
  //   filename: "another_preset.json"
  // }
  // 残兽
  {
    name: "溶腔型-卵",
    description: "新人杀手：巨大肉块状的初级残兽，能喷射腐蚀性液体。",
    filename: "C01_egg.json",
    type: "canshou"
  },
  {
    name: "双头猎犬-蠖",
    description: "湿地魅影：拥有双头和野兽智慧的敏捷猎手，擅长追猎与夹击。",
    filename: "C02_pupa.json",
    type: "canshou"
  },
  {
    name: "合唱团与舞者-蛹",
    description: "下水道的歌剧：歌声操控一切的巨大鱼形残兽，极度危险的区域控制者。",
    filename: "C03_choir_and_dancer.json",
    type: "canshou"
  },
  {
    name: "血肉蛛网-蛹",
    description: "捕食的巢穴：由血肉构成的巨大蛛网，能扭曲空间并捕获猎物。",
    filename: "C04_flesh_spider_web.json",
    type: "canshou"
  },
  {
    name: "殿前烬卫白蛛-半蜕",
    description: "忠诚的守护者：与人类融合的巨大白色蜘蛛，掌握规则之力的强大战士。",
    filename: "C05_cinder_guard_spider.json",
    type: "canshou"
  },
  {
    name: "蛾-蜕",
    description: "黑夜，黎明：梦幻而致命的巨大飞蛾，拥有完整巢穴与规则的灾难化身。",
    filename: "C06_moth.json",
    type: "canshou"
  },
  {
    name: "归一之璞-蜕",
    description: "大道至简II：或许是尝试融合“大道至简”，却被其本身吞噬的残兽。",
    filename: "C07_returning_to_simplicity.json",
    type: "canshou"
  },
  {
    name: "寂响之虫-蠖",
    description: "苍黑残响：由黑曜石和振动空气构成的巨大蝉蛹，使用声音相关的攻击方式。",
    filename: "C08_silent_worm.json",
    type: "canshou"
  }
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
      JSON.stringify({ error: '无法加载预设列表' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}