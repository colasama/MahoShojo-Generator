// pages/api/init-database.ts

import { type NextRequest } from 'next/server';
import { queryFromD1 } from '../../lib/d1';

export const config = {
  runtime: 'edge',
};

export default async function handler(req: NextRequest) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    // 创建角色统计表
    const createCharactersTable = `
      CREATE TABLE IF NOT EXISTS characters (
        name TEXT PRIMARY KEY NOT NULL,
        is_preset BOOLEAN NOT NULL DEFAULT 0,
        wins INTEGER NOT NULL DEFAULT 0,
        losses INTEGER NOT NULL DEFAULT 0,
        participations INTEGER NOT NULL DEFAULT 0
      );
    `;

    // 创建战斗记录表
    const createBattlesTable = `
      CREATE TABLE IF NOT EXISTS battles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        winner_name TEXT NOT NULL,
        participants_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `;

    // 执行创建表的SQL语句
    await queryFromD1(createCharactersTable);
    await queryFromD1(createBattlesTable);

    return new Response(JSON.stringify({ 
      success: true, 
      message: '数据库表创建成功' 
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('数据库初始化失败:', error);
    return new Response(JSON.stringify({ 
      error: '数据库初始化失败', 
      details: error instanceof Error ? error.message : '未知错误'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}