import type { AppProps } from 'next/app';
import Head from 'next/head';
import { useRouter } from 'next/router';
import '@/styles/globals.css';
import '@/styles/blue-theme.css';

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const isDetailsPage = router.pathname === '/details';

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
      </div>
    </>
  );
} 