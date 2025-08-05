import React, { useState, useEffect } from 'react';

interface QueueStatusData {
  queueLength: number;
  currentPosition: number;
  estimatedWaitTime: number;
  isProcessing: boolean;
  endpoint?: string;
  ip?: string;
  persistenceKey?: string;
  queueId?: string;
}

interface QueueStatusProps {
  endpoint?: string;
  isVisible: boolean;
  onComplete?: () => void;
  persistenceKey?: string;
}

const QueueStatus: React.FC<QueueStatusProps> = ({ endpoint, isVisible, onComplete, persistenceKey }) => {
  const [queueStatus, setQueueStatus] = useState<QueueStatusData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentPersistenceKey,] = useState<string>(() => {
    // 优先使用传入的持久化键
    if (persistenceKey) return persistenceKey;

    // 尝试从localStorage恢复
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('queuePersistenceKey');
      if (saved) return saved;
    }

    // 生成新的持久化键
    const newKey = `queue_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    if (typeof window !== 'undefined') {
      localStorage.setItem('queuePersistenceKey', newKey);
    }
    return newKey;
  });

  useEffect(() => {
    if (!isVisible) {
      setQueueStatus(null);
      setError(null);
      return;
    }

    const fetchQueueStatus = async () => {
      try {
        let url = endpoint
          ? `/api/queue-status?endpoint=${endpoint}`
          : '/api/queue-status';

        // 添加持久化键参数
        if (currentPersistenceKey) {
          url += `${url.includes('?') ? '&' : '?'}persistenceKey=${currentPersistenceKey}`;
        }

        const response = await fetch(url);
        if (!response.ok) {
          throw new Error('获取队列状态失败');
        }

        const data = await response.json();

        // 如果是特定endpoint，直接使用数据
        if (endpoint) {
          setQueueStatus(data);
        } else {
          // 如果没有指定endpoint，使用所有队列中位置最靠前的
          const allQueues = Object.values(data).filter(
            (item: any) => typeof item === 'object' && item.queueLength !== undefined
          ) as QueueStatusData[];

          if (allQueues.length > 0) {
            // 找到用户位置最靠前的队列
            const userQueue = allQueues.find(q => q.currentPosition > 0) || allQueues[0];
            setQueueStatus(userQueue);
          }
        }

        setError(null);
      } catch (err) {
        console.error('获取队列状态失败:', err);
        setError(err instanceof Error ? err.message : '获取队列状态失败');
      }
    };

    // 立即获取一次
    fetchQueueStatus();

    // 每2秒刷新一次队列状态
    const interval = setInterval(fetchQueueStatus, 2000);

    return () => clearInterval(interval);
  }, [isVisible, endpoint]);

  // 检查是否处理完成
  useEffect(() => {
    if (queueStatus && queueStatus.currentPosition === 0 && !queueStatus.isProcessing) {
      // 延迟调用onComplete，给服务器一点时间完成处理
      const timer = setTimeout(() => {
        onComplete?.();
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [queueStatus, onComplete]);

  if (!isVisible) {
    return null;
  }

  if (error) {
    return (
      <div className="queue-status-container">
        <div className="queue-status-card error">
          <h3>❌ 获取队列状态失败</h3>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (!queueStatus) {
    return (
      <div className="queue-status-container">
        <div className="queue-status-card loading">
          <div className="loading-spinner"></div>
        </div>
      </div>
    );
  }

  const { queueLength, currentPosition, estimatedWaitTime, isProcessing } = queueStatus;

  return (
    <div className="queue-status-container">
      <div className="queue-status-card">
        <div className="queue-header">
          <h3>🎀 魔法少女排队中...</h3>
          <p className="queue-subtitle">由于用户过多，请耐心等待哦～</p>
        </div>

        <div className="queue-info">
          <div className="queue-stat">
            <span className="stat-label">当前队列长度</span>
            <span className="stat-value">{queueLength}</span>
          </div>

          <div className="queue-stat">
            <span className="stat-label">您的位置</span>
            <span className="stat-value">
              {currentPosition === 0 ? '正在处理' : `第 ${currentPosition} 位`}
            </span>
          </div>

          <div className="queue-stat">
            <span className="stat-label">预计等待时间</span>
            <span className="stat-value">
              {estimatedWaitTime === 0 ? '马上就好' : `约 ${Math.ceil(estimatedWaitTime / 60)} 分钟`}
            </span>
          </div>
        </div>

        <div className="queue-progress">
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{
                width: currentPosition === 0 ? '100%' : `${Math.max(0, 100 - (currentPosition / Math.max(queueLength, 1)) * 100)}%`
              }}
            ></div>
          </div>
          <p className="progress-text">
            {isProcessing ? '🌟 正在施展魔法中...' : currentPosition === 0 ? '🎉 即将完成！' : '✨ 排队中，请稍候...'}
          </p>
        </div>

        <div className="queue-tips">
          <p>💡 小贴士：请保持页面开启，离开页面可能会丢失队列位置</p>
        </div>
      </div>

      <style jsx>{`
        .queue-status-container {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.8);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 1000;
          backdrop-filter: blur(5px);
        }

        .queue-status-card {
          background: linear-gradient(135deg, #ffeef8 0%, #f0e6ff 100%);
          border-radius: 20px;
          padding: 2rem;
          max-width: 400px;
          width: 90%;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
          border: 2px solid rgba(255, 255, 255, 0.3);
          text-align: center;
        }

        .queue-status-card.error {
          background: linear-gradient(135deg, #ffe6e6 0%, #ffcccc 100%);
        }

        .queue-status-card.loading {
          background: linear-gradient(135deg, #e6f3ff 0%, #cce7ff 100%);
        }

        .queue-header h3 {
          margin: 0 0 0.5rem 0;
          color: #663399;
          font-size: 1.5rem;
          font-weight: bold;
        }

        .queue-subtitle {
          color: #888;
          margin: 0 0 1.5rem 0;
          font-size: 0.9rem;
          text-align: center;
        }

        .queue-info {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          margin-bottom: 1.5rem;
        }

        .queue-stat {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.75rem;
          background: rgba(255, 255, 255, 0.5);
          border-radius: 10px;
          border: 1px solid rgba(255, 255, 255, 0.3);
        }

        .stat-label {
          font-weight: 500;
          color: #555;
        }

        .stat-value {
          font-weight: bold;
          color: #663399;
          font-size: 1.1rem;
        }

        .queue-progress {
          margin-bottom: 1.5rem;
        }

        .progress-bar {
          width: 100%;
          height: 12px;
          background: rgba(255, 255, 255, 0.3);
          border-radius: 6px;
          overflow: hidden;
          margin-bottom: 0.5rem;
        }

        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #ff6b9d, #c44569);
          border-radius: 6px;
          transition: width 0.3s ease;
        }

        .progress-text {
          margin: 0;
          color: #666;
          font-size: 0.9rem;
          font-weight: 500;
        }

        .queue-tips {
          background: rgba(255, 255, 255, 0.4);
          border-radius: 10px;
          padding: 1rem;
          border: 1px solid rgba(255, 255, 255, 0.3);
        }

        .queue-tips p {
          margin: 0;
          color: #666;
          font-size: 0.8rem;
          line-height: 1.4;
        }

        .loading-spinner {
          width: 40px;
          height: 40px;
          border: 4px solid rgba(102, 51, 153, 0.3);
          border-top: 4px solid #663399;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 0 auto 1rem auto;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default QueueStatus;