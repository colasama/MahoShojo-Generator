// pages/sublimation.tsx

import React, { useState, ChangeEvent, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Link from 'next/link';
import MagicalGirlCard from '../components/MagicalGirlCard';
import CanshouCard from '../components/CanshouCard';
import { quickCheck } from '@/lib/sensitive-word-filter';

// 新增：递归提取对象中所有字符串值的函数，用于敏感词检查
const extractTextForCheck = (data: any): string => {
    let textContent = '';
    if (typeof data === 'string') {
        textContent += data + ' ';
    } else if (Array.isArray(data)) {
        data.forEach(item => {
            textContent += extractTextForCheck(item);
        });
    } else if (typeof data === 'object' && data !== null) {
        for (const key in data) {
            // 排除签名和答案存档，这些不是用户生成内容，避免误判
            if (key !== 'signature' && key !== 'userAnswers') {
                textContent += extractTextForCheck(data[key]);
            }
        }
    }
    return textContent;
};

const SublimationPage: React.FC = () => {
    const router = useRouter();
    const [characterData, setCharacterData] = useState<any>(null);
    const [fileName, setFileName] = useState<string | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [resultData, setResultData] = useState<any | null>(null);
    const [savedImageUrl, setSavedImageUrl] = useState<string | null>(null);
    const [showImageModal, setShowImageModal] = useState(false);
    // 新增：用于粘贴的 state
    const [pastedJson, setPastedJson] = useState('');
    const [isPasteAreaVisible, setIsPasteAreaVisible] = useState(false);

    // 新增：在移动端默认展开粘贴区
    useEffect(() => {
        const isMobileDevice = /mobile|android|iphone|ipad|ipod|blackberry|iemobile|opera mini/.test(navigator.userAgent.toLowerCase());
        if (isMobileDevice) {
            setIsPasteAreaVisible(true);
        }
    }, []);

    const processJsonData = (jsonText: string) => {
        try {
            const json = JSON.parse(jsonText);
            if (!json.arena_history) {
                throw new Error('角色文件缺少必需的“arena_history”（历战记录）属性。');
            }
            setCharacterData(json);
            setFileName('粘贴的内容');
            setError(null);
            setResultData(null); // 清除旧结果
            return true;
        } catch (err) {
            const message = err instanceof Error ? err.message : '无法解析文件。';
            setError(`❌ 数据加载失败: ${message}`);
            setCharacterData(null);
            setFileName(null);
            return false;
        }
    };

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
        const text = await file.text();
        if (processJsonData(text)) {
            setFileName(file.name);
        }
        event.target.value = '';
    };

    // 新增：处理粘贴加载
    const handlePasteAndLoad = () => {
        if (!pastedJson.trim()) {
            setError('⚠️ 文本框内容为空。');
            return;
        }
        if (processJsonData(pastedJson)) {
            setPastedJson(''); // 成功后清空
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
            // 修复：只检查文本内容，而不是整个JSON对象
            const textToCheck = extractTextForCheck(characterData);
            if ((await quickCheck(textToCheck)).hasSensitiveWords) {
                router.push({
                    pathname: '/arrested',
                    query: { reason: '上传的角色档案包含危险符文' }
                });
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
                    router.push({
                        pathname: '/arrested',
                        query: { reason: errorJson.reason || '使用危险符文' }
                    });
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
    
    const renderResultCard = () => {
        if (!resultData) return null;
        if (resultData.codename) {
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
                        
                        {/* 新增：粘贴区域 */}
                        <div className="mb-6">
                            <button onClick={() => setIsPasteAreaVisible(!isPasteAreaVisible)} className="text-purple-700 hover:underline cursor-pointer mb-2 font-semibold">
                                {isPasteAreaVisible ? '▼ 折叠文本粘贴区域' : '▶ 展开文本粘贴区域 (手机端推荐)'}
                            </button>
                            {isPasteAreaVisible && (
                                <div className="input-group mt-2">
                                    <textarea value={pastedJson} onChange={(e) => setPastedJson(e.target.value)} placeholder="在此处粘贴一个角色的设定文件(.json)内容..." className="input-field resize-y h-32"/>
                                    <button onClick={handlePasteAndLoad} disabled={isGenerating} className="generate-button mt-2 mb-0" style={{ backgroundColor: '#8b5cf6', backgroundImage: 'linear-gradient(to right, #8b5cf6, #a78bfa)' }}>从文本加载角色</button>
                                </div>
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