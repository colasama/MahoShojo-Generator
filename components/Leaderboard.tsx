import React from 'react';
import { CharacterRank } from '../pages/api/get-stats';

interface LeaderboardProps {
  title: string;
  data: CharacterRank[];
  presetInfo: Map<string, string>;
}

/**
 * 排行榜组件
 * @param title - 排行榜标题
 * @param data - 排行榜数据
 * @param presetInfo - 预设角色的描述信息
 */
const Leaderboard: React.FC<LeaderboardProps> = ({ title, data, presetInfo }) => (
  <div style={{ padding: '1rem', backgroundColor: 'rgba(255, 255, 255, 0.5)', borderRadius: '0.5rem', boxShadow: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)' }}>
    <h4 style={{ fontWeight: 'bold', color: '#374151', textAlign: 'center', marginBottom: '0.5rem' }}>{title}</h4>
    {data && data.length > 0 ? (
      <ol style={{ listStyleType: 'decimal', paddingLeft: '1.5rem', marginTop: '0.25rem', fontSize: '0.875rem', color: '#1f2937' }}>
        {data.map((item, index) => (
          <li 
            key={index} 
            style={{ 
              overflow: 'hidden', 
              textOverflow: 'ellipsis', 
              whiteSpace: 'nowrap',
              marginBottom: '0.25rem'
            }} 
            title={`${item.name}${item.is_preset ? ` (${presetInfo.get(item.name)})` : ''}`}
          >
            <span style={{ fontWeight: '600' }}>{item.name}</span>
            {item.is_preset && <span style={{ fontSize: '0.75rem', color: '#7c3aed', marginLeft: '0.25rem' }}>[预设]</span>}
            <span style={{ float: 'right', color: '#4b5563' }}>{item.value}</span>
          </li>
        ))}
      </ol>
    ) : (
      <p style={{ fontSize: '0.75rem', color: '#6b7280', textAlign: 'center' }}>暂无数据</p>
    )}
  </div>
);

export default Leaderboard;