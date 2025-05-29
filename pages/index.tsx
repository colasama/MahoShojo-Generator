import React, { useState, useRef } from 'react'
import html2canvas from 'html2canvas'

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

const flowerNames = [
  '樱花', '玫瑰', '百合', '茉莉', '牡丹', '芍药', '紫罗兰', '薰衣草',
  '向日葵', '郁金香', '水仙', '康乃馨', '栀子花', '桔梗', '风信子',
  '绣球花', '茶花', '杜鹃', '蔷薇', '丁香', '海棠', '梅花', '兰花',
  '菊花', '莲花', '桃花', '梨花', '杏花', '紫藤', '月季'
]

const hairColors = ['银白色', '金黄色', '粉红色', '紫色', '蓝色', '绿色', '红色', '棕色', '黑色', '彩虹色']
const hairStyles = ['长直发', '卷发', '双马尾', '单马尾', '短发', '波浪卷', '辫子', '丸子头']
const eyeColors = ['蓝色', '绿色', '紫色', '金色', '银色', '红色', '粉色', '琥珀色', '异色瞳']
const skinTones = ['白皙', '小麦色', '健康肤色', '象牙白', '蜜桃色']
const specialFeatures = ['星星形胎记', '月牙形印记', '闪亮的眼睛', '柔和的光环', '花瓣般的唇色', '珍珠般的肌肤']

const levels = [
  { name: '种', emoji: '🌱' },
  { name: '芽', emoji: '🍃' },
  { name: '叶', emoji: '🌿' },
  { name: '蕾', emoji: '🌸' },
  { name: '花', emoji: '🌺' },
  { name: '宝石权杖', emoji: '💎' }
]

const spellTemplates = [
  '星光闪耀，{name}变身！',
  '花瓣飞舞，{name}守护之力！',
  '月光祝福，{name}觉醒！',
  '彩虹之光，{name}变身完成！',
  '爱与希望，{name}出现！',
  '梦想之力，{name}登场！',
  '纯净之心，{name}变身！',
  '奇迹绽放，{name}出击！'
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

function generateMagicalGirl(inputName: string): MagicalGirl {
  const seed = seedRandom(inputName)
  
  const flowerName = getRandomFromSeed(flowerNames, seed, 0)
  const realName = `${inputName}`
  const magicalName = `${flowerName}`
  
  const height = `${150 + (seed % 25)}cm`
  const weight = `${40 + (seed % 15)}kg`
  const hairColor = getRandomFromSeed(hairColors, seed, 1)
  const hairStyle = getRandomFromSeed(hairStyles, seed, 2)
  const eyeColor = getRandomFromSeed(eyeColors, seed, 3)
  const skinTone = getRandomFromSeed(skinTones, seed, 4)
  const specialFeature = getRandomFromSeed(specialFeatures, seed, 5)
  
  const level = getRandomFromSeed(levels, seed, 6)
  const spellTemplate = getRandomFromSeed(spellTemplates, seed, 7)
  const spell = spellTemplate.replace('{name}', magicalName)
  
  return {
    realName,
    name: magicalName,
    appearance: {
      height,
      weight,
      hairColor,
      hairStyle,
      eyeColor,
      skinTone,
      specialFeature
    },
    spell,
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
    // 添加一点延迟效果让用户感受到"生成"的过程
    setTimeout(() => {
      const result = generateMagicalGirl(inputName.trim())
      setMagicalGirl(result)
      setIsGenerating(false)
    }, 1000)
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
            {isGenerating ? '✨ 魔法生成中... ✨' : '🌸 生成我的魔法少女 🌸'}
          </button>
          
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