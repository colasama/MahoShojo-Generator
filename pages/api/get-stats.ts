// pages/api/get-stats.ts

import { type NextRequest } from 'next/server';
import { queryFromD1 } from '../../lib/d1';

export const config = {
  runtime: 'edge',
};

// 定义API返回的数据结构
export interface StatsData {
  totalBattles: number;
  totalParticipants: number;
  winRateRank: CharacterRank[];
  participationRank: CharacterRank[];
  winsRank: CharacterRank[];
  lossesRank: CharacterRank[];
}

export interface CharacterRank {
  name: string;
  is_preset: boolean;
  value: number | string; // 用于显示排行数值
}

async function executeQuery(sql: string, params: any[] = []): Promise<any[]> {
    // 注释：Cloudflare D1 API 的返回格式可能嵌套在 'results' 属性下
    const response = await queryFromD1(sql, params) as { results?: any[] };
    // 有时它也在 'result' -> 'results'
    if (response.results) {
      return response.results;
    }
    // 兼容旧的或不同的返回格式
    const legacyResponse = response as any;
    if (legacyResponse.result && Array.isArray(legacyResponse.result)) {
        return legacyResponse.result;
    }
    return [];
}


// 注释：已将 handler 从 (req: NextApiRequest, res: NextApiResponse) 修改为 (req: NextRequest)
// 这是为了兼容 Cloudflare Edge Runtime，它使用标准的 Web API Request 和 Response 对象。
export default async function handler(
  req: NextRequest
) {
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    // -- 1. 获取总览数据 --
    const totalBattlesResult = await executeQuery("SELECT COUNT(*) as count FROM battles;");
    const totalParticipantsResult = await executeQuery("SELECT SUM(participations) as count FROM characters;");

    const totalBattles = totalBattlesResult[0]?.count || 0;
    const totalParticipants = totalParticipantsResult[0]?.count || 0;

    // -- 2. 获取排行榜数据 (各取前5名) --
    const limit = 5;

    // 胜率榜 (至少参与3场)
    const winRateRank = await executeQuery(
      "SELECT name, is_preset, wins, participations FROM characters WHERE participations >= 3 ORDER BY (CAST(wins AS REAL) / participations) DESC, wins DESC LIMIT ?;",
      [limit]
    );

    // 参战榜
    const participationRank = await executeQuery(
      "SELECT name, is_preset, participations FROM characters ORDER BY participations DESC LIMIT ?;",
      [limit]
    );

    // 胜场榜
    const winsRank = await executeQuery(
      "SELECT name, is_preset, wins FROM characters ORDER BY wins DESC LIMIT ?;",
      [limit]
    );

    // 败场榜 (或称“劳模榜”)
    const lossesRank = await executeQuery(
      "SELECT name, is_preset, losses FROM characters ORDER BY losses DESC LIMIT ?;",
      [limit]
    );

    // -- 3. 格式化数据 --
    const responseData: StatsData = {
      totalBattles,
      totalParticipants,
      winRateRank: winRateRank.map(r => ({
        name: r.name,
        is_preset: !!r.is_preset,
        value: r.participations > 0 ? `${((r.wins / r.participations) * 100).toFixed(1)}% (${r.wins}胜)` : '0.0% (0胜)',
      })),
      participationRank: participationRank.map(r => ({
        name: r.name,
        is_preset: !!r.is_preset,
        value: `${r.participations}次`,
      })),
      winsRank: winsRank.map(r => ({
        name: r.name,
        is_preset: !!r.is_preset,
        value: `${r.wins}胜`,
      })),
      lossesRank: lossesRank.map(r => ({
        name: r.name,
        is_preset: !!r.is_preset,
        value: `${r.losses}败`,
      })),
    };

    return new Response(JSON.stringify(responseData), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('获取统计数据失败:', error);
    return new Response(JSON.stringify({ error: '无法加载统计数据' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}