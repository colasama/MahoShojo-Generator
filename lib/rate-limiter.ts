// IP限制工具类
interface RateLimitRecord {
  count: number;
  firstRequest: number;
  endpoint: string;
}

class RateLimiter {
  private records: Map<string, RateLimitRecord[]> = new Map();
  private readonly windowMs = 120 * 1000; // 1分钟
  private readonly maxRequests = 1; // 每个API每分钟最多1次

  /**
   * 清理过期记录
   */
  private cleanup(): void {
    const now = Date.now();
    const entries = Array.from(this.records.entries());
    for (const [ip, requests] of entries) {
      const validRequests = requests.filter(
        (record: RateLimitRecord) => now - record.firstRequest < this.windowMs
      );
      if (validRequests.length === 0) {
        this.records.delete(ip);
      } else {
        this.records.set(ip, validRequests);
      }
    }
  }

  /**
   * 检查IP是否被限制
   */
  public isRateLimited(ip: string, endpoint: string): boolean {
    this.cleanup();

    const requests = this.records.get(ip) || [];
    const now = Date.now();

    // 过滤出时间窗口内的请求
    const validRequests = requests.filter(
      record => now - record.firstRequest < this.windowMs
    );

    // 检查该IP在指定endpoint上的请求次数
    const endpointRequests = validRequests.filter(record => record.endpoint === endpoint);

    if (endpointRequests.length >= this.maxRequests) {
      return true;
    }

    // 检查该IP的总请求次数是否超过2（两个API各一次）
    const totalEndpoints = new Set(validRequests.map(record => record.endpoint));
    if (totalEndpoints.size >= 2 && !totalEndpoints.has(endpoint)) {
      return true;
    }

    return false;
  }

  /**
   * 记录请求
   */
  public recordRequest(ip: string, endpoint: string): void {
    const requests = this.records.get(ip) || [];
    const now = Date.now();

    requests.push({
      count: 1,
      firstRequest: now,
      endpoint
    });

    this.records.set(ip, requests);
  }

  /**
   * 获取剩余时间（毫秒）
   */
  public getTimeUntilReset(ip: string, endpoint: string): number {
    const requests = this.records.get(ip) || [];
    const endpointRequests = requests.filter(record => record.endpoint === endpoint);

    if (endpointRequests.length === 0) {
      return 0;
    }

    const oldestRequest = Math.min(...endpointRequests.map(record => record.firstRequest));
    const resetTime = oldestRequest + this.windowMs;

    return Math.max(0, resetTime - Date.now());
  }
}

// 全局实例
const rateLimiter = new RateLimiter();

/**
 * 获取客户端真实IP地址
 */
export function getClientIP(req: any): string {
  const forwarded = req.headers['x-forwarded-for'];
  const realIP = req.headers['x-real-ip'];
  const remoteAddress = req.connection?.remoteAddress || req.socket?.remoteAddress;

  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }

  if (typeof realIP === 'string') {
    return realIP;
  }

  return remoteAddress || 'unknown';
}

/**
 * IP限制中间件
 */
export function withRateLimit(endpoint: string) {
  return function (handler: any) {
    return async function (req: any, res: any) {
      try {
        const ip = getClientIP(req);
        console.log(`[Rate Limiter] IP: ${ip}, Endpoint: ${endpoint}`);

        // 检查IP是否被限制
        if (rateLimiter.isRateLimited(ip, endpoint)) {
          const timeUntilReset = rateLimiter.getTimeUntilReset(ip, endpoint);
          const resetTime = Math.ceil(timeUntilReset / 1000);

          console.log(`[Rate Limiter] 限制访问 - IP: ${ip}, Endpoint: ${endpoint}, 重置时间: ${resetTime}秒`);

          return res.status(429).json({
            error: '请求过于频繁',
            message: `同一IP每分钟只能调用每个API一次，请等待 ${resetTime} 秒后再试`,
            retryAfter: resetTime
          });
        }

        // 记录请求
        rateLimiter.recordRequest(ip, endpoint);
        console.log(`[Rate Limiter] 记录请求 - IP: ${ip}, Endpoint: ${endpoint}`);

        // 继续执行原有的处理函数
        return await handler(req, res);
      } catch (error) {
        console.error(`[Rate Limiter] 错误:`, error);
        // 如果 rate limiter 出错，继续执行原有的处理函数
        return await handler(req, res);
      }
    };
  };
}

export default rateLimiter;
