import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';

// 定义单条公告的数据结构
interface Announcement {
  id: string;
  date: string;
  title: string;
  content: string;
}

// 本地存储中用于标记公告已关闭的键名
const DISMISS_KEY_PREFIX = 'announcement_dismissed_';

const AnnouncementTicker: React.FC = () => {
  // 存储从JSON文件加载的所有公告
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  // 控制公告栏是否可见
  const [isVisible, setIsVisible] = useState(false);
  // 控制详情弹窗是否打开
  const [isModalOpen, setIsModalOpen] = useState(false);
  // 存储当前在弹窗中显示的公告
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);

  // 组件加载时执行的副作用
  useEffect(() => {
    // 异步获取公告数据
    fetch('/announcements.json')
      .then(res => res.json())
      .then((data: Announcement[]) => {
        if (data && data.length > 0) {
          // 按日期降序排序，最新的公告在最前面
          const sortedData = data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          setAnnouncements(sortedData);

          // 检查最新的一条公告是否已经被用户关闭
          const latestAnnouncementId = sortedData[0].id;
          const isDismissed = localStorage.getItem(`${DISMISS_KEY_PREFIX}${latestAnnouncementId}`) === 'true';

          // 如果没被关闭，则显示公告栏
          if (!isDismissed) {
            setIsVisible(true);
          }
        }
      })
      .catch(err => console.error("加载公告失败:", err));
  }, []); // 空依赖数组确保此 effect 仅在组件挂载时运行一次

  /**
   * 关闭公告栏的处理函数
   * 这会将最新公告的ID存入localStorage，以便下次不再显示
   */
  const handleDismiss = () => {
    setIsVisible(false);
    if (announcements.length > 0) {
      const latestAnnouncementId = announcements[0].id;
      localStorage.setItem(`${DISMISS_KEY_PREFIX}${latestAnnouncementId}`, 'true');
    }
  };

  /**
   * 点击公告标题，打开详情弹窗
   * @param announcement 被点击的公告对象
   */
  const handleOpenModal = (announcement: Announcement) => {
    setSelectedAnnouncement(announcement);
    setIsModalOpen(true);
  };

  /**
   * 关闭详情弹窗
   */
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedAnnouncement(null);
  };

  // 如果不可见或没有公告，则不渲染任何内容
  if (!isVisible || announcements.length === 0) {
    return null;
  }

  return (
    <>
      {/* 公告栏主体 */}
      <div className="announcement-ticker">
        <div className="announcement-content">
          <span className="announcement-label">公告</span>
          <div className="announcement-scroll-container" onClick={() => handleOpenModal(announcements[0])}>
            <p className="announcement-text">{announcements[0].title}</p>
          </div>
        </div>
        <button onClick={handleDismiss} className="announcement-close-btn" aria-label="关闭公告">
          ×
        </button>
      </div>

      {/* 详情弹窗 */}
      {isModalOpen && selectedAnnouncement && (
        <div className="announcement-modal-overlay" onClick={handleCloseModal}>
          <div className="announcement-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="announcement-modal-header">
              <h2 className="announcement-modal-title">{selectedAnnouncement.title}</h2>
              <button onClick={handleCloseModal} className="announcement-modal-close-btn" aria-label="关闭详情">
                ×
              </button>
            </div>
            <div className="announcement-modal-body">
              {/* 使用 ReactMarkdown 来渲染 Markdown 格式的公告内容 */}
              <ReactMarkdown
                components={{
                  h3: (props: any) => <h3 style={{ fontSize: '1.25em', fontWeight: 'bold', margin: '1em 0' }} {...props} />,
                  p: (props: any) => <p style={{ marginBottom: '1em', lineHeight: 1.6 }} {...props} />,
                  ul: (props: any) => <ul style={{ listStyle: 'disc', paddingLeft: '2em', marginBottom: '1em' }} {...props} />,
                  li: (props: any) => <li style={{ marginBottom: '0.5em' }} {...props} />,
                  code: (props: any) => <code style={{ backgroundColor: '#f0f0f0', padding: '0.2em 0.4em', borderRadius: '4px', fontSize: '0.9em' }} {...props} />
                }}
              >
                {selectedAnnouncement.content}
              </ReactMarkdown>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AnnouncementTicker;