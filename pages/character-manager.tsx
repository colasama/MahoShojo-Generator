// pages/character-manager.tsx

import React, { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { quickCheck } from '@/lib/sensitive-word-filter';
import { randomChooseOneHanaName } from '@/lib/random-choose-hana-name';
import { webcrypto } from 'crypto';

// 兼容 Edge 和 Node.js 环境的 crypto API
const randomUUID = typeof crypto !== 'undefined' ? crypto.randomUUID.bind(crypto) : webcrypto.randomUUID.bind(webcrypto);


// 定义允许保持原生性的可编辑字段 (顶级键)
const NATIVE_PRESERVING_FIELDS = new Set(['codename', 'name']);

const CharacterManagerPage: React.FC = () => {
    const [pastedJson, setPastedJson] = useState('');
    const [characterData, setCharacterData] = useState<any | null>(null);
    const [originalData, setOriginalData] = useState<any | null>(null);
    
    // 状态管理
    const [isNative, setIsNative] = useState(false);
    const [hasLostNativeness, setHasLostNativeness] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'info' | 'error' | 'success', text: string } | null>(null);
    const [copiedStatus, setCopiedStatus] = useState(false);

    // 核心逻辑：追踪数据变化以判断原生性是否丧失 (SRS 3.7.3)
    useEffect(() => {
        if (!originalData || !characterData || !isNative) return;

        // 深比较函数，用于比较两个对象是否相等
        const deepEqual = (obj1: any, obj2: any): boolean => {
            return JSON.stringify(obj1) === JSON.stringify(obj2);
        };
        
        let hasBreakingChange = false;
        
        // 遍历原始数据的所有键
        for (const key in originalData) {
            // 忽略签名本身的比较
            if (key === 'signature') continue;

            // 检查非特许字段是否被修改
            if (!NATIVE_PRESERVING_FIELDS.has(key) && key !== 'arena_history') {
                if (!deepEqual(originalData[key], characterData[key])) {
                    hasBreakingChange = true;
                    break;
                }
            }
        }
        
        // 单独检查 arena_history 的复杂修改规则
        if (!hasBreakingChange && originalData.arena_history && characterData.arena_history) {
            // 允许属性重置和记录清除，但属性本身不能被随意修改
            if (originalData.arena_history.attributes.sublimation_count !== characterData.arena_history.attributes.sublimation_count ||
                originalData.arena_history.attributes.last_sublimation_at !== characterData.arena_history.attributes.last_sublimation_at) {
                hasBreakingChange = true;
            } else {
                 // 只允许删除条目，不允许修改或新增
                const originalEntries = originalData.arena_history.entries || [];
                const currentEntries = characterData.arena_history.entries || [];
                if (currentEntries.length > originalEntries.length) {
                    hasBreakingChange = true; // 不允许新增
                } else {
                    const originalEntryIds = new Set(originalEntries.map((e: any) => e.id));
                    const hasModifiedOrAdded = currentEntries.some((currentEntry: any) => {
                        if (!originalEntryIds.has(currentEntry.id)) return true; // 新增了ID
                        const originalEntry = originalEntries.find((e: any) => e.id === currentEntry.id);
                        return !deepEqual(originalEntry, currentEntry); // 内容被修改
                    });
                    if(hasModifiedOrAdded) hasBreakingChange = true;
                }
            }
        }
        
        if (hasBreakingChange) {
            setHasLostNativeness(true);
        }

    }, [characterData, originalData, isNative]);
    
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

    // 递归渲染表单
    const renderFormFields = (data: any, path: string = ''): React.ReactNode => {
        // 渲染顺序：基本信息 -> 外观 -> 魔装 -> 奇境 -> 繁开 -> 分析 -> 问卷 -> 历战记录
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
            if (key === 'signature') return null;
            if (key === 'arena_history') return null; // 历战记录单独渲染

            const value = data[key];

            const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
                handleFieldChange(currentPath, e.target.value);
            };

            if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
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
        
        // 1. 内容安全检查
        if ((await quickCheck(JSON.stringify(characterData))).hasSensitiveWords) {
            setMessage({ type: 'error', text: '检测到不适宜内容，无法保存。请修改后重试。' });
            return;
        }
        
        // 2. 构造最终数据
        const finalData = { ...characterData };
        if (hasLostNativeness || !isNative) {
            delete finalData.signature;
        }
        
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
            setMessage({ type: 'success', text: '文件已下载！' });
        } else {
            navigator.clipboard.writeText(jsonData).then(() => {
                setCopiedStatus(true);
                setTimeout(() => setCopiedStatus(false), 2000);
            });
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
                        <h1 className="text-3xl font-bold text-gray-800">角色管理中心</h1>
                        <p className="subtitle mt-2">在这里查看、编辑和维护你的角色档案</p>
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
                                <button onClick={() => handleSaveChanges('download')} disabled={message?.type === 'error'} className="generate-button w-full">
                                    保存修改并下载
                                </button>
                                <button onClick={() => handleSaveChanges('copy')} disabled={message?.type === 'error'} className="generate-button w-full" style={{backgroundColor: '#3b82f6', backgroundImage: 'linear-gradient(to right, #3b82f6, #2563eb)'}}>
                                    {copiedStatus ? '已复制！' : '复制到剪贴板'}
                                </button>
                                <button onClick={() => { setCharacterData(null); setPastedJson('') }} className="footer-link mt-4 w-full text-center">
                                    加载其他角色
                                </button>
                            </div>
                        </div>
                    )}
                    
                    {message && (
                        <div className={`p-4 rounded-md my-4 text-sm whitespace-pre-wrap ${
                            message.type === 'error' ? 'bg-red-100 text-red-800' :
                            message.type === 'success' ? 'bg-green-100 text-green-800' :
                            'bg-blue-100 text-blue-800'
                        }`}>
                            {message.text}
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