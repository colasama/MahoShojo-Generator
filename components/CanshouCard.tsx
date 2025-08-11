// components/CanshouCard.tsx
import React, { useRef } from 'react';
import { snapdom } from '@zumer/snapdom';

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
}

interface CanshouCardProps {
  canshou: CanshouDetails;
  onSaveImage: (imageUrl: string) => void;
}

const CanshouCard: React.FC<CanshouCardProps> = ({ canshou, onSaveImage }) => {
  const cardRef = useRef<HTMLDivElement>(null);

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

        <div className="grid md:grid-cols-2 gap-4">
          <div className="result-item">
            <div className="result-label">核心概念</div>
            <div className="result-value">{canshou.coreConcept}</div>
          </div>
          <div className="result-item">
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

        <button onClick={handleSaveImage} className="save-button mt-4">
          保存档案图片
        </button>
      </div>
    </div>
  );
};

export default CanshouCard;