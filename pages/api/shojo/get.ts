import { getRecordById } from '../../../lib/d1';
import { getLogger } from '../../../lib/logger';

const log = getLogger('api-shojo-get');

export const config = {
  runtime: 'edge',
};

async function handler(req: Request): Promise<Response> {
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Method not allowed. Use GET.' 
    }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    // 解析 URL 查询参数
    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    const table = url.searchParams.get('table') || 'player_data';
    
    if (!id) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: '缺少必要参数: id' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const record = await getRecordById(id, table);
    
    if (record) {
      return new Response(JSON.stringify({ 
        success: true,
        data: record,
        message: `成功找到 ${table} 表中 ID 为 ${id} 的记录`
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } else {
      return new Response(JSON.stringify({ 
        success: false, 
        error: '未找到指定 ID 的记录' 
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  } catch (error) {
    log.error('查询记录失败', { error, url: req.url });
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    
    return new Response(JSON.stringify({ 
      success: false, 
      error: errorMessage 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export default handler;