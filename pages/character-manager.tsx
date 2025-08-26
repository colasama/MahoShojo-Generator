// pages/character-manager.tsx

import React, { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { quickCheck } from '@/lib/sensitive-word-filter';
import { randomChooseOneHanaName } from '@/lib/random-choose-hana-name';
import { webcrypto } from 'crypto';
import TachieGenerator from '../components/TachieGenerator';

// 兼容 Edge 和 Node.js 环境的 crypto API
const randomUUID = typeof crypto !== 'undefined' ? crypto.randomUUID.bind(crypto) : webcrypto.randomUUID.bind(webcrypto);


// 定义允许保持原生性的可编辑字段 (顶级键) (SRS 3.7.3)
const NATIVE_PRESERVING_FIELDS = new Set(['codename', 'name']);

/**
 * 辅助函数：判断一个值是否为可以遍历的普通对象（非数组、非null）。
 * @param item - 要检查的值。
 * @returns {boolean} 如果是对象则返回true，否则返回false。
 */
const isObject = (item: any): boolean => {
    return (item && typeof item === 'object' && !Array.isArray(item));
};

const CharacterManagerPage: React.FC = () => {
    const router = useRouter();
    const [pastedJson, setPastedJson] = useState('');
    const [characterData, setCharacterData] = useState<any | null>(null);
    const [originalData, setOriginalData] = useState<any | null>(null);

    // 状态管理
    const [isNative, setIsNative] = useState(false);
    const [hasLostNativeness, setHasLostNativeness] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'info' | 'error' | 'success', text: string } | null>(null);
    const [copiedStatus, setCopiedStatus] = useState(false);

    // 用于控制说明区域的显示与隐藏，默认为 true
    const [isGuideVisible, setIsGuideVisible] = useState(true);

    // [新增 SRS 3.3] 立绘生成器相关状态
    const [isTachieVisible, setIsTachieVisible] = useState(false);
    const [tachiePrompt, setTachiePrompt] = useState('');

    // [新增 SRS 3.3.3] 动态生成立绘提示词
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

    // 核心逻辑：追踪数据变化以判断原生性是否丧失 (SRS 3.7.3)
    useEffect(() => {
        if (!originalData || !characterData || !isNative) return;

        // 一旦丧失原生性，状态不再改变
        if (hasLostNativeness) return;

        const deepEqual = (obj1: any, obj2: any): boolean => {
            return JSON.stringify(obj1) === JSON.stringify(obj2);
        };

        let hasBreakingChange = false;

        // 1. 检查除特许字段和历战记录外的所有字段
        for (const key in originalData) {
            if (key === 'signature' || key === 'arena_history' || NATIVE_PRESERVING_FIELDS.has(key)) {
                continue;
            }
            if (!deepEqual(originalData[key], characterData[key])) {
                console.log(`原生性丧失：字段 '${key}' 被修改。`);
                hasBreakingChange = true;
                break;
            }
        }

        // 2. 单独检查 arena_history 的复杂修改规则 (SRS 3.7.3)
        if (!hasBreakingChange && originalData.arena_history && characterData.arena_history) {
            const originalAttrs = originalData.arena_history.attributes || {};
            const currentAttrs = characterData.arena_history.attributes || {};
            const originalEntries = originalData.arena_history.entries || [];
            const currentEntries = characterData.arena_history.entries || [];

            // 允许 `world_line_id` 和 `created_at` 被重置，但其他属性不允许修改
            if (originalAttrs.sublimation_count !== currentAttrs.sublimation_count ||
                originalAttrs.last_sublimation_at !== currentAttrs.last_sublimation_at) {
                console.log('原生性丧失：arena_history.attributes 的核心属性被修改。');
                hasBreakingChange = true;
            } else {
                // 只允许删除条目，不允许修改或新增
                const originalEntryIds = new Set(originalEntries.map((e: any) => e.id));

                if (currentEntries.length > originalEntries.length) {
                    console.log('原生性丧失：arena_history.entries 新增了条目。');
                    hasBreakingChange = true; // 不允许新增
                } else {
                    // 检查剩余的条目是否都是原始条目且未被修改
                    for (const currentEntry of currentEntries) {
                        if (!originalEntryIds.has(currentEntry.id)) {
                            console.log(`原生性丧失：arena_history.entries 出现了新的ID ${currentEntry.id}。`);
                            hasBreakingChange = true; // 出现了新的ID，说明不是删除操作
                            break;
                        }
                        const originalEntry = originalEntries.find((e: any) => e.id === currentEntry.id);
                        if (!deepEqual(originalEntry, currentEntry)) {
                            console.log(`原生性丧失：arena_history.entries ID ${currentEntry.id} 的内容被修改。`);
                            hasBreakingChange = true; // 内容被修改
                            break;
                        }
                    }
                }
            }
        }

        if (hasBreakingChange) {
            setHasLostNativeness(true);
            setMessage({ type: 'info', text: '注意：您已修改角色的核心数据，该角色将变为“衍生数据”，保存时会移除原生签名。' });
        }

    }, [characterData, originalData, isNative, hasLostNativeness]);

    // 加载和处理JSON数据
    const processJsonData = async (jsonText: string) => {
        setIsLoading(true);
        setMessage(null);
        setHasLostNativeness(false);

        try {
            const data = JSON.parse(jsonText);

            if (typeof data !== 'object' || data === null || (!data.codename && !data.name)) {
                throw new Error('无效的角色文件格式。');
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
            setMessage({ type: 'success', text: `成功加载角色: ${data.codename || data.name}` });
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
                current = current[keys[i]] = current[keys[i]] || {};
            }
            current[keys[keys.length - 1]] = value;
            return newData;
        });
    }, []);

    // 递归渲染表单，增加了对数组的专门处理逻辑
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
            if (key === 'signature' || key === 'isPreset' || key === 'arena_history') return null;

            const value = data[key];

            // [新增] 专门处理数组类型的逻辑
            if (Array.isArray(value)) {
                // 判断是否为字符串数组，这是我们主要支持编辑的类型
                const isStringArray = value.every(item => typeof item === 'string');
                if (isStringArray) {
                    const handleArrayChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
                        // 将文本域内容按换行符分割，变回数组，从而保持数据类型正确
                        const newArray = e.target.value.split('\n');
                        handleFieldChange(currentPath, newArray);
                    };
                    return (
                        <div key={currentPath} className="mt-4">
                            <label htmlFor={currentPath} className="block text-sm font-medium text-gray-700 capitalize">{key.replace(/([A-Z])/g, ' $1')}</label>
                            <textarea
                                id={currentPath}
                                value={value.join('\n')}
                                onChange={handleArrayChange}
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

            // 处理字符串和其他原始类型的逻辑
            const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
                handleFieldChange(currentPath, e.target.value);
            };

            return (
                <div key={currentPath}>
                    <label htmlFor={currentPath} className="block text-sm font-medium text-gray-700 capitalize">{key.replace(/([A-Z])/g, ' $1')}</label>
                    <div className="mt-1 flex items-center">
                        {typeof value === 'string' && value.length > 80 ?
                            <textarea id={currentPath} value={value as string} onChange={handleChange} rows={3} className="input-field" />
                            :
                            <input type="text" id={currentPath} value={value as any} onChange={handleChange} className="input-field" />
                        }
                        {currentPath === 'codename' && (
                            <button onClick={handleRandomCodename} type="button" className="ml-2 px-3 py-1.5 text-xs font-semibold text-white bg-purple-500 rounded-lg hover:bg-purple-600">随机</button>
                        )}
                    </div>
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
                                            <li><span className="font-semibold">编辑数据：</span>可视化地查看并修改角色的各项设定，包括调整历战记录。</li>
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
                                        </ul>
                                        <p className="text-xs text-gray-500 mt-2">（注：新增或修改历战记录、编辑除代号/名称外的任何字段，都会导致原生性丧失。）</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {!characterData ? (
                            <>
                                <div className="input-group">
                                    <label htmlFor="file-upload" className="input-label">上传 .json 设定文件</label>
                                    <input id="file-upload" type="file" accept=".json" onChange={handleFileChange} className="input-field file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0" />
                                </div>
                                <div className="text-center my-4 text-gray-500">或</div>
                                <div className="input-group">
                                    <label htmlFor="paste-area" className="input-label">粘贴JSON文本内容</label>
                                    <textarea id="paste-area" value={pastedJson} onChange={(e) => setPastedJson(e.target.value)} rows={8} className="input-field" />
                                    <button onClick={handlePasteAndLoad} disabled={isLoading} className="generate-button mt-2">
                                        {isLoading ? '加载中...' : '加载数据'}
                                    </button>
                                </div>
                            </>
                        ) : (
                            <div>
                                <div className="flex justify-between items-center mb-4">
                                    <h2 className="text-xl font-bold">编辑角色: {originalData.codename || originalData.name}</h2>
                                    {isNative && !hasLostNativeness ? (
                                        <span className="px-3 py-1 text-xs font-semibold text-green-800 bg-green-100 rounded-full">原生数据</span>
                                    ) : (
                                        <span className="px-3 py-1 text-xs font-semibold text-yellow-800 bg-yellow-100 rounded-full">衍生数据</span>
                                    )}
                                </div>

                                <div className="space-y-4">
                                    {renderFormFields(characterData)}
                                </div>

                                {/* 历战记录管理模块 */}
                                {characterData.arena_history && (
                                    <fieldset className="border border-gray-300 p-4 rounded-lg mt-4">
                                        <legend className="text-sm font-semibold px-2 text-gray-600">历战记录管理</legend>
                                        <div className="space-y-4">
                                            {characterData.arena_history.entries?.map((entry: any) => (
                                                <div key={entry.id} className="flex items-center justify-between bg-gray-50 p-2 rounded">
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
                                    <button onClick={() => handleSaveChanges('download')} disabled={message?.type === 'error' || isLoading} className="generate-button w-full">
                                        {isLoading ? '处理中...' : '保存修改并下载'}
                                    </button>
                                    <button onClick={() => handleSaveChanges('copy')} disabled={message?.type === 'error' || isLoading} className="generate-button w-full" style={{ backgroundColor: '#3b82f6', backgroundImage: 'linear-gradient(to right, #3b82f6, #2563eb)' }}>
                                        {isLoading ? '处理中...' : copiedStatus ? '已复制！' : '复制到剪贴板'}
                                    </button>
                                    <button onClick={() => { setCharacterData(null); setPastedJson('') }} className="footer-link mt-4 w-full text-center">
                                        加载其他角色
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

                    <div className="text-center mt-8">
                        <Link href="/" className="footer-link">返回首页</Link>
                    </div>
                </div>
            </div>
        </>
    );
};

export default CharacterManagerPage;