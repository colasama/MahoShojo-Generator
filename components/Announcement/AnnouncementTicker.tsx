import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';

interface Announcement {
  id: string;
  date: string;
  title: string;
  content: string;
  publisher?: string;
  pinned?: boolean;
}

const DISMISS_KEY_PREFIX = 'announcement_dismissed_';

const AnnouncementTicker: React.FC = () => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isVisible, setIsVisible] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);

  useEffect(() => {
    fetch('/announcements.json')
      .then(res => res.json())
      .then((data: Announcement[]) => {
        if (data && data.length > 0) {
          const sortedData = data.sort((a, b) => {
            if (a.pinned && !b.pinned) return -1;
            if (!a.pinned && b.pinned) return 1;
            return new Date(b.date).getTime() - new Date(a.date).getTime();
          });

          setAnnouncements(sortedData);

          const latestAnnouncementId = sortedData[0].id;
          const isDismissed = localStorage.getItem(`${DISMISS_KEY_PREFIX}${latestAnnouncementId}`) === 'true';

          if (!isDismissed) {
            setIsVisible(true);
          }
        }
      })
      .catch(err => console.error("加载公告失败:", err));
  }, []);

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsVisible(false);
    if (announcements.length > 0) {
      const latestAnnouncementId = announcements[0].id;
      localStorage.setItem(`${DISMISS_KEY_PREFIX}${latestAnnouncementId}`, 'true');
    }
  };

  const handleOpenModal = () => {
    setIsModalOpen(true);
    setSelectedAnnouncement(null);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedAnnouncement(null);
  };

  const handleSelectAnnouncement = (announcement: Announcement) => {
    setSelectedAnnouncement(announcement);
  };

  const handleReturnToList = () => {
    setSelectedAnnouncement(null);
  };

  if (!isVisible || announcements.length === 0) {
    return null;
  }

  return (
    <>
      {/* 公告栏主体 */}
      <div
        className="fixed bottom-0 left-0 right-0 w-full bg-gray-900/90 backdrop-blur-lg text-gray-200 px-4 py-2.5 flex items-center justify-between border-t border-white/10 shadow-lg z-[1000] cursor-pointer transition-all duration-300 hover:bg-gray-900/95 group"
        onClick={handleOpenModal}
      >
        <div className="flex items-center flex-grow overflow-hidden">
          <span className="bg-pink-500 text-white px-2 py-1 rounded text-xs font-semibold tracking-wider mr-3 flex-shrink-0">
            公告
          </span>
          <div className="flex-grow whitespace-nowrap overflow-hidden">
            <p className="inline-block animate-scroll-left group-hover:animation-play-state-paused">
              {announcements[0].pinned && '📌 '}
              {announcements[0].title}
            </p>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="text-gray-500 hover:text-white text-2xl leading-none px-1 transition-colors duration-200"
          aria-label="关闭公告"
        >
          ×
        </button>
      </div>

      {/* 详情弹窗 */}
      {isModalOpen && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1001] animate-fade-in"
          onClick={handleCloseModal}
        >
          <div
            className="bg-white rounded-xl max-w-2xl w-[90%] max-h-[80vh] flex flex-col shadow-2xl animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            {selectedAnnouncement ? (
              // 公告详情视图
              <>
                <div className="flex justify-between items-center p-6 border-b border-gray-200">
                  <h2 className="text-xl font-semibold text-gray-900">
                    {selectedAnnouncement.pinned && '📌 '}
                    {selectedAnnouncement.title}
                  </h2>
                  <button
                    onClick={handleCloseModal}
                    className="text-gray-400 hover:text-gray-900 text-3xl leading-none transition-colors"
                    aria-label="关闭详情"
                  >
                    ×
                  </button>
                </div>
                <div className="flex gap-4 px-6 py-3 bg-gray-50 border-b border-gray-200 text-sm text-gray-600">
                  <span>发布于: {selectedAnnouncement.date}</span>
                  {selectedAnnouncement.publisher && <span>发布者: {selectedAnnouncement.publisher}</span>}
                </div>
                <div className="px-6 py-4 overflow-y-auto flex-grow">
                  <ReactMarkdown
                    components={{
                      h3: ({ children }) => <h3 className="text-lg font-bold my-4">{children}</h3>,
                      p: ({ children }) => <p className="mb-4 leading-relaxed">{children}</p>,
                      ul: ({ children }) => <ul className="list-disc pl-8 mb-4">{children}</ul>,
                      li: ({ children }) => <li className="mb-2">{children}</li>,
                      code: ({ children }) => <code className="bg-gray-100 px-2 py-1 rounded text-sm">{children}</code>
                    }}
                  >
                    {selectedAnnouncement.content}
                  </ReactMarkdown>
                </div>
                <div className="px-6 py-4 border-t border-gray-200 flex justify-start">
                  <button
                    onClick={handleReturnToList}
                    className="bg-pink-500 hover:bg-pink-600 cursor-pointer text-white px-5 py-2 rounded-md text-sm font-medium transition-all duration-200 hover:-translate-x-0.5"
                  >
                    ← 返回列表
                  </button>
                </div>
              </>
            ) : (
              // 历史公告列表视图
              <>
                <div className="flex justify-between items-center p-6 border-b border-gray-200">
                  <h2 className="text-xl font-semibold text-gray-900">历史公告</h2>
                  <button
                    onClick={handleCloseModal}
                    className="text-gray-400 hover:text-gray-900 text-3xl leading-none transition-colors"
                    aria-label="关闭详情"
                  >
                    ×
                  </button>
                </div>
                <div className="px-6 py-4 overflow-y-auto flex flex-col gap-4">
                  {announcements.map((announcement) => (
                    <div
                      key={announcement.id}
                      className="bg-gray-50 border border-gray-200 rounded-lg p-4 transition-all duration-200 hover:bg-gray-100 hover:-translate-y-0.5 hover:shadow-md"
                    >
                      <h3 className="text-base font-semibold text-gray-900 mb-2">
                        {announcement.pinned && '📌 '}
                        {announcement.title}
                      </h3>
                      <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                        <span>{announcement.date}</span>
                        {announcement.publisher && (
                          <span>· {announcement.publisher}</span>
                        )}
                      </div>
                      <p className="text-gray-700 text-sm leading-relaxed mb-3">
                        {announcement.content.substring(0, 100).replace(/[#*\n]/g, '')}...
                      </p>
                      <div className="flex justify-end">
                        <button
                          className="bg-pink-500 hover:bg-pink-600 cursor-pointer text-white px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 hover:translate-x-0.5 hover:shadow-md"
                          onClick={() => handleSelectAnnouncement(announcement)}
                        >
                          查看详情 →
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* 添加动画样式 */}
      <style jsx>{`
        @keyframes scroll-left {
          0% {
            transform: translateX(100%);
          }
          100% {
            transform: translateX(-100%);
          }
        }
        
        @keyframes fade-in {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        
        @keyframes slide-up {
          from {
            transform: translateY(20px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        
        .animate-scroll-left {
          animation: scroll-left 15s linear infinite;
        }
        
        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }
        
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
        
        .animation-play-state-paused {
          animation-play-state: paused;
        }
        
        .group:hover .group-hover\\:animation-play-state-paused {
          animation-play-state: paused;
        }
      `}</style>
    </>
  );
};

export default AnnouncementTicker;