// components/MagicalGirlCard.tsx
import React, { useRef, useState } from 'react';
import { snapdom } from '@zumer/snapdom';
import { ArenaHistory, ArenaHistoryEntry } from '@/types/arena';

interface MagicalGirlCardProps {
  magicalGirl: {
    codename: string;
    appearance: {
      outfit: string;
      accessories: string;
      colorScheme: string;
      overallLook: string;
    };
    magicConstruct: {
      name: string;
      form: string | object; // 允许 form 是字符串或对象
      basicAbilities: string[] | string;
      description: string;
    };
    wonderlandRule: {
      name: string;
      description: string;
      tendency: string;
      activation: string;
    };
    blooming: {
      name: string | object; // 允许 name 是字符串或对象
      evolvedAbilities: string[] | string;
      evolvedForm: string;
      evolvedOutfit: string;
      powerLevel: string;
    };
    analysis: {
      personalityAnalysis: string;
      abilityReasoning: string;
      coreTraits: string[] | string;
      predictionBasis: string;
      background?: {
        belief: string;
        bonds: string;
      };
    };
  arena_history?: ArenaHistory;
  };
  gradientStyle: string;
  onSaveImage?: (imageUrl: string) => void;
}

/**
 * 【v0.3.0 修复】辅助渲染函数，用于安全地处理可能是字符串或对象的值。
 * @param value - 需要渲染的值
 * @returns React 节点
 */
const renderComplexValue = (value: any) => {
    // 如果值是字符串，直接返回
    if (typeof value === 'string') {
        return value;
    }
    // 如果值是对象（但不是null或数组），则格式化为键值对列表
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        return (
            <div style={{ marginTop: '0.25rem', paddingLeft: '0.5rem' }}>
                {Object.entries(value).map(([key, val]) => (
                    <div key={key}><strong>{key}：</strong>{String(val)}</div>
                ))}
            </div>
        );
    }
    // 对于其他类型（如数字等），转换为字符串
    return String(value);
};


