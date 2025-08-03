import React, { useState, useRef } from 'react';
import Head from 'next/head';
import { snapdom } from '@zumer/snapdom';
import { type AIGeneratedMagicalGirl } from '../lib/magical-girl';
import { MainColor } from '../lib/main-color';

interface MagicalGirl {
  realName: string;
  name: string;
  flowerDescription: string;
  appearance: {
    height: string;
    weight: string;
    hairColor: string;
    hairStyle: string;
    eyeColor: string;
    skinTone: string;
    wearing: string;
    specialFeature: string;
    mainColor: string; // 写法有点诡异，但是能用就行.jpg
    firstPageColor: string;
    secondPageColor: string;
  };
  spell: string;
  level: string;
  levelEmoji: string;
}

// 保留原有的 levels 数组和相关函数
const levels = [
  { name: '种', emoji: '🌱' },
  { name: '芽', emoji: '🍃' },
  { name: '叶', emoji: '🌿' },
  { name: '蕾', emoji: '🌸' },
  { name: '花', emoji: '🌺' },
  { name: '宝石权杖', emoji: '💎' }
];

// 定义8套渐变配色方案，与 MainColor 枚举顺序对应
const gradientColors: Record<string, { first: string; second: string }> = {
  [MainColor.Red]: { first: '#ff6b6b', second: '#ee5a6f' },
  [MainColor.Orange]: { first: '#ff922b', second: '#ffa94d' },
  [MainColor.Cyan]: { first: '#22b8cf', second: '#66d9e8' },
  [MainColor.Blue]: { first: '#5c7cfa', second: '#748ffc' },
  [MainColor.Purple]: { first: '#9775fa', second: '#b197fc' },
  [MainColor.Pink]: { first: '#ff9a9e', second: '#fecfef' },
  [MainColor.Yellow]: { first: '#f59f00', second: '#fcc419' },
  [MainColor.Green]: { first: '#51cf66', second: '#8ce99a' }
};

function seedRandom(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

function getWeightedRandomFromSeed<T>(array: T[], weights: number[], seed: number, offset: number = 0): T {
  // 使用种子生成 0-1 之间的伪随机数
  const pseudoRandom = ((seed + offset) * 9301 + 49297) % 233280 / 233280.0;

  // 累计权重
  let cumulativeWeight = 0;
  const cumulativeWeights = weights.map(weight => cumulativeWeight += weight);
  const totalWeight = cumulativeWeights[cumulativeWeights.length - 1];

  // 找到对应的索引
  const randomValue = pseudoRandom * totalWeight;
  const index = cumulativeWeights.findIndex(weight => randomValue <= weight);

  return array[index >= 0 ? index : 0];
}

function checkNameLength(name: string): boolean {
  return name.length <= 300;
}

// 使用 API 路由生成魔法少女
async function generateMagicalGirl(inputName: string): Promise<MagicalGirl> {
  const response = await fetch('/api/generate-magical-girl', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name: inputName }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || '生成失败');
  }

  const aiGenerated: AIGeneratedMagicalGirl = await response.json();

  // 等级概率配置: [种, 芽, 叶, 蕾, 花, 宝石权杖]
  const levelProbabilities = [0.1, 0.2, 0.3, 0.3, 0.07, 0.03];

  // 使用加权随机选择生成 level
  const seed = seedRandom(aiGenerated.flowerName + inputName);
  const level = getWeightedRandomFromSeed(levels, levelProbabilities, seed, 6);

  return {
    realName: inputName,
    name: aiGenerated.flowerName,
    flowerDescription: aiGenerated.flowerDescription,
    appearance: aiGenerated.appearance,
    spell: aiGenerated.spell,
    level: level.name,
    levelEmoji: level.emoji
  };
}

