// pages/canshou.tsx
import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useCooldown } from '../lib/cooldown';
import Link from 'next/link';
import CanshouCard, { CanshouDetails } from '../components/CanshouCard';
import { CANSHOU_LORE } from '../lib/canshou-lore';

// 定义问卷和问题的类型
interface Question {
  id: string;
  question: string;
  options?: (string | { value: string; label: string; disabled?: boolean })[];
  type?: 'text';
  placeholder?: string;
  allowCustom?: boolean;
}

interface CanshouQuestionnaire {
  title: string;
  description: string;
  questions: Question[];
}

// 新增：用于保存JSON的按钮组件
const SaveJsonButton: React.FC<{ canshouDetails: CanshouDetails; answers: Record<string, string> }> = ({ canshouDetails, answers }) => {
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
      ...canshouDetails,
      userAnswers: answers
    };
    const jsonData = JSON.stringify(dataToSave, null, 2);
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `残兽档案_${canshouDetails.name || 'data'}.json`;
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
          </div>
          <p className="text-sm text-gray-600 mb-2">请复制以下数据并保存</p>
          <button
            onClick={() => setShowJsonText(false)}
            className="text-pink-700 text-sm"
          >
            返回
          </button>
        </div>
        <textarea
          value={JSON.stringify({ ...canshouDetails, userAnswers: answers }, null, 2)}
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


