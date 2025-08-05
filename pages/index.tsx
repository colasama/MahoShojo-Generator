import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { StatsData, CharacterRank } from './api/get-stats'; // 导入API数据类型
import { PresetMagicalGirl } from './api/get-presets';    // 导入预设角色类型

/**
 * 排行榜组件
 * @param title - 排行榜标题
 * @param data - 排行榜数据
 * @param presetInfo - 预设角色的描述信息
 */
const Leaderboard: React.FC<{ title: string; data: CharacterRank[]; presetInfo: Map<string, string> }> = ({ title, data, presetInfo }) => (
    <div className="p-4 bg-white/50 rounded-lg shadow-inner">
        <h4 className="font-bold text-gray-700 text-center mb-2">{title}</h4>
        {data.length > 0 ? (
            <ol className="list-decimal list-inside space-y-1 text-sm text-gray-800">
                {data.map((item, index) => (
                    <li key={index} className="truncate" title={`${item.name}${item.is_preset ? ` (${presetInfo.get(item.name)})` : ''}`}>
                        <span className="font-semibold">{item.name}</span>
                        {item.is_preset && <span className="text-xs text-purple-600 ml-1">[预设]</span>}
                        <span className="float-right text-gray-600">{item.value}</span>
                    </li>
                ))}
            </ol>
        ) : (
            <p className="text-xs text-gray-500 text-center">暂无数据</p>
        )}
    </div>
);

export default function Home() {
    // 状态：用于存储从API获取的统计数据
    const [stats, setStats] = useState<StatsData | null>(null);
    // 状态：用于存储预设角色的描述信息，方便在排行榜上显示
    const [presetInfo, setPresetInfo] = useState<Map<string, string>>(new Map());
    // 状态：用于显示加载状态
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                // 并行获取统计数据和预设角色信息，提高效率
                const [statsRes, presetsRes] = await Promise.all([
                    fetch('/api/get-stats'),
                    fetch('/api/get-presets')
                ]);

                if (statsRes.ok) {
                    const statsData = await statsRes.json();
                    setStats(statsData);
                } else {
                    console.error("获取统计数据失败");
                }

                if (presetsRes.ok) {
                    const presetsData: PresetMagicalGirl[] = await presetsRes.json();
                    // 将预设角色信息转换为Map，方便快速查找描述
                    const infoMap = new Map(presetsData.map(p => [p.name, p.description]));
                    setPresetInfo(infoMap);
                } else {
                    console.error("获取预设角色失败");
                }
            } catch (error) {
                console.error("加载首页数据失败:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, []); // 空依赖数组确保只在组件加载时执行一次

    return (
        <>
            <Head>
                <title>✨ 魔法少女生成器 ✨</title>
                <meta name="description" content="AI驱动的魔法少女角色生成器，创建独一无二的魔法少女角色" />
                <link rel="preload" href="/logo.svg" as="image" type="image/svg+xml" />
                <link rel="preload" href="/mahou-title.svg" as="image" type="image/svg+xml" />
                <link rel="preload" href="/questionnaire-title.svg" as="image" type="image/svg+xml" />
            </Head>
            <div className="magic-background-white">
                <div className="container">
                    <div className="card">
                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '2rem' }}>
                            <img src="/logo.svg" width={280} height={180} alt="魔法少女生成器" />
                        </div>

                        <p className="subtitle text-center">
                            欢迎来到魔法国度！选择一个项目开始玩耍吧！
                        </p>
                        <p className="subtitle text-center" style={{ marginBottom: '3rem' }}>
                            由于用户爆炸可能需要多次尝试，正在努力优化中 ——
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            {/* 魔法少女生成器按钮 */}
                            <Link href="/name" className="feature-button magical-generator">
                                <div className="gradient-overlay"></div>
                                <div className="feature-button-content">
                                    <div className="feature-title-container">
                                        <img
                                            src="/logo-white.svg"
                                            width={250}
                                            height={60}
                                            alt="魔法少女生成器"
                                            className="feature-title-svg"
                                        />
                                    </div>
                                </div>
                            </Link>

                            {/* 奇妙妖精大调查按钮 */}
                            <Link href="/details" className="feature-button fairy-quest">
                                <div className="gradient-overlay"></div>
                                <div className="feature-button-content">
                                    <div className="feature-title-container">
                                        <img
                                            src="/questionnaire-logo.svg"
                                            width={250}
                                            height={40}
                                            alt="奇妙妖精大调查"
                                            className="feature-title-svg"
                                        />
                                    </div>
                                </div>
                            </Link>

                            {/* 魔法少女竞技场按钮 */}
                            <Link href="/battle" className="feature-button battle-arena">
                                <div className="gradient-overlay"></div>
                                <div className="feature-button-content">
                                    <div className="feature-title-container">
                                        <span className="text-2xl font-bold text-white drop-shadow-md">魔法少女竞技场</span>
                                    </div>
                                </div>
                            </Link>
                        </div>

                        <div style={{ marginTop: '3rem', textAlign: 'center' }}>
                            <p style={{ fontSize: '0.8rem', marginTop: '1rem', color: '#999', fontStyle: 'italic' }}>
                                设定来源于小说《下班，然后变成魔法少女》
                            </p>
                        </div>
                    </div>

                    {/* --- 新增：竞技场统计数据 --- */}
                    {isLoading ? (
                        <div className="card mt-6 text-center text-gray-500">正在加载数据中心...</div>
                    ) : stats && (
                        <div className="card mt-6">
                            <h3 className="text-xl font-bold text-gray-800 text-center mb-4">
                                竞技场数据中心
                            </h3>
                            <div className="grid grid-cols-2 gap-4 text-center mb-6">
                                <div className="p-4 bg-gray-100 rounded-lg">
                                    <p className="text-2xl font-bold text-pink-500">{stats.totalBattles}</p>
                                    <p className="text-sm text-gray-600">战斗总场数</p>
                                </div>
                                <div className="p-4 bg-gray-100 rounded-lg">
                                    <p className="text-2xl font-bold text-blue-500">{stats.totalParticipants}</p>
                                    <p className="text-sm text-gray-600">总参战人次</p>
                                </div>
                            </div>
                            <div className="grid md:grid-cols-2 gap-4">
                                <Leaderboard title="🏆 胜率排行榜" data={stats.winRateRank} presetInfo={presetInfo} />
                                <Leaderboard title="⚔️ 参战数排行榜" data={stats.participationRank} presetInfo={presetInfo} />
                                <Leaderboard title="🥇 胜利榜" data={stats.winsRank} presetInfo={presetInfo} />
                                <Leaderboard title="💔 战败榜" data={stats.lossesRank} presetInfo={presetInfo} />
                            </div>
                        </div>
                    )}

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
            </div>
        </>
    );
}