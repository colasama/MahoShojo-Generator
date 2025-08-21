// components/CanshouCard.tsx
import React, { useRef, useState } from 'react';
import { snapdom } from '@zumer/snapdom';
import { ArenaHistory, ArenaHistoryEntry } from '@/types/arena';

export interface CanshouDetails {
  name: string;
  coreConcept: string;
  coreEmotion: string;
  evolutionStage: string;
  appearance: string;
  materialAndSkin: string;
  featuresAndAppendages: string;
  attackMethod: string;
  specialAbility: string;
  origin: string;
  birthEnvironment: string;
  researcherNotes: string;
  arena_history?: ArenaHistory;
}

interface CanshouCardProps {
  canshou: CanshouDetails;
  onSaveImage: (imageUrl: string) => void;
}

const CanshouCard: React.FC<CanshouCardProps> = ({ canshou, onSaveImage }) => {
  const cardRef = useRef<HTMLDivElement>(null);
  // 新增：用于控制历战记录可见性的状态
  const [isHistoryVisible, setIsHistoryVisible] = useState(false);

  const handleSaveImage = async () => {
    if (!cardRef.current) return;

    try {
      const saveButton = cardRef.current.querySelector('.save-button') as HTMLElement;
      if (saveButton) saveButton.style.display = 'none';

      const result = await snapdom(cardRef.current, { scale: 1 });

      if (saveButton) saveButton.style.display = 'block';

      const imgElement = await result.toPng();
      onSaveImage(imgElement.src);
    } catch (err) {
      alert('生成图片失败，请重试');
      console.error("Image generation failed:", err);
      const saveButton = cardRef.current?.querySelector('.save-button') as HTMLElement;
      if (saveButton) saveButton.style.display = 'block';
    }
  };

  return (
    <div ref={cardRef} className="result-card" style={{ background: 'linear-gradient(135deg, #434343 0%, #000000 100%)' }}>
      <div className="result-content">
        <div className="flex justify-center">
          <img
            src="/beast-title.svg"
            alt="残兽档案"
            className="w-72 mb-4"
          />
        </div>

        <div className="result-item">
          <div className="result-label">名称</div>
          <div className="result-value">{canshou.name}</div>
        </div>

        <div className="flex">
          <div className="result-item w-full mr-4">
            <div className="result-label">核心概念</div>
            <div className="result-value">{canshou.coreConcept}</div>
          </div>
          <div className="result-item w-full">
            <div className="result-label">核心情感/欲望</div>
            <div className="result-value">{canshou.coreEmotion}</div>
          </div>
        </div>

        <div className="result-item">
          <div className="result-label">进化阶段</div>
          <div className="result-value">{canshou.evolutionStage}</div>
        </div>

        <div className="result-item">
          <div className="result-label">外貌描述</div>
          <div className="result-value text-sm">{canshou.appearance}</div>
        </div>

        <div className="result-item">
          <div className="result-label">材质/表皮</div>
          <div className="result-value text-sm">{canshou.materialAndSkin}</div>
        </div>

        <div className="result-item">
          <div className="result-label">特征/附属物</div>
          <div className="result-value text-sm">{canshou.featuresAndAppendages}</div>
        </div>

        <div className="result-item">
          <div className="result-label">攻击方式</div>
          <div className="result-value text-sm">{canshou.attackMethod}</div>
        </div>

        <div className="result-item">
          <div className="result-label">特殊能力</div>
          <div className="result-value text-sm">{canshou.specialAbility}</div>
        </div>

        <div className="result-item">
          <div className="result-label">起源</div>
          <div className="result-value text-sm">{canshou.origin}</div>
        </div>

        <div className="result-item">
          <div className="result-label">诞生环境</div>
          <div className="result-value text-sm">{canshou.birthEnvironment}</div>
        </div>

        <div className="result-item border-l-4 border-red-400">
          <div className="result-label">研究员笔记</div>
          <div className="result-value text-sm italic">{canshou.researcherNotes}</div>
        </div>
        
        {/* 新增：历战记录展示区 */}
        {canshou.arena_history && canshou.arena_history.entries.length > 0 && (
          <div className="result-item">
            <button onClick={() => setIsHistoryVisible(!isHistoryVisible)} className="result-label w-full text-left bg-transparent border-none cursor-pointer">
              {isHistoryVisible ? '▼' : '▶'} 📜 历战记录
            </button>
            {isHistoryVisible && (
              <div className="result-value mt-2 space-y-2 text-xs">
                {canshou.arena_history.entries.slice().reverse().map((entry: ArenaHistoryEntry) => (
                  <div key={entry.id} className="p-2 bg-black bg-opacity-10 rounded">
                    <p><strong>{entry.title}</strong></p>
                    <p><strong>类型:</strong> {entry.type} | <strong>胜利者:</strong> {entry.winner}</p>
                    <p><strong>影响:</strong> {entry.impact}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <button onClick={handleSaveImage} className="save-button mt-4">
          📱 保存为图片
        </button>
      </div>
    </div>
  );
};

export default CanshouCard;