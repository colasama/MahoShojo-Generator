// pages/battle.tsx

import React, { useState, useRef, ChangeEvent, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useCooldown } from '../lib/cooldown';
import { quickCheck } from '@/lib/sensitive-word-filter';
import BattleReportCard, { NewsReport } from '../components/BattleReportCard';
import Link from 'next/link';
import { Preset } from './api/get-presets'; // 统一使用 Preset 类型
import { StatsData } from './api/get-stats';
import Leaderboard from '../components/Leaderboard';
import { config as appConfig } from '../lib/config';
import { ArenaHistory } from '../types/arena';

interface UpdatedCombatantData {
  codename?: string;
  name?: string;
  arena_history: ArenaHistory;
  signature?: string;
  // 允许包含角色文件的其他所有字段
  [key: string]: any; 
}

interface BattleApiResponse {
  report: NewsReport;
  updatedCombatants: UpdatedCombatantData[];
}

// 魔法少女设定核心字段（用于验证）
const MAGICAL_GIRL_CORE_FIELDS = {
    appearance: ['outfit', 'accessories', 'colorScheme', 'overallLook'],
    magicConstruct: ['name', 'form', 'basicAbilities', 'description'],
    wonderlandRule: ['name', 'description', 'tendency', 'activation'],
    blooming: ['name', 'evolvedAbilities', 'evolvedForm', 'evolvedOutfit', 'powerLevel'],
    analysis: ['personalityAnalysis', 'abilityReasoning', 'coreTraits', 'predictionBasis']
};

// 残兽设定核心字段（用于验证）
const CANSHOU_CORE_FIELDS = [
    'name', 'coreConcept', 'coreEmotion', 'evolutionStage', 'appearance',
    'materialAndSkin', 'featuresAndAppendages', 'attackMethod', 'specialAbility',
    'origin', 'birthEnvironment', 'researcherNotes'
];


// 定义可选的战斗等级
const battleLevels = [
    { value: '', label: '默认 (AI自动分配)' },
    { value: '种级', label: '种级 🌱' },
    { value: '芽级', label: '芽级 🍃' },
    { value: '叶级', label: '叶级 🌿' },
    { value: '蕾级', label: '蕾级 🌸' },
    { value: '花级', label: '花级 🌺' },
];

// 定义参战者的数据结构
interface Combatant {
    type: 'magical-girl' | 'canshou';
    data: any;
    filename: string; // 用于UI显示和去重
    isValid: boolean; // 用于标记是否为原生设定
    isPreset: boolean; // 标记是否为预设角色
    teamId?: number; // 为分队功能添加可选的teamId
    isNonStandard?: boolean; // 标记是否为非规范格式
}

// 定义故事/战斗模式类型
type BattleMode = 'classic' | 'kizuna' | 'daily' | 'scenario';

