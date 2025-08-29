// pages/sublimation.tsx

import React, { useState, ChangeEvent, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Link from 'next/link';
import MagicalGirlCard from '../components/MagicalGirlCard';
import CanshouCard from '../components/CanshouCard';
import { quickCheck } from '@/lib/sensitive-word-filter';
import { useCooldown } from '../lib/cooldown';
import { config as appConfig } from '../lib/config'; // 导入应用配置

// 颜色处理方案，用于修复背景色问题
const MainColor = {
    Red: '红色',
    Orange: '橙色',
    Cyan: '青色',
    Blue: '蓝色',
    Purple: '紫色',
    Pink: '粉色',
    Yellow: '黄色',
    Green: '绿色'
} as const;

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

// 递归提取对象中所有字符串值的函数，用于敏感词检查
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

// API响应和结果状态的类型
interface SublimationResponse {
    sublimatedData: any;
    unchangedFields: string[];
}

const SublimationPage: React.FC = () => {
    const router = useRouter();
    const [characterData, setCharacterData] = useState<any>(null);
    const [fileName, setFileName] = useState<string | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [resultData, setResultData] = useState<SublimationResponse | null>(null);
    const [savedImageUrl, setSavedImageUrl] = useState<string | null>(null);
    const [showImageModal, setShowImageModal] = useState(false);
    const [pastedJson, setPastedJson] = useState('');
    const [isPasteAreaVisible, setIsPasteAreaVisible] = useState(false);
    // 新增：用于存储用户引导输入的状态
    const [userGuidance, setUserGuidance] = useState('');

    // 实例化 useCooldown hook，设置60秒冷却时间
    const { isCooldown, startCooldown, remainingTime } = useCooldown('sublimationCooldown', 60000);
    // 多语言支持
    const [languages, setLanguages] = useState<{ code: string; name: string }[]>([]);
    const [selectedLanguage, setSelectedLanguage] = useState('zh-CN');

    useEffect(() => {
        fetch('/languages.json')
            .then(res => res.json())
            .then(data => setLanguages(data))
            .catch(err => console.error("Failed to load languages:", err));
    }, []);

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
                throw new Error('角色文件缺少必需的“arena_history”（历战记录）属性，需使用在竞技场下载的经历战斗后的角色文件！');
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
        if (!file) return;
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

    const handlePasteAndLoad = () => {
        if (!pastedJson.trim()) {
            setError('⚠️ 文本框内容为空。');
            return;
        }
        if (processJsonData(pastedJson)) {
            setPastedJson('');
        }
    };

    const handleGenerate = async () => {
        // [修改] 增加冷却检查
        if (isCooldown) {
            setError(`操作过于频繁，请等待 ${remainingTime} 秒后再试。`);
            return;
        }
        if (!characterData) {
            setError('⚠️ 请先上传一个角色设定文件。');
            return;
        }
        setIsGenerating(true);
        setError(null);
        setResultData(null);

        try {
            // 安全检查现在包括了用户引导
            const textToCheck = extractTextForCheck(characterData) + " " + userGuidance;
            if ((await quickCheck(textToCheck)).hasSensitiveWords) {
                router.push({
                    pathname: '/arrested',
                    query: { reason: '上传的角色档案或引导内容包含危险符文' }
                });
                return;
            }

            const response = await fetch('/api/generate-sublimation', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                // 在请求体中加入 userGuidance
                body: JSON.stringify({ 
                    ...characterData, 
                    language: selectedLanguage,
                    userGuidance: userGuidance.trim(),
                }),
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

            const result: SublimationResponse = await response.json();
            setResultData(result);
            startCooldown();

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
        if (!resultData?.sublimatedData) return null;
        const data = resultData.sublimatedData;

        if (data.codename) { // 魔法少女
            const colorScheme = data.appearance.colorScheme || "红色、粉色";
            const mainColorName = Object.values(MainColor).find(color => colorScheme.includes(color)) || MainColor.Pink;
            const colors = gradientColors[mainColorName] || gradientColors[MainColor.Pink];
            const gradientStyle = `linear-gradient(135deg, ${colors.first} 0%, ${colors.second} 100%)`;
            return <MagicalGirlCard magicalGirl={data} gradientStyle={gradientStyle} onSaveImage={handleSaveImage} />;
        } else if (data.name) { // 残兽
            return <CanshouCard canshou={data} onSaveImage={handleSaveImage} />;
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
                            <div className="flex justify-center items-center" style={{ marginBottom: '1rem' }}>
                                <img src="/sublimation.svg" width={360} height={40} alt="角色成长升华" />
                            </div>
                            <p className="subtitle mt-2">角色成长升华，见证她们在战斗与经历中完成的蜕变</p>
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

                        <div className="mb-6">
                            <button onClick={() => setIsPasteAreaVisible(!isPasteAreaVisible)} className="text-purple-700 hover:underline cursor-pointer mb-2 font-semibold">
                                {isPasteAreaVisible ? '▼ 折叠文本粘贴区域' : '▶ 展开文本粘贴区域 (手机端推荐)'}
                            </button>
                            {isPasteAreaVisible && (
                                <div className="input-group mt-2">
                                    <textarea value={pastedJson} onChange={(e) => setPastedJson(e.target.value)} placeholder="在此处粘贴一个角色的设定文件(.json)内容..." className="input-field resize-y h-32" />
                                    <button onClick={handlePasteAndLoad} disabled={isGenerating} className="generate-button mt-2 mb-0" style={{ backgroundColor: '#8b5cf6', backgroundImage: 'linear-gradient(to right, #8b5cf6, #a78bfa)' }}>从文本加载角色</button>
                                </div>
                            )}
                        </div>

                        {/* 新增：成长方向引导输入框 */}
                        <div className="input-group">
                            <label htmlFor="user-guidance" className="input-label">成长方向引导 (可选)</label>
                            <input
                                id="user-guidance"
                                type="text"
                                value={userGuidance}
                                onChange={(e) => setUserGuidance(e.target.value)}
                                className="input-field"
                                placeholder="输入关键词或一句话 (最多30字)"
                                maxLength={30}
                                disabled={isGenerating}
                            />
                            {/* 新增：根据配置和用户输入显示不同的提示信息 */}
                            {userGuidance && appConfig.ALLOW_GUIDED_SUBLIMATION_NATIVE_SIGNING ? (
                                <p className="text-xs text-green-700 mt-1">
                                    ✅ 管理员已开启特殊模式：本次引导升华将**保留**原生签名。
                                </p>
                            ) : (
                                <p className="text-xs text-yellow-700 mt-1">
                                    ⚠️ **注意**: 提供引导将使生成的角色变为“衍生数据”，并移除其原生签名。
                                </p>
                            )}
                        </div>

                        {/* 多语言支持 */}
                        <div className="input-group">
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

                        {/* 成功提示信息 */}
                        {!isGenerating && resultData && (
                            <div className="text-center text-sm text-green-600 my-2 font-semibold">
                                🎉 升华成功！结果已显示在下方，请下滑查看。
                            </div>
                        )}

                        {/* 更新按钮状态和文本 */}
                        <button onClick={handleGenerate} disabled={isGenerating || !characterData || isCooldown} className="generate-button mt-4">
                            {isCooldown ? `冷却中 (${remainingTime}s)` : isGenerating ? '升华中...' : '开始升华'}
                        </button>
                        {error && <div className="error-message mt-4">{error}</div>}
                    </div>

                    {isGenerating && <div className="text-center mt-6">少女蜕变中，请稍后...</div>}

                    {resultData && (
                        <>
                            {resultData.unchangedFields && resultData.unchangedFields.length > 0 && (
                                <div className="card mt-6 bg-blue-50 border border-blue-200">
                                    <h4 className="font-bold text-blue-800 mb-2">升华报告</h4>
                                    <p className="text-sm text-blue-700">AI 已根据角色经历更新了大部分设定，但以下字段保留原始设定：</p>
                                    <ul className="list-disc list-inside text-xs text-blue-600 mt-2 pl-2">
                                        {resultData.unchangedFields.map(field => <li key={field}>{field}</li>)}
                                    </ul>
                                </div>
                            )}

                            {renderResultCard()}
                            <div className="card mt-6 text-center">
                                <h3 className="text-lg font-bold text-gray-800 mb-3">操作</h3>
                                <div className="flex flex-col md:flex-row gap-4 justify-center">
                                    <button onClick={() => downloadJson(resultData.sublimatedData)} className="generate-button flex-1">
                                        下载新设定
                                    </button>
                                    <Link href="/battle" className="generate-button flex-1" style={{ backgroundColor: '#22c55e', backgroundImage: 'linear-gradient(to right, #22c55e, #16a34a)', textDecoration: 'none' }}>
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