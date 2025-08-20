// types/arena.d.ts

/**
 * @fileoverview 定义与魔法少女竞技场和角色成长相关的类型。
 */

/**
 * 历战记录中的单个事件条目。
 * 对应 SRS 3.1.2 节。
 */
export interface ArenaHistoryEntry {
  id: number; // 从 1 开始自增
  type: 'daily' | 'kizuna' | 'classic' | 'scenario' | 'sublimation';
  title: string;
  participants: string[];
  winner: string;
  impact: string; // AI生成的对此角色的影响
  metadata: {
    user_guidance: string | null;
    scenario_title: string | null;
    non_native_data_involved: boolean;
  };
}

/**
 * 完整的历战记录对象。
 * 对应 SRS 3.1.1 节。
 */
export interface ArenaHistory {
  attributes: {
    world_line_id: string; // UUID
    created_at: string; // ISO 8601
    updated_at: string; // ISO 8601
    sublimation_count: number;
    last_sublimation_at: string | null; // ISO 8601
  };
  entries: ArenaHistoryEntry[];
}