const BattlePage: React.FC = () => {
    const router = useRouter();
    // 统一存储所有参战者
    const [combatants, setCombatants] = useState<Combatant[]>([]);
    const [isGenerating, setIsGenerating] = useState(false);
    // 错误或警告信息
    const [error, setError] = useState<string | null>(null);
    // 更新状态以匹配新的数据结构
    const [newsReport, setNewsReport] = useState<NewsReport | null>(null);
    // 保存的图片URL
    const [savedImageUrl, setSavedImageUrl] = useState<string | null>(null);
    // 是否显示图片模态框
    const [showImageModal, setShowImageModal] = useState(false);
    // 用于复制粘贴角色设定文本
    const [pastedJson, setPastedJson] = useState<string>('');
    const [isPasteAreaVisible, setIsPasteAreaVisible] = useState(false);
    // 新增：用于复制粘贴情景设定文本
    const [pastedScenarioJson, setPastedScenarioJson] = useState('');
    const [isScenarioPasteAreaVisible, setIsScenarioPasteAreaVisible] = useState(false);
    // 用于跟踪哪些文件被自动修正过
    const [correctedFiles, setCorrectedFiles] = useState<Record<string, boolean>>({});
    // 用于跟踪复制操作的状态
    const [copiedStatus, setCopiedStatus] = useState<Record<string, boolean>>({});
    // 用于存储用户故事引导输入的状态
    const [userGuidance, setUserGuidance] = useState('');
    // 用于锁定正在加载的预设按钮的状态
    const [loadingPreset, setLoadingPreset] = useState<string | null>(null);


    // 冷却状态钩子，设置为2分钟
    const { isCooldown, startCooldown, remainingTime } = useCooldown('generateBattleCooldown', 120000);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // 分别存储两种类型的预设
    const [magicalGirlPresets, setMagicalGirlPresets] = useState<Preset[]>([]);
    const [canshouPresets, setCanshouPresets] = useState<Preset[]>([]);
    const [isLoadingPresets, setIsLoadingPresets] = useState(true);

    // 分页状态
    const [currentMgPresetPage, setCurrentMgPresetPage] = useState(1);
    const [currentCanshouPresetPage, setCurrentCanshouPresetPage] = useState(1);
    const presetsPerPage = 4;

    // 状态：用于存储从API获取的统计数据
    const [stats, setStats] = useState<StatsData | null>(null);
    // 状态：用于存储用户选择等级的状态
    const [selectedLevel, setSelectedLevel] = useState<string>('');
    // 状态：用于存储预设角色的描述信息，方便在排行榜上显示
    const [presetInfo, setPresetInfo] = useState<Map<string, string>>(new Map());
    // 状态：用于显示加载状态
    const [isLoadingStats, setIsLoadingStats] = useState(true);
    
    // 模式状态
    const [battleMode, setBattleMode] = useState<BattleMode>('classic');

    // [新增 SRS 3.4] 语言选择状态
    const [languages, setLanguages] = useState<{ code: string; name: string }[]>([]);
    const [selectedLanguage, setSelectedLanguage] = useState('zh-CN');

    // 用于存储情景模式下上传的情景文件内容
    const [scenarioContent, setScenarioContent] = useState<object | null>(null);
    const [scenarioFileName, setScenarioFileName] = useState<string | null>(null);
    
    // 用于追踪情景文件的原生性
    const [isScenarioNative, setIsScenarioNative] = useState<boolean>(false);

    // 用于存储从API返回的、更新了历战记录的角色数据
    const [updatedCombatants, setUpdatedCombatants] = useState<any[]>([]);

    // 加载语言列表
    useEffect(() => {
        fetch('/languages.json')
            .then(res => res.json())
            .then(data => setLanguages(data))
            .catch(err => console.error("Failed to load languages:", err));
    }, []);

    // 检测移动端并默认展开文本域
    useEffect(() => {
        const isMobileDevice = /mobile|android|iphone|ipad|ipod|blackberry|iemobile|opera mini/.test(navigator.userAgent.toLowerCase());
        if (isMobileDevice) {
            setIsPasteAreaVisible(true);
            setIsScenarioPasteAreaVisible(true); // 同样默认展开情景粘贴区
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
                    const presetsData: Preset[] = await presetsRes.json();
                    // 分类预设
                    setMagicalGirlPresets(presetsData.filter(p => p.type === 'magical-girl'));
                    setCanshouPresets(presetsData.filter(p => p.type === 'canshou'));

                    const infoMap = new Map<string, string>();
                    presetsData.forEach((p) => {
                        infoMap.set(p.name, p.description);
                    });
                    setPresetInfo(infoMap);
                } else {
                    console.error("获取预设失败");
                }

                // 只有在启用统计数据功能时才处理统计数据响应
                if (shouldFetchStats && statsRes) {
                    if (statsRes.ok) {
                        setStats(await statsRes.json());
                    } else {
                        console.error("获取统计数据失败:", statsRes.status, await statsRes.text());
                    }
                }
            } catch (err) {
                console.error('加载数据失败:', err);
                setError('无法加载预设列表或统计数据。');
            } finally {
                setIsLoadingPresets(false);
                setIsLoadingStats(false);
            }
        };
        fetchData();
    }, []);

    // 验证魔法少女数据
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
        for (const parentKey of Object.keys(MAGICAL_GIRL_CORE_FIELDS)) {
            if (data[parentKey] === undefined) {
                const childKeys = MAGICAL_GIRL_CORE_FIELDS[parentKey as keyof typeof MAGICAL_GIRL_CORE_FIELDS];
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

    // 验证残兽数据
    const validateCanshouData = (data: any, filename: string): { success: boolean } => {
        const missingField = CANSHOU_CORE_FIELDS.find(field => data[field] === undefined);
        if (missingField) {
            setError(`❌ 残兽文件 "${filename}" 格式不规范，缺少必需的 "${missingField}" 字段。`);
            return { success: false };
        }
        return { success: true };
    };

    // 统一处理添加参战者
    const addCombatant = (combatant: Combatant) => {
        if (combatants.length >= 4) {
            setError('最多只能选择 4 位参战者。');
            return;
        }
        setCombatants(prev => [...prev, combatant]);
        setError(null);
    };

    // 处理选择预设
    const handleRemoveCombatant = (filename: string) => {
        setCombatants(prev => prev.filter(c => c.filename !== filename));
    };

    const handleSelectPreset = async (preset: Preset) => {
        // 修改：在操作开始时就锁定按钮，防止重复点击
        setLoadingPreset(preset.filename);
    
        try {
            if (combatants.some(c => c.filename === preset.filename)) {
                handleRemoveCombatant(preset.filename);
                setError(null);
                return;
            }
    
            const response = await fetch(`/presets/${preset.filename}`);
            if (!response.ok) throw new Error(`无法加载 ${preset.name} 的设定文件。`);
            const presetData = await response.json();

            let validationResult;
            if (preset.type === 'magical-girl') {
                validationResult = validateMagicalGirlData(presetData, preset.name);
            } else {
                validationResult = { success: validateCanshouData(presetData, preset.name).success, wasCorrected: false };
            }

            if (!validationResult.success) return;

            presetData.isPreset = true;
            // 预设文件默认视为原生
            addCombatant({ 
                type: preset.type, 
                data: presetData, 
                filename: preset.filename, 
                isValid: true, // 预设始终是原生的
                isPreset: true // 在 Combatant 对象层面标记为预设
            });

        } catch (err) {
            if (err instanceof Error) setError(err.message);
        } finally {
            // 操作结束后解除按钮锁定
            setLoadingPreset(null);
        }
    };

    // 统一处理文件上传和粘贴
    const processJsonData = async (jsonText: string, sourceName: string) => {
        // [SRS 3.2.2] 兼容性加载核心逻辑
        let parsedData;
        let isPotentiallyMalformed = false;
        try {
            parsedData = JSON.parse(jsonText);
        } catch (e) {
            // 如果直接解析失败，尝试修复并解析为数组 (处理多个JSON对象粘在一起的情况)
            try {
                const sanitizedText = `[${jsonText.trim().replace(/}\s*{/g, '},{')}]`;
                parsedData = JSON.parse(sanitizedText);
            } catch (finalError) {
                // 如果修复后仍然失败，但满足最低要求（包含name/codename），则标记为非规范
                const nameMatch = jsonText.match(/"(codename|name)"\s*:\s*"([^"]+)"/);
                if (nameMatch && nameMatch[2]) {
                    parsedData = [{ rawText: jsonText, name: nameMatch[2], codename: nameMatch[2] }];
                    isPotentiallyMalformed = true;
                    console.error("非规范内容，但满足最低要求:", e);
                } else {
                    throw new Error(`JSON.parse: ${finalError instanceof Error ? finalError.message : String(finalError)}`);
                }
            }
        }

        const dataArray = Array.isArray(parsedData) ? parsedData : [parsedData];

        if (dataArray.length > (4 - combatants.length)) {
            throw new Error(`队伍将超出4人上限！`);
        }

        const loadedCombatants: Combatant[] = [];

        for (const item of dataArray) {
            let combatantToAdd: Combatant | null = null;
            const itemName = item.codename || item.name || sourceName;

            try {
                if (isPotentiallyMalformed || typeof item !== 'object') {
                    // 如果是潜在的格式错误或不是对象，直接进入兼容模式逻辑
                    throw new Error("Standard validation skipped for potentially malformed data.");
                }

                let type: 'magical-girl' | 'canshou';
                if (item.codename) type = 'magical-girl';
                else if (item.name) type = 'canshou';
                else throw new Error('缺少必需的 "codename" 或 "name" 字段。');

                const validationResult = type === 'magical-girl' ? validateMagicalGirlData(item, itemName) : validateCanshouData(item, itemName);

                if (!validationResult.success) {
                    // 标准验证失败，进入兼容模式检查
                    throw new Error("Standard validation failed.");
                }

                const verificationResponse = await fetch('/api/verify-origin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(item) });
                const { isValid } = await verificationResponse.json();

                combatantToAdd = { type, data: item, filename: itemName, isValid, isPreset: false, isNonStandard: false };

            } catch {
                // [SRS 3.2.2] 兼容模式逻辑
                if (item && (item.codename || item.name)) {
                    setError(`✔️ 文件 "${itemName}" 格式不完全规范，已通过兼容模式加载。`);
                    const type = item.codename ? 'magical-girl' : 'canshou';
                    combatantToAdd = { type, data: item, filename: itemName, isValid: false, isPreset: false, isNonStandard: true };
                } else {
                    // 如果连最低要求都不满足，则抛出最终错误
                    throw new Error(`文件 "${itemName}" 格式不规范，缺少必需的 "codename" 或 "name" 字段。`);
                }
            }

            if (combatantToAdd) {
                loadedCombatants.push(combatantToAdd);
            }
        }

        setCombatants(prev => [...prev, ...loadedCombatants]);
    };


    const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files) return;

        try {
            const filePromises = Array.from(files).map(file => {
                if (file.type !== 'application/json') {
                    throw new Error(`文件 "${file.name}" 不是有效的 JSON 文件。`);
                }
                return file.text();
            });
            const fileContents = await Promise.all(filePromises);
            // 合并所有文件内容为一个字符串进行处理
            await processJsonData(fileContents.join('\n'), '上传的文件');
        } catch (err) {
            if (err instanceof Error) setError(`❌ 文件处理失败: ${err.message}`);
        } finally {
            if (event.target) event.target.value = '';
        }
    };

    const handleAddFromPaste = async () => {
        const text = pastedJson.trim();
        if (!text) return;
        try {
            await processJsonData(text, '粘贴的内容');
            setPastedJson(''); // 成功后清空文本域
        } catch (err) {
            if (err instanceof Error) setError(`❌ 文本解析失败: ${err.message}.`);
        }
    };

    const handlePasteAndLoadScenario = async () => {
        const text = pastedScenarioJson.trim();
        if (!text) return;
        try {
            const json = JSON.parse(text);
            if (!json.title || !json.elements) {
                throw new Error('情景文件缺少必需的 title 或 elements 字段。');
            }

            // --- 新增：验证情景文件的原生性 ---
            const verificationResponse = await fetch('/api/verify-origin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(json),
            });
            const { isValid } = await verificationResponse.json();
            setIsScenarioNative(isValid);

            setScenarioContent(json);
            setScenarioFileName(json.title || '粘贴的情景');
            setError(null);
            setPastedScenarioJson('');
        } catch (err) {
            const message = err instanceof Error ? err.message : '无法解析文本。';
            setError(`❌ 情景解析失败: ${message}`);
            setScenarioContent(null);
            setScenarioFileName(null);
            setIsScenarioNative(false); // 出错时重置
        }
    };


    const handleClearRoster = () => {
        setCombatants([]);
        setNewsReport(null);
        setError(null);
        setCorrectedFiles({});
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleDownloadCorrectedJson = (codename: string) => {
        const combatant = combatants.find(c => (c.data.codename || c.data.name) === codename);
        if (!combatant) return;
        const jsonData = JSON.stringify(combatant.data, null, 2);
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

    const handleCopyCorrectedJson = (codename: string) => {
        const combatant = combatants.find(c => (c.data.codename || c.data.name) === codename);
        if (!combatant) return;
        const jsonData = JSON.stringify(combatant.data, null, 2);
        navigator.clipboard.writeText(jsonData).then(() => {
            setCopiedStatus(prev => ({ ...prev, [codename]: true }));
            setTimeout(() => {
                setCopiedStatus(prev => ({ ...prev, [codename]: false }));
            }, 2000); // 2秒后恢复按钮状态
        });
    };

    const handleTeamChange = (filename: string, teamId: number) => {
        setCombatants(prev => 
            prev.map(c => 
                c.filename === filename ? { ...c, teamId: teamId === 0 ? undefined : teamId } : c
            )
        );
    };

    const handleScenarioFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) {
            setScenarioContent(null);
            setScenarioFileName(null);
            setIsScenarioNative(false); // 重置状态
            return;
        }
        if (file.type !== 'application/json') {
            setError('❌ 情景文件必须是 .json 格式。');
            return;
        }
        try {
            const text = await file.text();
            const json = JSON.parse(text);
            // 简单验证一下情景文件结构
            if (!json.title || !json.elements) {
                throw new Error('情景文件缺少必需的 title 或 elements 字段。');
            }

            // --- 验证情景文件的原生性 ---
            const verificationResponse = await fetch('/api/verify-origin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(json),
            });
            const { isValid } = await verificationResponse.json();
            setIsScenarioNative(isValid);

            setScenarioContent(json);
            setScenarioFileName(file.name);
            setError(null);
        } catch (err) {
            const message = err instanceof Error ? err.message : '无法解析文件。';
            setError(`❌ 情景文件读取失败: ${message}`);
            setScenarioContent(null);
            setScenarioFileName(null);
            setIsScenarioNative(false); // 出错时重置
        } finally {
            if(event.target) event.target.value = ''; // 允许重复上传同一个文件
        }
    };

    const downloadUpdatedJson = (characterData: any) => {
        const name = characterData.codename || characterData.name;
        const jsonData = JSON.stringify(characterData, null, 2);
        const blob = new Blob([jsonData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `角色设定_${name}_更新.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };


    const checkSensitiveWords = async (content: string) => {
        const checkResult = await quickCheck(content);
        if (checkResult.hasSensitiveWords) {
            router.push('/arrested');
            return true;
        }
        return false;
    }

    // 处理生成按钮点击事件
    const handleGenerate = async () => {
        if (isCooldown) {
            setError(`冷却中，请等待 ${remainingTime} 秒后再生成。`);
            return;
        }

        const minParticipants = (battleMode === 'daily' || battleMode === 'scenario') ? 1 : 2;
        const maxParticipants = 4;
        if (combatants.length < minParticipants || combatants.length > 4) {
            setError(`⚠️ 该模式需要 ${minParticipants} 到 ${maxParticipants} 位角色。`);
            return;
        }

        if (battleMode === 'scenario' && !scenarioContent) {
            setError('⚠️ 情景模式下，请先上传一个情景文件。');
            return;
        }

        setIsGenerating(true);
        setError(null);
        setNewsReport(null);
        setUpdatedCombatants([]); // 清空上次的结果

        try {
            // 安全检查
            const combatantsForCheck = combatants.map(c => c.data);
            if (await checkSensitiveWords(JSON.stringify(combatantsForCheck))) return;
            if (userGuidance && (await checkSensitiveWords(userGuidance))) return;
            if (scenarioContent && (await checkSensitiveWords(JSON.stringify(scenarioContent)))) return;
            
            // 构造分队信息
            const teams: { [key: number]: string[] } = {};
            combatants.forEach(c => {
                if (c.teamId) {
                    if (!teams[c.teamId]) {
                        teams[c.teamId] = [];
                    }
                    teams[c.teamId].push(c.data.codename || c.data.name);
                }
            });

            const response = await fetch('/api/generate-battle-story', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    combatants: combatants.map(c => ({ 
                        type: c.type, 
                        data: c.data,
                        isNative: c.isValid,
                        isPreset: c.isPreset
                    })),
                    selectedLevel,
                    mode: battleMode,
                    userGuidance: userGuidance,
                    scenario: scenarioContent, // 发送情景内容
                    teams: Object.keys(teams).length > 0 ? teams : undefined, // 发送分队信息
                    language: selectedLanguage,
                }),
            });

            // --- 核心修改：增强错误处理 ---
            if (!response.ok) {
                // 首先，尝试将响应体作为文本读取
                const errorText = await response.text();
                let errorMessage = `服务器返回了错误 (状态码: ${response.status})。`;

                try {
                    // 尝试将文本解析为JSON
                    const errorJson = JSON.parse(errorText);
                    // 如果成功，并且是需要跳转的特定错误，则执行跳转
                    if (errorJson.shouldRedirect) {
                        router.push({
                            pathname: '/arrested',
                            query: { reason: errorJson.reason || '使用危险符文' }
                        });
                        return; // 终止后续执行
                    }
                    // 否则，使用JSON中的详细错误信息
                    errorMessage = errorJson.message || errorJson.error || errorMessage;
                } catch {
                    // 如果解析失败，说明响应不是JSON格式（可能是HTML错误页）
                    // 此时，我们可以显示一个更通用的消息，或者在开发模式下显示原始文本
                    console.error("收到了非JSON格式的错误响应:", errorText);
                    errorMessage = '服务器响应异常，可能是服务暂时不可用，请稍后再试。';
                }
                throw new Error(errorMessage);
            }
            
            // 处理新的API响应结构
            const result: BattleApiResponse = await response.json();

            // 加入后置生成敏感词检测
            if (await checkSensitiveWords(JSON.stringify(result.report))) return;

            setNewsReport(result.report);
            setUpdatedCombatants(result.updatedCombatants);

            // 关键：用返回的最新角色数据更新当前页面的参战者状态 (SRS 3.1.4)
            setCombatants(prev => 
                prev.map(oldCombatant => {
                    const updatedData = result.updatedCombatants.find(
                        uc => (uc.codename || uc.name) === (oldCombatant.data.codename || oldCombatant.data.name)
                    );
                    return updatedData ? { ...oldCombatant, data: updatedData } : oldCombatant;
                })
            );

            setNewsReport(result.report);
            startCooldown();
        } catch (err) {
            // 现在的 catch 块可以捕获到更明确的错误信息
            if (err instanceof Error) {
                setError(`✨ 魔法失效了！${err.message}`);
            } else {
                setError('✨ 魔法失效了！生成故事时发生未知错误，请重试。');
            }
        } finally {
            setIsGenerating(false);
        }
    };
    
    // 修复：为情景模式添加按钮文本
    const getButtonText = () => {
        if (isCooldown) return `记者赶稿中...请等待 ${remainingTime} 秒`;
        if (isGenerating) {
            switch(battleMode) {
                case 'daily': return '撰写日常逸闻中... (｡･ω･｡)ﾉ';
                case 'kizuna': return '描绘宿命对决中... (ง •̀_•́)ง';
                case 'classic': return '推演激烈战斗中... (ง •̀_•́)ง';
                case 'scenario': return '演绎指定剧本中... (｡･ω･｡)ﾉ';
            }
        }
        switch(battleMode) {
            case 'daily': return '生成日常故事 (´｡• ᵕ •｡`) ♡';
            case 'kizuna': return '生成宿命对决 (๑•̀ㅂ•́)و✧';
            case 'classic': return '生成独家新闻 (๑•̀ㅂ•́)و✧';
            case 'scenario': return '开始演绎情景 (´｡• ᵕ •｡`)';
        }
    };

    // 处理图片保存回调
    const handleSaveImage = (imageUrl: string) => {
        setSavedImageUrl(imageUrl);
        setShowImageModal(true);
    };

    // 渲染预设列表的通用函数
    const renderPresetSelector = (presets: Preset[], currentPage: number, setCurrentPage: (page: number) => void, title: string) => (
        <div className="mb-6">
            <h3 className="input-label" style={{ marginTop: '0.5rem' }}>{title}</h3>
            {isLoadingPresets ? (
                <p className="text-sm text-gray-500">正在加载预设...</p>
            ) : (
                <div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {presets.slice((currentPage - 1) * presetsPerPage, currentPage * presetsPerPage).map(preset => {
                            const isSelected = combatants.some(c => c.filename === preset.filename);
                            // 修改：增加 loadingPreset 的判断
                            const isLoadingThis = loadingPreset === preset.filename;
                            const isDisabled = isLoadingThis || (!isSelected && combatants.length >= 4);

                            const bgColor = preset.type === 'canshou'
                                ? (isSelected ? 'bg-red-200 border-red-400 hover:bg-red-300' : 'bg-white border-gray-300 hover:border-red-400 hover:bg-red-50')
                                : (isSelected ? 'bg-pink-200 border-pink-400 hover:bg-pink-300' : 'bg-white border-gray-300 hover:border-pink-400 hover:bg-pink-50');
                            const textColor = preset.type === 'canshou'
                                ? (isSelected ? 'text-red-900' : 'text-red-800')
                                : (isSelected ? 'text-pink-900' : 'text-pink-800');

                            return (
                                <div
                                    key={preset.filename}
                                    onClick={() => !isDisabled && handleSelectPreset(preset)}
                                    className={`p-3 border rounded-lg transition-all duration-200 ${isDisabled ? 'bg-gray-200 border-gray-300 text-gray-500 cursor-not-allowed' : `${bgColor} cursor-pointer`}`}
                                >
                                    {/* 修改：根据加载状态显示不同文本 */}
                                    <p className={`font-semibold ${textColor}`}>{isLoadingThis ? '加载中...' : preset.name}</p>
                                    <p className={`text-xs mt-1 ${isSelected ? (preset.type === 'canshou' ? 'text-red-800' : 'text-pink-800') : 'text-gray-600'}`}>{preset.description}</p>
                                </div>
                            );
                        })}
                    </div>
                    {presets.length > presetsPerPage && (
                        <div className="flex justify-center items-center mt-4 space-x-2">
                             <button onClick={() => setCurrentPage(Math.max(currentPage - 1, 1))} disabled={currentPage === 1} className={`px-3 py-1 rounded text-sm ${currentPage === 1 ? 'bg-gray-200 text-gray-400' : 'bg-pink-100 text-pink-700 hover:bg-pink-200'}`}>上一页</button>
                             <span className="text-sm text-gray-600">第 {currentPage} / {Math.ceil(presets.length / presetsPerPage)} 页</span>
                             <button onClick={() => setCurrentPage(Math.min(currentPage + 1, Math.ceil(presets.length / presetsPerPage)))} disabled={currentPage === Math.ceil(presets.length / presetsPerPage)} className={`px-3 py-1 rounded text-sm ${currentPage === Math.ceil(presets.length / presetsPerPage) ? 'bg-gray-200 text-gray-400' : 'bg-pink-100 text-pink-700 hover:bg-pink-200'}`}>下一页</button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );

    return (
        <>
            <Head>
                <title>魔法少女竞技场 - MahoShojo Generator</title>
                <meta name="description" content="上传魔法少女或残兽设定，生成她们之间的战斗或日常故事！" />
            </Head>
            <div className="magic-background-white">
                <div className="container">
                    <div className="card" style={{ border: "2px solid #ccc", background: "#f9f9f9" }}>
                        <div className="text-center mb-4">
                            <img src="/arena-black.svg" width={320} height={90} alt="魔法少女竞技场" />
                            <p className="subtitle" style={{ marginBottom: '1rem', marginTop: '1rem' }}>能亲眼见到强者之战，这下就算死也会值回票价呀！</p>
                        </div>

                        <div className="mb-6 p-4 bg-gray-200 border border-gray-300 rounded-lg text-sm text-gray-800" style={{ padding: '1rem' }}>
                            <h3 className="font-bold mb-2">📰 使用须知</h3>
                            <ol className="list-decimal list-inside space-y-1">
                                <li>前往<Link href="/details" className="footer-link">【奇妙妖精大调查】</Link>或<Link href="/canshou" className="footer-link">【研究院残兽调查】</Link>页面，生成角色并下载其【设定文件】。</li>
                                <li>收集 2-4 位角色的设定文件（.json 格式）。</li>
                                <li>在此处选择预设角色或上传你收集到的设定文件。</li>
                                <li>选择一个模式，然后敬请期待在「命运的舞台」之上发生的故事吧！</li>
                            </ol>
                        </div>

                        {renderPresetSelector(magicalGirlPresets, currentMgPresetPage, setCurrentMgPresetPage, '选择预设魔法少女')}
                        {renderPresetSelector(canshouPresets, currentCanshouPresetPage, setCurrentCanshouPresetPage, '选择预设残兽')}

                        <div className="input-group">
                            <label htmlFor="file-upload" className="input-label">上传自己的 .json 设定文件</label>
                            <input ref={fileInputRef} id="file-upload" type="file" multiple accept=".json" onChange={handleFileChange} className="cursor-pointer input-field file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-pink-50 file:text-pink-700 hover:file:bg-pink-100"/>
                        </div>

                        <div className="mb-6">
                            <button onClick={() => setIsPasteAreaVisible(!isPasteAreaVisible)} className="text-pink-700 hover:underline cursor-pointer mb-2 font-semibold">
                                {isPasteAreaVisible ? '▼ 折叠角色粘贴区域' : '▶ 展开角色粘贴区域 (手机端推荐)'}
                            </button>
                            {isPasteAreaVisible && (
                                <div className="input-group mt-2">
                                    <textarea value={pastedJson} onChange={(e) => setPastedJson(e.target.value)} placeholder="在此处粘贴一个或多个魔法少女/残兽的设定文件(.json)内容..." className="input-field resize-y h-32"/>
                                    <button onClick={handleAddFromPaste} disabled={!pastedJson.trim() || isGenerating || combatants.length >= 4} className="generate-button mt-2 mb-0">从文本添加角色</button>
                                </div>
                            )}
                        </div>
                        
                        {/* 新增：情景粘贴区 */}
                        {battleMode === 'scenario' && (
                            <div className="mb-6">
                                <button onClick={() => setIsScenarioPasteAreaVisible(!isScenarioPasteAreaVisible)} className="text-purple-700 hover:underline cursor-pointer mb-2 font-semibold">
                                    {isScenarioPasteAreaVisible ? '▼ 折叠情景粘贴区域' : '▶ 展开情景粘贴区域 (手机端推荐)'}
                                </button>
                                {isScenarioPasteAreaVisible && (
                                    <div className="input-group mt-2">
                                        <textarea value={pastedScenarioJson} onChange={(e) => setPastedScenarioJson(e.target.value)} placeholder="在此处粘贴一个情景的设定文件(.json)内容..." className="input-field resize-y h-24"/>
                                        <button onClick={handlePasteAndLoadScenario} disabled={!pastedScenarioJson.trim() || isGenerating} className="generate-button mt-2 mb-0" style={{ backgroundColor: '#8b5cf6', backgroundImage: 'linear-gradient(to right, #8b5cf6, #a78bfa)' }}>从文本加载情景</button>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* --- 已选角色列表 --- */}
                        {combatants.length > 0 && (
                            <div className="mb-4 p-3 bg-gray-200 rounded-lg">
                                <div className="flex justify-between items-center m-0 top-0 right-0">
                                    <p className="font-semibold text-sm text-gray-700">已选角色 ({combatants.length}/4):</p>
                                    <button onClick={handleClearRoster} className="text-sm text-red-500 hover:underline cursor-pointer">清空列表</button>
                                </div>
                                <ul className="list-disc list-inside text-sm text-gray-600 mt-2 space-y-2">
                                    {combatants.map(c => {
                                        const name = c.data.codename || c.data.name;
                                        const typeDisplay = c.type === 'magical-girl' ? '(魔法少女)' : '(残兽)';
                                        const isCorrected = correctedFiles[name];
                                        return (
                                            <li key={c.filename} className="flex justify-between items-center group">
                                                <div className="flex items-center flex-grow">
                                                    <span className="truncate mr-2" title={name}>
                                                        {name}
                                                        <span className="text-xs text-gray-500 ml-1">{typeDisplay}</span>
                                                        {c.isPreset && <span className="text-xs text-purple-600 ml-1">(预设)</span>}
                                                        {c.isValid && <span className="text-xs text-green-600 ml-1">(原生)</span>}
                                                        {isCorrected && <span className="text-xs text-yellow-600 ml-2">(格式已修正)</span>}
                                                        {c.isNonStandard && <span className="text-xs text-orange-500 ml-1 font-semibold">(非规范格式)</span>}
                                                    </span>
                                                    {/* 分队选择器 */}
                                                    <select
                                                        value={c.teamId || 0}
                                                        onChange={(e) => handleTeamChange(c.filename, parseInt(e.target.value))}
                                                        className="text-xs border border-gray-300 rounded px-1 py-0.5 bg-white"
                                                    >
                                                        <option value={0}>无分队</option>
                                                        <option value={1}>队伍 1</option>
                                                        <option value={2}>队伍 2</option>
                                                        <option value={3}>队伍 3</option>
                                                        <option value={4}>队伍 4</option>
                                                    </select>
                                                </div>
                                                <div className="flex items-center">
                                                    {isCorrected && (
                                                        <div className="flex gap-2 mr-2">
                                                            <button onClick={() => handleDownloadCorrectedJson(name)} className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200">下载</button>
                                                            <button onClick={() => handleCopyCorrectedJson(name)} className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded hover:bg-green-200 w-16">{copiedStatus[name] ? '已复制!' : '复制'}</button>
                                                        </div>
                                                    )}
                                                    {/* 单个删除按钮 */}
                                                    <button
                                                        onClick={() => handleRemoveCombatant(c.filename)}
                                                        className="w-5 h-5 bg-red-200 text-red-700 rounded-full flex items-center justify-center text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-300"
                                                        aria-label={`移除 ${name}`}
                                                    >
                                                        X
                                                    </button>
                                                </div>
                                            </li>
                                        );
                                    })}
                                </ul>
                                {/* --- 历战记录超限提示 --- */}
                                {combatants.some(c => c.data.arena_history?.entries?.length > 20) && (
                                    <div className="mt-3 text-xs text-gray-500">
                                        <p>
                                            ⚠️ 注意：
                                            {combatants
                                                .filter(c => c.data.arena_history?.entries?.length > 20)
                                                .map(c => `“${c.data.codename || c.data.name}”(${c.data.arena_history.entries.length}条) `)
                                                .join('、')
                                            }
                                            的历战记录已超过20条上限，生成故事时将仅选取最重要的部分。
                                            <Link href="/sublimation" className="text-blue-600 hover:underline font-semibold">
                                                考虑前往「成长升华」
                                            </Link>
                                            来凝练角色的成长。
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* 战斗模式切换UI */}
                        <div className="input-group">
                            <label className="input-label">选择故事模式</label>
                            <div className="flex items-center space-x-1 bg-gray-200 p-1 rounded-full">
                                <button
                                    onClick={() => setBattleMode('daily')}
                                    className={`w-1/4 py-2 text-sm font-semibold rounded-full transition-colors duration-300 ${battleMode === 'daily' ? 'bg-white text-green-600 shadow' : 'text-gray-600 hover:bg-gray-300'}`}
                                >
                                    日常模式☕
                                </button>
                                <button
                                    onClick={() => setBattleMode('kizuna')}
                                    className={`w-1/4 py-2 text-sm font-semibold rounded-full transition-colors duration-300 ${battleMode === 'kizuna' ? 'bg-white text-blue-600 shadow' : 'text-gray-600 hover:bg-gray-300'}`}
                                >
                                    羁绊模式✨
                                </button>
                                <button
                                    onClick={() => setBattleMode('classic')}
                                    className={`w-1/4 py-2 text-sm font-semibold rounded-full transition-colors duration-300 ${battleMode === 'classic' ? 'bg-white text-pink-600 shadow' : 'text-gray-600 hover:bg-gray-300'}`}
                                >
                                    经典模式⚔️
                                </button>
                                <button
                                    onClick={() => setBattleMode('scenario')}
                                    className={`w-1/4 py-2 text-sm font-semibold rounded-full transition-colors duration-300 ${battleMode === 'scenario' ? 'bg-white text-purple-600 shadow' : 'text-gray-600 hover:bg-gray-300'}`}
                                >
                                    情景模式📜
                                </button>
                            </div>
                            {battleMode === 'daily' && (
                                <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
                                    <p className="font-bold">你已选择【日常模式】！</p>
                                    <p className="mt-1">此模式下将聚焦于角色间的互动故事，而非战斗。</p>
                                </div>
                            )}
                            {battleMode === 'kizuna' && (
                                <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
                                    <p className="font-bold">你已选择【羁绊模式】！</p>
                                    <p className="mt-1">在此模式下，战斗将更注重友情！热血！羁绊！角色的背景、信念与羁绊将成为关键，能力强度不再是决定胜负的核心因素。</p>
                                </div>
                            )}
                            {battleMode === 'classic' && (
                                <div className="mt-2 p-3 bg-pink-50 border border-pink-200 rounded-lg text-sm text-pink-800">
                                    <p className="font-bold">你已选择【经典模式】！</p>
                                    <p className="mt-1">经典模式：战斗结果主要基于角色的能力设定和战斗推演规则。</p>
                                </div>
                            )}
                        </div>

                            {/* --- 情景模式UI --- */}
                            {battleMode === 'scenario' && (
                                <div className="mt-4">
                                    <label htmlFor="scenario-upload" className="input-label">上传情景文件 (.json)</label>
                                    <input 
                                        id="scenario-upload" 
                                        type="file" 
                                        accept=".json" 
                                        onChange={handleScenarioFileChange}
                                        className="cursor-pointer input-field file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
                                    />
                                    {scenarioFileName && (
                                        <p className="text-xs text-gray-500 mt-2">
                                            已加载情景: {scenarioFileName}
                                            {isScenarioNative && <span className="text-xs text-green-600 ml-1 font-semibold">(原生)</span>}
                                        </p>
                                    )}
                                    <div className="mt-2 p-3 bg-purple-50 border border-purple-200 rounded-lg text-sm text-purple-800">
                                        <p className="font-bold">你已选择【情景模式】！</p>
                                        <p className="mt-1">上传一个情景文件，让角色们在自定义的舞台上展开故事吧！</p>
                                    </div>
                                </div>
                            )}

                        {/* --- 在非日常模式下显示等级选择 --- */}
                        {battleMode !== 'daily' && (
                           <div className="input-group">
                                <label htmlFor="level-select" className="input-label">指定平均等级 (可选):</label>
                                <select id="level-select" value={selectedLevel} onChange={(e) => setSelectedLevel(e.target.value)} className="input-field" style={{ cursor: 'pointer' }}>
                                    {battleLevels.map(level => (<option key={level.value} value={level.value}>{level.label}</option>))}
                                </select>
                                <p className="text-xs text-gray-500 mt-1">默认由 AI 根据角色强度自动分配，以保证战斗平衡和观赏性。</p>
                            </div>
                        )}

                        {/* 故事方向引导输入框 */}
                        {appConfig.ENABLE_ARENA_USER_GUIDANCE && (
                            <div className="input-group">
                                <label htmlFor="user-guidance" className="input-label">故事方向引导 (可选)</label>
                                <input
                                    id="user-guidance"
                                    type="text"
                                    value={userGuidance}
                                    onChange={(e) => setUserGuidance(e.target.value)}
                                    className="input-field"
                                    placeholder="输入关键词或一句话 (最多20字)"
                                    maxLength={20}
                                />
                                <p className="text-xs text-gray-500 mt-1">尝试引导AI生成您想看的故事，例如：“在雨中相遇”、“保卫要地”、“猫咖聚会”等。</p>
                            </div>
                        )}

                        {/*语言选择下拉菜单*/}
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

                        <button onClick={handleGenerate} 
                            // --- 根据模式动态判断禁用条件 ---
                            disabled={
                                isGenerating || 
                                isCooldown || 
                                (battleMode === 'daily' || battleMode === 'scenario' ? combatants.length < 1 : combatants.length < 2)
                            } 
                            className="generate-button"
                        >
                            {getButtonText()}
                        </button>
                        {error && <div className={`p-4 rounded-md my-4 text-sm whitespace-pre-wrap ${error.startsWith('❌') ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>{error}</div>}
                    </div>

                    {newsReport && (
                        <BattleReportCard
                            report={newsReport}
                            onSaveImage={handleSaveImage}
                            mode={battleMode} // 传递模式
                        />
                    )}

                    {/* --- 更新后的角色信息展示区域 --- */}
                    {updatedCombatants.length > 0 && (
                        <div className="card mt-6">
                            <h3 className="text-lg font-bold text-gray-800 mb-3">历战记录更新</h3>
                            <div className="space-y-4">
                                {updatedCombatants.map((charData) => {
                                    const latestEntry = charData.arena_history?.entries?.[charData.arena_history.entries.length - 1];
                                    const name = charData.codename || charData.name;
                                    
                                    // 直接根据当前角色数据（charData）的字段来判断类型,魔法少女有 codename 字段，而残兽没有。
                                    const typeDisplay = charData.codename ? '魔法少女' : '残兽';

                                    if (!latestEntry) return null;

                                    return (
                                        <div key={name} className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <p className="font-semibold text-gray-700">{name} <span className="text-xs text-gray-500">({typeDisplay})</span></p>
                                                    <p className="text-sm text-gray-600 mt-1">
                                                        <span className="font-medium">本次事件影响：</span>
                                                        {latestEntry.impact}
                                                    </p>
                                                </div>
                                                <button 
                                                    onClick={() => downloadUpdatedJson(charData)}
                                                    className="ml-4 px-3 py-1.5 text-xs font-semibold text-white bg-blue-500 rounded-lg hover:bg-blue-600 transition-colors shrink-0"
                                                >
                                                    下载更新设定
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* --- 统计数据 --- */}
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
                                            <p className="text-sm text-gray-600">故事/战斗总场数</p>
                                        </div>
                                        <div className="p-4 bg-gray-100 rounded-lg">
                                            <p className="text-2xl font-bold text-blue-500">{stats.totalParticipants || 0}</p>
                                            <p className="text-sm text-gray-600">总登场人次</p>
                                        </div>
                                    </div>
                                    <div className="grid md:grid-cols-2 gap-4">
                                        <Leaderboard title="🏆 胜率排行榜" data={stats.winRateRank || []} presetInfo={presetInfo} />
                                        <Leaderboard title="⚔️ 登场数排行榜" data={stats.participationRank || []} presetInfo={presetInfo} />
                                        <Leaderboard title="🥇 胜利榜" data={stats.winsRank || []} presetInfo={presetInfo} />
                                        <Leaderboard title="💔 战败榜" data={stats.lossesRank || []} presetInfo={presetInfo} />
                                    </div>
                                </div>
                            ) : (
                                <div className="card mt-6 text-center text-gray-500">
                                    <p>数据库还未初始化或暂无数据</p>
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
                                📱 长按图片保存到相册
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