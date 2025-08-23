// pages/scenario.tsx

import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { quickCheck } from '@/lib/sensitive-word-filter';

// 定义引导性问题
const scenarioQuestions = [
  { id: 'scene', label: '故事发生的场景是怎样的？', placeholder: '例如：黄昏时分的废弃钟楼顶端，晚风吹拂，可以俯瞰整座城市...' },
  { id: 'roles', label: '场景中有需要出现的角色（NPC）吗？', placeholder: '【强烈建议】此项填写“未指定”，让AI不生成此项内容。如果需要添加场景固定角色，则可以填写例如这样的内容：一位守护钟楼、知晓一切的老钟表匠；一只只会说反话的黑猫...' },
  { id: 'events', label: '角色们在这里需要做什么核心事件？', placeholder: '例如：进行一场一对一的决斗；合作解开一个古老的谜题；接受一次特别的采访...' },
  { id: 'atmosphere', label: '希望故事的整体氛围是怎样的？', placeholder: '例如：轻松愉快、紧张悬疑、悲伤感人、热血沸腾...' },
  { id: 'development', label: '故事可能会有哪些有趣的发展方向？', placeholder: '例如：决斗中途有第三方介入；谜题的答案指向一个惊人的秘密；采访者突然问了一个尖锐的问题...' },
];

const ScenarioPage: React.FC = () => {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, string>>(
    scenarioQuestions.reduce((acc, q) => ({ ...acc, [q.label]: '' }), {})
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultData, setResultData] = useState<any | null>(null);

  // 多语言支持
  const [languages, setLanguages] = useState<{ code: string; name: string }[]>([]);
  const [selectedLanguage, setSelectedLanguage] = useState('zh-CN');

  useEffect(() => {
      fetch('/languages.json')
          .then(res => res.json())
          .then(data => setLanguages(data))
          .catch(err => console.error("Failed to load languages:", err));
  }, []);

  const handleAnswerChange = (id: string, value: string) => {
    setAnswers(prev => ({ ...prev, [id]: value }));
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);
    setResultData(null);
    
    try {
      if ((await quickCheck(JSON.stringify(answers))).hasSensitiveWords) {
        router.push({
            pathname: '/arrested',
            query: { reason: '在情景问卷中使用了危险符文' }
        });
        return;
      }

      const response = await fetch('/api/generate-scenario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers, language: selectedLanguage }),
      });

      if (!response.ok) {
          const errorJson = await response.json().catch(() => ({ message: '服务器响应异常' }));
          if (errorJson.shouldRedirect) {
              router.push({
                  pathname: '/arrested',
                  query: { reason: errorJson.reason || '使用危险符文' }
              });
              return;
          }
          throw new Error(errorJson.message || errorJson.error || '生成失败');
      }

      const result = await response.json();
      setResultData(result);

    } catch (err) {
      const message = err instanceof Error ? err.message : '发生未知错误';
      setError(`✨ 剧本创作失败！${message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadJson = (data: any) => {
    const title = data.title || '自定义情景';
    const jsonData = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${title}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };
  
  const copyToClipboard = (data: any) => {
    const jsonData = JSON.stringify(data, null, 2);
    navigator.clipboard.writeText(jsonData)
      .then(() => alert('已复制到剪贴板！'))
      .catch(() => alert('复制失败'));
  };

  return (
    <>
      <Head>
        <title>情景生成 - MahoShojo Generator</title>
        <meta name="description" content="通过回答问题，快速生成用于竞技场的自定义故事场景。" />
      </Head>
      <div className="magic-background-white">
        <div className="container">
          <div className="card">
            <div className="text-center mb-4">
              <h1 className="text-3xl font-bold text-gray-800">情景生成</h1>
              <p className="subtitle mt-2">创建独一无二的舞台，上演属于你的故事</p>
            </div>
            
            <div className="space-y-6">
              {scenarioQuestions.map(q => (
                <div key={q.id} className="input-group">
                  <label htmlFor={q.id} className="input-label">{q.label}</label>
                  <textarea
                    id={q.id}
                    value={answers[q.label]}
                    onChange={(e) => handleAnswerChange(q.label, e.target.value)}
                    placeholder={q.placeholder}
                    className="input-field resize-y h-24"
                    rows={3}
                  />
                </div>
              ))}
            </div>

            {/* 多语言支持 */}
            <div className="input-group mt-6">
                <label htmlFor="language-select" className="input-label">
                    <img src="/globe.svg" alt="Language" className="inline-block w-4 h-4 mr-2" />
                    生成语言
                </label>
                <select
                    id="language-select"
                    value={selectedLanguage}
                    onChange={(e) => setSelectedLanguage(e.target.value)}
                    className="input-field"
                    disabled={isGenerating}
                >
                    {languages.map(lang => (
                        <option key={lang.code} value={lang.code}>{lang.name}</option>
                    ))}
                </select>
            </div>

            <button onClick={handleGenerate} disabled={isGenerating} className="generate-button mt-8">
              {isGenerating ? '正在构建舞台...' : '生成情景'}
            </button>
            {error && <div className="error-message mt-4">{error}</div>}
          </div>

          {resultData && (
            <div className="card mt-6">
              <h2 className="text-2xl font-bold text-center mb-4">{resultData.title}</h2>
              <div className="bg-gray-100 p-4 rounded-lg font-mono text-xs overflow-x-auto">
                <pre>{JSON.stringify(resultData, null, 2)}</pre>
              </div>
              <div className="flex flex-col md:flex-row gap-4 justify-center mt-6">
                <button onClick={() => downloadJson(resultData)} className="generate-button flex-1">
                  下载情景文件
                </button>
                <button onClick={() => copyToClipboard(resultData)} className="generate-button flex-1" style={{ backgroundColor: '#3b82f6', backgroundImage: 'linear-gradient(to right, #3b82f6, #2563eb)' }}>
                  复制到剪贴板
                </button>
              </div>
            </div>
          )}

          <div className="text-center" style={{ marginTop: '2rem' }}>
            <Link href="/" className="footer-link">返回首页</Link>
          </div>
        </div>
      </div>
    </>
  );
};

export default ScenarioPage;