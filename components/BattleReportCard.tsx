import React, { useRef } from 'react';
import { snapdom } from '@zumer/snapdom';

export interface BattleReport {
  title: string;
  story: {
    cause: string;
    progression: string;
    result: string;
  };
  report: {
    summary: string;
    winner: string;
    outcome: string;
  };
}

interface BattleReportCardProps {
  report: BattleReport;
  onSaveImage?: (imageUrl: string) => void;
}

const BattleReportCard: React.FC<BattleReportCardProps> = ({ report, onSaveImage }) => {
  const cardRef = useRef<HTMLDivElement>(null);

  const handleSaveImage = async () => {
    if (!cardRef.current) return;

    try {
      const saveButton = cardRef.current.querySelector('.save-button') as HTMLElement;
      const logoPlaceholder = cardRef.current.querySelector('.logo-placeholder') as HTMLElement;

      if (saveButton) saveButton.style.display = 'none';
      if (logoPlaceholder) logoPlaceholder.style.display = 'flex';

      const result = await snapdom(cardRef.current, { scale: 1 });

      if (saveButton) saveButton.style.display = 'block';
      if (logoPlaceholder) logoPlaceholder.style.display = 'none';

      const imgElement = await result.toPng();
      const imageUrl = imgElement.src;

      if (onSaveImage) {
        onSaveImage(imageUrl);
      }
    } catch (err) {
      alert('生成图片失败，请重试');
      console.error("Image generation failed:", err);
      const saveButton = cardRef.current?.querySelector('.save-button') as HTMLElement;
      const logoPlaceholder = cardRef.current?.querySelector('.logo-placeholder') as HTMLElement;

      if (saveButton) saveButton.style.display = 'block';
      if (logoPlaceholder) logoPlaceholder.style.display = 'none';
    }
  };

  return (
    <div
      ref={cardRef}
      className="result-card"
      style={{ background: 'linear-gradient(135deg, #434343 0%, #000000 100%)' }}
    >
      <div className="result-content">
        <h2 className="text-2xl font-bold text-center mb-4">{report.title}</h2>

        <div className="result-item">
          <div className="result-label">📖 战斗故事</div>
          <div className="result-value">
            <h3 className="font-semibold mt-2">起因：</h3>
            <p className="text-sm opacity-90 whitespace-pre-line">{report.story.cause}</p>
            <h3 className="font-semibold mt-3">经过：</h3>
            <p className="text-sm opacity-90 whitespace-pre-line">{report.story.progression}</p>
            <h3 className="font-semibold mt-3">结果：</h3>
            <p className="text-sm opacity-90 whitespace-pre-line">{report.story.result}</p>
          </div>
        </div>

        <div className="result-item">
          <div className="result-label">📊 战斗结算报告</div>
          <div className="result-value">
            <h3 className="font-semibold mt-2">战斗简报：</h3>
            <p className="text-sm opacity-90">{report.report.summary}</p>
            <h3 className="font-semibold mt-3">胜利者：</h3>
            <p className="text-sm opacity-90">{report.report.winner}</p>
            <h3 className="font-semibold mt-3">最终影响：</h3>
            <p className="text-sm opacity-90">{report.report.outcome}</p>
          </div>
        </div>

        {onSaveImage && (
            <button onClick={handleSaveImage} className="save-button">
              📱 保存为图片
            </button>
        )}

        <div className="logo-placeholder" style={{ display: 'none', justifyContent: 'center', marginTop: '1rem' }}>
          <img
            src="/logo-white-qrcode.svg"
            width={280}
            height={280}
            alt="Logo"
            style={{ display: 'block', maxWidth: '100%', height: 'auto' }}
          />
        </div>
      </div>
    </div>
  );
};

export default BattleReportCard;