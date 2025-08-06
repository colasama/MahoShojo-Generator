// pages/battle.tsx

import React, { useState, useRef, ChangeEvent, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useCooldown } from '../lib/cooldown';
import { quickCheck } from '@/lib/sensitive-word-filter';
import BattleReportCard, { NewsReport } from '../components/BattleReportCard';
import Link from 'next/link';
import { PresetMagicalGirl } from './api/get-presets';

const BattlePage: React.FC = () => {
    const router = useRouter();
    // 存储解析后的魔法少女JSON数据
    const [magicalGirls, setMagicalGirls] = useState<any[]>([]);
    // 存储上传或选择的文件名/代号用于显示
    const [filenames, setFilenames] = useState<string[]>([]);
    // 是否正在生成中
    const [isGenerating, setIsGenerating] = useState(false);
    // 错误信息
    const [error, setError] = useState<string | null>(null);
    // 更新状态以匹配新的数据结构
    const [newsReport, setNewsReport] = useState<NewsReport | null>(null);
    // 保存的图片URL
    const [savedImageUrl, setSavedImageUrl] = useState<string | null>(null);
    // 是否显示图片模态框
    const [showImageModal, setShowImageModal] = useState(false);

    // 冷却状态钩子，设置为2分钟
    const { isCooldown, startCooldown, remainingTime } = useCooldown('generateBattleCooldown', 120000);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [presets, setPresets] = useState<PresetMagicalGirl[]>([]);
    const [isLoadingPresets, setIsLoadingPresets] = useState(true);

    // 组件加载时获取预设角色列表
    useEffect(() => {
        const fetchPresets = async () => {
            try {
                const response = await fetch('/api/get-presets');
                if (!response.ok) throw new Error('获取预设失败');
                const data = await response.json();
                setPresets(data);
            } catch (err) {
                console.error(err);
                setError('无法加载预设魔法少女列表。');
            } finally {
                setIsLoadingPresets(false);
            }
        };
        fetchPresets();
    }, []);

    // 处理选择预设角色的逻辑
    const handleSelectPreset = async (preset: PresetMagicalGirl) => {
        if (magicalGirls.length >= 6) {
            setError('最多只能选择 6 位魔法少女参战。');
            return;
        }
        if (filenames.includes(preset.filename)) {
            setError(`${preset.name} 已经在战斗列表中了。`);
            return;
        }

        try {
            const response = await fetch(`/presets/${preset.filename}`);
            if (!response.ok) throw new Error(`无法加载 ${preset.name} 的设定文件。`);
            const presetData = await response.json();

            // 添加 isPreset 标志，用于数据库记录
            presetData.isPreset = true;

            setMagicalGirls(prev => [...prev, presetData]);
            setFilenames(prev => [...prev, preset.filename]);
            setError(null);
        } catch (err) {
            if (err instanceof Error) setError(err.message);
        }
    };

    // 处理用户上传文件
    const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files || files.length === 0) return;

        const totalSlots = 6 - magicalGirls.length;
        if (files.length > totalSlots) {
            setError(`最多还能上传 ${totalSlots} 个文件。`);
            return;
        }

        const loadedGirls: any[] = [];
        const loadedFilenames: string[] = [];

        try {
            for (const file of Array.from(files)) {
                if (file.type !== 'application/json') {
                    throw new Error(`文件 "${file.name}" 不是有效的 JSON 文件。`);
                }
                const text = await file.text();
                const json = JSON.parse(text);
                if (!json.codename && !json.name) {
                    throw new Error(`文件 "${file.name}" 似乎不是一个有效的魔法少女设定。`);
                }
                loadedGirls.push(json);
                loadedFilenames.push(file.name);
            }
            // 修正：追加而不是覆盖
            setMagicalGirls(prev => [...prev, ...loadedGirls]);
            setFilenames(prev => [...prev, ...loadedFilenames]);
            setError(null);
        } catch (err) {
            if (err instanceof Error) {
                setError(`❌ 文件读取失败: ${err.message}`);
            } else {
                setError('❌ 文件读取失败，请确保上传了正确的 JSON 文件。');
            }
        } finally {
            // 清空input的值
            if (event.target) event.target.value = '';
        }
    };

    // 清空已选角色列表
    const handleClearRoster = () => {
        setMagicalGirls([]);
        setFilenames([]);
        setNewsReport(null);
        setError(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = ''; // 重置文件输入框
        }
    };

    // 处理生成按钮点击事件
    const handleGenerate = async () => {
        if (isCooldown) {
            setError(`冷却中，请等待 ${remainingTime} 秒后再生成。`);
            return;
        }
        if (magicalGirls.length < 2 || magicalGirls.length > 6) {
            setError('⚠️ 请先提交 2 到 6 位魔法少女的情报');
            return;
        }

        setIsGenerating(true);
        setError(null);
        setNewsReport(null);

        try {
            // 安全措施：检查上传内容中的敏感词
            const contentToCheck = JSON.stringify(magicalGirls);
            const checkResult = await quickCheck(contentToCheck);
            if (checkResult.hasSensitiveWords) {
                router.push('/arrested');
                return;
            }

            const response = await fetch('/api/generate-battle-story', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ magicalGirls }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                // 优化错误提示，告知用户可能是服务器繁忙
                if (response.status >= 500) {
                    throw new Error('服务器繁忙，请稍后再试。');
                }
                throw new Error(errorData.message || errorData.error || '生成失败');
            }

            const result: NewsReport = await response.json();
            setNewsReport(result);
            startCooldown();
        } catch (err) {
            if (err instanceof Error) {
                setError(`✨ 魔法失效了！${err.message}`);
            } else {
                setError('✨ 魔法失效了！生成故事时发生未知错误，请重试。');
            }
        } finally {
            setIsGenerating(false);
        }
    };

    // 处理图片保存回调
    const handleSaveImage = (imageUrl: string) => {
        setSavedImageUrl(imageUrl);
        setShowImageModal(true);
    };

    return (
        <>
            <Head>
                <title>魔法少女竞技场 - MahoShojo Generator</title>
                <meta name="description" content="上传魔法少女设定，生成她们之间的战斗故事！" />
            </Head>
            <div className="magic-background-white">
                <div className="container">
                    <div className="card" style={{border: "2px solid #ccc", background: "#f9f9f9"}}>
                        <div className="text-center mb-4">
                            <h1 className="text-3xl font-bold text-gray-800">魔法少女竞技场</h1>
                            <p className="subtitle" style={{ marginBottom: '1rem' }}>提交目击情报，生成独家新闻报道！</p>
                        </div>

                        {/* 功能使用说明 */}
                        <div className="mb-6 p-4 bg-gray-200 border border-gray-300 rounded-lg text-sm text-gray-800">
                            <h3 className="font-bold mb-2">📰 投稿须知</h3>
                            <ol className="list-decimal list-inside space-y-1">
                                <li>前往<Link href="/details" className="footer-link">【奇妙妖精大调查】</Link>页面，生成魔法少女并下载其【设定文件】。</li>
                                <li>收集 2-6 位魔法少女的设定文件（.json 格式）。</li>
                                <li>在此处选择预设角色或上传你收集到的设定文件作为“情报”。</li>
                                <li>我们的王牌记者将根据你的情报，撰写一篇精彩绝伦的新闻报道！</li>
                            </ol>
                        </div>

                        {/* --- 预设角色选择区域 --- */}
                        <div className="mb-6">
                            <h3 className="input-label">选择预设魔法少女：</h3>
                            {isLoadingPresets ? (
                                <p className="text-sm text-gray-500">正在加载预设角色...</p>
                            ) : (
                                <div className="flex flex-wrap gap-2">
                                    {presets.map(preset => (
                                        <button
                                            key={preset.filename}
                                            onClick={() => handleSelectPreset(preset)}
                                            title={preset.description}
                                            disabled={magicalGirls.length >= 6}
                                            className="px-3 py-1 text-sm bg-purple-100 text-purple-800 rounded-full hover:bg-purple-200 disabled:bg-gray-200 disabled:cursor-not-allowed transition-colors"
                                        >
                                            {preset.name}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* --- 上传区域 --- */}
                        <div className="input-group">
                            <label htmlFor="file-upload" className="input-label">
                                或上传自己的 .json 设定情报文件:
                            </label>
                            <input
                                ref={fileInputRef}
                                id="file-upload"
                                type="file"
                                multiple
                                accept=".json"
                                onChange={handleFileChange}
                                className="input-field file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-pink-50 file:text-pink-700 hover:file:bg-pink-100"
                            />
                        </div>

                        {/* --- 已选角色列表 --- */}
                        {filenames.length > 0 && (
                            <div className="mb-4 p-3 bg-gray-200 rounded-lg">
                                <div className="flex justify-between items-center">
                                    <p className="font-semibold text-sm text-gray-700">
                                        已选角色 ({filenames.length}/6):
                                    </p>
                                    <button onClick={handleClearRoster} className="text-xs text-red-500 hover:underline">
                                        清空列表
                                    </button>
                                </div>
                                <ul className="list-disc list-inside text-sm text-gray-600 mt-2">
                                    {magicalGirls.map(girl => (
                                        <li key={girl.codename || girl.name}>
                                            {girl.codename || girl.name} {girl.isPreset && ' (预设)'}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        <button
                            onClick={handleGenerate}
                            disabled={isGenerating || isCooldown || magicalGirls.length < 2}
                            className="generate-button"
                        >
                            {isCooldown
                                ? `记者赶稿中...请等待 ${remainingTime} 秒`
                                : isGenerating
                                    ? '撰写报道中... (ง •̀_•́)ง'
                                    : '生成独家新闻 (๑•̀ㅂ•́)و✧'}
                        </button>

                        {error && <div className="error-message">{error}</div>}
                    </div>

                    {newsReport && (
                        <BattleReportCard
                            report={newsReport}
                            onSaveImage={handleSaveImage}
                        />
                    )}

                    <div className="text-center" style={{ marginTop: '2rem' }}>
                        <button onClick={() => router.push('/')} className="footer-link">
                            返回首页
                        </button>
                    </div>

                    <footer className="footer">
                        <p>
                            竞技场、问卷与系统设计 <a href="https://github.com/notuhao" target="_blank" rel="noopener noreferrer" className="footer-link">@末伏之夜</a>
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

                {/* 图片模态框 */}
                {showImageModal && savedImageUrl && (
                    <div className="fixed inset-0 bg-black flex items-center justify-center z-50"
                        style={{ backgroundColor: 'rgba(0, 0, 0, 0.7)', paddingLeft: '2rem', paddingRight: '2rem' }}
                    >
                        <div className="bg-white rounded-lg max-w-lg w-full max-h-[80vh] overflow-auto relative">
                            <div className="flex justify-between items-center m-0">
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
                                    alt="魔法少女战斗报告"
                                    className="w-full h-auto rounded-lg mx-auto"
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
};

export default BattlePage;