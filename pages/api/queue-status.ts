import { magicalGirlQueue, magicalGirlDetailsQueue } from '../../lib/queue-system';
import { getClientIP } from '../../lib/rate-limiter';
import { getLogger } from '../../lib/logger';

const log = getLogger('api-queue-status');

export const config = {
  runtime: 'edge',
};

async function handler(
  req: Request
): Promise<Response> {
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const ip = getClientIP(req as any);
    const url = new URL(req.url);
    const endpoint = url.searchParams.get('endpoint');
    const persistenceKey = url.searchParams.get('persistenceKey');

    let queueStatus;

    if (endpoint === 'generate-magical-girl') {
      queueStatus = magicalGirlQueue.getQueueStatus(ip, persistenceKey || undefined);
    } else if (endpoint === 'generate-magical-girl-details') {
      queueStatus = magicalGirlDetailsQueue.getQueueStatus(ip, persistenceKey || undefined);
    } else {
      // 返回所有队列的状态
      const mgStatus = magicalGirlQueue.getQueueStatus(ip, persistenceKey || undefined);
      const mgDetailsStatus = magicalGirlDetailsQueue.getQueueStatus(ip, persistenceKey || undefined);

      return new Response(JSON.stringify({
        'generate-magical-girl': mgStatus,
        'generate-magical-girl-details': mgDetailsStatus,
        ip: ip,
        persistenceKey: persistenceKey
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      ...queueStatus,
      endpoint: endpoint,
      ip: ip
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    log.error('获取队列状态失败', { error });
    return new Response(JSON.stringify({ error: '获取队列状态失败' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export default handler;