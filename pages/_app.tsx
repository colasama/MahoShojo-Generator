import type { AppProps } from 'next/app'
import Head from 'next/head'
import '@/styles/globals.css'
import { Analytics } from "@vercel/analytics/next"

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <title>✨ 魔法少女生成器 ✨</title>
        <meta name="description" content="为你生成独特的魔法少女角色" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.svg" />
      </Head>
      <Component {...pageProps} />
      <Analytics />
    </>
  )
} 