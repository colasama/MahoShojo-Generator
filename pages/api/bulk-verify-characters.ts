// pages/api/bulk-verify-characters.ts
import { NextRequest } from 'next/server';
import { verifySignature } from '../../lib/signature';

export const config = {
  runtime: 'edge',
};

// 定义API返回的单个校验结果的类型
interface VerificationResult {
    name: string;
    isValid: boolean;
}

/**
 * 处理批量校验角色设定原生性的API请求。
 * @param req - Next.js的请求对象。
 */
async function handler(req: NextRequest) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const { characters } = await req.json();

    if (!Array.isArray(characters)) {
        return new Response(JSON.stringify({ error: '请求体必须是一个包含 "characters" 数组的对象。' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    // 使用Promise.all来并行处理所有角色的校验任务，以提高效率
    const verificationPromises = characters.map(async (charData: any) => {
        // 从角色数据中获取名称，用于前端匹配
        const name = charData?.codename || charData?.name || '未知角色';
        const isValid = await verifySignature(charData);
        return { name, isValid };
    });

    const results: VerificationResult[] = await Promise.all(verificationPromises);
    
    // 返回一个包含所有角色校验结果的数组
    return new Response(JSON.stringify({ results }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    // 如果请求体不是有效的JSON，或者发生其他错误，都视为校验失败
    console.error('批量校验API出错:', error);
    return new Response(JSON.stringify({ results: [], error: '无效的请求数据' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export default handler;