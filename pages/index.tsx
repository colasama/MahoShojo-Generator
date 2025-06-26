import React, { useState, useRef } from 'react'
import html2canvas from 'html2canvas'
import { generateMagicalGirlWithAI, type AIGeneratedMagicalGirl } from '../lib/ai'

interface MagicalGirl {
  realName: string
  name: string
  appearance: {
    height: string
    weight: string
    hairColor: string
    hairStyle: string
    eyeColor: string
    skinTone: string
    specialFeature: string
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

// 使用 AI 生成魔法少女（除了 level）
async function generateMagicalGirl(inputName: string): Promise<MagicalGirl> {
  // 使用 AI 生成大部分属性
  const aiGenerated: AIGeneratedMagicalGirl = await generateMagicalGirlWithAI(inputName)
  
  // 保留原有的随机 level 生成逻辑
  const seed = seedRandom(inputName)
  const level = getRandomFromSeed(levels, seed, 6)
  
  return {
    realName: inputName,
    name: aiGenerated.name,
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
  const [error, setError] = useState<string | null>(null)
  const resultRef = useRef<HTMLDivElement>(null)

  const handleGenerate = async () => {
    if (!inputName.trim()) return
    
    setIsGenerating(true)
    setError(null)
    
    try {
      const result = await generateMagicalGirl(inputName.trim())
      setMagicalGirl(result)
    } catch (err) {
      console.error('生成魔法少女失败:', err)
      setError('生成失败，请检查网络连接和 API 配置后重试')
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
    } catch (error) {
      console.error('保存图片失败:', error)
      alert('保存图片失败，请重试')
    }
  }

  return (
    <div className="magic-background">
      <div className="container">
        <div className="card">
          <h1 className="title">✨ 魔法少女生成器 ✨</h1>
          <p className="subtitle">🤖 AI 驱动的个性化魔法少女角色生成</p>
          
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
              placeholder="例如：小樱"
              onKeyPress={(e) => e.key === 'Enter' && handleGenerate()}
            />
          </div>
          
          <button
            onClick={handleGenerate}
            disabled={!inputName.trim() || isGenerating}
            className="generate-button"
          >
            {isGenerating ? '🤖 AI 魔法生成中... ✨' : '🌸 生成我的魔法少女 🌸'}
          </button>
          
          {error && (
            <div className="error-message">
              ⚠️ {error}
            </div>
          )}
          
          {magicalGirl && (
            <div ref={resultRef} className="result-card">
              <div className="result-content">
                <div className="result-item">
                    <div className="result-label">💝 真名解放</div>
                    <div className="result-value">{magicalGirl.realName}</div>
                </div>
                <div className="result-item">
                  <div className="result-label">💝 魔法少女名</div>
                  <div className="result-value">{magicalGirl.name}</div>
                </div>
                
                <div className="result-item">
                  <div className="result-label">👗 外貌特征</div>
                  <div className="result-value">
                    身高：{magicalGirl.appearance.height}<br/>
                    体重：{magicalGirl.appearance.weight}<br/>
                    发色：{magicalGirl.appearance.hairColor}<br/>
                    发型：{magicalGirl.appearance.hairStyle}<br/>
                    瞳色：{magicalGirl.appearance.eyeColor}<br/>
                    肤色：{magicalGirl.appearance.skinTone}<br/>
                    特征：{magicalGirl.appearance.specialFeature}
                  </div>
                </div>
                
                <div className="result-item">
                  <div className="result-label">✨ 变身咒语</div>
                  <div className="result-value">&ldquo;{magicalGirl.spell}&rdquo;</div>
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
        </div>
      </div>
    </div>
  )
} 