const MagicalGirlCard: React.FC<MagicalGirlCardProps> = ({
  magicalGirl,
  gradientStyle,
  onSaveImage
}) => {
  const resultRef = useRef<HTMLDivElement>(null);
  const [isHistoryVisible, setIsHistoryVisible] = useState(false);

  const handleSaveImage = async () => {
    if (!resultRef.current) return;

    try {
      const saveButton = resultRef.current.querySelector('.save-button') as HTMLElement;
      const logoPlaceholder = resultRef.current.querySelector('.logo-placeholder') as HTMLElement;

      if (saveButton) saveButton.style.display = 'none';
      if (logoPlaceholder) logoPlaceholder.style.display = 'flex';

      const result = await snapdom(resultRef.current, { scale: 1 });

      if (saveButton) saveButton.style.display = 'block';
      if (logoPlaceholder) logoPlaceholder.style.display = 'none';

      const imgElement = await result.toPng();
      const imageUrl = imgElement.src;

      const isMobileDevice = /Mobi/i.test(window.navigator.userAgent);

      if (isMobileDevice) {
        if (onSaveImage) onSaveImage(imageUrl);
      } else {
        const downloadLink = document.createElement('a');
        downloadLink.href = imageUrl;
        const sanitizedTitle = magicalGirl.codename.replace(/[^a-z0-9\u4e00-\u9fa5]/gi, '_');
        downloadLink.download = `魔法少女_${sanitizedTitle}.png`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
      }
    } catch (err) {
      alert('生成图片失败，请重试');
      console.error("Image generation failed:", err);
      const saveButton = resultRef.current?.querySelector('.save-button') as HTMLElement;
      const logoPlaceholder = resultRef.current?.querySelector('.logo-placeholder') as HTMLElement;

      if (saveButton) saveButton.style.display = 'block';
      if (logoPlaceholder) logoPlaceholder.style.display = 'none';
    }
  };

  return (
    <div
      ref={resultRef}
      className="result-card"
      style={{ background: gradientStyle }}
    >
      <div className="result-content">
        <div className="flex justify-center items-center" style={{ marginBottom: '1rem', background: 'transparent' }}>
          <img src="/questionnaire-title.svg" width={300} height={70} alt="Logo" style={{ display: 'block', background: 'transparent' }} />
        </div>

        {/* 基本信息 */}
        <div className="result-item">
          <div className="result-label">💝 魔法少女代号</div>
          <div className="result-value">{magicalGirl.codename}</div>
        </div>

        {/* 外观描述 */}
        <div className="result-item">
          <div className="result-label">👗 魔法少女外观</div>
          <div className="result-value">
            <div><strong>服装：</strong>{magicalGirl.appearance.outfit}</div>
            <div><strong>饰品：</strong>{magicalGirl.appearance.accessories}</div>
            <div><strong>配色：</strong>{magicalGirl.appearance.colorScheme}</div>
            <div><strong>整体风格：</strong>{magicalGirl.appearance.overallLook}</div>
          </div>
        </div>

        {/* 魔力构装 */}
        <div className="result-item">
          <div className="result-label">⚔️ 魔力构装</div>
          <div className="result-value">
            <div><strong>名称：</strong>{magicalGirl.magicConstruct.name}</div>
            {/* 【v0.3.0 修复】使用辅助函数渲染 form 字段 */}
            <div><strong>形态：</strong>{renderComplexValue(magicalGirl.magicConstruct.form)}</div>
            <div><strong>基本能力：</strong></div>
            <ul style={{ marginLeft: '1rem', marginTop: '0.5rem' }}>
              {Array.isArray(magicalGirl.magicConstruct.basicAbilities) && magicalGirl.magicConstruct.basicAbilities.map((ability: string, index: number) => (
                <li key={index}>• {ability}</li>
              ))}
            </ul>
            <div style={{ marginTop: '0.5rem' }}><strong>详细描述：</strong>{magicalGirl.magicConstruct.description}</div>
          </div>
        </div>

        {/* 奇境规则 */}
        <div className="result-item">
          <div className="result-label">🌟 奇境规则</div>
          <div className="result-value">
            <div><strong>规则名称：</strong>{magicalGirl.wonderlandRule.name}</div>
            <div><strong>规则描述：</strong>{magicalGirl.wonderlandRule.description}</div>
            <div><strong>规则倾向：</strong>{magicalGirl.wonderlandRule.tendency}</div>
            <div><strong>激活条件：</strong>{magicalGirl.wonderlandRule.activation}</div>
          </div>
        </div>

        {/* 繁开状态 */}
        <div className="result-item">
          <div className="result-label">🌸 繁开状态</div>
          <div className="result-value">
            {/* 【v0.3.0 修复】使用辅助函数渲染 name 字段 */}
            <div><strong>繁开魔装名：</strong>{renderComplexValue(magicalGirl.blooming.name)}</div>
            <div><strong>进化能力：</strong></div>
            <ul style={{ marginLeft: '1rem', marginTop: '0.5rem' }}>
              {Array.isArray(magicalGirl.blooming.evolvedAbilities) && magicalGirl.blooming.evolvedAbilities.map((ability: string, index: number) => (
                <li key={index}>• {ability}</li>
              ))}
            </ul>
            {/* 【v0.3.0 修复】使用辅助函数渲染 evolvedForm 字段 */}
            <div><strong>进化形态：</strong>{renderComplexValue(magicalGirl.blooming.evolvedForm)}</div>
            <div><strong>进化衣装：</strong>{magicalGirl.blooming.evolvedOutfit}</div>
            <div><strong>力量等级：</strong>{magicalGirl.blooming.powerLevel}</div>
          </div>
        </div>

        {/* 性格分析 */}
        <div className="result-item">
          <div className="result-label">🔮 性格分析</div>
          <div className="result-value">
            <div><strong>性格分析：</strong>{magicalGirl.analysis.personalityAnalysis}</div>
            <div><strong>能力推理：</strong>{magicalGirl.analysis.abilityReasoning}</div>
            <div><strong>核心特征：</strong>
              {Array.isArray(magicalGirl.analysis.coreTraits) 
                ? magicalGirl.analysis.coreTraits.join('、') 
                : magicalGirl.analysis.coreTraits}
            </div>
            <div><strong>预测依据：</strong>{magicalGirl.analysis.predictionBasis}</div>
          </div>
        </div>

        {/* 角色背景 */}
        {magicalGirl.analysis.background && (
          <div className="result-item">
            <div className="result-label">📖 角色背景</div>
            <div className="result-value">
              <div><strong>信念：</strong>{magicalGirl.analysis.background.belief}</div>
              <div style={{ marginTop: '0.5rem' }}><strong>羁绊：</strong>{magicalGirl.analysis.background.bonds}</div>
            </div>
          </div>
        )}

        {/* 历战记录展示区 */}
        {magicalGirl.arena_history && magicalGirl.arena_history.entries.length > 0 && (
          <div className="result-item">
            <button onClick={() => setIsHistoryVisible(!isHistoryVisible)} className="result-label w-full text-left bg-transparent border-none cursor-pointer">
              {isHistoryVisible ? '▼' : '▶'} 📜 历战记录
            </button>
            {isHistoryVisible && (
              <div className="result-value mt-2 space-y-2 text-xs">
                {magicalGirl.arena_history.entries.slice().reverse().map((entry: ArenaHistoryEntry) => {
                  const startColor = gradientStyle.startsWith('linear-gradient')
                    ? gradientStyle.split(', ')[1].trim()
                    : 'rgba(0, 0, 0, 0.05)';
                  const historyItemBackground = `${startColor}20`; 

                  return (
                    <div key={entry.id} className="p-2 rounded" style={{ backgroundColor: historyItemBackground }}>
                      <p><strong>{entry.title}</strong></p>
                      <p><strong>类型:</strong> {entry.type} | <strong>胜利者:</strong> {entry.winner}</p>
                      <p><strong>影响:</strong> {entry.impact}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <button onClick={handleSaveImage} className="save-button">
          📱 保存为图片
        </button>

        <div className="logo-placeholder" style={{ display: 'none', justifyContent: 'center', marginTop: '1rem' }}>
          <img
            src="/logo-white-qrcode.svg"
            width={280}
            height={280}
            alt="Logo"
            style={{
              display: 'block',
              maxWidth: '100%',
              height: 'auto'
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default MagicalGirlCard;