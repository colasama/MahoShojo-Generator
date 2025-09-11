import { getPublicDataCards } from '@/lib/d1';

export const runtime = 'edge';

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const url = new URL(req.url);
    const type = url.searchParams.get('type'); // 'character' or 'scenario'
    const limit = parseInt(url.searchParams.get('limit') || '12');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    // 获取公开数据卡，如果指定了类型则过滤
    const cards = await getPublicDataCards(limit, offset, type as 'character' | 'scenario' | undefined);

    return new Response(JSON.stringify({
      success: true,
      cards
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Get public data cards error:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: '获取公开数据卡失败' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}