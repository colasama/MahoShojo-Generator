// pages/battle.tsx

import React, { useState, useRef, ChangeEvent, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useCooldown } from '../lib/cooldown';
import { quickCheck } from '@/lib/sensitive-word-filter';
import BattleReportCard, { NewsReport } from '../components/BattleReportCard';
import Link from 'next/link';
import { PresetMagicalGirl } from './api/get-presets';
import { StatsData } from './api/get-stats';
import Leaderboard from '../components/Leaderboard';
import { config as appConfig } from '../lib/config';

// 定义魔法少女设定的核心字段，用于验证
// const CORE_FIELDS = ['codename', 'appearance', 'magicConstruct', 'wonderlandRule', 'blooming', 'analysis'];

// 新增：定义一个映射，用于描述核心字段及其必需的子字段
// 这将用于兼容缺少父级但包含子级的不规范JSON
const CORE_FIELD_CHILDREN: Record<string, string[]> = {
    appearance: ['outfit', 'accessories', 'colorScheme', 'overallLook'],
    magicConstruct: ['name', 'form', 'basicAbilities', 'description'],
    wonderlandRule: ['name', 'description', 'tendency', 'activation'],
    blooming: ['name', 'evolvedAbilities', 'evolvedForm', 'evolvedOutfit', 'powerLevel'],
    analysis: ['personalityAnalysis', 'abilityReasoning', 'coreTraits', 'predictionBasis']
};


// 定义可选的战斗等级
const battleLevels = [
    { value: '', label: '默认 (AI自动分配)' },
    { value: '种级', label: '种级 🌱' },
    { value: '芽级', label: '芽级 🍃' },
    { value: '叶级', label: '叶级 🌿' },
    { value: '蕾级', label: '蕾级 🌸' },
    { value: '花级', label: '花级 🌺' },
];

