// components/BattleReportCard.tsx

import React, { useRef } from 'react';
import { snapdom } from '@zumer/snapdom';

// 更新接口以匹配新的新闻报道格式
export interface NewsReport {
  headline: string;
  reporterInfo: {
    name: string;
    publication: string;
  };
  article: {
    body: string;
    analysis: string;
  };
  officialReport: {
    winner: string;
    impact: string;
  };
}

interface BattleReportCardProps {
  report: NewsReport;
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
# ${report.headline}
**来源：${report.reporterInfo.publication} | 记者：${report.reporterInfo.name}**

---

## 新闻正文
${report.article.body}

---

## 记者点评
> ${report.article.analysis}

---

## 官方通报
- **胜利者**: ${report.officialReport.winner}
- **最终影响**: ${report.officialReport.impact}
    `.trim();

    // 2. 创建 Blob 对象并触发下载
    const blob = new Blob([markdownContent], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    // 创建一个安全的文件名
    const sanitizedTitle = report.headline.replace(/[^a-z0-9\u4e00-\u9fa5]/gi, '_');
    link.download = `魔法少女速报_${sanitizedTitle}.md`;
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
        <h2 className="text-2xl font-bold text-center mb-2">{report.headline}</h2>
        <p className="text-sm text-gray-300 text-center mb-4 italic">文 / {report.reporterInfo.name} | {report.reporterInfo.publication}</p>

        <div className="result-item">
          <div className="result-label">📰 新闻正文</div>
          <div className="result-value">
            <p className="text-sm opacity-90 whitespace-pre-line">{report.article.body}</p>
          </div>
        </div>

        <div className="result-item" style={{ borderLeft: '4px solid #ff6b9d', background: 'rgba(0,0,0,0.2)'}}>
          <div className="result-label">🎤 记者点评</div>
          <div className="result-value">
            <p className="text-sm opacity-90 italic">{report.article.analysis}</p>
          </div>
        </div>

        <div className="result-item">
          <div className="result-label">📊 战斗结算报告</div>
          <div className="result-value">
            <h3 className="font-semibold mt-2">战斗简报：</h3>
            <p className="text-sm opacity-90">{report.report.summary}</p>
            <h3 className="font-semibold mt-2">胜利者：</h3>
            <p className="text-sm opacity-90">{report.officialReport.winner}</p>
            <h3 className="font-semibold mt-3">最终影响：</h3>
            <p className="text-sm opacity-90">{report.officialReport.impact}</p>
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