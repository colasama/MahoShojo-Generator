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

  // [核心改造] selectedAnnouncement 状态现在用于控制弹窗内的视图。
  // null: 显示历史公告列表
  // Announcement对象: 显示该公告的详情
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
  }, []);

  /**
   * 关闭公告栏的处理函数
   * 这会将最新公告的ID存入localStorage，以便下次不再显示
   */
  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation(); // 阻止事件冒泡，避免触发打开弹窗
    setIsVisible(false);
    if (announcements.length > 0) {
      const latestAnnouncementId = announcements[0].id;
      localStorage.setItem(`${DISMISS_KEY_PREFIX}${latestAnnouncementId}`, 'true');
    }
  };

  /**
   * [核心改造] 打开详情弹窗，默认进入历史列表视图
   */
  const handleOpenModal = () => {
    setIsModalOpen(true);
    // 初始状态不选中任何公告，以便显示列表
    setSelectedAnnouncement(null);
  };

  /**
   * 关闭详情弹窗
   */
  const handleCloseModal = () => {
    setIsModalOpen(false);
    // 关闭时重置选中状态
    setSelectedAnnouncement(null);
  };

  /**
   * [新增] 在列表中选择一个公告以查看详情
   * @param announcement 被选中的公告对象
   */
  const handleSelectAnnouncement = (announcement: Announcement) => {
    setSelectedAnnouncement(announcement);
  };

  /**
   * [新增] 从详情视图返回到历史列表视图
   */
  const handleReturnToList = () => {
    setSelectedAnnouncement(null);
  };

  if (!isVisible || announcements.length === 0) {
    return null;
  }

  return (
    <>
      {/* 公告栏主体 */}
      {/* [核心改造] 整个滚动区域都可以点击以打开弹窗 */}
      <div className="announcement-ticker" onClick={handleOpenModal}>
        <div className="announcement-content">
          <span className="announcement-label">公告</span>
          <div className="announcement-scroll-container">
            <p className="announcement-text">{announcements[0].title}</p>
          </div>
        </div>
        <button onClick={handleDismiss} className="announcement-close-btn" aria-label="关闭公告">
          ×
        </button>
      </div>

      {/* 详情弹窗 */}
      {isModalOpen && (
        <div className="announcement-modal-overlay" onClick={handleCloseModal}>
          <div className="announcement-modal-content" onClick={(e) => e.stopPropagation()}>
            {/* [核心改造] 根据是否有选中的公告，来决定显示详情还是列表 */}
            {selectedAnnouncement ? (
              // --- 公告详情视图 ---
              <>
                <div className="announcement-modal-header">
                  <h2 className="announcement-modal-title">{selectedAnnouncement.title}</h2>
                  <button onClick={handleCloseModal} className="announcement-modal-close-btn" aria-label="关闭详情">
                    ×
                  </button>
                </div>
                <div className="announcement-modal-body">
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
                {/* [新增] 返回列表按钮 */}
                <div className="announcement-modal-footer">
                  <button onClick={handleReturnToList} className="announcement-back-button">
                    ← 返回列表
                  </button>
                </div>
              </>
            ) : (
              // --- 历史公告列表视图 ---
              <>
                <div className="announcement-modal-header">
                  <h2 className="announcement-modal-title">历史公告</h2>
                  <button onClick={handleCloseModal} className="announcement-modal-close-btn" aria-label="关闭详情">
                    ×
                  </button>
                </div>
                <div className="announcement-modal-body announcement-list">
                  {announcements.map((announcement) => (
                    <div
                      key={announcement.id}
                      className="announcement-list-item"
                      onClick={() => handleSelectAnnouncement(announcement)}
                    >
                      <span className="announcement-list-date">{announcement.date}</span>
                      <span className="announcement-list-title">{announcement.title}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default AnnouncementTicker;