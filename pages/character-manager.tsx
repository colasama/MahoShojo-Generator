// pages/character-manager.tsx

import React, { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { quickCheck } from '@/lib/sensitive-word-filter';
import { randomChooseOneHanaName } from '@/lib/random-choose-hana-name';
import { webcrypto } from 'crypto';
import { config } from '@/lib/config';
import TachieGenerator from '../components/TachieGenerator';
// 【新增】导入卡片组件和颜色配置
import MagicalGirlCard from '../components/MagicalGirlCard';
import CanshouCard from '../components/CanshouCard';
import { MainColor } from '../lib/main-color';
import { useAuth } from '@/lib/useAuth';
import { dataCardApi } from '@/lib/auth';

// 导入拆分的组件
import AuthModal from '../components/CharManager/AuthModal';
import SaveCardModal from '../components/CharManager/SaveCardModal';
import DataCardsModal from '../components/CharManager/DataCardsModal';
import ScenarioEditor from '../components/ScenarioEditor';
import { UserWithTitle } from '../components/UserTitle';

// 兼容 Edge 和 Node.js 环境的 crypto API
const randomUUID = typeof crypto !== 'undefined' ? crypto.randomUUID.bind(crypto) : webcrypto.randomUUID.bind(webcrypto);


// 定义允许保持原生性的可编辑字段 (顶级键) (SRS 3.7.3)
// 这是一个路径集合，用于更精确地控制哪些字段的修改不影响原生性
const NATIVE_PRESERVING_PATHS = new Set([
    'codename', // 允许修改魔法少女代号
    'name',     // 允许修改残兽名称
    'appearance.colorScheme' // 允许修改配色方案
]);

/**
 * 辅助函数：判断一个值是否为可以遍历的普通对象（非数组、非null）。
 * @param item - 要检查的值。
 * @returns {boolean} 如果是对象则返回true，否则返回false。
 */
const isObject = (item: any): boolean => {
    return (item && typeof item === 'object' && !Array.isArray(item));
};

/**
 * 辅助函数：转义正则表达式特殊字符。
 * @param str - 需要转义的字符串。
 * @returns {string} 转义后的字符串。
 */
const escapeRegExp = (str: string): string => {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

/**
 * 辅助函数：递归地在数据对象中替换所有出现的旧名称。
 * @param data - 要进行替换操作的数据对象或数组。
 * @param oldBaseName - 原始的基础名称（不带称号）。
 * @param newBaseName - 新的基础名称。
 * @returns {any} 返回一个经过名称替换后的新数据对象。
 */
const replaceAllNamesInData = (data: any, oldBaseName: string, newBaseName: string): any => {
    if (typeof data === 'string') {
        // 使用正则表达式进行替换。
        // 这个表达式会匹配 "旧基础名称" 或 "旧基础名称「称号」" 两种形式。
        // (「[^」]+」)? 是一个捕获组，用于匹配并保留称号部分。
        const regex = new RegExp(escapeRegExp(oldBaseName) + '(「[^」]+」)?', 'g');
        return data.replace(regex, `${newBaseName}$1`);
    }
    if (Array.isArray(data)) {
        // 如果是数组，则递归遍历数组中的每一项。
        return data.map(item => replaceAllNamesInData(item, oldBaseName, newBaseName));
    }
    if (isObject(data)) {
        // 如果是对象，则递归遍历对象的每一个值。
        const newData: { [key: string]: any } = {};
        for (const key in data) {
            newData[key] = replaceAllNamesInData(data[key], oldBaseName, newBaseName);
        }
        return newData;
    }
    // 对于非字符串、数组、对象类型的值，直接返回原值。
    return data;
};

// 【新增】定义渐变色，用于魔法少女卡片背景
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

const CharacterManagerPage: React.FC = () => {
    const router = useRouter();
    const { user, loading: authLoading, isAuthenticated, register, login, logout } = useAuth();
    const [pastedJson, setPastedJson] = useState('');
    const [characterData, setCharacterData] = useState<any | null>(null);
    const [originalData, setOriginalData] = useState<any | null>(null);

    // 账户系统相关状态
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [authMessage, setAuthMessage] = useState<{ type: 'error' | 'success', text: string } | null>(null);
    const [generatedAuthKey, setGeneratedAuthKey] = useState<string | null>(null);

    // 数据卡管理相关状态
    const [userDataCards, setUserDataCards] = useState<any[]>([]);
    const [userCapacity, setUserCapacity] = useState(config.DEFAULT_DATA_CARD_CAPACITY);
    const [showDataCardsModal, setShowDataCardsModal] = useState(false);
    const [editingCard, setEditingCard] = useState<any | null>(null);
    const [showSaveCardModal, setShowSaveCardModal] = useState(false);
    const [newCardForm, setNewCardForm] = useState({ name: '', description: '', isPublic: false });
    const [saveCardError, setSaveCardError] = useState<string | null>(null);
    const [isSavingCard, setIsSavingCard] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const cardsPerPage = 12;

    // 状态管理
    const [isNative, setIsNative] = useState(false);
    const [hasLostNativeness, setHasLostNativeness] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'info' | 'error' | 'success', text: string } | null>(null);
    const [copiedStatus, setCopiedStatus] = useState(false);
    // 【新增】图片保存模态框的状态
    const [showImageModal, setShowImageModal] = useState(false);
    const [savedImageUrl, setSavedImageUrl] = useState<string | null>(null);

    // 用于控制说明区域的显示与隐藏，默认为 true
    const [isGuideVisible, setIsGuideVisible] = useState(true);

    // 控制“一键替换曾用名”按钮的显示状态
    const [showNameReplaceButton, setShowNameReplaceButton] = useState(false);

    // 用于控制粘贴区域折叠/展开的状态，默认为折叠
    const [isPasteAreaVisible, setIsPasteAreaVisible] = useState(false);

    // 加载用户数据卡和容量
    const loadUserDataCards = useCallback(async () => {
        if (!isAuthenticated) return;
        const [cards, capacity] = await Promise.all([
            dataCardApi.getCards(),
            dataCardApi.getUserCapacity()
        ]);
        setUserDataCards(cards);
        if (capacity !== null) {
            setUserCapacity(capacity);
        }
    }, [isAuthenticated]);

    useEffect(() => {
        if (isAuthenticated) {
            loadUserDataCards();
        }
    }, [isAuthenticated, loadUserDataCards]);

    // 处理注册
    const handleRegister = async (username: string, email: string, turnstileToken: string) => {
        setAuthMessage(null);
        const result = await register(username, email, turnstileToken);
        if (result.success && result.authKey) {
            setGeneratedAuthKey(result.authKey);
            setAuthMessage({ type: 'success', text: '注册成功！请复制并保存您的登录密钥。' });
        } else {
            setAuthMessage({ type: 'error', text: result.error || '注册失败' });
        }
    };

    // 处理登录
    const handleLogin = async (username: string, authKey: string, turnstileToken: string) => {
        setAuthMessage(null);
        const result = await login(username, authKey, turnstileToken);
        if (result.success) {
            setShowAuthModal(false);
            setMessage({ type: 'success', text: '登录成功！' });
            loadUserDataCards();
        } else {
            setAuthMessage({ type: 'error', text: result.error || '登录失败' });
        }
    };

    // 保存当前角色为数据卡
    const handleSaveAsDataCard = async () => {
        if (!isAuthenticated || !characterData) return;

        // 打开保存弹窗，设置默认值
        const isScenario = isScenarioData(characterData);
        const type = isScenario ? 'scenario' : 'character';
        const defaultName = isScenario
            ? (characterData.title || characterData.name || '')
            : (characterData.codename || characterData.name || '');
        const defaultDescription = `${type === 'character' ? '角色' : '情景'}数据卡`;

        setNewCardForm({
            name: defaultName,
            description: defaultDescription,
            isPublic: false
        });
        setSaveCardError(null);
        setShowSaveCardModal(true);
    };

    // 确认保存数据卡
    const handleConfirmSaveCard = async () => {
        if (!newCardForm.name.trim()) {
            setSaveCardError('请输入数据卡名称');
            return;
        }

        setIsSavingCard(true);
        setSaveCardError(null);

        try {
            // 前端敏感词检查
            const type = isScenarioData(characterData) ? 'scenario' : 'character';
            const textToCheck = `${newCardForm.name} ${newCardForm.description} ${JSON.stringify(characterData)}`;
            const sensitiveWordResult = await quickCheck(textToCheck);

            if (sensitiveWordResult.hasSensitiveWords) {
                // 直接跳转到 /arrested 页面
                router.push('/arrested');
                return;
            }

            const result = await dataCardApi.createCard(
                type,
                newCardForm.name,
                newCardForm.description,
                characterData,
                newCardForm.isPublic
            );

            if (result.success) {
                setMessage({ type: 'success', text: `数据卡保存成功！${newCardForm.isPublic ? '（公开）' : '（私有）'}` });
                setShowSaveCardModal(false);
                setNewCardForm({ name: '', description: '', isPublic: false });
                setSaveCardError(null);
                loadUserDataCards();
            } else {
                // 检查是否是敏感词错误，如果是则跳转到 /arrest
                if (result.error === 'SENSITIVE_WORD_DETECTED' || (result as any).redirect === '/arrested') {
                    router.push('/arrested');
                    return;
                }
                setSaveCardError(result.error || '保存失败');
            }
        } finally {
            setIsSavingCard(false);
        }
    };

    // 加载数据卡
    const handleLoadDataCard = (card: any) => {
        try {
            const data = JSON.parse(card.data);
            setCharacterData(data);
            setOriginalData(JSON.parse(JSON.stringify(data)));
            setShowDataCardsModal(false);
            setMessage({ type: 'success', text: `已加载数据卡: ${card.name}` });
        } catch {
            setMessage({ type: 'error', text: '加载数据卡失败' });
        }
    };

    // 删除数据卡
    const handleDeleteDataCard = async (id: string) => {
        if (!window.confirm('确定要删除这个数据卡吗？')) return;

        const result = await dataCardApi.deleteCard(id);
        if (result.success) {
            setMessage({ type: 'success', text: '数据卡已删除' });
            loadUserDataCards();
        } else {
            setMessage({ type: 'error', text: result.error || '删除失败' });
        }
    };

    // 更新数据卡信息
    const handleUpdateDataCard = async (id: string, name: string, description: string, isPublic?: boolean) => {
        // 前端敏感词检查
        const textToCheck = `${name} ${description}`;
        const sensitiveWordResult = await quickCheck(textToCheck);

        if (sensitiveWordResult.hasSensitiveWords) {
            // 直接跳转到 /arrested 页面
            router.push('/arrested');
            return;
        }

        const result = await dataCardApi.updateCard(id, name, description, isPublic);
        if (result.success) {
            setEditingCard(null);
            loadUserDataCards();
            setMessage({ type: 'success', text: '数据卡信息已更新' });
        } else {
            // 检查是否是敏感词错误，如果是则跳转到 /arrested
            if (result.error === 'SENSITIVE_WORD_DETECTED' || (result as any).redirect === '/arrested') {
                router.push('/arrested');
                return;
            }
            setMessage({ type: 'error', text: result.error || '更新失败' });
        }
    };

    // 检测是否为情景文件
    const isScenarioData = (data: any): boolean => {
        return Boolean(data && data.title && data.elements && (data.scenario_type || data.elements.events));
    };

    // 分享数据卡
    const handleShareDataCard = async (card: any) => {
        // 在这里可以添加额外的分享统计或其他操作
        console.log(`分享了数据卡: ${card.name} (${card.id})`);
    };

    // 组件加载时运行，检测设备类型以决定是否默认展开粘贴区域
    useEffect(() => {
        // 使用正则表达式检测用户代理字符串中是否包含常见的移动设备关键词
        const isMobileDevice = /mobile|android|iphone|ipad|ipod|blackberry|iemobile|opera mini/.test(navigator.userAgent.toLowerCase());
        // 如果是移动设备，则自动展开粘贴区域，优化移动端用户体验
        if (isMobileDevice) {
            setIsPasteAreaVisible(true);
        }
    }, []); // 空依赖数组 `[]` 确保此效果仅在组件首次挂载时运行一次

    // [SRS 3.3] 立绘生成器相关状态
    const [isTachieVisible, setIsTachieVisible] = useState(false);
    const [tachiePrompt, setTachiePrompt] = useState('');

    // [SRS 3.3.3] 动态生成立绘提示词
    useEffect(() => {
        if (!characterData) {
            setTachiePrompt('');
            return;
        }

        let newPrompt = '';
        const isMagicalGirl = !!characterData.codename;

        if (isMagicalGirl && characterData.appearance) {
            // 魔法少女的 Prompt 逻辑
            const appearanceString = Object.entries(characterData.appearance)
                .map(([key, value]) => `${key}: ${value}`)
                .join(', ');
            newPrompt = `${appearanceString}, Xiabanmo, 二次元, 魔法少女`;
        } else if (!isMagicalGirl && characterData.name) {
            // 残兽的 Prompt 逻辑
            const parts = [
                characterData.appearance,
                characterData.materialAndSkin,
                characterData.featuresAndAppendages
            ].filter(Boolean); // 过滤掉空值
            newPrompt = parts.join(', ');
        }

        setTachiePrompt(newPrompt);

    }, [characterData]);

    /**
     * 专门用于控制“一键替换名称”按钮的显示逻辑。
     * 这个 Hook 不关心角色是否为原生，只关心名称字段是否发生了变化。
     * 这样就解决了非原生角色无法显示此按钮的问题。
     */
    useEffect(() => {
        // 确保原始数据和当前编辑数据都存在
        if (!originalData || !characterData) {
            setShowNameReplaceButton(false);
            return;
        }

        // 获取原始名称和当前名称
        const originalName = originalData.codename || originalData.name;
        const currentName = characterData.codename || characterData.name;

        // 如果名称发生了变化，则显示替换按钮，否则隐藏
        if (originalName !== currentName) {
            setShowNameReplaceButton(true);
        } else {
            setShowNameReplaceButton(false);
        }
    }, [characterData, originalData]); // 依赖项只包含 characterData 和 originalData


    /**
     * 现在只负责追踪“原生性”是否因核心数据被修改而丧失。
     * 移除了原有的名称比较和按钮显示逻辑，使其职责更单一、逻辑更清晰。
     */
    useEffect(() => {
        // 这个 Hook 的核心前提是角色必须是原生的，如果不是，则无需执行任何逻辑
        if (!originalData || !characterData || !isNative) return;

        // 一旦原生性丧失，状态就不再改变，以防止不必要的重复计算
        if (hasLostNativeness) return;

        // 定义一个深度比较函数，用于判断两个值是否完全相同
        const deepEqual = (obj1: any, obj2: any): boolean => {
            return JSON.stringify(obj1) === JSON.stringify(obj2);
        };

        let hasBreakingChange = false;

        // 递归检查函数，会忽略被豁免的路径
        const checkForBreakingChanges = (originalNode: any, currentNode: any, path: string) => {
            if (hasBreakingChange) return;
            for (const key in originalNode) {
                const currentPath = path ? `${path}.${key}` : key;

                // 如果当前路径或其父路径在豁免列表中（如 'codename'），或字段本身就是签名/历战记录，则跳过检查
                if (key === 'signature' || key === 'arena_history' || NATIVE_PRESERVING_PATHS.has(currentPath)) {
                    continue;
                }

                if (!deepEqual(originalNode[key], currentNode[key])) {
                    // 历战记录有特殊规则：只允许删除条目，不允许新增或修改
                    if (currentPath === 'arena_history.entries') {
                        const originalEntries = originalNode[key] || [];
                        const currentEntries = currentNode[key] || [];
                        if (currentEntries.length > originalEntries.length) {
                            hasBreakingChange = true;
                        } else {
                            const originalIds = new Set(originalEntries.map((e: any) => e.id));
                            for (const currentEntry of currentEntries) {
                                if (!originalIds.has(currentEntry.id)) {
                                    hasBreakingChange = true;
                                    break;
                                }
                            }
                        }
                    } else {
                        // 对于其他非豁免字段，任何修改都会导致原生性丧失
                        hasBreakingChange = true;
                    }
                    if (hasBreakingChange) {
                        console.log(`原生性丧失：字段 '${currentPath}' 被修改。`);
                        break;
                    }
                }
            }
        };

        checkForBreakingChanges(originalData, characterData, '');

        if (hasBreakingChange) {
            setHasLostNativeness(true);
            setMessage({ type: 'info', text: '注意：您已修改角色的核心数据，该角色将变为“衍生数据”，保存时会移除原生签名。' });
        }

    }, [characterData, originalData, isNative, hasLostNativeness]);


    // 加载和处理JSON数据 (支持角色和情景文件)
    const processJsonData = async (jsonText: string) => {
        setIsLoading(true);
        setMessage(null);
        setHasLostNativeness(false);

        try {
            const data = JSON.parse(jsonText);

            if (typeof data !== 'object' || data === null) {
                throw new Error('无效的文件格式。');
            }

            // 检测文件类型
            const isCharacterFile = Boolean(data.codename || (data.name && (data.attributes || data.skills || data.transformationSpell)));
            const isScenarioFile = Boolean(data.title && data.elements && (data.scenario_type || data.elements.events));

            if (!isCharacterFile && !isScenarioFile) {
                throw new Error('无效的文件格式。请确保是有效的角色或情景文件。');
            }

            // 调用API验证原生性
            const verificationResponse = await fetch('/api/verify-origin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            const { isValid } = await verificationResponse.json();

            setCharacterData(data);
            setOriginalData(JSON.parse(JSON.stringify(data))); // 深拷贝作为原始备份
            setIsNative(isValid);

            if (isCharacterFile) {
                setMessage({ type: 'success', text: `成功加载角色: ${data.codename || data.name}` });
            } else if (isScenarioFile) {
                setMessage({ type: 'success', text: `成功加载情景: ${data.title}` });
            }
        } catch (err) {
            const text = err instanceof Error ? err.message : '解析JSON失败。';
            setMessage({ type: 'error', text: `加载失败: ${text}` });
            setCharacterData(null);
            setOriginalData(null);
            setIsNative(false);
        } finally {
            setIsLoading(false);
        }
    };

    // 文件上传处理
    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target?.result as string;
            processJsonData(text);
        };
        reader.readAsText(file);
        event.target.value = ''; // 允许重复上传
    };

    // 粘贴加载处理
    const handlePasteAndLoad = () => {
        if (!pastedJson.trim()) {
            setMessage({ type: 'error', text: '文本框内容为空。' });
            return;
        }
        processJsonData(pastedJson);
    };

    // 统一的字段更新处理器
    const handleFieldChange = useCallback((path: string, value: any) => {
        setCharacterData((prev: any) => {
            const newData = JSON.parse(JSON.stringify(prev)); // 深拷贝以安全地修改
            let current = newData;
            const keys = path.split('.');
            for (let i = 0; i < keys.length - 1; i++) {
                const key = keys[i];
                const nextKey = keys[i + 1];
                const isNextKeyNumeric = !isNaN(parseInt(nextKey, 10));

                if (isNextKeyNumeric && !Array.isArray(current[key])) {
                    current[key] = [];
                } else if (!isNextKeyNumeric && !isObject(current[key])) {
                    current[key] = {};
                }
                current = current[key];
            }
            current[keys[keys.length - 1]] = value;
            return newData;
        });
    }, []);

    // 一键替换所有旧名称的事件处理器
    const handleReplaceAllNames = useCallback(() => {
        if (!characterData || !originalData) return;

        const oldName = originalData.codename || originalData.name;
        const newName = characterData.codename || characterData.name;

        // 从完整名称中提取基础名称（去除称号）
        const oldBaseName = oldName.split('「')[0];
        const newBaseName = newName.split('「')[0];

        if (oldBaseName === newBaseName) return;

        // 对当前编辑的数据和原始备份数据同时执行替换操作
        // 这是保持原生性的关键：让 useEffect 认为除了豁免字段外，其他内容没有“意外”变化。
        const updatedCharacterData = replaceAllNamesInData(characterData, oldBaseName, newBaseName);
        const updatedOriginalData = replaceAllNamesInData(originalData, oldBaseName, newBaseName);

        // 更新状态
        setCharacterData(updatedCharacterData);
        setOriginalData(updatedOriginalData);

        // 隐藏按钮并显示成功消息
        setShowNameReplaceButton(false);
        setMessage({ type: 'success', text: `已将所有“${oldBaseName}”替换为“${newBaseName}”！` });

    }, [characterData, originalData]);


    // 【v0.3.0 新增】渲染内嵌随机事件的编辑器
    const renderAdjudicationEventsEditor = () => {
        // 从角色数据中获取事件数组，如果不存在则默认为空数组
        const events = characterData.adjudicationEvents || [];

        // 添加新事件的处理函数
        const handleAddEvent = () => {
            const newEvent = { event: '', probability: 50 };
            // 更新角色数据状态，将新事件添加到数组末尾
            handleFieldChange('adjudicationEvents', [...events, newEvent]);
        };

        // 删除事件的处理函数
        const handleDeleteEvent = (index: number) => {
            // 创建一个新数组，其中不包含指定索引的事件
            const newEvents = events.filter((_: any, i: number) => i !== index);
            // 更新角色数据状态
            handleFieldChange('adjudicationEvents', newEvents);
        };

        // 渲染UI
        return (
            <fieldset className="border border-gray-300 p-4 rounded-lg mt-4">
                <legend className="text-sm font-semibold px-2 text-gray-600">🎲 内嵌随机事件管理</legend>
                <div className="space-y-4">
                    {events.map((event: any, index: number) => (
                        <div key={index} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                            {/* 事件描述输入框 */}
                            <div className="flex items-center justify-between gap-2">
                                <label htmlFor={`adj-event-${index}`} className="text-xs font-medium text-gray-600 flex-shrink-0">事件描述</label>
                                <button
                                    onClick={() => handleDeleteEvent(index)}
                                    className="text-red-500 hover:text-red-700 font-bold p-1 text-lg leading-none rounded-full hover:bg-red-100"
                                    aria-label="删除此事件"
                                >
                                    &times;
                                </button>
                            </div>
                            <textarea
                                id={`adj-event-${index}`}
                                value={event.event}
                                onChange={(e) => handleFieldChange(`adjudicationEvents.${index}.event`, e.target.value)}
                                placeholder="输入需要判定的事件（最多60字）"
                                maxLength={60}
                                rows={2}
                                className="input-field mt-1"
                            />
                            {/* 成功率输入框 */}
                            <div className="flex items-center gap-3 mt-2">
                                <label htmlFor={`adj-prob-${index}`} className="text-xs font-medium text-gray-600">成功率</label>
                                <input
                                    type="range"
                                    min="1"
                                    max="100"
                                    value={event.probability}
                                    onChange={(e) => handleFieldChange(`adjudicationEvents.${index}.probability`, parseInt(e.target.value, 10))}
                                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                                />
                                <div className="relative w-24 flex-shrink-0">
                                    <input
                                        type="number"
                                        id={`adj-prob-${index}`}
                                        min="1"
                                        max="100"
                                        value={event.probability}
                                        onChange={(e) => handleFieldChange(`adjudicationEvents.${index}.probability`, parseInt(e.target.value, 10))}
                                        className="input-field !my-0 w-full text-center pr-6"
                                    />
                                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 text-sm pointer-events-none">%</span>
                                </div>
                            </div>
                        </div>
                    ))}
                    {/* 添加事件按钮 */}
                    <button
                        type="button"
                        onClick={handleAddEvent}
                        className="text-sm text-blue-600 hover:underline mt-2"
                    >
                        + 添加随机事件
                    </button>
                </div>
            </fieldset>
        );
    };

    // 递归渲染表单
    // 【修正】渲染表单的递归函数，移除了未被使用的变量以修复ESLint报错
    const renderFormFields = (data: any, path: string = ''): React.ReactNode => {
        // 渲染顺序：基本信息 -> 外观 -> 魔装 -> 奇境 -> 繁开 -> 分析 -> 问卷 -> 历战记录
        if (!isObject(data)) return null;

        const keyOrder = [
            'codename', 'name', 'appearance', 'magicConstruct', 'wonderlandRule',
            'blooming', 'analysis', 'userAnswers', 'arena_history'
        ];

        const sortedKeys = Object.keys(data).sort((a, b) => {
            const indexA = keyOrder.indexOf(a);
            const indexB = keyOrder.indexOf(b);
            if (indexA === -1 && indexB === -1) return a.localeCompare(b);
            if (indexA === -1) return 1;
            if (indexB === -1) return -1;
            return indexA - indexB;
        });

        return sortedKeys.map(key => {
            const currentPath = path ? `${path}.${key}` : key;
            // 过滤掉不应在表单中编辑的字段
            if (key === 'signature' || key === 'isPreset' || key === 'arena_history' || key === 'adjudicationEvents') return null;

            const value = data[key];

            // 专门处理数组类型的逻辑
            if (Array.isArray(value)) {
                // 判断是否为字符串数组，这是我们主要支持编辑的类型
                const isStringArray = value.every(item => typeof item === 'string');
                if (isStringArray) {
                    return (
                        <div key={currentPath} className="mt-4">
                            <label htmlFor={currentPath} className="block text-sm font-medium text-gray-700 capitalize">{key.replace(/([A-Z])/g, ' $1')}</label>
                            <textarea
                                id={currentPath}
                                value={value.join('\n')}
                                onChange={(e) => handleFieldChange(currentPath, e.target.value.split('\n'))}
                                rows={Math.max(3, value.length)} // 动态调整高度
                                className="input-field"
                                placeholder="每行输入一个项目"
                            />
                            <p className="text-xs text-gray-500 mt-1">此字段为列表，请每行输入一个项目。</p>
                        </div>
                    );
                }
                // 对于其他类型的数组（如对象数组），暂时以只读JSON形式显示，防止数据结构被破坏
                return (
                    <div key={currentPath} className="mt-4">
                        <label htmlFor={currentPath} className="block text-sm font-medium text-gray-700 capitalize">{key.replace(/([A-Z])/g, ' $1')} (只读)</label>
                        <textarea
                            id={currentPath}
                            value={JSON.stringify(value, null, 2)}
                            readOnly
                            rows={5}
                            className="input-field bg-gray-100 cursor-not-allowed"
                        />
                    </div>
                );
            }

            // 处理嵌套对象的逻辑
            if (isObject(value)) {
                return (
                    <fieldset key={currentPath} className="border border-gray-300 p-4 rounded-lg mt-4">
                        <legend className="text-sm font-semibold px-2 text-gray-600 capitalize">{key.replace(/([A-Z])/g, ' $1')}</legend>
                        <div className="space-y-4">{renderFormFields(value, currentPath)}</div>
                    </fieldset>
                );
            }

            return (
                <div key={currentPath}>
                    <label htmlFor={currentPath} className="block text-sm font-medium text-gray-700 capitalize">{key.replace(/([A-Z])/g, ' $1')}</label>
                    <div className="mt-1 flex items-center">
                        {typeof value === 'string' && value.length > 80 ?
                            <textarea id={currentPath} value={value as string} onChange={(e) => handleFieldChange(currentPath, e.target.value)} rows={3} className="input-field" />
                            :
                            <input type="text" id={currentPath} value={value as any} onChange={(e) => handleFieldChange(currentPath, e.target.value)} className="input-field" />
                        }
                        {currentPath === 'codename' && (
                            <button onClick={handleRandomCodename} type="button" className="ml-2 px-3 py-1.5 text-xs font-semibold text-white bg-pink-500 rounded-lg hover:bg-pink-600">随机</button>
                        )}
                    </div>
                    {/* 条件渲染“一键替换”按钮 */}
                    {showNameReplaceButton && (currentPath === 'codename' || currentPath === 'name') && (
                        <button
                            onClick={handleReplaceAllNames}
                            className="text-sm text-white bg-green-500 hover:bg-green-600 rounded-md px-3 py-1 mt-2 w-full"
                        >
                            点击将所有“{originalData.codename || originalData.name}”替换为“{characterData.codename || characterData.name}”
                        </button>
                    )}
                </div>
            );
        });
    };

    const handleRandomCodename = () => {
        const newCodename = randomChooseOneHanaName();
        handleFieldChange('codename', newCodename);
    };

    // ===================================
    // 历战记录管理函数 (SRS 3.7.2)
    // ===================================
    const handleDeleteHistoryEntry = (id: number) => {
        setCharacterData((prev: any) => {
            const newHistory = { ...prev.arena_history };
            newHistory.entries = newHistory.entries.filter((entry: any) => entry.id !== id);
            return { ...prev, arena_history: newHistory };
        });
    };

    const handleResetHistoryAttributes = () => {
        setCharacterData((prev: any) => {
            const newHistory = { ...prev.arena_history };
            newHistory.attributes.world_line_id = randomUUID();
            newHistory.attributes.created_at = new Date().toISOString();
            return { ...prev, arena_history: newHistory };
        });
    };

    const handleClearHistory = () => {
        if (window.confirm('确定要清除所有历战记录吗？此操作将清空 entries 数组。')) {
            setCharacterData((prev: any) => {
                const newHistory = { ...prev.arena_history };
                newHistory.entries = [];
                return { ...prev, arena_history: newHistory };
            });
        }
    };

    // ===================================
    // 保存与输出 (SRS 3.7.4 & 3.7.5)
    // ===================================
    const handleSaveChanges = async (type: 'download' | 'copy') => {
        if (!characterData) return;
        setMessage(null);
        setCopiedStatus(false); // 重置复制状态

        // 1. 前端先行内容安全检查，提供快速反馈
        if ((await quickCheck(JSON.stringify(characterData))).hasSensitiveWords) {
            setMessage({ type: 'error', text: '检测到不适宜内容，无法保存。请修改后重试。' });
            return;
        }

        // 声明一个变量，用于存储最终要处理的数据
        let finalData;

        try {
            // 2. 核心逻辑分歧：判断是否需要重新签名
            if (isNative && !hasLostNativeness) {
                // **情况一：数据为原生且未被破坏**
                // 此时，我们需要将当前编辑后的数据发送到服务器，获取一个新的有效签名。
                setMessage({ type: 'info', text: '正在请求服务器进行原生性签名认证...' });
                setIsLoading(true);

                const response = await fetch('/api/resign-data', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(characterData),
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    if (errorData.shouldRedirect) {
                        router.push({
                            pathname: '/arrested',
                            query: { reason: errorData.reason || '编辑内容不合规' }
                        });
                        // 中断执行，因为页面即将跳转
                        return;
                    }
                    // 如果是其他错误，则抛出异常
                    throw new Error(errorData.message || '签名服务器认证失败');
                }

                // 使用服务器返回的、带有最新有效签名的数据作为最终数据
                finalData = await response.json();
                setMessage({ type: 'success', text: '原生性签名认证成功！' });

            } else {
                // **情况二：数据为衍生数据（非原生或已失去原生性）**
                // 按照原有逻辑，直接移除签名。
                finalData = { ...characterData };
                delete finalData.signature;
            }

            // 3. 执行下载或复制操作
            const name = finalData.codename || finalData.name;
            const jsonData = JSON.stringify(finalData, null, 2);

            if (type === 'download') {
                const blob = new Blob([jsonData], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `角色档案_${name}_已编辑.json`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
                // 延迟更新消息，确保用户能看到签名成功的提示
                setTimeout(() => setMessage({ type: 'success', text: '文件已下载！' }), 1000);
            } else {
                await navigator.clipboard.writeText(jsonData);
                setCopiedStatus(true);
                setTimeout(() => setCopiedStatus(false), 2000);
            }

        } catch (err) {
            const text = err instanceof Error ? err.message : '处理数据时发生未知错误。';
            setMessage({ type: 'error', text: `操作失败: ${text}` });
        } finally {
            setIsLoading(false);
        }
    };

    /**
     * 【新增】处理图片保存的回调函数。
     * 当在移动设备上点击卡片保存按钮时，此函数会被调用。
     * @param imageUrl - 由卡片组件生成的图片Data URL。
     */
    const handleSaveImageCallback = (imageUrl: string) => {
        setSavedImageUrl(imageUrl);
        setShowImageModal(true);
    };

    return (
        <>
            <Head>
                <title>角色管理中心 - MahoShojo Generator</title>
            </Head>
            <div className="magic-background-white">
                <div className="container">
                    <div className="card">
                        <div className="text-center mb-4">
                            <div className="flex justify-center items-center mt-4" style={{ marginBottom: '1rem' }}>
                                <img src="/character-manager.svg" width={320} height={40} alt="角色数据管理" />
                            </div>
                            <p className="subtitle mt-2">在这里查看、编辑和维护你的角色档案</p>
                            {/* 实验性警告 */}
                            <div className="flex mb-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800 text-left">
                                <div className="mr-2">⚠️ </div>
                                <div>目前，用户系统仍处于测试阶段，可能存在功能不稳定的情况，敬请谅解。同时请妥善保存您的登录密钥，之后会开启邮箱找回密钥的功能。</div>
                            </div>
                            {/* 账户状态显示区域 */}
                            <div className="mt-4 p-3 bg-pink-50 rounded-lg">
                                {authLoading ? (
                                    <p className="text-sm text-gray-600">加载中...</p>
                                ) : isAuthenticated ? (
                                    <div className="flex justify-between items-center">
                                        <div className="text-left">
                                            <p className="text-sm text-gray-600">当前用户</p>
                                            <UserWithTitle 
                                                username={user?.username || ''}
                                                prefix={user?.prefix}
                                                usernameClassName="font-semibold text-pink-700"
                                                titleClassName="ml-1"
                                            />
                                        </div>
                                        <div className="space-x-2">
                                            <button
                                                onClick={() => setShowDataCardsModal(true)}
                                                className="px-3 py-1 text-sm bg-pink-600 text-white rounded hover:bg-pink-700"
                                            >
                                                我的数据卡 ({userDataCards.length}/{userCapacity})
                                            </button>
                                            <button
                                                onClick={logout}
                                                className="px-3 py-1 text-sm bg-gray-500 text-white rounded hover:bg-gray-600"
                                            >
                                                退出登录
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center">
                                        <p className="text-sm text-gray-600 mb-2">登录后可以保存和管理您的角色数据卡</p>
                                        <button
                                            onClick={() => setShowAuthModal(true)}
                                            className="px-4 py-2 bg-pink-600 text-white rounded hover:bg-pink-700"
                                        >
                                            登录 / 注册
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="mb-6 p-4 bg-gray-100 border border-gray-300 rounded-lg text-sm text-gray-800">
                            <button
                                onClick={() => setIsGuideVisible(!isGuideVisible)}
                                className="w-full text-left font-bold text-gray-700 mb-2 focus:outline-none"
                            >
                                {isGuideVisible ? '▼' : '▶'} 使用指南
                            </button>
                            {isGuideVisible && (
                                <div className="mt-2 space-y-3">
                                    <div>
                                        <h4 className="font-semibold text-gray-800">核心功能：</h4>
                                        <ul className="list-disc list-inside space-y-1 mt-1 pl-2">
                                            <li><span className="font-semibold">加载角色：</span>通过上传 <code>.json</code> 文件或直接粘贴文本内容来加载你的角色档案。</li>
                                            <li><span className="font-semibold">编辑数据：</span>可视化地查看并修改角色的各项设定，包括调整历战记录和新增的“内嵌随机事件”。</li>
                                            <li><span className="font-semibold">一键换名：</span>修改名称后，可一键替换档案中所有旧名称。</li>
                                            <li><span className="font-semibold">生成立绘：</span>加载角色后，展开下方的“立绘生成”模块，可为你的角色创建立绘。</li>
                                            <li><span className="font-semibold">保存与导出：</span>完成修改后，可下载新的 <code>.json</code> 文件或将内容复制到剪贴板。</li>
                                        </ul>
                                    </div>
                                    <div>
                                        <h4 className="font-semibold text-gray-800">关于“原生数据”：</h4>
                                        <ul className="list-disc list-inside space-y-1 mt-1 pl-2">
                                            <li>“原生数据”指由本生成器直接产出、未经核心修改的角色文件。它包含一个数字签名，用于验证其真实性。</li>
                                            <li>在竞技场等功能中，系统会更信任原生数据。对非原生数据可能会启用更严格的内容安全检查。</li>
                                        </ul>
                                    </div>
                                    <div>
                                        <h4 className="font-semibold text-gray-800">如何保持角色“原生性”：</h4>
                                        <p className="mt-1">
                                            请注意：对角色档案的<span className="font-bold text-red-600">绝大多数修改</span>都会使其失去“原生性”，保存后数字签名将被移除。
                                        </p>
                                        <p className="mt-2">
                                            以下是<span className="font-bold text-green-600">唯一允许</span>在保持原生性的前提下进行的操作：
                                        </p>
                                        <ul className="list-disc list-inside space-y-1 mt-1 pl-2">
                                            <li>修改角色的 <code className="bg-gray-200 px-1 rounded text-xs">codename</code> (魔法少女) 或 <code className="bg-gray-200 px-1 rounded text-xs">name</code> (残兽) 字段。</li>
                                            <li>在“历战记录管理”中<span className="font-semibold">删除</span>一条或多条历史记录。</li>
                                            <li>在“历战记录管理”中点击<span className="font-semibold">“重置属性”或“清除所有记录”</span>按钮。</li>
                                            <li><span className="font-semibold">添加、编辑或删除</span>内嵌的随机事件。</li>
                                        </ul>
                                        <p className="text-xs text-gray-500 mt-2">（注：新增或修改历战记录、编辑除上述豁免字段外的任何字段，都会导致原生性丧失。）</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {!characterData ? (
                            <>
                                <div className="input-group">
                                    <label htmlFor="file-upload" className="input-label">上传 .json 设定文件（支持角色或情景文件）</label>
                                    <input id="file-upload" type="file" accept=".json" onChange={handleFileChange} className="input-field file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0" />
                                </div>
                                <div className="text-center my-4 text-gray-500">或</div>
                                {/* 可折叠的粘贴区域 */}
                                <div className="mb-6">
                                    <button
                                        onClick={() => setIsPasteAreaVisible(!isPasteAreaVisible)}
                                        className="text-pink-700 hover:underline cursor-pointer mb-2 font-semibold text-sm"
                                    >
                                        {isPasteAreaVisible ? '▼ 折叠文本粘贴区域' : '▶ 展开文本粘贴区域 (手机端推荐)'}
                                    </button>
                                    {isPasteAreaVisible && (
                                        <div className="input-group mt-2">
                                            <textarea
                                                value={pastedJson}
                                                onChange={(e) => setPastedJson(e.target.value)}
                                                placeholder="在此处粘贴角色或情景的设定文件(.json)内容..."
                                                className="input-field resize-y h-32"
                                                disabled={isLoading}
                                            />
                                            <button onClick={handlePasteAndLoad} disabled={isLoading || !pastedJson.trim()} className="generate-button mt-2 mb-0">
                                                {isLoading ? '加载中...' : '从文本加载数据'}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </>
                        ) : (
                            <div>
                                <div className="flex justify-between items-center mb-4">
                                    <h2 className="text-xl font-bold">
                                        {isScenarioData(characterData) ?
                                            `编辑情景: ${characterData.title}` :
                                            `编辑角色: ${originalData.codename || originalData.name}`
                                        }
                                    </h2>
                                    {isNative && !hasLostNativeness ? (
                                        <span className="px-3 py-1 text-xs font-semibold text-green-800 bg-green-100 rounded-full">原生数据</span>
                                    ) : (
                                        <span className="px-3 py-1 text-xs font-semibold text-yellow-800 bg-yellow-100 rounded-full">衍生数据</span>
                                    )}
                                </div>

                                {/* 按文件类型显示不同的编辑界面 */}
                                {isScenarioData(characterData) ? (
                                    <ScenarioEditor
                                        data={characterData}
                                        onChange={handleFieldChange}
                                    />
                                ) : (
                                    <div className="space-y-4">
                                        {renderFormFields(characterData)}
                                    </div>
                                )}

                                {/* 【v0.3.0 新增】调用内嵌随机事件编辑器 */}
                                {renderAdjudicationEventsEditor()}
                                {/* 历战记录管理模块 - 只对角色数据显示 */}
                                {!isScenarioData(characterData) && characterData.arena_history && (
                                    <fieldset className="border border-gray-300 p-4 rounded-lg mt-4">
                                        <legend className="text-sm font-semibold px-2 text-gray-600">历战记录管理</legend>
                                        <div className="space-y-4">
                                            {characterData.arena_history.entries?.map((entry: any) => (
                                                <div key={entry.id} className="flex items-start justify-between bg-gray-50 p-2 rounded">
                                                    <p className="text-xs truncate" title={entry.title}>{entry.id}: {entry.title}</p>
                                                    <button onClick={() => handleDeleteHistoryEntry(entry.id)} className="text-red-500 hover:text-red-700 text-xs font-bold px-2">删除</button>
                                                </div>
                                            ))}
                                            <div className="flex flex-wrap gap-2 pt-2 border-t">
                                                <button onClick={handleResetHistoryAttributes} className="text-xs bg-yellow-100 text-yellow-800 px-3 py-1 rounded hover:bg-yellow-200">重置属性</button>
                                                <button onClick={handleClearHistory} className="text-xs bg-red-100 text-red-800 px-3 py-1 rounded hover:bg-red-200">清除所有记录</button>
                                            </div>
                                        </div>
                                    </fieldset>
                                )}

                                <div className="mt-8 pt-4 border-t space-y-2">
                                    {isAuthenticated && characterData && (
                                        <button
                                            onClick={handleSaveAsDataCard}
                                            className="generate-button w-full"
                                            style={{ backgroundColor: '#10b981', backgroundImage: 'linear-gradient(to right, #10b981, #059669)' }}
                                        >
                                            保存到云端
                                        </button>
                                    )}
                                    <button onClick={() => handleSaveChanges('download')} disabled={message?.type === 'error' || isLoading} className="generate-button w-full">
                                        {isLoading ? '处理中...' : '保存修改并下载'}
                                    </button>
                                    <button onClick={() => handleSaveChanges('copy')} disabled={message?.type === 'error' || isLoading} className="generate-button w-full" style={{ backgroundColor: '#3b82f6', backgroundImage: 'linear-gradient(to right, #3b82f6, #2563eb)' }}>
                                        {isLoading ? '处理中...' : copiedStatus ? '已复制！' : '复制到剪贴板'}
                                    </button>
                                    <button onClick={() => { setCharacterData(null); setPastedJson('') }} className="footer-link mt-4 w-full text-center">
                                        加载其他数据
                                    </button>
                                </div>
                            </div>
                        )}

                        {message && (
                            <div className={`p-4 rounded-md my-4 text-sm whitespace-pre-wrap ${message.type === 'error' ? 'bg-red-100 text-red-800' :
                                message.type === 'success' ? 'bg-green-100 text-green-800' :
                                    'bg-blue-100 text-blue-800'
                                }`}>
                                {message.text}
                            </div>
                        )}
                    </div>

                    {/* 【新增】角色卡片预览与生成区域 */}
                    {characterData && !isLoading && (
                        <div className="card mt-6">
                            <h3 className="text-xl font-bold text-gray-800 text-center mb-4">
                                角色卡片预览与生成
                            </h3>
                            {characterData.codename ? (
                                <MagicalGirlCard
                                    magicalGirl={characterData}
                                    gradientStyle={(() => {
                                        const colorScheme = characterData.appearance?.colorScheme || "粉色";
                                        const mainColorName = Object.values(MainColor).find(color => colorScheme.includes(color)) || MainColor.Pink;
                                        const colors = gradientColors[mainColorName] || gradientColors[MainColor.Pink];
                                        return `linear-gradient(135deg, ${colors.first} 0%, ${colors.second} 100%)`;
                                    })()}
                                    onSaveImage={handleSaveImageCallback}
                                />
                            ) : (
                                <CanshouCard
                                    canshou={characterData}
                                    onSaveImage={handleSaveImageCallback}
                                />
                            )}
                        </div>
                    )}

                    {/* 立绘生成 - 只对角色数据显示 */}
                    {!isScenarioData(characterData) && (
                        <div className="card mt-6">
                            <button
                                onClick={() => setIsTachieVisible(!isTachieVisible)}
                                className="w-full text-left text-lg font-bold text-gray-800"
                            >
                                {isTachieVisible ? '▼' : '▶'} 立绘生成
                            </button>
                            {isTachieVisible && characterData && (
                                <div className="mt-4 pt-4 border-t">
                                    <TachieGenerator prompt={tachiePrompt} />
                                </div>
                            )}
                        </div>
                    )}

                    <div className="text-center mt-8">
                        <Link href="/" className="footer-link">返回首页</Link>
                    </div>
                </div>

                {/* 【新增】用于移动端长按保存的图片模态框 */}
                {showImageModal && savedImageUrl && (
                    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4" onClick={() => setShowImageModal(false)}>
                        <div className="bg-white rounded-lg max-w-lg w-full max-h-[80vh] overflow-auto relative p-4" onClick={(e) => e.stopPropagation()}>
                            <button onClick={() => setShowImageModal(false)} className="absolute top-2 right-2 text-3xl text-gray-600 hover:text-gray-900">&times;</button>
                            <p className="text-center text-sm text-gray-600 mb-2">📱 长按图片保存到相册</p>
                            <img src={savedImageUrl} alt="角色卡片" className="w-full h-auto rounded-lg" />
                        </div>
                    </div>
                )}
            </div>

            {/* 认证模态框 */}
            <AuthModal
                isOpen={showAuthModal}
                onClose={() => {
                    setShowAuthModal(false);
                    setAuthMessage(null);
                    setGeneratedAuthKey(null);
                }}
                onLogin={handleLogin}
                onRegister={handleRegister}
                authMessage={authMessage}
                generatedAuthKey={generatedAuthKey}
            />

            {/* 数据卡管理模态框 */}
            <DataCardsModal
                isOpen={showDataCardsModal}
                onClose={() => {
                    setShowDataCardsModal(false);
                    setCurrentPage(1);
                }}
                dataCards={userDataCards}
                editingCard={editingCard}
                currentPage={currentPage}
                cardsPerPage={cardsPerPage}
                onPageChange={setCurrentPage}
                onEditCard={setEditingCard}
                onUpdateCard={handleUpdateDataCard}
                onDeleteCard={handleDeleteDataCard}
                onLoadCard={handleLoadDataCard}
                onCancelEdit={() => setEditingCard(null)}
                onShareCard={handleShareDataCard}
                userCapacity={userCapacity}
            />

            {/* 保存数据卡弹窗 */}
            <SaveCardModal
                isOpen={showSaveCardModal}
                onClose={() => {
                    setShowSaveCardModal(false);
                    setNewCardForm({ name: '', description: '', isPublic: false });
                    setSaveCardError(null);
                    setIsSavingCard(false);
                }}
                onSave={handleConfirmSaveCard}
                name={newCardForm.name}
                description={newCardForm.description}
                isPublic={newCardForm.isPublic}
                onNameChange={(value) => setNewCardForm({ ...newCardForm, name: value })}
                onDescriptionChange={(value) => setNewCardForm({ ...newCardForm, description: value })}
                onPublicChange={(value) => setNewCardForm({ ...newCardForm, isPublic: value })}
                error={saveCardError}
                isSaving={isSavingCard}
                currentCardCount={userDataCards.length}
                userCapacity={userCapacity}
            />
        </>
    );
};

export default CharacterManagerPage;