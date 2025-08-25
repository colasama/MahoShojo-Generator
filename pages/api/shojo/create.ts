import { createWithCustomId } from '../../../lib/d1';
import { getLogger } from '../../../lib/logger';

const log = getLogger('api-shojo-create');

export const config = {
  runtime: 'edge',
};

async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Method not allowed' 
    }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const { data, table = 'player_data' } = await req.json();
    
    if (!data) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: '缺少 data 参数' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 将数据转换为字符串（如果还不是的话）
    const dataString = typeof data === 'string' ? data : JSON.stringify(data);
    
    const customId = await createWithCustomId(dataString, table);
    
    if (customId !== null) {
      return new Response(JSON.stringify({ 
        success: true, 
        id: customId,
        message: `成功插入表 ${table}，生成 32 位随机 ID`
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } else {
      return new Response(JSON.stringify({ 
        success: false, 
        error: '插入失败或配置信息缺失' 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  } catch (error) {
    log.error('创建记录失败', { error });
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