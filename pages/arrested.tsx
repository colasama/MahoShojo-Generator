import React, { useState, useEffect } from 'react';
import Head from 'next/head';

export default function ArrestedPage() {
    const [inspectorId, setInspectorId] = useState('');
    const [caseNumber, setCaseNumber] = useState('');
    const [magicalTimestamp, setMagicalTimestamp] = useState('');

    useEffect(() => {
        // 生成巡查使编号
        const generateInspectorId = () => {
            const random = Math.random();
            if (random < 0.4) return '21032'; // 40% 概率为玛格丽特
            if (random < 0.6) return '41076'; // 20% 概率为翠雀 (0.4 + 0.2)
            if (random < 0.7) return '41055'; // 10% 概率为樱 (0.6 + 0.1)
            // 剩下的 30% 概率生成随机5位数
            return Math.floor(10000 + Math.random() * 90000).toString();
        };

        // 随机生成一个案件编号
        const generateCaseNumber = () => {
            const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
            const randomLetter = letters[Math.floor(Math.random() * letters.length)];
            const randomNumber = Math.floor(100000 + Math.random() * 900000);
            return `MG-${randomLetter}${randomNumber}`;
        };
        
        // 生成一个日期
        const generateMagicalTimestamp = () => {
            const date = new Date();
            const year = date.getFullYear();
            const seasons = ['春季', '夏季', '秋季', '冬季'];
            const season = seasons[Math.floor(date.getMonth() / 3)];
            const day = date.getDate();
            return `女王历 ${year} 年 ${season} 第 ${day} 日`;
        };

        setInspectorId(generateInspectorId());
        setCaseNumber(generateCaseNumber());
        setMagicalTimestamp(generateMagicalTimestamp());
    }, []); // 空依赖数组确保只在组件加载时执行一次

    return (
        <>
            <Head>
                <title>调查院正在出动 - 魔法国度调查院</title>
                <meta name="description" content="魔法国度调查院逮捕令" />
                <link rel="icon" href="/favicon.svg" />
            </Head>

            <div className="min-h-screen bg-gradient-to-br from-purple-900 via-violet-800 to-indigo-900 text-white font-sans relative overflow-hidden">
                {/* Magical background patterns */}
                <div className="absolute inset-0 opacity-10">
                    <div className="absolute top-10 left-10 text-6xl animate-pulse">🌸</div>
                    <div className="absolute top-20 right-20 text-4xl animate-bounce">🌿</div>
                    <div className="absolute top-1/3 left-1/4 text-5xl animate-pulse">🌺</div>
                    <div className="absolute top-2/3 right-1/3 text-3xl animate-bounce">🍃</div>
                    <div className="absolute bottom-20 left-20 text-4xl animate-pulse">🌹</div>
                    <div className="absolute bottom-10 right-10 text-5xl animate-bounce">🌷</div>
                    <div className="absolute top-1/2 left-10 text-3xl animate-pulse">🌻</div>
                    <div className="absolute top-1/4 right-1/4 text-4xl animate-bounce">🌼</div>
                </div>

                {/* Floating magical particles */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute animate-float w-2 h-2 bg-purple-300 rounded-full opacity-60" style={{ top: '20%', left: '15%', animationDelay: '0s' }}></div>
                    <div className="absolute animate-float w-1 h-1 bg-violet-300 rounded-full opacity-70" style={{ top: '40%', left: '80%', animationDelay: '1s' }}></div>
                    <div className="absolute animate-float w-3 h-3 bg-pink-300 rounded-full opacity-50" style={{ top: '60%', left: '25%', animationDelay: '2s' }}></div>
                    <div className="absolute animate-float w-1 h-1 bg-purple-200 rounded-full opacity-80" style={{ top: '80%', left: '70%', animationDelay: '3s' }}></div>
                </div>

                {/* Main magical content */}
                <div className="container mx-auto px-4 py-8 relative z-10" style={{ marginTop: '5rem' }}>
                    {/* Enchanted warning banner */}
                    <div className="text-center text-purple-100" style={{ marginBottom: '0.5rem' }}>您的结果是</div>
                    <div className="bg-gradient-to-r from-pink-600 via-purple-600 to-violet-600 border-2 border-pink-400 rounded-lg p-6 mb-8 text-center shadow-2xl relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-10 animate-pulse"></div>
                        <div className="relative z-10">
                            <div className="text-4xl font-semibold text-purple-100" style={{ padding: '2rem' }}>
                                批 准 逮 捕
                            </div>
                        </div>
                    </div>

                    {/* Mystical arrest warrant */}
                    <div className="bg-gradient-to-b from-purple-900 to-violet-900 border-2 border-pink-500 rounded-lg p-8 mb-8 shadow-2xl relative">
                        {/* SVG background pattern */}
                        <div
                            className="absolute inset-0 rounded-lg opacity-20 bg-no-repeat bg-center bg-contain"
                            style={{
                                backgroundImage: 'url(/arrest-frame.svg)',
                                backgroundSize: 'contain',
                                backgroundPosition: 'center',
                            }}
                        ></div>
                        <div className="absolute top-4 right-4 text-2xl animate-spin">🌟</div>
                        <div className="absolute bottom-4 left-4 text-2xl animate-bounce">🌟</div>

                        <div className="text-center mb-8 px-4 py-8">
                            <div className="mb-6 text-2xl font-serif text-pink-300">
                                魔法国度调查院
                            </div>
                            <div className="text-sm text-purple-200 mb-8 tracking-widest">
                                M A G I C A L &nbsp; K I N G D O M &nbsp; B U R E A U &nbsp; O F &nbsp; I N V E S T I G A T I O N
                            </div>
                            
                            <div className="text-left text-purple-200 text-sm mx-auto max-w-sm space-y-3 mb-10">
                                <p><strong>案件编号：</strong> {caseNumber}</p>
                                <p><strong>签发时间：</strong> {magicalTimestamp}</p>
                                <p><strong>巡查使 花牌认证编号：</strong> {inspectorId}</p>
                            </div>

                            <div className="text-lg md:text-xl text-purple-200 font-semibold mb-16">
                                <p>巡查使正在前往您的所在地</p>
                                <p>请勿离开该界面</p>
                            </div>
                            <div className="text-purple-100 space-y-3">
                                <p className="flex items-center justify-center gap-2 mb-2">
                                    ⚠️ 金绿猫眼权杖严正声明 ⚠️
                                </p>
                                <p className="text-xl flex items-center justify-center gap-2">
                                    城际网络并非法外之地
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Magical footer warning */}
                    <div className="mt-8 text-center">
                        <div className="text-purple-300 text-sm" style={{ marginTop: '1rem' }}>
                            本逮捕令由魔法国度调查院授权发布
                        </div>
                    </div>
                </div>

                {/* Custom animations */}
                <style jsx>{`
                  @keyframes float {
                    0%, 100% { transform: translateY(0px) rotate(0deg); }
                    50% { transform: translateY(-20px) rotate(180deg); }
                  }
                  .animate-float {
                    animation: float 4s ease-in-out infinite;
                  }
                `}</style>
            </div>
        </>
    );
}