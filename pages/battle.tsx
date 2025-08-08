// pages/battle.tsx

import React, { useState, useRef, ChangeEvent, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useCooldown } from '../lib/cooldown';
import { quickCheck } from '@/lib/sensitive-word-filter';
import BattleReportCard, { NewsReport } from '../components/BattleReportCard';
import QueueStatus from '../components/QueueStatus';
import Link from 'next/link';
import { PresetMagicalGirl } from './api/get-presets';
import { StatsData } from './api/get-stats';
import Leaderboard from '../components/Leaderboard';
import { config as appConfig } from '../lib/config';

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
    // 是否显示队列状态
    const [showQueueStatus, setShowQueueStatus] = useState(false);

    // 冷却状态钩子，设置为2分钟
    const { isCooldown, startCooldown, remainingTime } = useCooldown('generateBattleCooldown', 120000);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [presets, setPresets] = useState<PresetMagicalGirl[]>([]);
    const [isLoadingPresets, setIsLoadingPresets] = useState(true);

    // 状态：用于存储从API获取的统计数据
    const [stats, setStats] = useState<StatsData | null>(null);
    // 状态：用于存储预设角色的描述信息，方便在排行榜上显示
    const [presetInfo, setPresetInfo] = useState<Map<string, string>>(new Map());
    // 状态：用于显示加载状态
    const [isLoadingStats, setIsLoadingStats] = useState(true);

    // 组件加载时获取预设角色列表和统计数据
    useEffect(() => {
        const fetchData = async () => {
            try {
                // 根据配置决定是否需要获取统计数据
                const shouldFetchStats = appConfig.SHOW_STAT_DATA;

                // 构建请求数组
                const requests = [fetch('/api/get-presets')];
                if (shouldFetchStats) {
                    requests.push(fetch('/api/get-stats'));
                }

                // 并行获取数据
                const responses = await Promise.all(requests);
                const [presetsRes, statsRes] = responses;

                if (presetsRes.ok) {
                    const presetsData = await presetsRes.json();
                    setPresets(presetsData);

                    // 将预设角色信息转换为Map，方便快速查找描述
                    const infoMap = new Map<string, string>();
                    presetsData.forEach((p: PresetMagicalGirl) => {
                        infoMap.set(p.name, p.description);
                    });
                    setPresetInfo(infoMap);
                } else {
                    console.error("获取预设失败");
                }

                // 只有在启用统计数据功能时才处理统计数据响应
                if (shouldFetchStats && statsRes) {
                    if (statsRes.ok) {
                        const statsData = await statsRes.json();
                        console.log('Stats data loaded:', statsData); // Debug log
                        setStats(statsData);
                    } else {
                        const errorText = await statsRes.text();
                        console.error("获取统计数据失败:", statsRes.status, errorText);
                    }
                }
            } catch (err) {
                console.error('加载数据失败:', err);
                setError('无法加载预设魔法少女列表或统计数据。');
            } finally {
                setIsLoadingPresets(false);
                setIsLoadingStats(false);
            }
        };
        fetchData();
    }, []);

    // 处理选择预设角色的逻辑
    const handleSelectPreset = async (preset: PresetMagicalGirl) => {
        if (magicalGirls.length >= 4) {
            setError('最多只能选择 4 位魔法少女参战。');
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

        const totalSlots = 4 - magicalGirls.length;
        if (files.length > totalSlots) {
            setError(`队伍已满！总人数不能超过4人，你当前还能添加 ${totalSlots} 人。`);
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
        if (magicalGirls.length < 2 || magicalGirls.length > 4) {
            setError('⚠️ 请先提交 2 到 4 位魔法少女的情报');
            return;
        }

        setIsGenerating(true);
        setError(null);
        setNewsReport(null);
        setShowQueueStatus(true); // 显示队列状态

        try {
            // 安全措施：检查上传内容中的敏感词
            const contentToCheck = JSON.stringify(magicalGirls);
            const checkResult = await quickCheck(contentToCheck);
            if (checkResult.hasSensitiveWords) {
                setShowQueueStatus(false);
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
                setError('✨ 魔法失效了！推演战斗时发生未知错误，请重试。');
            }
        } finally {
            setIsGenerating(false);
            setShowQueueStatus(false); // 隐藏队列状态
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
                <meta name="description" content="上传魔法少女设定，推演她们之间的战斗！" />
            </Head>
            <div className="magic-background-white">
                <div className="container">
                    <div className="card" style={{ border: "2px solid #ccc", background: "#f9f9f9" }}>
                        <div className="text-center mb-4">
                            <img src="/arena-black.svg" width={320} height={90} alt="魔法少女竞技场" />
                            <p className="subtitle" style={{ marginBottom: '1rem', marginTop: '1rem' }}>能亲眼见到强者之战，这下就算死也会值回票价呀！</p>
                        </div>

                        {/* 功能使用说明 */}
                        <div className="mb-6 p-4 bg-gray-200 border border-gray-300 rounded-lg text-sm text-gray-800" style={{ padding: '1rem' }}>
                            <h3 className="font-bold mb-2">📰 使用须知</h3>
                            <ol className="list-decimal list-inside space-y-1">
                                <li>前往<Link href="/details" className="footer-link">【奇妙妖精大调查】</Link>页面，生成魔法少女并下载其【设定文件】。</li>
                                <li>收集 2-4 位魔法少女的设定文件（.json 格式）。</li>
                                <li>在此处选择预设角色或上传你收集到的设定文件作为“情报”。</li>
                                <li>接下来，敬请期待魔法少女们在「命运的舞台」之上的战斗吧！</li>
                            </ol>
                        </div>

                        {/* --- 预设角色选择区域 --- */}
                        <div className="mb-6">
                            <h3 className="input-label" style={{ marginTop: '0.5rem' }}>选择预设魔法少女</h3>
                            {isLoadingPresets ? (
                                <p className="text-sm text-gray-500">正在加载预设角色...</p>
                            ) : (
                                // 改为Grid布局以更好地展示描述
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {presets.map(preset => {
                                        const isSelected = filenames.includes(preset.filename);
                                        const isDisabled = !isSelected && magicalGirls.length >= 4;
                                        return (
                                            <div
                                                key={preset.filename}
                                                // 当角色未被选中且队伍未满时，才可点击
                                                onClick={() => !isSelected && !isDisabled && handleSelectPreset(preset)}
                                                // 根据状态（已选/禁用/可选）应用不同样式
                                                className={`p-3 border rounded-lg transition-all duration-200 ${
                                                    isSelected
                                                        ? 'bg-purple-200 border-purple-400 cursor-default'
                                                        : isDisabled
                                                        ? 'bg-gray-200 border-gray-300 text-gray-500 cursor-not-allowed'
                                                        : 'bg-white border-gray-300 hover:border-purple-400 hover:bg-purple-50 cursor-pointer'
                                                }`}
                                            >
                                                <p className={`font-semibold ${isSelected ? 'text-purple-900' : 'text-purple-800'}`}>{preset.name}</p>
                                                <p className={`text-xs mt-1 ${isSelected ? 'text-purple-800' : 'text-gray-600'}`}>{preset.description}</p>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* --- 上传区域 --- */}
                        <div className="input-group">
                            <label htmlFor="file-upload" className="input-label">
                                上传自己的 .json 设定情报
                            </label>
                            <input
                                ref={fileInputRef}
                                id="file-upload"
                                type="file"
                                multiple
                                accept=".json"
                                onChange={handleFileChange}
                                className="cursor-pointer input-field file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-pink-50 file:text-pink-700 hover:file:bg-pink-100"
                            />
                        </div>

                        {/* --- 已选角色列表 --- */}
                        {filenames.length > 0 && (
                            <div className="mb-4 p-3 bg-gray-200 rounded-lg" style={{ padding: '1rem', marginBottom: '1rem' }}>
                                <div className="flex justify-between items-center">
                                    <p className="font-semibold text-sm text-gray-700">
                                        已选角色 ({filenames.length}/4):
                                    </p>
                                    <button onClick={handleClearRoster} className="text-sm text-red-500 hover:underline cursor-pointer">
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

                    {/* --- 竞技场统计数据 --- */}
                    {appConfig.SHOW_STAT_DATA && (
                        <>
                            {isLoadingStats ? (
                                <div className="card mt-6 text-center text-gray-500">正在加载数据中心...</div>
                            ) : stats ? (
                                <div className="card mt-6">
                                    <h3 className="text-xl font-bold text-gray-800 text-center mb-4">
                                        竞技场数据中心
                                    </h3>
                                    <div className="grid grid-cols-2 gap-4 text-center mb-6">
                                        <div className="p-4 bg-gray-100 rounded-lg">
                                            <p className="text-2xl font-bold text-pink-500">{stats.totalBattles || 0}</p>
                                            <p className="text-sm text-gray-600">战斗总场数</p>
                                        </div>
                                        <div className="p-4 bg-gray-100 rounded-lg">
                                            <p className="text-2xl font-bold text-blue-500">{stats.totalParticipants || 0}</p>
                                            <p className="text-sm text-gray-600">总参战人次</p>
                                        </div>
                                    </div>
                                    <div className="grid md:grid-cols-2 gap-4">
                                        <Leaderboard title="🏆 胜率排行榜" data={stats.winRateRank || []} presetInfo={presetInfo} />
                                        <Leaderboard title="⚔️ 参战数排行榜" data={stats.participationRank || []} presetInfo={presetInfo} />
                                        <Leaderboard title="🥇 胜利榜" data={stats.winsRank || []} presetInfo={presetInfo} />
                                        <Leaderboard title="💔 战败榜" data={stats.lossesRank || []} presetInfo={presetInfo} />
                                    </div>
                                </div>
                            ) : (
                                <div className="card mt-6 text-center text-gray-500">
                                    <p>数据库还未初始化或暂无战斗数据</p>
                                    <p className="text-sm mt-2">开始使用竞技场功能后，这里将显示统计数据</p>
                                    <p className="text-xs mt-2 text-red-500">请在 Cloudflare D1 控制台执行建表 SQL 语句</p>
                                </div>
                            )}
                        </>
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

                {/* 队列状态组件 */}
                <QueueStatus
                    endpoint="generate-battle-story"
                    isVisible={showQueueStatus}
                    onComplete={() => {
                        setShowQueueStatus(false);
                        // 可以在这里添加完成后的逻辑
                    }}
                />
            </div>
        </>
    );
};

export default BattlePage;