import { queryFromD1 } from './core';

// 角色战斗统计相关函数

// 获取或创建角色
export async function getOrCreateCharacter(name: string, isPreset: boolean = false): Promise<any> {
  try {
    // 先尝试获取现有角色
    let result = await queryFromD1(
      'SELECT * FROM characters WHERE name = ?',
      [name]
    ) as any;
    
    if (result.success && result.result && result.result[0]?.results?.length > 0) {
      return result.result[0].results[0];
    }
    
    // 如果不存在，创建新角色
    result = await queryFromD1(
      'INSERT INTO characters (name, is_preset) VALUES (?, ?)',
      [name, isPreset ? 1 : 0]
    ) as any;
    
    if (result.success) {
      // 返回新创建的角色
      return {
        name,
        is_preset: isPreset,
        wins: 0,
        losses: 0,
        participations: 0
      };
    }
    return null;
  } catch (error) {
    console.error("获取或创建角色失败:", error);
    return null;
  }
}

// 更新角色战斗统计
export async function updateCharacterStats(
  name: string,
  won: boolean,
  participated: boolean = true
): Promise<boolean> {
  try {
    let sql = 'UPDATE characters SET participations = participations + 1';
    
    if (won) {
      sql += ', wins = wins + 1';
    } else if (participated) {
      sql += ', losses = losses + 1';
    }
    
    sql += ' WHERE name = ?';
    
    const result = await queryFromD1(sql, [name]) as any;
    
    return result.success && result.result && result.result[0]?.meta?.changes > 0;
  } catch (error) {
    console.error("更新角色统计失败:", error);
    return false;
  }
}

// 记录战斗结果
export async function recordBattle(
  winnerName: string,
  participants: string[]
): Promise<number | null> {
  try {
    const timestamp = new Date().toISOString();
    const participantsJson = JSON.stringify(participants);
    
    const result = await queryFromD1(
      'INSERT INTO battles (winner_name, participants_json, created_at) VALUES (?, ?, ?)',
      [winnerName, participantsJson, timestamp]
    ) as any;
    
    if (result.success && result.result) {
      return result.result[0]?.meta?.last_row_id || null;
    }
    return null;
  } catch (error) {
    console.error("记录战斗失败:", error);
    return null;
  }
}

// 获取角色排行榜
export async function getCharacterLeaderboard(limit: number = 10): Promise<any[]> {
  try {
    const result = await queryFromD1(
      'SELECT * FROM characters ORDER BY wins DESC, participations DESC LIMIT ?',
      [limit]
    ) as any;
    
    if (result.success && result.result && result.result[0]?.results) {
      return result.result[0].results;
    }
    return [];
  } catch (error) {
    console.error("获取排行榜失败:", error);
    return [];
  }
}

// 获取最近的战斗记录
export async function getRecentBattles(limit: number = 20): Promise<any[]> {
  try {
    const result = await queryFromD1(
      'SELECT * FROM battles ORDER BY created_at DESC LIMIT ?',
      [limit]
    ) as any;
    
    if (result.success && result.result && result.result[0]?.results) {
      return result.result[0].results;
    }
    return [];
  } catch (error) {
    console.error("获取战斗记录失败:", error);
    return [];
  }
}