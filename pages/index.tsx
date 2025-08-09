import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';

export default function Home() {
  const [, setImagesLoaded] = useState(false);

  useEffect(() => {
    // 预加载关键图片
    const preloadImages = async () => {
      const imageUrls = [
        '/logo.svg',
        '/logo-white.svg',
        '/questionnaire-logo.svg'
      ];

      const imagePromises = imageUrls.map(url => {
        return new Promise((resolve, reject) => {
          const img = new window.Image();
          img.onload = resolve;
          img.onerror = reject;
          img.src = url;
        });
      });

      try {
        await Promise.all(imagePromises);
        setImagesLoaded(true);
      } catch (error) {
        console.log('图片预加载完成，但部分图片可能失败', error);
        setImagesLoaded(true);
      }
    };

    preloadImages();
  }, []);

  return (
    <>
      <Head>
        <title>✨ 魔法少女生成器 ✨</title>
        <meta name="description" content="AI驱动的魔法少女角色生成器，创建独一无二的魔法少女角色" />
        <link rel="preload" href="/logo.svg" as="image" type="image/svg+xml" />
        <link rel="preload" href="/mahou-title.svg" as="image" type="image/svg+xml" />
        <link rel="preload" href="/questionnaire-title.svg" as="image" type="image/svg+xml" />
      </Head>
      <div className="magic-background-white">
        <div className="container">
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '2rem' }}>
              <img src="/logo.svg" width={280} height={180} alt="魔法少女生成器" />
            </div>

            <p className="subtitle text-center">
              欢迎来到魔法国度！选择一个项目开始玩耍吧！
            </p>
            <p className="subtitle text-center" style={{ marginBottom: '3rem' }}>
              由于用户爆炸可能需要多次尝试，正在努力优化中 ——
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* 魔法少女生成器按钮 */}
              <Link href="/name" className="feature-button magical-generator">
                <div className="gradient-overlay"></div>
                <div className="feature-button-content">
                  <div className="feature-title-container">
                    <img
                      src="/logo-white.svg"
                      width={250}
                      height={60}
                      alt="魔法少女生成器"
                      className="feature-title-svg"
                    />
                  </div>
                </div>
              </Link>

              {/* 奇妙妖精大调查按钮 */}
              <Link href="/details" className="feature-button fairy-quest">
                <div className="gradient-overlay"></div>
                <div className="feature-button-content">
                  <div className="feature-title-container">
                    <img
                      src="/questionnaire-logo.svg"
                      width={250}
                      height={40}
                      alt="奇妙妖精大调查"
                      className="feature-title-svg"
                    />
                  </div>
                </div>
              </Link>

              {/* 残兽生成器按钮 */}
              <Link href="/canshou" className="feature-button canshou-generator">
                <div className="gradient-overlay"></div>
                <div className="feature-button-content">
                  <div className="feature-title-container">
                    <img
                      src="/questionnaire-logo.svg"
                      width={250}
                      height={40}
                      alt="危险残兽大调查"
                      className="feature-title-svg"
                    />
                  </div>
                </div>
              </Link>

              {/* 魔法少女竞技场按钮 */}
              <Link href="/battle" className="feature-button battle-arena">
                <div className="gradient-overlay"></div>
                <div className="feature-button-content">
                  <div className="feature-title-container">
                    <img
                      src="/arena-white.svg"
                      width={280}
                      height={80}
                      alt="魔法少女竞技场"
                      className="feature-title-svg"
                    />
                  </div>
                </div>
              </Link>
            </div>

            <div style={{ marginTop: '2rem', textAlign: 'center' }}>
              <p style={{ fontSize: '0.8rem', marginTop: '1rem', color: '#999', fontStyle: 'italic' }}>
                设定来源于小说《下班，然后变成魔法少女》
              </p>
            </div>
          </div>

          <footer className="footer">
            <p>
              竞技场、问卷与系统设计 <a href="https://github.com/notuhao" target="_blank" rel="noopener noreferrer" className="footer-link">@末伏之夜</a>
            </p>
            <p>
              <a href="https://github.com/colasama" target="_blank" rel="noopener noreferrer" className="footer-link">@Colanns</a> 急速出品
            </p>
            <p>
              本项目 AI 能力由&nbsp;
              <a href="https://github.com/KouriChat/KouriChat" target="_blank" rel="noopener noreferrer" className="footer-link">KouriChat</a> &&nbsp;
              <a href="https://api.kourichat.com/" target="_blank" rel="noopener noreferrer" className="footer-link">Kouri API</a>
              &nbsp;强力支持
            </p>
            <p>
              <a href="https://github.com/colasama/MahoShojo-Generator" target="_blank" rel="noopener noreferrer" className="footer-link">colasama/MahoShojo-Generator</a>
            </p>
          </footer>
        </div>
      </div>
    </>
  );
}