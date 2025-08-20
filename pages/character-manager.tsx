// pages/character-manager.tsx

import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { quickCheck } from '@/lib/sensitive-word-filter';
import { randomChooseOneHanaName } from '@/lib/random-choose-hana-name';

// 定义允许保持原生性的可编辑字段
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

    // 核心逻辑：追踪数据变化以判断原生性是否丧失
    useEffect(() => {
        if (!originalData || !characterData) return;

        // 深比较函数，用于找出变化的键
        const findChangedKeys = (obj1: any, obj2: any, path: string = ''): string[] => {
            const keys1 = Object.keys(obj1);
            const keys2 = Object.keys(obj2);
            let diffs: string[] = [];

            const allKeys = new Set([...keys1, ...keys2]);

            for (const key of Array.from(allKeys)) {
                const currentPath = path ? `${path}.${key}` : key;
                const val1 = obj1[key];
                const val2 = obj2[key];

                if (typeof val1 === 'object' && val1 !== null && typeof val2 === 'object' && val2 !== null && !Array.isArray(val1) && !Array.isArray(val2)) {
                    diffs = diffs.concat(findChangedKeys(val1, val2, currentPath));
                } else if (JSON.stringify(val1) !== JSON.stringify(val2)) {
                    diffs.push(currentPath);
                }
            }
            return diffs;
        };

        const changedKeys = findChangedKeys(originalData, characterData);
        
        // 检查是否有任何一项修改是会“导致原生性丧失的”
        const hasBreakingChange = changedKeys.some(key => {
            // arena_history 的变化是特例，单独处理
            if (key.startsWith('arena_history')) return false;
            // codename 和 name 的变化是允许的
            if (NATIVE_PRESERVING_FIELDS.has(key)) return false;
            // 其他任何变化都会导致原生性丧失
            return true;
        });

        if (hasBreakingChange) {
            setHasLostNativeness(true);
        }

    }, [characterData, originalData]);

    // 加载和处理JSON数据
    const processJsonData = async (jsonText: string) => {
        setIsLoading(true);
        setMessage(null);
        setHasLostNativeness(false);

        try {
            const data = JSON.parse(jsonText);
            
            // 简单验证
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
    
    const handlePasteAndLoad = () => {
        if (!pastedJson.trim()) {
            setMessage({ type: 'error', text: '文本框内容为空。' });
            return;
        }
        processJsonData(pastedJson);
    };

    // 递归渲染表单
    const renderFormFields = (data: any, path: string = ''): React.ReactNode => {
        return Object.entries(data).map(([key, value]) => {
            const currentPath = path ? `${path}.${key}` : key;
            
            if (key === 'signature') return <React.Fragment key={currentPath}></React.Fragment>;

            const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
                const newValue = e.target.value;
                setCharacterData((prev: any) => {
                    const new_data = { ...prev };
                    let current = new_data;
                    const keys = currentPath.split('.');
                    for (let i = 0; i < keys.length - 1; i++) {
                        current = current[keys[i]];
                    }
                    current[keys[keys.length - 1]] = newValue;
                    return new_data;
                });
            };

            if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                return (
                    <fieldset key={currentPath} className="border border-gray-300 p-4 rounded-lg mt-4">
                        <legend className="text-sm font-semibold px-2 text-gray-600">{key}</legend>
                        <div className="space-y-4">{renderFormFields(value, currentPath)}</div>
                    </fieldset>
                );
            }

            return (
                <div key={currentPath}>
                    <label htmlFor={currentPath} className="block text-sm font-medium text-gray-700 capitalize">{key.replace(/([A-Z])/g, ' $1')}</label>
                    <div className="mt-1 flex items-center">
                    { typeof value === 'string' && value.length > 100 ? 
                        <textarea id={currentPath} value={value as string} onChange={handleChange} rows={4} className="input-field" />
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
        setCharacterData((prev: any) => ({ ...prev, codename: newCodename }));
    };
    
    // 保存逻辑 (SRS 3.7.4)
    const handleSaveChanges = async () => {
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
        
        // 3. 触发下载
        const name = finalData.codename || finalData.name;
        const jsonData = JSON.stringify(finalData, null, 2);
        const blob = new Blob([jsonData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `角色档案_${name}_已编辑.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        setMessage({ type: 'success', text: '文件已保存！' });
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

                    {!characterData && (
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

                    {characterData && (
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

                            <div className="mt-8 pt-4 border-t">
                                <button onClick={handleSaveChanges} disabled={message?.type === 'error'} className="generate-button w-full">
                                    保存修改并下载
                                </button>
                                <button onClick={() => setCharacterData(null)} className="footer-link mt-4 w-full text-center">
                                    加载其他角色
                                </button>
                            </div>
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