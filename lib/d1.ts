// D1 数据库配置
const D1_DATABASE_ID = process.env.D1_DATABASE_ID;
const D1_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const CLOUDFLARE_DATABASE_URL = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/d1/database/${D1_DATABASE_ID}/query`;

// 生成 32 位包含大小写字母和数字的随机字符串
function generateRandomId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

async function query(sql: string, params: unknown[] = []): Promise<Response> {
  if (!D1_API_TOKEN || !CLOUDFLARE_ACCOUNT_ID || !D1_DATABASE_ID) {
    throw new Error("缺少 Cloudflare 配置信息，跳过 D1 查询");
  }

  return await fetch(CLOUDFLARE_DATABASE_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${D1_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sql,
      params,
    }),
  });
}

// 保存数据到 D1 数据库，使用自定义 32 位随机字符串 ID 并返回 ID
export async function createWithCustomId(data: string, table: string): Promise<string | null> {
  try {
    if (!D1_API_TOKEN || !CLOUDFLARE_ACCOUNT_ID || !D1_DATABASE_ID) {
      console.warn("缺少 Cloudflare 配置信息，跳过 D1 保存");
      return null;
    }

    const customId = generateRandomId();
    const timestamp = new Date().toISOString();
    
    const response = await query(
      `INSERT INTO ${table} (id, data, created_at, updated_at) VALUES (?, ?, ?, ?)`,
      [customId, data, timestamp, timestamp]
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`D1 API 错误: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const result = await response.json();
    // 如果插入成功，返回自定义 ID
    if (result.success) {
      return customId;
    }
    
    return null;
  } catch (error) {
    console.error("保存到 D1 数据库失败:", error);
    return null;
  }
}

// 根据 ID 更新数据库记录的函数
export async function updateById(id: string, data: string, table: string): Promise<boolean> {
  try {
    if (!D1_API_TOKEN || !CLOUDFLARE_ACCOUNT_ID || !D1_DATABASE_ID) {
      console.warn("缺少 Cloudflare 配置信息，跳过 D1 更新");
      return false;
    }

    const timestamp = new Date().toISOString();
    
    const response = await query(
      `UPDATE ${table} SET data = ?, updated_at = ? WHERE id = ?`,
      [data, timestamp, id]
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`D1 API 错误: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const result = await response.json();
    // 检查是否有记录被更新
    if (result.success && result.result && result.result.length > 0) {
      const changes = result.result[0].meta?.changes || 0;
      return changes > 0;
    }
    
    return false;
  } catch (error) {
    console.error("更新 D1 数据库失败:", error);
    return false;
  }
}

export async function getRecordById(id: string, table: string): Promise<unknown> {
  try {
    const response = await query(`SELECT * FROM ${table} WHERE id = ?`, [id]);
    if (response.ok) {
      const result = await response.json();
      if (result.result && result.result.length > 0) {
        return result.result[0].results[0];
      }
    }
    return null;
  } catch (error) {
    console.error("从 D1 数据库查询失败:", error);
    throw error;
  }
}

// @deprecated 保存到 D1 数据库的函数
export async function saveToD1(data: unknown): Promise<boolean> {
  try {
    if (!D1_API_TOKEN || !CLOUDFLARE_ACCOUNT_ID || !D1_DATABASE_ID) {
      console.warn("缺少 Cloudflare 配置信息，跳过 D1 保存");
      return false;
    }

    const timestamp = new Date().toISOString();
    const dataString = JSON.stringify(data);
    const response = await query(
      "INSERT INTO shojo (data, created_at) VALUES (?, ?)",
      [dataString, timestamp]
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`D1 API 错误: ${response.status} ${response.statusText} - ${errorText}`);
    }
    return true;
  } catch (error) {
    console.error("保存到 D1 数据库失败:", error);
    // 不抛出错误，避免影响主要生成流程
    return false;
  }
}

// 从 D1 数据库直接执行 SQL 语句
export async function queryFromD1(sql: string, params: unknown[] = []): Promise<unknown> {
  try {
    if (!D1_API_TOKEN || !CLOUDFLARE_ACCOUNT_ID) {
      throw new Error("缺少 Cloudflare API Token 或 Account ID");
    }

    const response = await query(
      sql,
      params
    );

    if (!response.ok) {
      throw new Error(`D1 API 错误: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error("从 D1 数据库查询失败:", error);
    throw error;
  }
}

/*
需要在 Cloudflare D1 的控制台执行以下 SQL 语句来创建竞技场所需数据表：
-- 角色统计表
-- 用于记录每个参战角色的胜、负、参战次数等信息
CREATE TABLE IF NOT EXISTS characters (
  name TEXT PRIMARY KEY NOT NULL,         -- 魔法少女的名字/代号，作为唯一标识
  is_preset BOOLEAN NOT NULL DEFAULT 0, -- 是否是预设角色 (1 for true, 0 for false)
  wins INTEGER NOT NULL DEFAULT 0,        -- 胜利次数
  losses INTEGER NOT NULL DEFAULT 0,      -- 失败次数
  participations INTEGER NOT NULL DEFAULT 0 -- 总参战次数
);

-- 战斗记录表
-- 用于记录每一场战斗的概要信息
CREATE TABLE IF NOT EXISTS battles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,      -- 唯一ID
  winner_name TEXT NOT NULL,               -- 胜利者名字 (如果是平局，可以存 "平局")
  participants_json TEXT NOT NULL,         -- 参战者列表 (JSON数组格式)
  created_at TEXT NOT NULL                 -- 战斗发生时间
);

-- 新增的测试数据表，使用 32 位随机字符串 ID
-- 用于测试自定义 ID 插入功能
CREATE TABLE IF NOT EXISTS player_data (
  id TEXT PRIMARY KEY NOT NULL,           -- 32位随机字符串ID
  data TEXT NOT NULL,                      -- JSON格式的数据
  created_at TEXT NOT NULL                 -- 创建时间
  updated_at TEXT NOT NULL                 -- 更新时间
);

请不要忘记在 Cloudflare D1 的控制台执行上述 SQL 语句来创建竞技场所需的 characters 和 battles 数据表，
以及新增的 shojo_custom 数据表。
如果缺少了这些表，相关 API 将会失败。
*/