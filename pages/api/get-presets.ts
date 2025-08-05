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

// 预设角色列表 - 在 Edge Runtime 中无法读取文件系统，可以使用 fetch 获取
const PRESET_LIST: PresetMagicalGirl[] = [];

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