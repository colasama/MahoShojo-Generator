import React, { useState, useRef, ChangeEvent } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useCooldown } from '../lib/cooldown';
import { quickCheck } from '@/lib/sensitive-word-filter';
import BattleReportCard, { BattleReport } from '../components/BattleReportCard';
import Link from 'next/link';

const BattlePage: React.FC = () => {
    const router = useRouter();
    // 存储解析后的魔法少女JSON数据
    const [magicalGirls, setMagicalGirls] = useState<any[]>([]);
    // 存储上传的文件名用于显示
    const [filenames, setFilenames] = useState<string[]>([]);
    // 是否正在生成中
    const [isGenerating, setIsGenerating] = useState(false);
    // 错误信息
    const [error, setError] = useState<string | null>(null);
    // 生成的战斗报告结果
    const [battleReport, setBattleReport] = useState<BattleReport | null>(null);
    // 保存的图片URL
    const [savedImageUrl, setSavedImageUrl] = useState<string | null>(null);
    // 是否显示图片模态框
    const [showImageModal, setShowImageModal] = useState(false);

    // 冷却状态钩子，设置为2分钟
    const { isCooldown, startCooldown, remainingTime } = useCooldown('generateBattleCooldown', 120000);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // 处理文件选择变化的函数
    const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files || files.length === 0) {
            return;
        }

        if (files.length < 2 || files.length > 6) {
            setError('⚠️ 请上传 2 到 6 个设定文件');
            return;
        }

        setError(null);
        setMagicalGirls([]);
        setFilenames([]);
        setBattleReport(null);

        const loadedGirls: any[] = [];
        const loadedFilenames: string[] = [];

        try {
            for (const file of Array.from(files)) {
                if (file.type !== 'application/json') {
                    throw new Error(`文件 "${file.name}" 不是有效的 JSON 文件。`);
                }
                const text = await file.text();
                const json = JSON.parse(text);
                // 对JSON文件内容进行基本校验
                if (!json.codename && !json.name) {
                    throw new Error(`文件 "${file.name}" 似乎不是一个有效的魔法少女设定。`);
                }
                loadedGirls.push(json);
                loadedFilenames.push(file.name);
            }
            setMagicalGirls(loadedGirls);
            setFilenames(loadedFilenames);
        } catch (err) {
            if (err instanceof Error) {
                setError(`❌ 文件读取失败: ${err.message}`);
            } else {
                setError('❌ 文件读取失败，请确保上传了正确的 JSON 文件。');
            }
        }
    };

    // 处理生成按钮点击事件
    const handleGenerate = async () => {
        if (isCooldown) {
            setError(`冷却中，请等待 ${remainingTime} 秒后再生成。`);
            return;
        }
        if (magicalGirls.length < 2 || magicalGirls.length > 6) {
            setError('⚠️ 请先上传 2 到 6 个魔法少女设定文件');
            return;
        }

        setIsGenerating(true);
        setError(null);
        setBattleReport(null);

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

            const result: BattleReport = await response.json();
            setBattleReport(result);
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
                    <div className="card">
                        <div className="text-center mb-4">
                           <h1 className="text-3xl font-bold text-gray-800">魔法少女竞技场</h1>
                           <p className="subtitle" style={{marginBottom: '1rem'}}>上传她们的设定，见证宿命的对决！</p>
                        </div>

                        {/* 功能使用说明 */}
                        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
                            <h3 className="font-bold mb-2">💡 如何使用？</h3>
                            <ol className="list-decimal list-inside space-y-1">
                                <li>前往<Link href="/details" className="footer-link">【奇妙妖精大调查】</Link>页面。</li>
                                <li>完成问卷并生成你的魔法少女。</li>
                                <li>在结果页面底部，点击【下载设定文件】按钮，保存 `.json` 文件。</li>
                                <li>重复以上步骤，获取 2-6 位魔法少女的设定文件。</li>
                                <li>在此页面上传你保存的 `.json` 文件，即可生成她们的对战故事！</li>
                            </ol>
                        </div>

                        <div className="input-group">
                            <label htmlFor="file-upload" className="input-label">
                                上传 2~6 个魔法少女 .json 设定文件:
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

                        {filenames.length > 0 && (
                            <div className="mb-4 p-3 bg-gray-100 rounded-lg">
                                <p className="font-semibold text-sm text-gray-700">已加载角色:</p>
                                <ul className="list-disc list-inside text-sm text-gray-600">
                                    {filenames.map(name => <li key={name}>{name}</li>)}
                                </ul>
                            </div>
                        )}

                        <button
                            onClick={handleGenerate}
                            disabled={isGenerating || isCooldown || magicalGirls.length < 2}
                            className="generate-button"
                        >
                            {isCooldown
                                ? `请等待 ${remainingTime} 秒`
                                : isGenerating
                                ? '战斗推演中... (ง •̀_•́)ง'
                                : '生成对战故事 (๑•̀ㅂ•́)و✧'}
                        </button>

                        {error && <div className="error-message">{error}</div>}
                    </div>

                    {battleReport && (
                        <BattleReportCard
                            report={battleReport}
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