import type { AppProps } from 'next/app';
import Head from 'next/head';
import { useRouter } from 'next/router';
import '@/styles/globals.css';
import '@/styles/blue-theme.css';
import '@/styles/gradient-buttons.css';
import { GoogleAnalytics } from '@next/third-parties/google';
import { GoogleAdSense } from "nextjs-google-adsense";

// 如果需要统计，请取消注释并安装 @vercel/analytics
// import { Analytics } from "@vercel/analytics/next";

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const isDetailsPage = router.pathname === '/details' || router.pathname === '/canshou';

  return (
    <>
      <Head>
        <title>✨ 魔法少女生成器 ✨</title>
        <meta name="description" content="为你生成独特的魔法少女角色" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.svg" />
      </Head>

      <div className={isDetailsPage ? 'blue-theme' : ''}>
        <Component {...pageProps} />
        <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_ID || ''} />
        {process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_PUBLISHER_ID && (
          <GoogleAdSense
            publisherId={process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_PUBLISHER_ID || ''}
          />
        )}
        {/* <Analytics /> */}
      </div>
    </>
  );
} 