export default function Home() {
  const [inputName, setInputName] = useState('');
  const [magicalGirl, setMagicalGirl] = useState<MagicalGirl | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [savedImageUrl, setSavedImageUrl] = useState<string | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  const handleGenerate = async () => {
    if (!inputName.trim()) return;

    if (!checkNameLength(inputName)) {
      alert('名字太长啦，你怎么回事！');
      return;
    }

    setIsGenerating(true);

    try {
      const result = await generateMagicalGirl(inputName.trim());
      setMagicalGirl(result);
    } catch {
      // 显示错误提示
      alert(`✨ 魔法失效了！请再生成一次试试吧~`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveImage = async () => {
    if (!resultRef.current) return;

    try {
      // 临时隐藏保存按钮和说明文字
      const saveButton = resultRef.current.querySelector('.save-button') as HTMLElement;
      const logoPlaceholder = resultRef.current.querySelector('.logo-placeholder') as HTMLElement;

      if (saveButton) saveButton.style.display = 'none';
      if (logoPlaceholder) logoPlaceholder.style.display = 'flex';

      const result = await snapdom(resultRef.current, {
        scale: 1,
      });

      // 恢复按钮显示
      if (saveButton) saveButton.style.display = 'block';
      if (logoPlaceholder) logoPlaceholder.style.display = 'none';

      // 获取 result.toPng() 生成的 HTMLImageElement 的图片 URL
      // toPng() 返回 Promise<HTMLImageElement>，可通过 .src 获取图片的 base64 url
      const imgElement = await result.toPng();
      const imageUrl = imgElement.src;
      setSavedImageUrl(imageUrl);
      setShowImageModal(true);
    } catch {
      alert('生成图片失败，请重试');
      // 确保在失败时也恢复按钮显示
      const saveButton = resultRef.current?.querySelector('.save-button') as HTMLElement;
      const logoPlaceholder = resultRef.current?.querySelector('.logo-placeholder') as HTMLElement;

      if (saveButton) saveButton.style.display = 'block';
      if (logoPlaceholder) logoPlaceholder.style.display = 'none';
    }
  };

  return (
    <>
      <Head>
        <link rel="preload" href="/logo.svg" as="image" type="image/svg+xml" />
        <link rel="preload" href="/logo-white.svg" as="image" type="image/svg+xml" />
      </Head>
      <div className="magic-background">
        <div className="container">
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '1rem' }}>
              <img src="/logo.svg" width={250} height={160} alt="Logo" />
            </div>
            <p className="subtitle text-center">你是什么魔法少女呢！</p>
            <p className="subtitle text-center">
              或者要不要来试试 <a href="/details" className="footer-link">奇妙妖精大调查</a>？
            </p>
            <div className="input-group">
              <label htmlFor="name" className="input-label">
                请输入你的名字：
              </label>
              <input
                id="name"
                type="text"
                value={inputName}
                onChange={(e) => setInputName(e.target.value)}
                className="input-field"
                placeholder="例如：鹿目圆香"
                onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
              />
            </div>

            <button
              onClick={handleGenerate}
              disabled={!inputName.trim() || isGenerating}
              className="generate-button"
            >
              {isGenerating ? '少女创造中，请稍后捏 (≖ᴗ≖)✧✨' : 'へんしん(ﾉﾟ▽ﾟ)ﾉ! '}
            </button>

            {magicalGirl && (
              <div
                ref={resultRef}
                className="result-card"
                style={{
                  background: (() => {
                    const colors = gradientColors[magicalGirl.appearance.mainColor] || gradientColors[MainColor.Pink];
                    return `linear-gradient(135deg, ${colors.first} 0%, ${colors.second} 100%)`;
                  })()
                }}
              >
                <div className="result-content">
                  <div className="flex justify-center items-center" style={{ marginBottom: '1rem', background: 'transparent' }}>
                    <img src="/mahou-title.svg" width={300} height={70} alt="Logo" style={{ display: 'block', background: 'transparent' }} />
                  </div>
                  <div className="result-item">
                    <div className="result-label">✨ 真名解放</div>
                    <div className="result-value">{magicalGirl.realName}</div>
                  </div>
                  <div className="result-item">
                    <div className="result-label">💝 魔法少女名</div>
                    <div className="result-value">
                      {magicalGirl.name}
                      <div style={{ fontStyle: 'italic', marginTop: '8px', fontSize: '14px', opacity: 0.9 }}>
                        「{magicalGirl.flowerDescription}」
                      </div>
                    </div>
                  </div>

                  <div className="result-item">
                    <div className="result-label">👗 外貌</div>
                    <div className="result-value">
                      身高：{magicalGirl.appearance.height}<br />
                      体重：{magicalGirl.appearance.weight}<br />
                      发色：{magicalGirl.appearance.hairColor}<br />
                      发型：{magicalGirl.appearance.hairStyle}<br />
                      瞳色：{magicalGirl.appearance.eyeColor}<br />
                      肤色：{magicalGirl.appearance.skinTone}<br />
                      穿着：{magicalGirl.appearance.wearing}<br />
                      特征：{magicalGirl.appearance.specialFeature}
                    </div>
                  </div>

                  <div className="result-item">
                    <div className="result-label">✨ 变身咒语</div>
                    <div className="result-value">
                      <div style={{ whiteSpace: 'pre-line' }}>{magicalGirl.spell}</div>
                    </div>
                  </div>

                  <div className="result-item">
                    <div className="result-label">⭐ 魔法等级</div>
                    <div className="result-value">
                      <span className="level-badge">
                        {magicalGirl.levelEmoji} {magicalGirl.level}
                      </span>
                    </div>
                  </div>

                  <button onClick={handleSaveImage} className="save-button">
                    📱 保存为图片
                  </button>

                  {/* Logo placeholder for saved images */}
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
            )}
            <div className="text-center w-full text-sm text-gray-500" style={{ marginTop: '8px' }}> 立绘生成功能开发中（大概）... </div>
          </div>

          <footer className="footer">
            <p>
              <a href="https://github.com/colasama" target="_blank" rel="noopener noreferrer" className="footer-link">@Colanns</a> 急速出品
            </p>
            <p>
              <a href="https://github.com/colasama/MahoShojo-Generator" target="_blank" rel="noopener noreferrer" className="footer-link">colasama/MahoShojo-Generator</a>
            </p>
          </footer>
        </div>

        {/* Image Modal */}
        {showImageModal && savedImageUrl && (
          <div className="fixed inset-0 bg-black flex items-center justify-center z-50"
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.7)', paddingLeft: '2rem', paddingRight: '2rem' }}
          >
            <div className="bg-white rounded-lg max-w-lg w-full max-h-[80vh] overflow-auto relative">
              <div className="flex justify-between items-center m-0">
                <div></div>
                <button
                  onClick={() => setShowImageModal(false)}
                  className="text-gray-500 hover:text-gray-700 text-3xl leading-none"
                  style={{ marginRight: '0.5rem' }}
                >
                  ×
                </button>
              </div>
              <p className="text-center text-sm text-gray-600" style={{ marginTop: '0.5rem' }}>
                💫 长按图片保存到相册
              </p>
              <div className="items-center flex flex-col" style={{ padding: '0.5rem' }}>
                <img
                  src={savedImageUrl}
                  alt="魔法少女登记表"
                  className="w-1/2 h-auto rounded-lg mx-auto"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
} 