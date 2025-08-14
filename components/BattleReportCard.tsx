// components/BattleReportCard.tsx

import React, { useRef } from 'react';
import { snapdom } from '@zumer/snapdom';

export interface NewsReport {
  headline: string;
  reporterInfo: {
    name:string;
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
  // 新增：可选的用户引导信息字段
  userGuidance?: string;
}

interface BattleReportCardProps {
  report: NewsReport;
  onSaveImage?: (imageUrl: string) => void;
  // 战斗模式，设为可选以兼容旧功能
  mode?: 'classic' | 'kizuna' | 'daily';
}

const BattleReportCard: React.FC<BattleReportCardProps> = ({ report, onSaveImage, mode }) => {
  const cardRef = useRef<HTMLDivElement>(null);

  const getModeDisplay = (mode: string) => {
    switch (mode) {
      case 'daily':
        return { text: '日常模式 ☕', style: { color: '#22c55e', borderColor: '#22c55e', background: 'rgba(34, 197, 94, 0.1)' } };
      case 'kizuna':
        return { text: '羁绊模式 ✨', style: { color: '#3b82f6', borderColor: '#3b82f6', background: 'rgba(59, 130, 246, 0.1)' } };
      case 'classic':
        return { text: '经典模式 ⚔️', style: { color: '#ec4899', borderColor: '#ec4899', background: 'rgba(236, 72, 153, 0.1)' } };
      default:
        return null;
    }
  };

  const modeDisplay = mode ? getModeDisplay(mode) : null;

  // 处理保存为图片的功能
  const handleSaveImage = async () => {
    if (!cardRef.current) return;

    try {
      // 截图前隐藏按钮和显示Logo
      const buttonsContainer = cardRef.current.querySelector('.buttons-container') as HTMLElement;
      const logoPlaceholder = cardRef.current.querySelector('.logo-placeholder') as HTMLElement;

      if (buttonsContainer) buttonsContainer.style.display = 'none';
      if (logoPlaceholder) logoPlaceholder.style.display = 'flex';

      const result = await snapdom(cardRef.current, { scale: 1 });

      // 截图后恢复按钮和隐藏Logo
      if (buttonsContainer) buttonsContainer.style.display = 'flex';
      if (logoPlaceholder) logoPlaceholder.style.display = 'none';

      const imgElement = await result.toPng();
      const imageUrl = imgElement.src;

      // 检测设备类型以提供最佳保存体验
      const isMobileDevice = /Mobi/i.test(window.navigator.userAgent);

      if (isMobileDevice) {
        // 在移动端，调用回调函数以显示弹窗供用户长按保存
        if (onSaveImage) {
          onSaveImage(imageUrl);
        }
      } else {
        // 在桌面端，直接触发文件下载
        const downloadLink = document.createElement('a');
        downloadLink.href = imageUrl;
        // 使用新闻标题并清理特殊字符作为文件名
        const sanitizedTitle = report.headline.replace(/[^a-z0-9\u4e00-\u9fa5]/gi, '_');
        downloadLink.download = `魔法少女速报_${sanitizedTitle}.png`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
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

  // 处理保存为Markdown文件
  const handleSaveMarkdown = () => {
    // 新增：在Markdown中加入用户引导信息
    const markdownContent = `
# ${report.headline}
**来源：${report.reporterInfo.publication} | 记者：${report.reporterInfo.name}**
${mode ? `**模式：${modeDisplay?.text}**\n` : ''}
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
${report.userGuidance ? `
---

## 故事引导
> ${report.userGuidance}` : ''}
    `.trim();

    // 创建Blob对象并触发下载
    const blob = new Blob([markdownContent], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
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
        <img src="/arena-white.svg" style={{ marginBottom: '1rem', marginTop: '1rem' }} width={320} height={90} alt="魔法少女竞技场" className="feature-title-svg" />
        <h2 className="text-xl font-bold mb-2" style={{ marginLeft: '0.5rem' }}>{report.headline}</h2>
        <p className="text-sm text-gray-300" style={{ marginLeft: '0.5rem' }}>
          记者 | {report.reporterInfo.name}
        </p>
        <p className="text-sm text-gray-300" style={{ marginBottom: '0.5rem', marginLeft: '0.5rem' }}>
          来源 | {report.reporterInfo.publication}
        </p>

        {/* 显示战斗模式 */}
        {modeDisplay && (
            <div style={{ display: 'flex', justifyContent: 'center', margin: '0.75rem 0' }}>
                <span style={{
                    ...modeDisplay.style,
                    padding: '0.25rem 0.75rem',
                    borderRadius: '9999px',
                    borderWidth: '1px',
                    fontSize: '0.875rem',
                    fontWeight: '600'
                }}>
                    {modeDisplay.text}
                </span>
            </div>
        )}

        <div className="result-item">
          <div className="result-value">
            <p className="text-sm opacity-90 whitespace-pre-line">{report.article.body}</p>
          </div>
        </div>

        <div className="result-item" style={{ borderLeft: '4px solid #ff6b9d', background: 'rgba(0,0,0,0.2)' }}>
          <div className="result-label">🎤 记者点评</div>
          <div className="result-value">
            <p className="text-sm opacity-90 italic">{report.article.analysis}</p>
          </div>
        </div>

        <div className="result-item">
          <div className="result-value">
            <h3 className="font-semibold mt-2">胜利者</h3>
            <p className="text-sm opacity-90" style={{ marginBottom: '0.5rem' }}>{report.officialReport.winner}</p>
            <h3 className="font-semibold mt-2">最终影响</h3>
            <p className="text-sm opacity-90" style={{ marginBottom: '0.5rem' }}>{report.officialReport.impact}</p>
          </div>
        </div>

        {/* 新增：如果用户提供了引导信息，则显示此区域 */}
        {report.userGuidance && (
          <div className="result-item" style={{ borderLeft: '4px solid #a78bfa', background: 'rgba(0,0,0,0.2)' }}>
            <div className="result-label">📖 故事引导</div>
            <div className="result-value">
              <p className="text-sm opacity-90 italic">“{report.userGuidance}”</p>
            </div>
          </div>
        )}

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

        {/* Logo占位符，用于截图 */}
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