// pages/sublimation.tsx

import React, { useState, ChangeEvent } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Link from 'next/link';
import MagicalGirlCard from '../components/MagicalGirlCard';
import CanshouCard from '../components/CanshouCard';
import { quickCheck } from '@/lib/sensitive-word-filter';

const SublimationPage: React.FC = () => {
  const router = useRouter();
  const [characterData, setCharacterData] = useState<any>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultData, setResultData] = useState<any | null>(null);
  const [savedImageUrl, setSavedImageUrl] = useState<string | null>(null);
  const [showImageModal, setShowImageModal] = useState(false);

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      setCharacterData(null);
      setFileName(null);
      return;
    }
    if (file.type !== 'application/json') {
      setError('❌ 文件必须是 .json 格式。');
      return;
    }

    try {
      const text = await file.text();
      const json = JSON.parse(text);
      if (!json.arena_history) {
        throw new Error('角色文件缺少必需的“arena_history”（历战记录）属性。');
      }
      setCharacterData(json);
      setFileName(file.name);
      setError(null);
      setResultData(null); // 清除旧结果
    } catch (err) {
      const message = err instanceof Error ? err.message : '无法解析文件。';
      setError(`❌ 文件读取失败: ${message}`);
      setCharacterData(null);
      setFileName(null);
    } finally {
      event.target.value = '';
    }
  };

  const handleGenerate = async () => {
    if (!characterData) {
      setError('⚠️ 请先上传一个角色设定文件。');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setResultData(null);

    try {
      if (await quickCheck(JSON.stringify(characterData))) {
          router.push('/arrested');
          return;
      }

      const response = await fetch('/api/generate-sublimation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(characterData),
      });

      if (!response.ok) {
        const errorJson = await response.json().catch(() => ({ message: '服务器响应异常' }));
        if (errorJson.shouldRedirect) {
          router.push('/arrested');
          return;
        }
        throw new Error(errorJson.message || errorJson.error || '升华失败');
      }

      const result = await response.json();
      setResultData(result);

    } catch (err) {
      const message = err instanceof Error ? err.message : '发生未知错误';
      setError(`✨ 升华失败！${message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveImage = (imageUrl: string) => {
    setSavedImageUrl(imageUrl);
    setShowImageModal(true);
  };
  
  const downloadJson = (data: any) => {
    const name = data.codename || data.name;
    const jsonData = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `角色档案_${name}_升华.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };
  
  // 动态渲染角色卡片
  const renderResultCard = () => {
    if (!resultData) return null;

    // 判断是魔法少女还是残兽
    if (resultData.codename) {
      // 魔法少女卡片需要渐变色，我们从配色方案中提取一个
      const colorScheme = resultData.appearance.colorScheme || "粉色、白色";
      const mainColor = colorScheme.split('、')[0];
      const gradientStyle = `linear-gradient(135deg, hsl(var(--${mainColor}-400)), hsl(var(--${mainColor}-600)))`;
      return <MagicalGirlCard magicalGirl={resultData} gradientStyle={gradientStyle} onSaveImage={handleSaveImage} />;
    } else if (resultData.name) {
      return <CanshouCard canshou={resultData} onSaveImage={handleSaveImage} />;
    }
    return <div className="error-message">无法识别的角色类型</div>;
  };

  return (
    <>
      <Head>
        <title>成长升华 - MahoShojo Generator</title>
        <meta name="description" content="根据角色的历战记录，生成一个全新的成长后形态！" />
      </Head>
      <div className="magic-background-white">
        <div className="container">
          <div className="card">
            <div className="text-center mb-4">
              <h1 className="text-3xl font-bold text-gray-800">成长升华</h1>
              <p className="subtitle mt-2">见证她们在战斗与经历中完成的蜕变</p>
            </div>

            <div className="mb-6 p-4 bg-purple-50 border border-purple-200 rounded-lg text-sm text-purple-800">
              <h3 className="font-bold mb-2">✨ 功能说明</h3>
              <ol className="list-decimal list-inside space-y-1">
                <li>上传一个包含【历战记录】(arena_history) 的角色设定文件 (.json)。</li>
                <li>AI 将会阅读角色的全部设定和所有经历。</li>
                <li>为你生成一个“成长之后”的全新角色设定！</li>
              </ol>
            </div>

            <div className="input-group">
              <label htmlFor="character-upload" className="input-label">上传角色设定文件</label>
              <input 
                id="character-upload" 
                type="file" 
                accept=".json" 
                onChange={handleFileChange}
                className="input-field file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
              />
              {fileName && (
                <p className="text-xs text-gray-500 mt-2">已加载角色: {fileName}</p>
              )}
            </div>
            
            <button onClick={handleGenerate} disabled={isGenerating || !characterData} className="generate-button">
              {isGenerating ? '升华中...' : '开始升华'}
            </button>

            {error && <div className="error-message mt-4">{error}</div>}
          </div>

          {isGenerating && <div className="text-center mt-6">少女蜕变中，请稍后...</div>}
          
          {resultData && (
            <>
              {renderResultCard()}
              <div className="card mt-6 text-center">
                <h3 className="text-lg font-bold text-gray-800 mb-3">操作</h3>
                <div className="flex flex-col md:flex-row gap-4 justify-center">
                    <button onClick={() => downloadJson(resultData)} className="generate-button flex-1">
                      下载新设定
                    </button>
                    <Link href="/battle" className="generate-button flex-1" style={{ backgroundColor: '#22c55e', backgroundImage: 'linear-gradient(to right, #22c55e, #16a34a)' }}>
                      前往竞技场
                    </Link>
                </div>
              </div>
            </>
          )}

          <div className="text-center" style={{ marginTop: '2rem' }}>
            <Link href="/" className="footer-link">返回首页</Link>
          </div>
        </div>

        {showImageModal && savedImageUrl && (
            <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-lg w-full max-h-[80vh] overflow-auto relative p-4">
                <button onClick={() => setShowImageModal(false)} className="absolute top-2 right-2 text-3xl text-gray-600 hover:text-gray-900">&times;</button>
                <p className="text-center text-sm text-gray-600 mb-2">长按图片保存到相册</p>
                <img src={savedImageUrl} alt="角色卡片" className="w-full h-auto rounded-lg" />
            </div>
            </div>
        )}
      </div>
    </>
  );
};

export default SublimationPage;