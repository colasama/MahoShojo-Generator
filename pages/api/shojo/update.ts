import { updateById } from '../../../lib/d1';
import { getLogger } from '../../../lib/logger';

const log = getLogger('api-shojo-update');

export const config = {
  runtime: 'edge',
};

async function handler(req: Request): Promise<Response> {
  if (req.method !== 'PUT') {
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Method not allowed. Use PUT.' 
    }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const { id, data, table = 'player_data' } = await req.json();
    
    if (!id || !data) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: '缺少必要参数: id 和 data' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 将数据转换为字符串（如果还不是的话）
    const dataString = typeof data === 'string' ? data : JSON.stringify(data);
    
    const success = await updateById(id, dataString, table);
    
    if (success) {
      return new Response(JSON.stringify({ 
        success: true,
        message: `成功更新 ${table} 表中 ID 为 ${id} 的记录`
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } else {
      return new Response(JSON.stringify({ 
        success: false, 
        error: '更新失败：找不到指定 ID 的记录或配置信息缺失' 
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  } catch (error) {
    log.error('更新记录失败', { error, id: req.url });
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