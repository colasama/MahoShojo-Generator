// 核心数据库连接和查询功能
const D1_DATABASE_ID = process.env.D1_DATABASE_ID;
const D1_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const CLOUDFLARE_DATABASE_URL = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/d1/database/${D1_DATABASE_ID}/query`;

// 生成 32 位包含大小写字母和数字的随机字符串
export function generateRandomId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// 生成 UUID v4 格式的字符串 (xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx)
export function generateUUID(): string {
  // 使用加密安全的随机数生成器
  const getRandomValues = (arr: Uint8Array) => {
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      return crypto.getRandomValues(arr);
    }
    // Fallback for environments without crypto.getRandomValues
    for (let i = 0; i < arr.length; i++) {
      arr[i] = Math.floor(Math.random() * 256);
    }
    return arr;
  };

  const randomBytes = new Uint8Array(16);
  getRandomValues(randomBytes);
  
  // Set version (4) and variant bits
  randomBytes[6] = (randomBytes[6] & 0x0f) | 0x40; // Version 4
  randomBytes[8] = (randomBytes[8] & 0x3f) | 0x80; // Variant bits
  
  // Convert to hex string with dashes
  const hex = Array.from(randomBytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
    
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32)
  ].join('-');
}

// 核心查询函数
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

// 从 D1 数据库直接执行 SQL 语句
export async function queryFromD1(sql: string, params: unknown[] = []): Promise<unknown> {
  try {
    if (!D1_API_TOKEN || !CLOUDFLARE_ACCOUNT_ID) {
      throw new Error("缺少 Cloudflare API Token 或 Account ID");
    }

    const response = await query(sql, params);

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