import React, { useState, useEffect } from 'react';
import { Download, Heart, Share } from 'lucide-react';
import { isCardLiked, addLikedCard } from '@/lib/localStorage';

interface DataCardProps {
  id: string; // Changed from number to string for UUID
  name: string;
  description: string;
  type: 'character' | 'scenario';
  isPublic: boolean;
  usageCount?: number;
  likeCount?: number;
  author?: string;
  isOwner?: boolean;
  isSelected?: boolean;
  onDownload?: () => void;
  onLike?: () => void;
  onEditInfo?: () => void;
  onEditData?: () => void;
  onDelete?: () => void;
  onShare?: () => void;
  onLikeSuccess?: () => void;
}

const typeMap = {
  character: '角色',
  scenario: '情景',
}

export default function DataCard({
  id,
  name,
  description,
  type,
  isPublic,
  usageCount = 0,
  likeCount = 0,
  author,
  isOwner = false,
  onDownload,
  onLike,
  onEditInfo,
  onEditData,
  onDelete,
  onShare,
  onLikeSuccess,
}: DataCardProps) {
  const [shareStatus, setShareStatus] = useState<'idle' | 'copied'>('idle');
  const [liked, setLiked] = useState(false);
  const [liking, setLiking] = useState(false);
  const [currentLikeCount, setCurrentLikeCount] = useState(likeCount);

  // 检查本地存储中的点赞状态
  useEffect(() => {
    setLiked(isCardLiked(id));
  }, [id]);

  // 处理点赞
  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!isPublic || liked || liking) return;
    
    try {
      setLiking(true);
      
      // 调用 API 增加点赞数
      const response = await fetch('/api/data-card-stats', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cardId: id,
          type: 'like'
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          // 添加到本地存储
          const success = addLikedCard(id);
          if (success) {
            setLiked(true);
            setCurrentLikeCount(prev => prev + 1);
            onLike?.();
            onLikeSuccess?.();
          }
        }
      }
    } catch (error) {
      console.error('点赞失败:', error);
    } finally {
      setLiking(false);
    }
  };

  // 分享功能 - 复制卡片名称和UUID到剪贴板
  const handleShare = async () => {
    try {
      const shareText = `【${typeMap[type]}：${name}】${id}`;
      await navigator.clipboard.writeText(shareText);
      setShareStatus('copied');
      setTimeout(() => setShareStatus('idle'), 2000);
    } catch (error) {
      console.error('复制到剪贴板失败:', error);
      // 降级处理：尝试使用传统方法
      try {
        const textArea = document.createElement('textarea');
        textArea.value = `${name} ${id}`;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        setShareStatus('copied');
        setTimeout(() => setShareStatus('idle'), 2000);
      } catch (fallbackError) {
        console.error('降级复制方法也失败了:', fallbackError);
      }
    }
  };
  const bgColor = type === 'scenario'
    ? 'bg-white border-gray-200 hover:border-green-400'
    : 'bg-white border-gray-200 hover:border-pink-400';

  const textColor = 'text-gray-800';
  const subTextColor = 'text-gray-600';

  return (
    <div
      className={`flex flex-col justify-between relative p-4 rounded-lg border-2 transition-all duration-200 ${bgColor}`}
    >
      {/* 公开/私有标签 */}
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <span className={`text-xs px-2 py-1 rounded ${isPublic ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
          }`}>
          {isPublic ? '公开' : '私有'}
        </span>
        {type === 'scenario' && (
          <span className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded">
            情景
          </span>
        )}
        {type === 'character' && (
          <span className="text-xs px-2 py-1 bg-pink-100 text-pink-700 rounded">
            角色
          </span>
        )}
      </div>

      {/* 主要内容 */}
      <div className='mb-1'>
        <h4 className={`font-semibold text-lg ${textColor} mb-1`}>{name}</h4>
        {description && (
          <p className={`text-sm line-clamp-2 ${subTextColor}`}>
            {description}
          </p>
        )}
      </div>

      <div className="flex gap-3 text-sm justify-between">
        {/* 作者 */}
        {author && (
          <p className={`text-xs mt-1 ${subTextColor}`}>
            作者: {author}
          </p>
        )}
        {/* 统计信息 */}
        <div className="flex gap-3 text-sm justify-end">

          {/* 点赞按钮和计数 */}
          <button
            onClick={handleLike}
            className={`flex items-center gap-1 transition-colors ${
              !isPublic
                ? 'text-gray-400 cursor-not-allowed'
                : liked
                ? 'text-red-500'
                : liking
                ? 'text-red-300'
                : 'text-gray-500 hover:text-red-500'
            }`}
            disabled={!isPublic || liked || liking}
            title={!isPublic ? '私有数据卡无法点赞' : liked ? '已点赞' : '点赞'}
          >
            <Heart className={`w-4 h-4 ${liked ? 'fill-current' : ''}`} />
            <span>{currentLikeCount}</span>
          </button>

          {/* 使用次数 */}
          <div className="flex items-center gap-1 text-gray-500">
            <Download className="w-4 h-4" />
            <span>{usageCount}</span>
          </div>

          {/* 分享按钮 */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (isPublic) {
                handleShare();
                onShare?.();
              }
            }}
            className={`flex items-center gap-1 transition-colors ${isPublic
              ? 'text-gray-500 hover:text-blue-500'
              : 'text-gray-400 cursor-not-allowed'
              }`}
            title={isPublic ? `分享：${name} ${id}` : '私有数据卡不允许分享'}
            disabled={!isPublic}
          >
            <Share className="w-4 h-4" />
            <span className="text-xs">
              {!isPublic ? '不可分享' : (shareStatus === 'copied' ? '已复制！' : '分享')}
            </span>
          </button>
        </div>
      </div>

      {/* 操作按钮 */}
      {isOwner && (
        <div className="flex flex-wrap gap-2 mt-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDownload?.();
            }}
            className="flex-1 min-w-[80px] text-sm px-3 py-1.5 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded transition-colors"
          >
            下载
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEditInfo?.();
            }}
            className="flex-1 min-w-[80px] text-sm px-3 py-1.5 bg-green-100 text-green-700 hover:bg-green-200 rounded transition-colors flex items-center justify-center gap-1"
          >
            修改信息
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete?.();
            }}
            className="flex-1 min-w-[80px] text-sm px-3 py-1.5 bg-red-100 text-red-700 hover:bg-red-200 rounded transition-colors"
          >
            删除
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEditData?.();
            }}
            className="flex-1 min-w-[80px] text-sm px-3 py-1.5 bg-purple-100 text-purple-700 hover:bg-purple-200 rounded transition-colors flex items-center justify-center gap-1"
          >
            编辑档案
          </button>
        </div>
      )}
    </div>
  );
}