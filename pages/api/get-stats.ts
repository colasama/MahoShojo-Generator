import { type NextApiRequest, type NextApiResponse } from 'next';
import { queryFromD1 } from '../../lib/d1';

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
    // @ts-ignore D1Result 类型可能不完全匹配，但结构是兼容的
    const result: { results?: any[] } = await queryFromD1(sql, params);
    return result.results || [];
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<StatsData | { error: string }>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
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
        value: `${((r.wins / r.participations) * 100).toFixed(1)}% (${r.wins}胜)`,
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

    res.status(200).json(responseData);
  } catch (error) {
    console.error('获取统计数据失败:', error);
    res.status(500).json({ error: '无法加载统计数据' });
  }
}