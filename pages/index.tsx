import React, { useState, useRef } from 'react'
import html2canvas from 'html2canvas'
import { type AIGeneratedMagicalGirl, MainColor } from '../lib/ai'
import Image from 'next/image'

interface MagicalGirl {
  realName: string
  name: string
  flowerDescription: string
  appearance: {
    height: string
    weight: string
    hairColor: string
    hairStyle: string
    eyeColor: string
    skinTone: string
    wearing: string
    specialFeature: string
    mainColor: string // 写法有点诡异，但是能用就行.jpg
    firstPageColor: string
    secondPageColor: string
  }
  spell: string
  level: string
  levelEmoji: string
}

// 保留原有的 levels 数组和相关函数
const levels = [
  { name: '种', emoji: '🌱' },
  { name: '芽', emoji: '🍃' },
  { name: '叶', emoji: '🌿' },
  { name: '蕾', emoji: '🌸' },
  { name: '花', emoji: '🌺' },
  { name: '宝石权杖', emoji: '💎' }
]

// 定义8套渐变配色方案，与 MainColor 枚举顺序对应
const gradientColors: Record<MainColor, { first: string; second: string }> = {
  [MainColor.Red]: { first: '#ff6b6b', second: '#ee5a6f' },
  [MainColor.Orange]: { first: '#ff922b', second: '#ffa94d' },
  [MainColor.Cyan]: { first: '#22b8cf', second: '#66d9e8' },
  [MainColor.Blue]: { first: '#5c7cfa', second: '#748ffc' },
  [MainColor.Purple]: { first: '#9775fa', second: '#b197fc' },
  [MainColor.Pink]: { first: '#ff9a9e', second: '#fecfef' },
  [MainColor.Yellow]: { first: '#f59f00', second: '#fcc419' },
  [MainColor.Green]: { first: '#51cf66', second: '#8ce99a' }
}

function seedRandom(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return Math.abs(hash)
}

function getRandomFromSeed<T>(array: T[], seed: number, offset: number = 0): T {
  const index = (seed + offset) % array.length
  return array[index]
}

// 使用 API 路由生成魔法少女
async function generateMagicalGirl(inputName: string): Promise<MagicalGirl> {
  const response = await fetch('/api/generate-magical-girl', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name: inputName }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || '生成失败')
  }

  const aiGenerated: AIGeneratedMagicalGirl = await response.json()

  // 保留原有的随机 level 生成逻辑
  const seed = seedRandom(aiGenerated.flowerName + inputName)
  const level = getRandomFromSeed(levels, seed, 6)

  return {
    realName: inputName,
    name: aiGenerated.flowerName,
    flowerDescription: aiGenerated.flowerDescription,
    appearance: aiGenerated.appearance,
    spell: aiGenerated.spell,
    level: level.name,
    levelEmoji: level.emoji
  }
}

export default function Home() {
  const [inputName, setInputName] = useState('')
  const [magicalGirl, setMagicalGirl] = useState<MagicalGirl | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const resultRef = useRef<HTMLDivElement>(null)

  const handleGenerate = async () => {
    if (!inputName.trim()) return

    setIsGenerating(true)

    try {
      const result = await generateMagicalGirl(inputName.trim())
      setMagicalGirl(result)
    } catch {
      // 显示错误提示
      alert(`✨ 魔法失效了！请再生成一次试试吧~`)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleSaveImage = async () => {
    if (!resultRef.current) return

    try {
      const canvas = await html2canvas(resultRef.current, {
        backgroundColor: null,
        scale: 2,
        useCORS: true,
      })

      const link = document.createElement('a')
      link.download = `${magicalGirl?.name || '魔法少女'}.png`
      link.href = canvas.toDataURL()
      link.click()
    } catch {
      alert('保存图片失败，请重试')
    }
  }

  return (
    <div className="magic-background">
      <div className="container">
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '1rem' }}>
            <Image src="/logo.svg" width={250} height={160} alt="Logo" style={{ display: 'block' }} />
          </div>
          <p className="subtitle text-center">你是什么魔法少女呢！</p>

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
              placeholder="例如："
              onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
            />
          </div>

          <button
            onClick={handleGenerate}
            disabled={!inputName.trim() || isGenerating}
            className="generate-button"
          >
            {isGenerating ? '舞台创造中，请稍后捏 (≖ᴗ≖)✧✨' : 'へんしん(ﾉﾟ▽ﾟ)ﾉ! '}
          </button>

          {magicalGirl && (
            <div
              ref={resultRef}
              className="result-card"
              style={{
                background: (() => {
                  const colors = gradientColors[magicalGirl.appearance.mainColor as MainColor] || gradientColors[MainColor.Pink];
                  return `linear-gradient(135deg, ${colors.first} 0%, ${colors.second} 100%)`;
                })()
              }}
            >
              <div className="flex justify-center items-center" style={{ marginBottom: '1rem' }}>
                <Image src="/mahou-title.svg" width={300} height={180} alt="Logo" style={{ display: 'block' }} />
              </div>
              <div className="result-content">
                <div className="result-item">
                  <div className="result-label">💝 真名解放</div>
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
                <div className="save-instructions">
                  点击按钮下载图片，或长按结果卡片截图保存
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
        </footer>
      </div>
    </div>
  )
} 