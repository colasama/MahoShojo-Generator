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
    description: "一位神圣而典雅，宛如圣女的魔法少女。",
    filename: "white_lily.json"
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