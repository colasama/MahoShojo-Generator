// 队列系统
interface QueueItem {
  id: string;
  endpoint: string;
  requestData: any;
  ip: string;
  timestamp: number;
  resolve: (value: any) => void;
  reject: (error: any) => void;
  retryCount: number;
  processor: () => Promise<any>;
  // 让用户保持队列
  persistenceKey?: string; // 用于前端识别的唯一键
}

interface PersistedQueueItem {
  id: string;
  endpoint: string;
  requestData: any;
  ip: string;
  timestamp: number;
  retryCount: number;
  persistenceKey: string;
}

interface QueueStatus {
  queueLength: number;
  currentPosition: number;
  estimatedWaitTime: number; // 秒
  isProcessing: boolean;
  persistenceKey?: string; // 用户的持久化标识
  queueId?: string; // 当前队列项的ID
}

class RequestQueue {
  private queue: QueueItem[] = [];
  private processing: boolean = false;
  private readonly maxRequestsPerMinute: number;
  private readonly userWaitTime: number; // 秒
  private lastProcessTime: number = 0;
  private processedCount: number = 0;
  private processWindow: number = 60 * 1000; // 1分钟窗口

  constructor() {
    // 从环境变量读取配置，提供默认值
    this.maxRequestsPerMinute = 10; // 默认值
    this.userWaitTime = 30; // 默认值
    
    // 使用与config.ts相同的方式读取环境变量
    try {
      if (typeof process !== 'undefined' && process.env) {
        const envMaxRequests = process.env.QUEUE_MAX_REQUESTS_PER_MINUTE;
        const envWaitTime = process.env.QUEUE_USER_WAIT_TIME_SECONDS;
        
        if (envMaxRequests) {
          const parsed = parseInt(envMaxRequests, 10);
          if (!isNaN(parsed) && parsed > 0) {
            this.maxRequestsPerMinute = parsed;
          }
        }
        
        if (envWaitTime) {
          const parsed = parseInt(envWaitTime, 10);
          if (!isNaN(parsed) && parsed >= 0) {
            this.userWaitTime = parsed;
          }
        }
      }
    } catch (e) {
      console.log('[Queue System] 环境变量读取失败，使用默认配置:', e);
    }
    
    console.log(`[Queue System] 初始化队列系统 - 每分钟最大API请求数: ${this.maxRequestsPerMinute}, 用户等待时间: ${this.userWaitTime}秒`);
  }

  /**
   * 生成唯一ID
   */
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  /**
   * 检查是否可以继续处理请求
   * @returns {Promise<boolean>} 是否可以处理请求
   */
  private async canProcessRequest(): Promise<boolean> {
    const now = Date.now();
    
    // 如果超过1分钟，重置计数器
    if (now - this.lastProcessTime >= this.processWindow) {
      this.processedCount = 0;
      this.lastProcessTime = now;
      return true;
    }
    
    // 如果已经达到最大请求数，等待到下一个分钟
    if (this.processedCount >= this.maxRequestsPerMinute) {
      const waitTime = this.processWindow - (now - this.lastProcessTime);
      console.log(`[Queue System] 达到每分钟请求限制，等待 ${Math.ceil(waitTime / 1000)} 秒`);
      await this.sleep(waitTime);
      this.processedCount = 0;
      this.lastProcessTime = Date.now();
      return true;
    }
    
    // 计算请求之间的均匀间隔时间
    // 公式：一分钟 / 最大请求数 = 每个请求的理想间隔
    const idealInterval = this.processWindow / this.maxRequestsPerMinute;
    
    // 计算距离上次请求的时间
    const timeSinceLastRequest = now - (this.lastProcessTime + this.processedCount * idealInterval);
    
    // 如果时间间隔不够，等待一段时间
    if (timeSinceLastRequest < 0) {
      const waitTime = Math.abs(timeSinceLastRequest);
      console.log(`[Queue System] 均匀分布请求，等待 ${Math.ceil(waitTime / 1000)} 秒`);
      await this.sleep(waitTime);
    }
    
    return true;
  }

  /**
   * 计算预估等待时间
   */
  private calculateWaitTime(position: number): number {
    if (position === 0) return 0;
    
    const requestsPerSecond = this.maxRequestsPerMinute / 60;
    const baseWaitTime = position / requestsPerSecond;
    
    // 加上用户配置的额外等待时间
    return Math.ceil(baseWaitTime + this.userWaitTime);
  }

  /**
   * 用户最后请求时间记录
   */
  private userLastRequestTime: Map<string, number> = new Map();

  /**
   * 检查用户是否可以发送新请求
   * @param userKey 用户标识（IP或persistenceKey）
   * @returns 是否允许请求
   */
  private canUserMakeRequest(userKey: string): boolean {
    const lastRequestTime = this.userLastRequestTime.get(userKey);
    if (!lastRequestTime) return true;
    
    const now = Date.now();
    const elapsedSeconds = (now - lastRequestTime) / 1000;
    
    return elapsedSeconds >= this.userWaitTime;
  }

