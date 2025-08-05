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
      // 修改为隐藏整个按钮容器
      const buttonsContainer = cardRef.current.querySelector('.buttons-container') as HTMLElement;
      const logoPlaceholder = cardRef.current.querySelector('.logo-placeholder') as HTMLElement;

      if (buttonsContainer) buttonsContainer.style.display = 'none';
      if (logoPlaceholder) logoPlaceholder.style.display = 'flex';

      const result = await snapdom(cardRef.current, { scale: 1 });

      // 恢复按钮容器的显示
      if (buttonsContainer) buttonsContainer.style.display = 'flex';
      if (logoPlaceholder) logoPlaceholder.style.display = 'none';

      const imgElement = await result.toPng();
      const imageUrl = imgElement.src;

      if (onSaveImage) {
        onSaveImage(imageUrl);
      }
    } catch (err) {
      alert('生成图片失败，请重试');
      console.error("Image generation failed:", err);
      // 确保在出错时也恢复按钮
      const buttonsContainer = cardRef.current?.querySelector('.buttons-container') as HTMLElement;
      const logoPlaceholder = cardRef.current?.querySelector('.logo-placeholder') as HTMLElement;

      if (buttonsContainer) buttonsContainer.style.display = 'flex';
      if (logoPlaceholder) logoPlaceholder.style.display = 'none';
    }
  };

  const handleSaveMarkdown = () => {
    // 1. 将报告内容格式化为 Markdown 字符串
    const markdownContent = `
# ${report.title}

## 📖 战斗故事

### 起因
${report.story.cause}

### 经过
${report.story.progression}

### 结果
${report.story.result}

---

## 📊 战斗结算报告

### 战斗简报
${report.report.summary}

### 胜利者
**${report.report.winner}**

### 最终影响
${report.report.outcome}
    `.trim();

    // 2. 创建 Blob 对象并触发下载
    const blob = new Blob([markdownContent], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    // 创建一个安全的文件名
    const sanitizedTitle = report.title.replace(/[^a-z0-9\u4e00-\u9fa5]/gi, '_');
    link.download = `战斗报告_${sanitizedTitle}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
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

        {/* 按钮容器 */}
        <div className="buttons-container flex gap-2 justify-center mt-4" style={{ alignItems: 'stretch' }}>
          {onSaveImage && (
            <button onClick={handleSaveImage} className="save-button" style={{ marginTop: 0, flex: 1 }}>
              📱 保存为图片
            </button>
          )}
          <button onClick={handleSaveMarkdown} className="save-button" style={{ marginTop: 0, flex: 1 }}>
            📄 下载战斗记录
          </button>
        </div>

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