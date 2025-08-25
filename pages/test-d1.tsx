import React, { useState } from 'react';
import Head from 'next/head';

export default function TestD1() {
  const [testData, setTestData] = useState('{"name": "测试魔法少女", "level": 3, "power": "星光闪耀"}');
  const [updateId, setUpdateId] = useState('');
  const [result, setResult] = useState<string>('');
  const [loading, setLoading] = useState(false);

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
          </div>
        </div>
      </div>
    </>
  );
}