  /**
   * 添加请求到队列
   */
  public async addToQueue<T>(
    endpoint: string,
    requestData: any,
    ip: string,
    processor: () => Promise<T>,
    persistenceKey?: string
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      // 用户标识，优先使用persistenceKey，其次是IP
      const userKey = persistenceKey || ip;
      
      // 检查用户是否可以发送新请求
      if (!this.canUserMakeRequest(userKey)) {
        const lastTime = this.userLastRequestTime.get(userKey) || 0;
        const waitTimeLeft = Math.ceil(this.userWaitTime - ((Date.now() - lastTime) / 1000));
        
        console.log(`[Queue System] 用户 ${userKey} 请求过于频繁，需等待 ${waitTimeLeft} 秒`);
        reject(new Error(`请求过于频繁，请等待 ${waitTimeLeft} 秒后再试`));
        return;
      }
      
      const queueItem: QueueItem = {
        id: this.generateId(),
        endpoint,
        requestData,
        ip,
        timestamp: Date.now(),
        resolve,
        reject,
        retryCount: 0,
        processor,
        persistenceKey
      };

      // 更新用户最后请求时间
      this.userLastRequestTime.set(userKey, Date.now());
      
      this.queue.push(queueItem);
      
      console.log(`[Queue System] 添加请求到队列 - ID: ${queueItem.id}, IP: ${ip}, Endpoint: ${endpoint}, 队列长度: ${this.queue.length}, 持久化键: ${persistenceKey}`);
      
      // 如果当前没在处理，开始处理队列
      if (!this.processing) {
        this.processQueue();
      }
    });
  }

  /**
   * 处理队列
   */
  private async processQueue(): Promise<void> {
    if (this.processing) return;
    
    this.processing = true;
    console.log(`[Queue System] 开始处理队列，当前队列长度: ${this.queue.length}`);

    while (this.queue.length > 0) {
      // 检查是否可以处理请求，并自动等待合适的时间
      await this.canProcessRequest();

      const item = this.queue.shift();
      if (!item) break;

      try {
        console.log(`[Queue System] 处理请求 - ID: ${item.id}, IP: ${item.ip}, Endpoint: ${item.endpoint}`);
        
        // 使用队列项自带的processor处理请求
        const result = await item.processor();
        
        this.processedCount++;
        item.resolve(result);
        
        console.log(`[Queue System] 请求处理成功 - ID: ${item.id}`);
        
      } catch (error) {
        console.error(`[Queue System] 请求处理失败 - ID: ${item.id}:`, error);
        
        // 重试逻辑
        if (item.retryCount < 2) {
          item.retryCount++;
          console.log(`[Queue System] 重试请求 - ID: ${item.id}, 重试次数: ${item.retryCount}`);
          this.queue.unshift(item); // 重新添加到队列开头
        } else {
          item.reject(error);
        }
      }
    }

    this.processing = false;
    console.log(`[Queue System] 队列处理完成`);
  }



  /**
   * 获取队列状态
   */
  public getQueueStatus(ip?: string, persistenceKey?: string): QueueStatus {
    let currentPosition = -1;
    let queueId: string | undefined;
    let foundPersistenceKey: string | undefined;
    
    if (persistenceKey) {
      // 优先使用持久化键查找
      const index = this.queue.findIndex(item => item.persistenceKey === persistenceKey);
      if (index !== -1) {
        currentPosition = index;
        queueId = this.queue[index].id;
        foundPersistenceKey = persistenceKey;
      }
    } else if (ip) {
      // 降级到IP查找
      const index = this.queue.findIndex(item => item.ip === ip);
      if (index !== -1) {
        currentPosition = index;
        queueId = this.queue[index].id;
        foundPersistenceKey = this.queue[index].persistenceKey;
      }
    }
    
    if (currentPosition === -1) currentPosition = 0; // 不在队列中
    
    const estimatedWaitTime = this.calculateWaitTime(currentPosition === 0 ? this.queue.length : currentPosition);
    
    return {
      queueLength: this.queue.length,
      currentPosition: currentPosition === 0 ? 0 : currentPosition + 1,
      estimatedWaitTime,
      isProcessing: this.processing,
      persistenceKey: foundPersistenceKey,
      queueId
    };
  }

  /**
   * 获取特定IP或持久化键的队列位置
   */
  public getPositionInQueue(ip: string, persistenceKey?: string): number {
    let position = -1;
    
    if (persistenceKey) {
      position = this.queue.findIndex(item => item.persistenceKey === persistenceKey);
    }
    
    if (position === -1) {
      position = this.queue.findIndex(item => item.ip === ip);
    }
    
    return position === -1 ? 0 : position + 1;
  }

  /**
   * 获取持久化的队列数据（仅用于状态查询）
   */
  public getPersistedQueue(): PersistedQueueItem[] {
    return this.queue.map(item => ({
      id: item.id,
      endpoint: item.endpoint,
      requestData: item.requestData,
      ip: item.ip,
      timestamp: item.timestamp,
      retryCount: item.retryCount,
      persistenceKey: item.persistenceKey || ''
    }));
  }

  /**
   * 清理过期的队列项（超过10分钟）
   */
  public cleanup(): void {
    const now = Date.now();
    const maxAge = 10 * 60 * 1000; // 10分钟
    
    const originalLength = this.queue.length;
    this.queue = this.queue.filter(item => {
      const isExpired = now - item.timestamp > maxAge;
      if (isExpired) {
        item.reject(new Error('Request timeout - removed from queue'));
      }
      return !isExpired;
    });
    
    if (originalLength !== this.queue.length) {
      console.log(`[Queue System] 清理过期请求，移除 ${originalLength - this.queue.length} 个请求`);
    }
  }

  /**
   * 工具方法：延时
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// 全局队列实例
export const magicalGirlQueue = new RequestQueue();
export const magicalGirlDetailsQueue = new RequestQueue();

// 定期清理过期请求
setInterval(() => {
  magicalGirlQueue.cleanup();
  magicalGirlDetailsQueue.cleanup();
}, 5 * 60 * 1000); // 每5分钟清理一次

export { RequestQueue };
export type { QueueStatus };