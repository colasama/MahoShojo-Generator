import React, { useRef } from 'react';
import { snapdom } from '@zumer/snapdom';

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
      form: string;
      basicAbilities: string[];
      description: string;
    };
    wonderlandRule: {
      name: string;
      description: string;
      tendency: string;
      activation: string;
    };
    blooming: {
      name: string;
      evolvedAbilities: string[];
      evolvedForm: string;
      evolvedOutfit: string;
      powerLevel: string;
    };
    analysis: {
      personalityAnalysis: string;
      abilityReasoning: string;
      coreTraits: string[];
      predictionBasis: string;
    };
  };
  gradientStyle: string;
  onSaveImage?: (imageUrl: string) => void;
}

const MagicalGirlCard: React.FC<MagicalGirlCardProps> = ({
  magicalGirl,
  gradientStyle,
  onSaveImage
}) => {
  const resultRef = useRef<HTMLDivElement>(null);

  const handleSaveImage = async () => {
    if (!resultRef.current) return;

    try {
      const saveButton = resultRef.current.querySelector('.save-button') as HTMLElement;
      const logoPlaceholder = resultRef.current.querySelector('.logo-placeholder') as HTMLElement;

      if (saveButton) saveButton.style.display = 'none';
      if (logoPlaceholder) logoPlaceholder.style.display = 'flex';

      const result = await snapdom(resultRef.current, {
        scale: 1,
      });

      if (saveButton) saveButton.style.display = 'block';
      if (logoPlaceholder) logoPlaceholder.style.display = 'none';

      const imgElement = await result.toPng();
      const imageUrl = imgElement.src;

      if (onSaveImage) {
        onSaveImage(imageUrl);
      }
    } catch {
      alert('生成图片失败，请重试');
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
            <div><strong>形态：</strong>{magicalGirl.magicConstruct.form}</div>
            <div><strong>基本能力：</strong></div>
            <ul style={{ marginLeft: '1rem', marginTop: '0.5rem' }}>
              {magicalGirl.magicConstruct.basicAbilities.map((ability: string, index: number) => (
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
            <div><strong>繁开魔装名：</strong>{magicalGirl.blooming.name}</div>
            <div><strong>进化能力：</strong></div>
            <ul style={{ marginLeft: '1rem', marginTop: '0.5rem' }}>
              {magicalGirl.blooming.evolvedAbilities.map((ability: string, index: number) => (
                <li key={index}>• {ability}</li>
              ))}
            </ul>
            <div><strong>进化形态：</strong>{magicalGirl.blooming.evolvedForm}</div>
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
            <div><strong>核心特征：</strong>{magicalGirl.analysis.coreTraits.join('、')}</div>
            <div><strong>预测依据：</strong>{magicalGirl.analysis.predictionBasis}</div>
          </div>
        </div>

        <button onClick={handleSaveImage} className="save-button">
          📱 保存为图片
        </button>

        <div className="logo-placeholder" style={{ display: 'none', justifyContent: 'center', marginTop: '1rem' }}>
          <img
            src="/logo-white.svg"
            width={120}
            height={80}
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