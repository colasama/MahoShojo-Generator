import React, { useState, useEffect, useCallback } from 'react';
import DataCard from './DataCard';
import { useAuth } from '@/lib/useAuth';
import { dataCardApi } from '@/lib/auth';

interface BattleDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectCard: (card: any) => void;
  selectedType: 'character' | 'scenario';
}

export default function BattleDataModal({
  isOpen,
  onClose,
  onSelectCard,
  selectedType
}: BattleDataModalProps) {
  const { isAuthenticated } = useAuth();
  const [userDataCards, setUserDataCards] = useState<any[]>([]);
  const [publicDataCards, setPublicDataCards] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'my' | 'public'>('my');
  const [currentPage, setCurrentPage] = useState(1);
  const cardsPerPage = 12;

  // 获取用户的数据卡
  const loadUserDataCards = useCallback(async () => {
    if (!isAuthenticated) return;

    try {
      setIsLoading(true);
      const cards = await dataCardApi.getCards();
      // 根据选择的类型过滤数据卡
      const filteredCards = cards.filter((card: any) => card.type === selectedType);
      setUserDataCards(filteredCards);
    } catch (error) {
      console.error('获取用户数据卡失败:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, selectedType]);

  // 获取公开数据卡
  const loadPublicDataCards = useCallback(async () => {
    try {
      setIsLoading(true);
      // 这里需要一个新的API端点来获取公开数据卡
      const response = await fetch(`/api/public-data-cards?type=${selectedType}`);
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setPublicDataCards(result.cards || []);
        }
      }
    } catch (error) {
      console.error('获取公开数据卡失败:', error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedType]);

  // 当模态框打开时加载数据
  useEffect(() => {
    if (isOpen) {
      setCurrentPage(1);
      if (isAuthenticated) {
        loadUserDataCards();
      }
      loadPublicDataCards();
    }
  }, [isOpen, selectedType, isAuthenticated, loadUserDataCards, loadPublicDataCards]);

  // 处理卡片选择
  const handleSelectCard = (card: any) => {
    try {
      // 解析数据卡的JSON内容
      const cardData = JSON.parse(card.data);
      onSelectCard({
        ...cardData,
        _cardId: card.id,
        _cardName: card.name,
        _isPublic: card.is_public,
        _author: card.username || '未知'
      });
      onClose();
    } catch (error) {
      console.error('解析数据卡失败:', error);
    }
  };

  if (!isOpen) return null;

  const currentCards = activeTab === 'my' ? userDataCards : publicDataCards;
  const totalPages = Math.ceil(currentCards.length / cardsPerPage);
  const paginatedCards = currentCards.slice(
    (currentPage - 1) * cardsPerPage,
    currentPage * cardsPerPage
  );

  const typeLabel = selectedType === 'character' ? '角色' : '情景';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 max-w-7xl w-full max-h-[90vh] overflow-hidden flex flex-col relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-2xl leading-none z-10"
          aria-label="关闭"
        >
          ×
        </button>

        <h2 className="text-xl font-bold mb-4 pr-8">选择{typeLabel}数据卡</h2>

        {/* 标签页切换 */}
        <div className="flex gap-2 mb-4">
          {isAuthenticated && (
            <button
              onClick={() => {
                setActiveTab('my');
                setCurrentPage(1);
              }}
              className={`px-4 py-2 rounded text-sm font-medium ${activeTab === 'my'
                ? 'bg-pink-500 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
            >
              我的{typeLabel} ({userDataCards.length})
            </button>
          )}
          <button
            onClick={() => {
              setActiveTab('public');
              setCurrentPage(1);
            }}
            className={`px-4 py-2 rounded text-sm font-medium ${activeTab === 'public'
              ? 'bg-pink-500 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
          >
            公开{typeLabel} ({publicDataCards.length})
          </button>
        </div>

        {/* 内容区域 */}
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="flex justify-center items-center h-32">
              <div className="text-gray-500">加载中...</div>
            </div>
          ) : currentCards.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              {activeTab === 'my' ?
                `暂无${typeLabel}数据卡，去角色管理中心创建一些吧！` :
                `暂无公开的${typeLabel}数据卡`
              }
            </div>
          ) : (
            <>
              {/* 数据卡网格 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {paginatedCards.map((card: any) => {
                  const author = activeTab === 'public' ? (card.username || '未知') : '我';

                  return (
                    <div
                      key={card.id}
                      className="cursor-pointer transition-transform"
                      onClick={() => handleSelectCard(card)}
                    >
                      <DataCard
                        id={card.id}
                        name={card.name}
                        description={card.description}
                        type={card.type}
                        isPublic={card.is_public}
                        usageCount={card.usage_count}
                        likeCount={card.like_count}
                        author={author}
                      />
                    </div>
                  );
                })}
              </div>

              {/* 分页控件 */}
              {currentCards.length > cardsPerPage && (
                <div className="flex justify-center items-center gap-2 pt-4 border-t mt-4">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1 rounded text-sm bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 disabled:text-gray-400"
                  >
                    上一页
                  </button>
                  <span className="text-sm text-gray-600">
                    {currentPage} / {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 rounded text-sm bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 disabled:text-gray-400"
                  >
                    下一页
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* 底部提示 */}
        <div className="mt-4 text-center text-sm text-gray-500">
          点击数据卡即可加载到竞技场中
        </div>
      </div>
    </div>
  );
}