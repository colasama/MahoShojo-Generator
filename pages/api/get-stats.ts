// pages/api/get-stats.ts

import { type NextRequest } from 'next/server';
import { queryFromD1 } from '../../lib/d1';
import { config as appConfig } from '../../lib/config'; // 导入应用配置

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
  try {
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
  } catch (error) {
    console.error('数据库查询失败:', error);
    // 如果是表不存在的错误，返回空数组而不是抛出错误
    if (error instanceof Error && error.message.includes('no such table')) {
      console.warn('数据库表不存在，返回空数据');
      return [];
    }
    throw error;
  }
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
    // --- 新增：根据配置生成 SQL 筛选条件 ---
    // 从配置中读取排行榜模式
    const leaderboardMode = appConfig.LEADERBOARD_MODE;
    let filterClause = '';
    // is_preset 在数据库中是布尔值 (0 or 1)
    if (leaderboardMode === 'preset') {
      filterClause = 'WHERE is_preset = 1';
    } else if (leaderboardMode === 'user') {
      filterClause = 'WHERE is_preset = 0';
    }
    // 如果是 'all'，则 filterClause 为空字符串，查询所有角色

    // -- 1. 获取总览数据 (总览数据不受筛选影响) --
    const totalBattlesResult = await executeQuery("SELECT COUNT(*) as count FROM battles;");
    const totalParticipantsResult = await executeQuery("SELECT SUM(participations) as count FROM characters;");

    const totalBattles = totalBattlesResult[0]?.count || 0;
    const totalParticipants = totalParticipantsResult[0]?.count || 0;

    // -- 2. 获取排行榜数据 (各取前5名) --
    const limit = 5;

    // 胜率榜 (至少参与3场)
    // 注释：这里需要将筛选条件与原有的 'participations >= 3' 结合
    const winRateFilter = filterClause
      ? `${filterClause} AND participations >= 3`
      : 'WHERE participations >= 3';

    const winRateRank = await executeQuery(
      `SELECT name, is_preset, wins, participations FROM characters ${winRateFilter} ORDER BY (CAST(wins AS REAL) / participations) DESC, wins DESC LIMIT ?;`,
      [limit]
    );

    // 参战榜
    const participationRank = await executeQuery(
      `SELECT name, is_preset, participations FROM characters ${filterClause} ORDER BY participations DESC LIMIT ?;`,
      [limit]
    );

    // 胜场榜
    const winsRank = await executeQuery(
      `SELECT name, is_preset, wins FROM characters ${filterClause} ORDER BY wins DESC LIMIT ?;`,
      [limit]
    );

    // 败场榜 (或称“劳模榜”)
    const lossesRank = await executeQuery(
      `SELECT name, is_preset, losses FROM characters ${filterClause} ORDER BY losses DESC LIMIT ?;`,
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

    // 检查是否所有排行榜都为空（可能表示数据库未初始化）
    const hasAnyData = totalBattles > 0 || totalParticipants > 0 ||
      winRateRank.length > 0 || participationRank.length > 0 ||
      winsRank.length > 0 || lossesRank.length > 0;

    if (!hasAnyData) {
      // 添加初始化提示
      (responseData as any).needsInitialization = true;
    }

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