const BattlePage: React.FC = () => {
    const router = useRouter();
    // 存储解析后的魔法少女JSON数据
    const [magicalGirls, setMagicalGirls] = useState<any[]>([]);
    // 存储上传或选择的文件名/代号用于显示
    const [filenames, setFilenames] = useState<string[]>([]);
    // 是否正在生成中
    const [isGenerating, setIsGenerating] = useState(false);
    // 错误或警告信息
    const [error, setError] = useState<string | null>(null);
    // 更新状态以匹配新的数据结构
    const [newsReport, setNewsReport] = useState<NewsReport | null>(null);
    // 保存的图片URL
    const [savedImageUrl, setSavedImageUrl] = useState<string | null>(null);
    // 是否显示图片模态框
    const [showImageModal, setShowImageModal] = useState(false);
    // 用于复制粘贴设定文本
    const [pastedJson, setPastedJson] = useState<string>('');
    const [isPasteAreaVisible, setIsPasteAreaVisible] = useState(false);
    // 新增：用于跟踪哪些文件被自动修正过
    const [correctedFiles, setCorrectedFiles] = useState<Record<string, boolean>>({});
    // 新增：用于跟踪复制操作的状态
    const [copiedStatus, setCopiedStatus] = useState<Record<string, boolean>>({});


    // 冷却状态钩子，设置为2分钟
    const { isCooldown, startCooldown, remainingTime } = useCooldown('generateBattleCooldown', 120000);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [presets, setPresets] = useState<PresetMagicalGirl[]>([]);
    const [isLoadingPresets, setIsLoadingPresets] = useState(true);
    // 分页状态
    const [currentPresetPage, setCurrentPresetPage] = useState(1);
    const presetsPerPage = 4;

    // 状态：用于存储从API获取的统计数据
    const [stats, setStats] = useState<StatsData | null>(null);
    // 状态：用于存储用户选择等级的状态
    const [selectedLevel, setSelectedLevel] = useState<string>('');
    // 状态：用于存储预设角色的描述信息，方便在排行榜上显示
    const [presetInfo, setPresetInfo] = useState<Map<string, string>>(new Map());
    // 状态：用于显示加载状态
    const [isLoadingStats, setIsLoadingStats] = useState(true);

    // 检测移动端并默认展开文本域
    useEffect(() => {
        const isMobileDevice = /mobile|android|iphone|ipad|ipod|blackberry|iemobile|opera mini/.test(navigator.userAgent.toLowerCase());
        if (isMobileDevice) {
            setIsPasteAreaVisible(true);
        }
    }, []);

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

    // 修改：重构验证函数以兼容不规范的JSON，并返回是否被修正过的状态
    const validateMagicalGirlData = (data: any, filename: string): { success: boolean, wasCorrected: boolean } => {
        // 兼容非规范但可用的文件
        if (data.name && data.construct) {
            data.codename = data.name; // 补充 codename 字段以供后续使用
            return { success: true, wasCorrected: false };
        }

        // 检查codename字段
        if (typeof data.codename !== 'string' || !data.codename) {
            setError(`❌ 文件 "${filename}" 格式不规范，缺少必需的 "codename" 字段。`);
            return { success: false, wasCorrected: false };
        }

        let warningMessage = '';
        let wasCorrected = false;

        // 遍历所有核心字段进行检查和修复
        for (const parentKey of Object.keys(CORE_FIELD_CHILDREN)) {
            // 如果父级项目不存在
            if (data[parentKey] === undefined) {
                const childKeys = CORE_FIELD_CHILDREN[parentKey];
                const allChildrenExist = childKeys.every(childKey => data[childKey] !== undefined);

                // 如果所有子级项目都存在于顶层
                if (allChildrenExist) {
                    // 记录一个警告，告知用户格式问题
                    wasCorrected = true;
                    warningMessage += `检测到缺失的顶层项目 "${parentKey}"，但其子项目齐全，已自动兼容。\n`;
                    // 创建父级项目并将子级项目移动进去
                    data[parentKey] = {};
                    childKeys.forEach(childKey => {
                        data[parentKey][childKey] = data[childKey];
                        delete data[childKey]; // 从顶层删除已移动的子项目
                    });
                } else {
                    // 如果父级和子级都不完整，则这是一个真正的错误
                    setError(`❌ 文件 "${filename}" 格式不规范，缺少必需的 "${parentKey}" 字段或其部分子字段。`);
                    return { success: false, wasCorrected: false };
                }
            }
        }

        // 如果有任何警告信息，则显示出来（不会中断流程）
        if (warningMessage) {
            setError(`✔️ 文件 "${filename}" 已加载，但格式稍有不规范:\n${warningMessage.trim()}`);
        }
        return { success: true, wasCorrected };
    };


    // 处理选择预设角色的逻辑
    const handleSelectPreset = async (preset: PresetMagicalGirl) => {
        // 如果已经选择，则取消选择
        if (filenames.includes(preset.filename)) {
            const filenameIndex = filenames.indexOf(preset.filename);
            setMagicalGirls(prev => prev.filter((_, index) => index !== filenameIndex));
            setFilenames(prev => prev.filter(filename => filename !== preset.filename));
            setError(null);
            return;
        }

        // 如果未选择，则进行选择
        if (magicalGirls.length >= 4) {
            setError('最多只能选择 4 位魔法少女参战。');
            return;
        }

        try {
            const response = await fetch(`/presets/${preset.filename}`);
            if (!response.ok) throw new Error(`无法加载 ${preset.name} 的设定文件。`);

            const fileContent = await response.text();
            let presetData;
            try {
                presetData = JSON.parse(fileContent);
            } catch {
                throw new Error(`预设文件 "${preset.name}" 格式错误，无法解析。`);
            }

            if (!validateMagicalGirlData(presetData, preset.name).success) {
                return;
            }

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
            if (event.target) event.target.value = '';
            return;
        }

        const loadedGirls: any[] = [];
        const loadedFilenames: string[] = [];
        const newCorrectedFiles: Record<string, boolean> = {};
        let validationPassed = true;

        try {
            for (const file of Array.from(files)) {
                if (file.type !== 'application/json') {
                    throw new Error(`文件 "${file.name}" 不是有效的 JSON 文件。`);
                }
                const text = await file.text();
                let json;

                try {
                    json = JSON.parse(text);
                } catch {
                    throw new Error(`文件 "${file.name}" 的JSON格式有误，无法解析。请检查文件内容。`);
                }

                const validationResult = validateMagicalGirlData(json, file.name);
                if (!validationResult.success) {
                    validationPassed = false;
                    break;
                }

                if (validationResult.wasCorrected) {
                    newCorrectedFiles[json.codename] = true;
                }

                loadedGirls.push(json);
                loadedFilenames.push(file.name);
            }

            if (validationPassed) {
                setMagicalGirls(prev => [...prev, ...loadedGirls]);
                setFilenames(prev => [...prev, ...loadedFilenames]);
                setCorrectedFiles(prev => ({ ...prev, ...newCorrectedFiles }));
                if (!error?.startsWith('✔️')) {
                    setError(null);
                }
            }

        } catch (err) {
            if (err instanceof Error) {
                setError(`❌ 文件读取失败: ${err.message}`);
            } else {
                setError('❌ 文件读取失败，请确保上传了正确的 JSON 文件。');
            }
        } finally {
            if (event.target) event.target.value = '';
        }
    };

    // 处理粘贴文本的函数
    const handleAddFromPaste = () => {
        const text = pastedJson.trim();
        if (!text) return;

        const loadedGirls: any[] = [];
        const loadedFilenames: string[] = [];
        const newCorrectedFiles: Record<string, boolean> = {};

        try {
            // 尝试将文本解析为 JSON 对象或数组
            let parsedData;
            try {
                // 尝试直接解析
                parsedData = JSON.parse(text);
            } catch {
                // 如果直接解析失败，尝试修复并解析为数组
                // 这种方法可以处理多个JSON对象被直接拼接在一起的情况
                const sanitizedText = `[${text.replace(/}\s*{/g, '},{')}]`;
                parsedData = JSON.parse(sanitizedText);
            }

            const dataArray = Array.isArray(parsedData) ? parsedData : [parsedData];

            if (dataArray.length > (4 - magicalGirls.length)) {
                throw new Error(`队伍将超出4人上限！`);
            }

            for (const item of dataArray) {
                const validationResult = validateMagicalGirlData(item, item.codename || '粘贴的内容');
                if (!validationResult.success) {
                    return;
                }
                if (validationResult.wasCorrected) {
                    newCorrectedFiles[item.codename] = true;
                }
                loadedGirls.push(item);
                loadedFilenames.push(item.codename);
            }

            setMagicalGirls(prev => [...prev, ...loadedGirls]);
            setFilenames(prev => [...prev, ...loadedFilenames]);
            setCorrectedFiles(prev => ({ ...prev, ...newCorrectedFiles }));
            setPastedJson('');
            if (!error?.startsWith('✔️')) {
                setError(null);
            }

        } catch (err) {
            if (err instanceof Error) {
                setError(`❌ 文本解析失败: ${err.message}. 请确保粘贴的是一个或多个完整的JSON对象。`);
            } else {
                setError('❌ 文本解析失败，请检查粘贴内容的格式。');
            }
        }
    };

    // 清空已选角色列表
    const handleClearRoster = () => {
        setMagicalGirls([]);
        setFilenames([]);
        setNewsReport(null);
        setError(null);
        setCorrectedFiles({}); // 清空修正记录
        if (fileInputRef.current) {
            fileInputRef.current.value = ''; // 重置文件输入框
        }
    };

    // 新增：下载修正后的JSON文件
    const handleDownloadCorrectedJson = (codename: string) => {
        const girlData = magicalGirls.find(g => (g.codename || g.name) === codename);
        if (!girlData) return;

        const jsonData = JSON.stringify(girlData, null, 2);
        const blob = new Blob([jsonData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `魔法少女_${codename}_修正版.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    // 新增：复制修正后的JSON文本
    const handleCopyCorrectedJson = (codename: string) => {
        const girlData = magicalGirls.find(g => (g.codename || g.name) === codename);
        if (!girlData) return;

        const jsonData = JSON.stringify(girlData, null, 2);
        navigator.clipboard.writeText(jsonData).then(() => {
            setCopiedStatus(prev => ({ ...prev, [codename]: true }));
            setTimeout(() => {
                setCopiedStatus(prev => ({ ...prev, [codename]: false }));
            }, 2000); // 2秒后恢复按钮状态
        });
    };

    const checkSensitiveWords = async (content: string) => {
        const checkResult = await quickCheck(content);
        if (checkResult.hasSensitiveWords) {
            router.push('/arrested');
            return;
        }
    }

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

        try {
            // 安全措施：检查上传内容中的敏感词
            const contentToCheck = JSON.stringify(magicalGirls);
            await checkSensitiveWords(contentToCheck);

            const response = await fetch('/api/generate-battle-story', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ magicalGirls, selectedLevel }),
            });

            // --- 核心修改：增强错误处理 ---
            if (!response.ok) {
                // 首先，尝试将响应体作为文本读取
                const errorText = await response.text();
                let errorMessage = `服务器返回了错误 (状态码: ${response.status})。`;

                try {
                    // 尝试将文本解析为JSON
                    const errorJson = JSON.parse(errorText);
                    // 如果成功，使用JSON中的详细错误信息
                    errorMessage = errorJson.message || errorJson.error || errorMessage;
                } catch {
                    // 如果解析失败，说明响应不是JSON格式（可能是HTML错误页）
                    // 此时，我们可以显示一个更通用的消息，或者在开发模式下显示原始文本
                    console.error("收到了非JSON格式的错误响应:", errorText);
                    errorMessage = '服务器响应异常，可能是服务暂时不可用，请稍后再试。';
                }
                throw new Error(errorMessage);
            }

            const result: NewsReport = await response.json();
            // 加入后置生成敏感词检测
            await checkSensitiveWords(JSON.stringify(result));

            setNewsReport(result);
            startCooldown();
        } catch (err) {
            // 现在的 catch 块可以捕获到更明确的错误信息
            if (err instanceof Error) {
                setError(`✨ 魔法失效了！${err.message}`);
            } else {
                setError('✨ 魔法失效了！推演战斗时发生未知错误，请重试。');
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
                                <div>
                                    {/* 分页显示的预设角色 */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {(() => {
                                            const startIndex = (currentPresetPage - 1) * presetsPerPage;
                                            const endIndex = startIndex + presetsPerPage;
                                            const currentPagePresets = presets.slice(startIndex, endIndex);

                                            return currentPagePresets.map(preset => {
                                                const isSelected = filenames.includes(preset.filename);
                                                const isDisabled = !isSelected && magicalGirls.length >= 4;
                                                return (
                                                    <div
                                                        key={preset.filename}
                                                        // 允许点击已选择的角色（取消选择）或可选择的角色，但禁用的不能点击
                                                        onClick={() => !isDisabled && handleSelectPreset(preset)}
                                                        // 根据状态（已选/禁用/可选）应用不同样式
                                                        className={`p-3 border rounded-lg transition-all duration-200 ${isSelected
                                                            ? 'bg-pink-200 border-pink-400 hover:bg-pink-300 cursor-pointer'
                                                            : isDisabled
                                                                ? 'bg-gray-200 border-gray-300 text-gray-500 cursor-not-allowed'
                                                                : 'bg-white border-gray-300 hover:border-pink-400 hover:bg-pink-50 cursor-pointer'
                                                            }`}
                                                    >
                                                        <p className={`font-semibold ${isSelected ? 'text-pink-900' : 'text-pink-800'}`}>{preset.name}</p>
                                                        <p className={`text-xs mt-1 ${isSelected ? 'text-pink-800' : 'text-gray-600'}`}>{preset.description}</p>
                                                    </div>
                                                );
                                            });
                                        })()}
                                    </div>

                                    {/* 分页控件 */}
                                    {presets.length > presetsPerPage && (
                                        <div className="flex justify-center items-center mt-4 space-x-2">
                                            <button
                                                onClick={() => setCurrentPresetPage(prev => Math.max(prev - 1, 1))}
                                                disabled={currentPresetPage === 1}
                                                className={`px-3 py-1 rounded text-sm ${currentPresetPage === 1
                                                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                                    : 'bg-pink-100 text-pink-700 hover:bg-pink-200'
                                                    }`}
                                            >
                                                上一页
                                            </button>

                                            <div className="flex space-x-1">
                                                {Array.from({ length: Math.ceil(presets.length / presetsPerPage) }, (_, i) => (
                                                    <button
                                                        key={i + 1}
                                                        onClick={() => setCurrentPresetPage(i + 1)}
                                                        className={`px-3 py-1 rounded text-sm ${currentPresetPage === i + 1
                                                            ? 'bg-pink-600 text-white'
                                                            : 'bg-pink-100 text-pink-700 hover:bg-pink-200'
                                                            }`}
                                                    >
                                                        {i + 1}
                                                    </button>
                                                ))}
                                            </div>

                                            <button
                                                onClick={() => setCurrentPresetPage(prev => Math.min(prev + 1, Math.ceil(presets.length / presetsPerPage)))}
                                                disabled={currentPresetPage === Math.ceil(presets.length / presetsPerPage)}
                                                className={`px-3 py-1 rounded text-sm ${currentPresetPage === Math.ceil(presets.length / presetsPerPage)
                                                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                                    : 'bg-pink-100 text-pink-700 hover:bg-pink-200'
                                                    }`}
                                            >
                                                下一页
                                            </button>
                                        </div>
                                    )}
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

                        {/* --- 粘贴设定文本区域 --- */}
                        <div className="mb-6">
                            <button onClick={() => setIsPasteAreaVisible(!isPasteAreaVisible)} className="text-pink-700 hover:underline cursor-pointer mb-2 font-semibold">
                                {isPasteAreaVisible ? '▼ 折叠文本粘贴区域' : '▶ 展开文本粘贴区域 (手机端推荐)'}
                            </button>
                            {isPasteAreaVisible && (
                                <div className="input-group mt-2">
                                    <textarea
                                        value={pastedJson}
                                        onChange={(e) => setPastedJson(e.target.value)}
                                        placeholder="在此处粘贴一个或多个魔法少女的设定文件(.json)内容..."
                                        className="input-field resize-y h-32"
                                    />
                                    <button
                                        onClick={handleAddFromPaste}
                                        disabled={!pastedJson.trim() || isGenerating || magicalGirls.length >= 4}
                                        className="generate-button mt-2 mb-0"
                                    >
                                        从文本添加角色
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* --- 已选角色列表 --- */}
                        {filenames.length > 0 && (
                            <div className="mb-4 p-3 bg-gray-200 rounded-lg">
                                <div className="flex justify-between items-center m-0 top-0 right-0">
                                    <p className="font-semibold text-sm text-gray-700">
                                        已选角色 ({filenames.length}/4):
                                    </p>
                                    <button onClick={handleClearRoster} className="text-sm text-red-500 hover:underline cursor-pointer">
                                        清空列表
                                    </button>
                                </div>
                                <ul className="list-disc list-inside text-sm text-gray-600 mt-2 space-y-2">
                                    {magicalGirls.map(girl => {
                                        const codename = girl.codename || girl.name;
                                        const isCorrected = correctedFiles[codename];
                                        return (
                                            <li key={codename} className="flex justify-between items-center">
                                                <span>
                                                    {codename} {girl.isPreset && ' (预设)'}
                                                    {isCorrected && <span className="text-xs text-yellow-600 ml-2">(格式已修正)</span>}
                                                </span>
                                                {isCorrected && (
                                                    <div className="flex gap-2">
                                                        <button onClick={() => handleDownloadCorrectedJson(codename)} className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200">下载</button>
                                                        <button onClick={() => handleCopyCorrectedJson(codename)} className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded hover:bg-green-200 w-16">
                                                            {copiedStatus[codename] ? '已复制!' : '复制'}
                                                        </button>
                                                    </div>
                                                )}
                                            </li>
                                        );
                                    })}
                                </ul>
                            </div>
                        )}

                        {/* --- 选择平均等级 --- */}
                        <div className="input-group">
                            <label htmlFor="level-select" className="input-label">
                                指定平均等级 (可选):
                            </label>
                            <select
                                id="level-select"
                                value={selectedLevel}
                                onChange={(e) => setSelectedLevel(e.target.value)}
                                className="input-field"
                                style={{ cursor: 'pointer' }}
                            >
                                {battleLevels.map(level => (
                                    <option key={level.value} value={level.value}>
                                        {level.label}
                                    </option>
                                ))}
                            </select>
                            <p className="text-xs text-gray-500 mt-1">默认由 AI 根据角色强度自动分配，以保证战斗平衡和观赏性。</p>
                        </div>

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

                        {error && <div className={`p-4 rounded-md my-4 text-sm whitespace-pre-wrap ${error.startsWith('❌') ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>{error}</div>}
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
            </div>
        </>
    );
};

export default BattlePage;