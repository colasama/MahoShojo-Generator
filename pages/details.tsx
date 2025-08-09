// pages/details.tsx

import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import MagicalGirlCard from '../components/MagicalGirlCard';
import { useCooldown } from '../lib/cooldown';
import { quickCheck } from '@/lib/sensitive-word-filter';
// 新增：导入 Link 组件，用于页面跳转
import Link from 'next/link';
import TachieGenerator from '../components/TachieGenerator';

interface Questionnaire {
  questions: string[];
}

interface MagicalGirlDetails {
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
}

const SaveJsonButton: React.FC<{ magicalGirlDetails: MagicalGirlDetails; answers: string[] }> = ({ magicalGirlDetails, answers }) => {
  const [isMobile, setIsMobile] = useState(false);
  const [showJsonText, setShowJsonText] = useState(false);

  useEffect(() => {
    const userAgent = navigator.userAgent.toLowerCase();
    const isMobileDevice = /mobile|android|iphone|ipad|ipod|blackberry|iemobile|opera mini/.test(userAgent);
    setIsMobile(isMobileDevice);
  }, []);

  const downloadJson = () => {
    // 将用户答案添加到保存的数据中
    const dataToSave = {
      ...magicalGirlDetails,
      userAnswers: answers
    };
    const jsonData = JSON.stringify(dataToSave, null, 2);
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `魔法少女_${magicalGirlDetails.codename || 'data'}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleSave = () => {
    if (isMobile) {
      setShowJsonText(true);
    } else {
      downloadJson();
    }
  };

  if (showJsonText) {
    return (
      <div className="text-left">
        <div className="mb-4 text-center">
          <div className="p-3 mb-4 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-800 text-xs rounded-r-lg">
            <p className="font-bold">手机用户操作提示：</p>
            <p className="mt-1">建议使用电脑进行文件操作。手机用户请复制下方全部内容，并将其手动保存为一个以 <code className="bg-yellow-200 px-1 rounded">.json</code> 结尾的文件。</p>
            <p className="mt-1">您也可以直接将复制的内容粘贴到【魔法少女竞技场】的文本输入框中，但此方式可能较为不便。</p>
          </div>
          <p className="text-sm text-gray-600 mb-2">请复制以下数据并保存</p>
          <button
            onClick={() => setShowJsonText(false)}
            className="text-blue-600 text-sm"
          >
            返回
          </button>
        </div>
        <textarea
          value={JSON.stringify({ ...magicalGirlDetails, userAnswers: answers }, null, 2)}
          readOnly
          className="w-full h-64 p-3 border rounded-lg text-xs font-mono bg-gray-50 text-gray-900"
          onClick={(e) => (e.target as HTMLTextAreaElement).select()}
        />
        <p className="text-xs text-gray-500 mt-2 text-center">点击文本框可全选内容</p>
      </div>
    );
  }

  return (
    <button
      onClick={handleSave}
      className="generate-button"
    >
      {isMobile ? '查看原始数据' : '下载设定文件'}
    </button>
  );
};

const DetailsPage: React.FC = () => {
  const router = useRouter();
  const [questions, setQuestions] = useState<string[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [currentAnswer, setCurrentAnswer] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [magicalGirlDetails, setMagicalGirlDetails] = useState<MagicalGirlDetails | null>(null);
  const [showImageModal, setShowImageModal] = useState(false);
  const [savedImageUrl, setSavedImageUrl] = useState<string | null>(null);
  const [showIntroduction, setShowIntroduction] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const { isCooldown, startCooldown, remainingTime } = useCooldown('generateDetailsCooldown', 60000);

  useEffect(() => {
    // 加载问卷数据
    fetch('/questionnaire.json')
      .then(response => {
        if (!response.ok) {
          throw new Error('加载问卷文件失败');
        }
        return response.json();
      })
      .then((data: Questionnaire) => {
        setQuestions(data.questions);
        setAnswers(new Array(data.questions.length).fill(''));
        setLoading(false);
      })
      .catch(error => {
        console.error('加载问卷失败:', error);
        setError('📋 加载问卷失败，请刷新页面重试');
        setLoading(false);
      });
  }, []);

  const handleNext = () => {
    if (currentAnswer.trim().length === 0) {
      setError('⚠️ 请输入答案后再继续');
      return;
    }

    if (currentAnswer.length > 80) {
      setError('⚠️ 答案不能超过80字');
      return;
    }

    setError(null); // 清除错误信息

    proceedToNextQuestion(currentAnswer.trim());
  };

  const handleQuickOption = (option: string) => {
    proceedToNextQuestion(option);
  };

  const proceedToNextQuestion = (answer: string) => {
    // 保存当前答案
    const newAnswers = [...answers];
    newAnswers[currentQuestionIndex] = answer;
    setAnswers(newAnswers);

    if (currentQuestionIndex < questions.length - 1) {
      // 开始渐变动画
      setIsTransitioning(true);

      // 延迟切换题目，让淡出动画完成
      setTimeout(() => {
        setCurrentQuestionIndex(currentQuestionIndex + 1);
        setCurrentAnswer(newAnswers[currentQuestionIndex + 1] || '');

        // 短暂延迟后开始淡入动画
        setTimeout(() => {
          setIsTransitioning(false);
        }, 50);
      }, 250);
    } else {
      // 提交
      handleSubmit(newAnswers);
    }
  };

  const checkSensitiveWords = async (content: string) => {
    const checkResult = await quickCheck(content);
    if (checkResult.hasSensitiveWords) {
      router.push('/arrested');
      return true;
    }
    return false;
  }

  const handleSubmit = async (finalAnswers: string[]) => {
    if (isCooldown) {
      setError(`请等待 ${remainingTime} 秒后再生成`);
      return;
    }
    setSubmitting(true);
    setError(null); // 清除之前的错误
    // 检查
    console.log('检查敏感词:', finalAnswers.join(''));
    if (await checkSensitiveWords(finalAnswers.join(''))) return;

    try {
      console.log('提交答案:', finalAnswers);
      const response = await fetch('/api/generate-magical-girl-details', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ answers: finalAnswers })
      });

      if (!response.ok) {
        const errorData = await response.json();

        // 处理不同的 HTTP 状态码
        if (response.status === 429) {
          const retryAfter = errorData.retryAfter || 60;
          throw new Error(`请求过于频繁！请等待 ${retryAfter} 秒后再试。`);
        } else if (response.status >= 500) {
          throw new Error('服务器内部错误，当前可能正忙，请稍后重试');
        } else {
          throw new Error(errorData.message || errorData.error || '生成失败');
        }
      }

      const result: MagicalGirlDetails = await response.json();
      console.log('生成结果:', result);
      // 加入后置生成敏感词检测
      if (await checkSensitiveWords(JSON.stringify(result))) return;

      setMagicalGirlDetails(result);
      setError(null); // 成功时清除错误
    } catch (error) {
      console.error('提交失败:', error);

      // 处理不同类型的错误
      if (error instanceof Error) {
        const errorMessage = error.message;

        // 检查是否是 rate limit 错误
        if (errorMessage.includes('请求过于频繁')) {
          setError('🚫 请求太频繁了！每2分钟只能生成一次哦~请稍后再试吧！');
        } else if (errorMessage.includes('网络') || error instanceof TypeError) {
          setError('🌐 网络连接有问题！请检查网络后重试~');
        } else {
          setError(`✨ 魔法失效了！${errorMessage}`);
        }
      } else {
        setError('✨ 魔法失效了！生成详情时发生未知错误，请重试');
      }
    } finally {
      setSubmitting(false);
      startCooldown();
    }
  };

  const handleSaveImage = (imageUrl: string) => {
    setSavedImageUrl(imageUrl);
    setShowImageModal(true);
  };

  const handleStartQuestionnaire = () => {
    setShowIntroduction(false);
  };


  if (loading) {
    return (
      <div className="magic-background">
        <div className="container">
          <div className="card">
            <div className="text-center text-lg">加载中...</div>
          </div>
        </div>
      </div>
    );
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
    );
  }

  const isLastQuestion = currentQuestionIndex === questions.length - 1;

  return (
    <>
      <Head>
        <title>魔法少女调查问卷 ~ 奇妙妖精大调查</title>
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

            {showIntroduction ? (
              // 介绍部分
              <div className="text-center">
                <div className="mb-6 leading-relaxed text-gray-800"
                  style={{ lineHeight: '1.5', marginTop: '3rem', marginBottom: '4rem' }}
                >
                  你在魔法少女道路上的潜力和表现将会如何？<br />
                  <p style={{ fontSize: '0.8rem', marginTop: '1rem', color: '#999', fontStyle: 'italic' }}>本测试设定来源于小说《下班，然后变成魔法少女》</p>
                  <p style={{ fontSize: '0.8rem', marginTop: '1rem', color: '#999', fontStyle: 'italic' }}>首页：mahoshojo.colanns.me</p>
                  <p style={{ fontSize: '0.8rem', marginTop: '0.2rem', color: '#999', fontStyle: '' }}><del>以及广告位募集中</del></p>
                  <p style={{ fontSize: '0.8rem', marginTop: '0.2rem', color: '#999', fontStyle: '' }}><del>如有意向请联系魔法国度研究院院长 @祖母绿：1********</del></p>
                </div>
                <button
                  onClick={handleStartQuestionnaire}
                  className="generate-button text-lg"
                  style={{ marginBottom: '0rem' }}
                >
                  开始回答
                </button>

                {/* 返回首页链接 */}
                <div className="text-center" style={{ marginTop: '2rem' }}>
                  <button
                    onClick={() => router.push('/')}
                    className="footer-link"
                  >
                    返回首页
                  </button>
                </div>
              </div>
            ) : (
              // 问卷部分
              <>
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
                    placeholder="请输入您的答案（不超过80字）"
                    className="input-field resize-none h-24"
                    maxLength={80}
                  />
                  <div className="text-right text-sm text-gray-500" style={{ marginTop: '-2rem', marginRight: '0.5rem' }}>
                    {currentAnswer.length}/80
                  </div>
                </div>

                {/* 快捷选项 */}
                <div className="flex gap-2 justify-center" style={{ marginBottom: '1rem', marginTop: '2rem' }}>
                  <button
                    onClick={() => handleQuickOption('还没想好')}
                    disabled={submitting || isTransitioning || isCooldown}
                    className="generate-button h-10"
                    style={{ marginBottom: 0, padding: 0 }}
                  >
                    还没想好
                  </button>
                  <button
                    onClick={() => handleQuickOption('不想回答')}
                    disabled={submitting || isTransitioning || isCooldown}
                    className="generate-button h-10"
                    style={{ marginBottom: 0, padding: 0 }}
                  >
                    不想回答
                  </button>
                </div>

                {/* 下一题按钮 */}
                <button
                  onClick={handleNext}
                  disabled={submitting || currentAnswer.trim().length === 0 || isTransitioning || isCooldown}
                  className="generate-button"
                >
                  {isCooldown
                    ? `请等待 ${remainingTime} 秒`
                    : submitting
                      ? (
                        <span className="flex items-center justify-center">
                          <svg className="animate-spin h-4 w-4 text-white" style={{ marginLeft: '-0.25rem', marginRight: '0.5rem' }} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          提交中...
                        </span>
                      )
                      : isLastQuestion
                        ? '提交'
                        : '下一题'}
                </button>

                {/* 错误信息显示 */}
                {error && (
                  <div className="error-message">
                    {error}
                  </div>
                )}

                {/* 返回首页链接 */}
                <div className="text-center" style={{ marginTop: '1rem' }}>
                  <button
                    onClick={() => router.push('/')}
                    className="footer-link"
                  >
                    返回首页
                  </button>
                </div>
              </>
            )}
          </div>

          {/* 显示魔法少女详细信息结果 */}
          {magicalGirlDetails && (
            <>
              <MagicalGirlCard
                magicalGirl={magicalGirlDetails}
                gradientStyle="linear-gradient(135deg, #9775fa 0%, #b197fc 100%)"
                onSaveImage={handleSaveImage}
              />
              {/* 关键解释抽屉 点击展开 点击关闭 */}
              <div className="card" style={{ marginTop: '1rem' }}>
                <div className="text-center">
                  <button
                    onClick={() => setShowDetails(!showDetails)}
                    className="text-lg font-medium text-blue-900 hover:text-blue-700 transition-colors duration-200"
                    style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    {showDetails ? '点击收起设定说明' : '点击展开设定说明'} {showDetails ? '▼' : '▶'}
                  </button>
                  {showDetails && (
                    <div className="text-left" style={{ marginTop: '1rem' }}>
                      <div className="mb-4">
                        <h4 className="font-medium text-blue-800 mb-2">1. 魔力构装（简称魔装）</h4>
                        <p className="text-sm text-gray-700 leading-relaxed">
                          魔法少女的本相魔力所孕育的能力具现，是魔法少女能力体系的基础。一般呈现为魔法少女在现实生活中接触过，在冥冥之中与其命运关联或映射的物体，并且与魔法少女特色能力相关。例如，泡泡机形态的魔装可以使魔法少女制造魔法泡泡，而这些泡泡可以拥有产生幻象、缓冲防护、束缚困敌等能力。这部分的内容需包含魔装的名字（通常为2字词），魔装的形态，魔装的基本能力。
                        </p>
                      </div>
                      <div className="mb-4">
                        <h4 className="font-medium text-blue-800 mb-2">2. 奇境规则</h4>
                        <p className="text-sm text-gray-700 leading-relaxed">
                          魔法少女的本相灵魂所孕育的能力，是魔装能力的一体两面。奇境是魔装能力在规则层面上的升华，体现为与魔装相关的规则领域，而规则的倾向则会根据魔法少女的倾向而有不同的发展。例如，泡泡机形态的魔装升华而来的奇境规则可以是倾向于守护的&ldquo;戳破泡泡的东西将会立即无效化&rdquo;，也可以是倾向于进攻的&ldquo;沾到身上的泡泡被戳破会立即遭受伤害&rdquo;。
                        </p>
                      </div>
                      <div className="mb-4">
                        <h4 className="font-medium text-blue-800 mb-2">3. 繁开</h4>
                        <p className="text-sm text-gray-700 leading-relaxed">
                          是魔法少女魔装能力的二段进化与解放，无论是作为魔法少女的魔力衣装还是魔装的武器外形都会发生改变。需包含繁开状态魔装名（需要包含原魔装名的每个字），繁开后的进化能力，繁开后的魔装形态，繁开后的魔法少女衣装样式（在通常变身外观上的升级与改变）。
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 保存原始数据按钮 */}
              <div className="card" style={{ marginTop: '1rem' }}>
                <div className="text-center">
                  <h3 className="text-lg font-medium text-blue-900" style={{ marginBottom: '1rem' }}>保存人物设定</h3>
                  <SaveJsonButton magicalGirlDetails={magicalGirlDetails} answers={answers} />
                  {/* 新增：前往竞技场的入口 */}
                  <div style={{ marginTop: '0.5rem', paddingTop: '1.5rem', borderTop: '1px solid #e5e7eb' }}>
                    <p className="text-sm text-gray-600 mb-2">
                      保存好你的设定文件了吗？
                    </p>
                    <Link href="/battle" className="footer-link" style={{ color: '#193cb8', fontSize: '1.125rem' }}>
                      前往竞技场，开始战斗！→
                    </Link>
                  </div>
                </div>
              </div>

              {/* 立绘生成器 */}
              <div className="card" style={{ marginTop: '1rem' }}>
                <div className="text-center">
                  <h3 className="text-lg font-medium text-blue-900" style={{ marginBottom: '1rem' }}>生成立绘</h3>
                  <TachieGenerator
                    prompt={`${JSON.stringify(magicalGirlDetails.appearance)} , Xiabanmo, 二次元, 魔法少女`}
                  />
                </div>
              </div>
            </>
          )}

          <footer className="footer text-white">
            <p className="text-white">
              竞技场、问卷与系统设计 <a href="https://github.com/notuhao" target="_blank" rel="noopener noreferrer" className="footer-link">@末伏之夜</a>
            </p>
            <p className="text-white">
              <a href="https://github.com/colasama" target="_blank" rel="noopener noreferrer" className="footer-link">@Colanns</a> 急速出品
            </p>
            <p className="text-white">
              本项目 AI 能力由&nbsp;
              <a href="https://github.com/KouriChat/KouriChat" target="_blank" rel="noopener noreferrer" className="footer-link">KouriChat</a> &&nbsp;
              <a href="https://api.kourichat.com/" target="_blank" rel="noopener noreferrer" className="footer-link">Kouri API</a>
              &nbsp;强力支持
            </p>
            <p className="text-white">
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
              <div className="flex justify-between items-center m-0 absolute top-0 right-0">
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
                  alt="魔法少女详细档案"
                  className="w-1/2 h-auto rounded-lg mx-auto"
                />
              </div>
            </div>
          </div>
        )}

      </div>
    </>
  );
};

export default DetailsPage;