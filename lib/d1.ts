// D1 数据库配置
const D1_DATABASE_ID = process.env.D1_DATABASE_ID;
const D1_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;

// 保存到 D1 数据库的函数
export async function saveToD1(data: unknown): Promise<void> {
  try {
    if (!D1_API_TOKEN || !CLOUDFLARE_ACCOUNT_ID || !D1_DATABASE_ID) {
      console.warn("缺少 Cloudflare 配置信息，跳过 D1 保存");
      return;
    }

    const timestamp = new Date().toISOString();
    const dataString = JSON.stringify(data);
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/d1/database/${D1_DATABASE_ID}/query`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${D1_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sql: "INSERT INTO shojo (data, created_at) VALUES (?, ?)",
          params: [dataString, timestamp],
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`D1 API 错误: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const result = await response.json();
    // console.log("成功保存到 D1 数据库:", result);
  } catch (error) {
    console.error("保存到 D1 数据库失败:", error);
    // 不抛出错误，避免影响主要生成流程
  }
}

// 从 D1 数据库查询数据的函数
export async function queryFromD1(sql: string, params: unknown[] = []): Promise<unknown> {
  try {
    if (!D1_API_TOKEN || !CLOUDFLARE_ACCOUNT_ID) {
      throw new Error("缺少 Cloudflare API Token 或 Account ID");
    }

    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/d1/database/${D1_DATABASE_ID}/query`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${D1_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sql,
          params,
        }),
      }
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