import React, { useState, useEffect } from 'react';
import Head from 'next/head';

interface RecordData {
  id: string;
  data: string;
  created_at: string;
  updated_at: string;
}

export default function TestD1() {
  const [testData, setTestData] = useState('{"name": "测试魔法少女", "level": 3, "power": "星光闪耀"}');
  const [updateId, setUpdateId] = useState('');
  const [result, setResult] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [recordsList, setRecordsList] = useState<RecordData[]>([]);
  const [showRecordsList, setShowRecordsList] = useState(false);

  // 从 localStorage 加载保存的 IDs
  useEffect(() => {
    const loadSavedIds = () => {
      try {
        const stored = localStorage.getItem('test-d1-keys');
        if (stored) {
          const ids = JSON.parse(stored);
          setSavedIds(Array.isArray(ids) ? ids : []);
        }
      } catch (error) {
        console.error('加载保存的 IDs 失败:', error);
      }
    };

    loadSavedIds();
  }, []);

  // 保存 ID 到 localStorage
  const saveIdToStorage = (id: string) => {
    try {
      const updatedIds = [...savedIds, id];
      setSavedIds(updatedIds);
      localStorage.setItem('test-d1-keys', JSON.stringify(updatedIds));
    } catch (error) {
      console.error('保存 ID 到 localStorage 失败:', error);
    }
  };

  const handleTestCustomId = async () => {
    setLoading(true);
    setResult('');

    try {
      const data = JSON.parse(testData);
      const response = await fetch('/api/shojo/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ data }),
      });

      const result = await response.json();

      if (result.success) {
        setResult(`✅ 成功插入新表 player_data！生成的 32 位随机 ID: ${result.id}`);
        setUpdateId(result.id); // 自动填入更新 ID 字段
        saveIdToStorage(result.id); // 保存 ID 到 localStorage
      } else {
        setResult(`❌ 插入新表失败: ${result.error}`);
      }
    } catch (error) {
      setResult(`❌ 错误: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleTestUpdate = async () => {
    setLoading(true);
    setResult('');

    try {
      if (!updateId.trim()) {
        setResult('❌ 请先输入要更新的 ID');
        setLoading(false);
        return;
      }

      const data = JSON.parse(testData);
      const response = await fetch('/api/shojo/update', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: updateId.trim(),
          data,
          table: 'player_data'
        }),
      });

      const result = await response.json();

      if (result.success) {
        setResult(`✅ 成功更新 ID: ${updateId} 的数据！`);
      } else {
        setResult(`❌ 更新失败: ${result.error}`);
      }
    } catch (error) {
      setResult(`❌ 错误: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadAllRecords = async () => {
    if (savedIds.length === 0) {
      setResult('❌ 没有保存的 ID 记录');
      return;
    }

    setLoading(true);
    setResult('');

    try {
      const records: RecordData[] = [];
      let successCount = 0;
      let failCount = 0;

      for (const id of savedIds) {
        try {
          const response = await fetch(`/api/shojo/get?id=${encodeURIComponent(id)}&table=player_data`, {
            method: 'GET',
          });

          const result = await response.json();

          if (result.success) {
            records.push(result.data);
            successCount++;
          } else {
            failCount++;
          }
        } catch (error) {
          failCount++;
          console.error(`查询 ID ${id} 失败:`, error);
        }
      }

      setRecordsList(records);
      setShowRecordsList(true);
      setResult(`✅ 批量查询完成！成功: ${successCount}，失败: ${failCount}`);
    } catch (error) {
      setResult(`❌ 批量查询错误: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleClearStorage = () => {
    try {
      localStorage.removeItem('test-d1-keys');
      setSavedIds([]);
      setRecordsList([]);
      setShowRecordsList(false);
      setResult('✅ 已清除所有保存的 ID');
    } catch (error) {
      setResult(`❌ 清除失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  const handleTestGetRecord = async () => {
    setLoading(true);
    setResult('');

    try {
      if (!updateId.trim()) {
        setResult('❌ 请先输入要查询的 ID');
        setLoading(false);
        return;
      }

      const response = await fetch(`/api/shojo/get?id=${encodeURIComponent(updateId.trim())}&table=player_data`, {
        method: 'GET',
      });

      const result = await response.json();

      if (result.success) {
        const recordData = result.data;
        setResult(`✅ 成功找到记录！\nID: ${recordData.id}\n创建时间: ${recordData.created_at}\n更新时间: ${recordData.updated_at}\n数据: ${recordData.data}`);
      } else {
        setResult(`❌ 查询失败: ${result.error}`);
      }
    } catch (error) {
      setResult(`❌ 错误: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateTestData = () => {
    const testCharacter = {
      name: `测试魔法少女_${Date.now()}`,
      level: Math.floor(Math.random() * 6) + 1,
      power: ['星光闪耀', '月之守护', '火焰之舞', '冰霜之心', '雷电风暴'][Math.floor(Math.random() * 5)],
      attributes: {
        strength: Math.floor(Math.random() * 100),
        magic: Math.floor(Math.random() * 100),
        defense: Math.floor(Math.random() * 100)
      },
      created_at: new Date().toISOString()
    };
    setTestData(JSON.stringify(testCharacter, null, 2));
  };

  return (
    <>
      <Head>
        <title>D1 数据库测试 - 魔法少女生成器</title>
        <meta name="description" content="测试 D1 数据库功能" />
      </Head>
      <div className="magic-background-white">
        <div className="container">
          <div className="card">
            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
              <h1>🧪 D1 数据库测试</h1>
              <p>测试 saveToD1 和 insertToD1 函数</p>
            </div>

            <div style={{ marginBottom: '2rem' }}>
              <label htmlFor="test-data" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                测试数据 (JSON 格式):
              </label>
              <textarea
                id="test-data"
                value={testData}
                onChange={(e) => setTestData(e.target.value)}
                style={{
                  width: '100%',
                  height: '200px',
                  padding: '0.75rem',
                  border: '1px solid #ddd',
                  borderRadius: '8px',
                  fontFamily: 'monospace',
                  fontSize: '14px',
                  resize: 'vertical'
                }}
                placeholder="输入要测试的 JSON 数据"
              />
            </div>

            <div style={{ marginBottom: '2rem' }}>
              <label htmlFor="update-id" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                更新数据的 ID (32位随机字符串):
              </label>
              <input
                type="text"
                id="update-id"
                value={updateId}
                onChange={(e) => setUpdateId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #ddd',
                  borderRadius: '8px',
                  fontSize: '14px'
                }}
                placeholder="输入要更新的记录 ID (创建记录后会自动填充)"
              />
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
              <button
                onClick={handleGenerateTestData}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: '#4CAF50',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                🎲 生成测试数据
              </button>

              <button
                onClick={handleTestCustomId}
                disabled={loading}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: loading ? '#ccc' : '#9C27B0',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontSize: '14px'
                }}
              >
                {loading ? '⏳ 测试中...' : '🔤 测试新表 (32位随机ID)'}
              </button>

              <button
                onClick={handleTestUpdate}
                disabled={loading}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: loading ? '#ccc' : '#FF5722',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontSize: '14px'
                }}
              >
                {loading ? '⏳ 更新中...' : '✏️ 更新数据 (需要ID)'}
              </button>

              <button
                onClick={handleTestGetRecord}
                disabled={loading}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: loading ? '#ccc' : '#607D8B',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontSize: '14px'
                }}
              >
                {loading ? '⏳ 查询中...' : '🔍 查询记录 (根据ID)'}
              </button>

              <button
                onClick={handleLoadAllRecords}
                disabled={loading}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: loading ? '#ccc' : '#4CAF50',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontSize: '14px'
                }}
              >
                {loading ? '⏳ 加载中...' : `📋 加载所有记录 (${savedIds.length})`}
              </button>

              <button
                onClick={handleClearStorage}
                disabled={loading}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: loading ? '#ccc' : '#F44336',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontSize: '14px'
                }}
              >
                🗑️ 清除存储
              </button>
            </div>

            {result && (
              <div
                style={{
                  padding: '1rem',
                  backgroundColor: result.startsWith('✅') ? '#d4edda' : '#f8d7da',
                  color: result.startsWith('✅') ? '#155724' : '#721c24',
                  border: `1px solid ${result.startsWith('✅') ? '#c3e6cb' : '#f5c6cb'}`,
                  borderRadius: '8px',
                  marginBottom: '2rem',
                  fontFamily: 'monospace',
                  fontSize: '14px',
                  whiteSpace: 'pre-wrap'
                }}
              >
                {result}
              </div>
            )}

            {showRecordsList && recordsList.length > 0 && (
              <div style={{ marginBottom: '2rem' }}>
                <h3 style={{ marginBottom: '1rem', color: '#333' }}>📋 保存的记录列表</h3>
                <div style={{
                  maxHeight: '400px',
                  overflowY: 'auto',
                  border: '1px solid #ddd',
                  borderRadius: '8px'
                }}>
                  {recordsList.map((record, index) => (
                    <div
                      key={record.id}
                      style={{
                        padding: '1rem',
                        borderBottom: index < recordsList.length - 1 ? '1px solid #eee' : 'none',
                        backgroundColor: index % 2 === 0 ? '#f9f9f9' : 'white'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                        <strong style={{ fontSize: '14px', color: '#2196F3', fontFamily: 'monospace' }}>
                          ID: {record.id}
                        </strong>
                        <button
                          onClick={() => setUpdateId(record.id)}
                          style={{
                            padding: '0.25rem 0.5rem',
                            backgroundColor: '#2196F3',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            fontSize: '12px',
                            cursor: 'pointer'
                          }}
                        >
                          选择
                        </button>
                      </div>
                      <div style={{ fontSize: '12px', color: '#666', marginBottom: '0.5rem' }}>
                        创建: {new Date(record.created_at).toLocaleString('zh-CN')} |
                        更新: {new Date(record.updated_at).toLocaleString('zh-CN')}
                      </div>
                      <div style={{
                        backgroundColor: '#f5f5f5',
                        padding: '0.5rem',
                        borderRadius: '4px',
                        fontSize: '13px',
                        fontFamily: 'monospace',
                        overflow: 'auto',
                        maxHeight: '100px'
                      }}>
                        {record.data}
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{
                  marginTop: '1rem',
                  textAlign: 'center',
                  fontSize: '14px',
                  color: '#666'
                }}>
                  共 {recordsList.length} 条记录
                </div>
              </div>
            )}

            <div style={{ marginTop: '2rem', padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
              <h3>📋 使用说明:</h3>
              <ul style={{ marginLeft: '1rem', color: '#666' }}>
                <li><strong>insertIntoD1</strong>: 插入数据到原始表 shojo，返回自增 ID</li>
                <li><strong>saveToD1</strong>: 插入数据到原始表 shojo，返回成功/失败的布尔值</li>
                <li><strong>createWithCustomId</strong>: 插入数据到新表 player_data，返回 32 位随机字符串 ID</li>
                <li><strong>updateById</strong>: 根据 ID 更新 player_data 表中的数据，返回更新成功与否</li>
                <li><strong>getRecordById</strong>: 根据 ID 查询 player_data 表中的完整记录，返回记录详情</li>
                <li><strong>localStorage 功能</strong>: 创建的所有 ID 自动保存到浏览器本地存储</li>
                <li><strong>批量查询</strong>: 可以一键加载所有保存的记录并以列表形式展示</li>
                <li>32 位随机 ID 包含大小写字母和数字，格式如: AbC123XyZ789...</li>
                <li>创建数据后 ID 会自动填入更新字段，方便测试更新和查询功能</li>
                <li>记录列表支持快速选择 ID 进行后续操作</li>
                <li>查询结果会显示完整的记录信息：ID、数据、创建时间、更新时间</li>
                <li>通过 API 路由调用，避免客户端直接访问环境变量</li>
                <li>需要配置环境变量: D1_DATABASE_ID, CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID</li>
                <li>需要在 D1 控制台创建 player_data 表（参考 lib/d1.ts 中的 SQL）</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}