const CanshouPage: React.FC = () => {
  const router = useRouter();
  const [questionnaire, setQuestionnaire] = useState<CanshouQuestionnaire | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentAnswer, setCurrentAnswer] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [canshouDetails, setCanshouDetails] = useState<CanshouDetails | null>(null);
  const [showImageModal, setShowImageModal] = useState(false);
  const [savedImageUrl, setSavedImageUrl] = useState<string | null>(null);
  const [showIntroduction, setShowIntroduction] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showLore, setShowLore] = useState(false);
  const { isCooldown, startCooldown, remainingTime } = useCooldown('generateCanshouCooldown', 60000);

  // 加载问卷文件
  useEffect(() => {
    const fetchData = async () => {
      try {
        const questionnaireRes = await fetch('/canshou_questionnaire.json');

        if (!questionnaireRes.ok) throw new Error('加载问卷文件失败');
        const questionnaireData: CanshouQuestionnaire = await questionnaireRes.json();
        setQuestionnaire(questionnaireData);
        setAnswers({});

      } catch (error) {
        console.error('加载页面数据失败:', error);
        setError('📋 加载问卷失败，请刷新页面重试');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const proceedToNext = (answer: string) => {
    const currentQuestion = questionnaire!.questions[currentQuestionIndex];
    setAnswers(prev => ({ ...prev, [currentQuestion.id]: answer }));

    if (currentQuestionIndex < questionnaire!.questions.length - 1) {
      setIsTransitioning(true);
      setTimeout(() => {
        const nextIndex = currentQuestionIndex + 1;
        setCurrentQuestionIndex(nextIndex);
        setCurrentAnswer(answers[questionnaire!.questions[nextIndex].id] || '');
        setIsTransitioning(false);
      }, 250);
    } else {
      const finalAnswers = { ...answers, [currentQuestion.id]: answer };
      handleSubmit(finalAnswers);
    }
  };

  const handleNext = () => {
    if (currentAnswer.trim().length === 0) {
      setError('⚠️ 请输入或选择一个答案');
      return;
    }
    setError(null);
    proceedToNext(currentAnswer.trim());
  };

  const handleOptionClick = (option: string) => {
    setCurrentAnswer(option);
    // 自动进入下一题
    setTimeout(() => proceedToNext(option), 100);
  };

  const handleSubmit = async (finalAnswers: Record<string, string>) => {
    if (isCooldown) {
      setError(`请等待 ${remainingTime} 秒后再生成`);
      return;
    }
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/generate-canshou', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: finalAnswers }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (errorData.shouldRedirect) {
          router.push('/arrested');
          return;
        }
        throw new Error(errorData.message || '生成失败，服务器返回错误');
      }

      const result: CanshouDetails = await response.json();
      setCanshouDetails(result);
      startCooldown();
    } catch (err) {
      setError(err instanceof Error ? `✨ 魔法失效了！${err.message}` : '发生未知错误');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveImage = (imageUrl: string) => {
    setSavedImageUrl(imageUrl);
    setShowImageModal(true);
  };

  if (loading || !questionnaire) {
    return (
      <div className="magic-background-dark">
        <div className="container"><div className="card text-center">加载中...</div></div>
      </div>
    );
  }

  const currentQuestion = questionnaire.questions[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === questionnaire.questions.length - 1;

  return (
    <>
      <Head>
        <title>残兽生成器 - 间界残兽前进基地</title>
      </Head>
      <div className="magic-background-dark">
        <div className="container">
          <div className="card">
            <div className="text-center mb-4">
              <img src="/beast-logo.svg" className="w-full px-8" alt="残兽调查" />
              <p className="text-gray-600 mt-2">{questionnaire.description}</p>
            </div>

            {showIntroduction ? (
              <div className="text-center">
                <button onClick={() => setShowIntroduction(false)} className="generate-button text-lg">开始调查</button>
                <div className="mt-8">
                  <Link href="/" className="footer-link">返回首页</Link>
                </div>
              </div>
            ) : !canshouDetails ? (
              <>
                <div className="mb-6">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-gray-600">问题 {currentQuestionIndex + 1} / {questionnaire.questions.length}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="h-2 rounded-full bg-pink-500 transition-all duration-300" style={{ width: `${((currentQuestionIndex + 1) / questionnaire.questions.length) * 100}%` }} />
                  </div>
                </div>

                <div className="mb-4 min-h-[60px] flex items-center justify-center">
                  <h3 className={`text-xl font-medium text-center text-gray-800 transition-all duration-200 ${isTransitioning ? 'opacity-0' : 'opacity-100'}`}>
                    {currentQuestion.question}
                  </h3>
                </div>

                {currentQuestion.options && (
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    {currentQuestion.options.map((option, index) => {
                      const value = typeof option === 'string' ? option : option.value;
                      const label = typeof option === 'string' ? option : option.label;
                      const disabled = typeof option !== 'string' && option.disabled;
                      return (
                        <button key={index} onClick={() => !disabled && handleOptionClick(value)} disabled={disabled} className={`p-3 border rounded-lg text-sm text-center transition-colors ${disabled ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-white hover:bg-pink-50 hover:border-pink-300'}`}>
                          {label}
                        </button>
                      );
                    })}
                  </div>
                )}

                {(currentQuestion.type === 'text' || currentQuestion.allowCustom) && (
                  <div className="input-group">
                    <textarea
                      value={currentAnswer}
                      onChange={(e) => setCurrentAnswer(e.target.value)}
                      placeholder={currentQuestion.placeholder || "请在此输入你的想法..."}
                      className="input-field resize-y h-24"
                      maxLength={100}
                    />
                  </div>
                )}

                <button onClick={handleNext} disabled={submitting || isCooldown || !currentAnswer.trim()} className="generate-button">
                  {isCooldown ? `冷却中 (${remainingTime}s)` : submitting ? '生成中...' : isLastQuestion ? '生成档案' : '下一题'}
                </button>

                {error && <div className="error-message">{error}</div>}

                <div className="mt-8 text-center">
                  <Link href="/" className="footer-link">返回首页</Link>
                </div>
              </>
            ) : (
              <>
                <CanshouCard canshou={canshouDetails} onSaveImage={handleSaveImage} />

                {/* 新增：保存JSON文件功能 */}
                <div className="card" style={{ marginTop: '1rem' }}>
                  <div className="text-center">
                    <h3 className="text-lg font-medium text-gray-800" style={{ marginBottom: '1rem' }}>保存残兽档案</h3>
                    <SaveJsonButton canshouDetails={canshouDetails} answers={answers} />
                  </div>
                </div>

                {/* 设定说明 */}
                <div className="card">
                  <button onClick={() => setShowLore(!showLore)} className="text-lg font-medium text-gray-800 w-full text-left">
                    {showLore ? '▼ ' : '▶ '}残兽设定说明
                  </button>
                  {showLore && (
                    <div className="mt-4 text-sm text-gray-700 whitespace-pre-wrap font-mono bg-gray-100 p-4 rounded-lg">
                      {CANSHOU_LORE}
                    </div>
                  )}
                </div>
                <div className="mt-8 text-center">
                  <Link href="/" className="footer-link">返回首页</Link>
                </div>
              </>
            )}
          </div>

          <footer className="footer text-gray-300">
            <p>
              设计与制作 <a href="https://github.com/notuhao" target="_blank" rel="noopener noreferrer" className="footer-link">@末伏之夜</a>
            </p>
            <p>
              <a href="https://github.com/colasama" target="_blank" rel="noopener noreferrer" className="footer-link">@Colanns</a> 急速出品
            </p>
            <p>
              本项目 AI 能力由&nbsp;
              <a href="https://github.com/KouriChat/KouriChat" target="_blank" rel="noopener noreferrer" className="footer-link">KouriChat</a> &&nbsp;
              <a href="https://api.kourichat.com/" target="_blank" rel="noopener noreferrer" className="footer-link">Kouri API</a>
              &nbsp;强力支持
            </p>
            <p>
              <a href="https://github.com/colasama/MahoShojo-Generator" target="_blank" rel="noopener noreferrer" className="footer-link">colasama/MahoShojo-Generator</a>
            </p>
          </footer>
        </div>
      </div>

      {showImageModal && savedImageUrl && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-lg w-full max-h-[80vh] overflow-auto relative p-4">
            <button onClick={() => setShowImageModal(false)} className="absolute top-2 right-2 text-3xl text-gray-600 hover:text-gray-900">&times;</button>
            <p className="text-center text-sm text-gray-600 mb-2">长按图片保存到相册</p>
            <img src={savedImageUrl} alt="残兽档案" className="w-full h-auto rounded-lg" />
          </div>
        </div>
      )}
    </>
  );
};

export default CanshouPage;