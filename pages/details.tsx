import React, { useState, useEffect } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'

interface Questionnaire {
  questions: string[]
}

const DetailsPage: React.FC = () => {
  const router = useRouter()
  const [questions, setQuestions] = useState<string[]>([])
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [answers, setAnswers] = useState<string[]>([])
  const [currentAnswer, setCurrentAnswer] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [isTransitioning, setIsTransitioning] = useState(false)

  useEffect(() => {
    // 加载问卷数据
    fetch('/questionnaire.json')
      .then(response => response.json())
      .then((data: Questionnaire) => {
        setQuestions(data.questions)
        setAnswers(new Array(data.questions.length).fill(''))
        setLoading(false)
      })
      .catch(error => {
        console.error('加载问卷失败:', error)
        setLoading(false)
      })
  }, [])

  const handleNext = () => {
    if (currentAnswer.trim().length === 0) {
      alert('请输入答案')
      return
    }

    if (currentAnswer.length > 30) {
      alert('答案不得超过30字')
      return
    }

    proceedToNextQuestion(currentAnswer.trim())
  }

  const handleQuickOption = (option: string) => {
    proceedToNextQuestion(option)
  }

  const proceedToNextQuestion = (answer: string) => {
    // 保存当前答案
    const newAnswers = [...answers]
    newAnswers[currentQuestionIndex] = answer
    setAnswers(newAnswers)

    if (currentQuestionIndex < questions.length - 1) {
      // 开始渐变动画
      setIsTransitioning(true)

      // 延迟切换题目，让淡出动画完成
      setTimeout(() => {
        setCurrentQuestionIndex(currentQuestionIndex + 1)
        setCurrentAnswer(newAnswers[currentQuestionIndex + 1] || '')

        // 短暂延迟后开始淡入动画
        setTimeout(() => {
          setIsTransitioning(false)
        }, 50)
      }, 250)
    } else {
      // 提交
      handleSubmit(newAnswers)
    }
  }

  const handleSubmit = async (finalAnswers: string[]) => {
    setSubmitting(true)
    try {
      console.log('提交答案:', finalAnswers);
      const response = await fetch('/api/generate-magical-girl-details', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ answers: finalAnswers })
      })

      if (response.ok) {
        const result = await response.json()
        console.log('生成结果:', result)
        // 这里可以跳转到结果页面或显示结果
        alert('生成成功!')
      } else {
        throw new Error('生成失败')
      }
    } catch (error) {
      console.error('提交失败:', error)
      alert('提交失败，请重试')
    } finally {
      setSubmitting(false)
    }
  }


  if (loading) {
    return (
      <div className="magic-background">
        <div className="container">
          <div className="card">
            <div className="text-center text-lg">加载中...</div>
          </div>
        </div>
      </div>
    )
  }

  if (questions.length === 0) {
    return (
      <div className="magic-background">
        <div className="container">
          <div className="card">
            <div className="error-message">加载问卷失败</div>
          </div>
        </div>
      </div>
    )
  }

  const isLastQuestion = currentQuestionIndex === questions.length - 1

  return (
    <>
      <Head>
        <title>魔法少女问卷 - IFMahouShoujo</title>
        <meta name="description" content="回答问卷，生成您的专属魔法少女" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="magic-background">
        <div className="container">
          <div className="card">
            {/* Logo */}
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '1rem' }}>
              <img src="/questionnaire-logo.svg" width={250} height={160} alt="Questionnaire Logo" />
            </div>

            {/* 进度指示器 */}
            <div style={{ marginBottom: '1.5rem' }}>
              <div className="flex justify-between items-center" style={{ marginBottom: '0.5rem' }}>
                <span className="text-sm text-gray-600">
                  问题 {currentQuestionIndex + 1} / {questions.length}
                </span>
                <span className="text-sm text-gray-600">
                  {Math.round(((currentQuestionIndex + 1) / questions.length) * 100)}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="h-2 rounded-full transition-all duration-300"
                  style={{
                    width: `${((currentQuestionIndex + 1) / questions.length) * 100}%`,
                    background: 'linear-gradient(to right, #3b82f6, #1d4ed8)'
                  }}
                />
              </div>
            </div>

            {/* 问题 */}
            <div style={{ marginBottom: '1rem', minHeight: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <h2
                className="text-xl font-medium leading-relaxed text-center text-blue-900"
                style={{
                  opacity: isTransitioning ? 0 : 1,
                  transition: 'opacity 0.3s ease-in-out, transform 0.3s ease-in-out',
                  transform: isTransitioning ? 'translateX(-100px)' : 'translateX(0)',
                  animation: !isTransitioning && currentQuestionIndex > 0 ? 'slideInFromRight 0.3s ease-out' : 'none'
                }}
              >
                {questions[currentQuestionIndex]}
              </h2>
            </div>

            {/* 输入框 */}
            <div className="input-group">
              <textarea
                value={currentAnswer}
                onChange={(e) => setCurrentAnswer(e.target.value)}
                placeholder="请输入您的答案（不超过30字）"
                className="input-field resize-none h-24"
                maxLength={30}
              />
              <div className="text-right text-sm text-gray-500" style={{ marginTop: '-2rem', marginRight: '0.5rem' }}>
                {currentAnswer.length}/30
              </div>
            </div>

            {/* 快捷选项 */}
            <div className="flex gap-2 justify-center" style={{ marginBottom: '1rem', marginTop: '2rem' }}>
              <button
                onClick={() => handleQuickOption('还没想好')}
                disabled={isTransitioning}
                className="generate-button h-10"
                style={{ marginBottom: 0, padding: 0 }}
              >
                还没想好
              </button>
              <button
                onClick={() => handleQuickOption('不想回答')}
                disabled={isTransitioning}
                className="generate-button h-10"
                style={{ marginBottom: 0, padding: 0 }}
              >
                不想回答
              </button>
            </div>

            {/* 下一题按钮 */}
            <button
              onClick={handleNext}
              disabled={submitting || currentAnswer.trim().length === 0 || isTransitioning}
              className="generate-button"
            >
              {submitting ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin h-4 w-4 text-white" style={{ marginLeft: '-0.25rem', marginRight: '0.5rem' }} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  提交中...
                </span>
              ) : (
                isLastQuestion ? '提交' : '下一题'
              )}
            </button>

            {/* 返回首页链接 */}
            <div className="text-center" style={{ marginTop: '1rem' }}>
              <button
                onClick={() => router.push('/')}
                className="footer-link"
              >
                返回首页
              </button>
            </div>
          </div>

          <footer className="footer text-white">
            <p className="text-white">
              <a href="https://github.com/colasama" target="_blank" rel="noopener noreferrer" className="footer-link">@Colanns</a> 急速出品
            </p>
            <p className="text-white">
              问卷与系统设计 <a className="footer-link">@末伏之夜</a>
            </p>
            <p className="text-white">
              <a href="https://github.com/colasama/MahoShojo-Generator" target="_blank" rel="noopener noreferrer" className="footer-link">colasama/MahoShojo-Generator</a>
            </p>
          </footer>
        </div>
      </div>
    </>
  )
}

export default DetailsPage