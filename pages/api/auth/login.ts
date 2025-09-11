import { NextApiRequest, NextApiResponse } from 'next';
import { verifyUserLogin } from '@/lib/d1';
import { verifyTurnstileToken } from '@/lib/turnstile';

export const runtime = 'edge';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { username, authKey, turnstileToken } = req.body;

    if (!username || !authKey || !turnstileToken) {
      return res.status(400).json({ error: '用户名、密钥和安全验证不能为空' });
    }

    // 验证 Turnstile token
    const isTurnstileValid = await verifyTurnstileToken(turnstileToken);
    if (!isTurnstileValid) {
      return res.status(400).json({ error: '安全验证失败，请重新验证' });
    }

    // 验证用户登录
    const user = await verifyUserLogin(username, authKey);

    if (!user) {
      return res.status(401).json({ error: '用户名或密钥错误' });
    }

    return res.status(200).json({
      success: true,
      user: {
        id: user.id,
        username: user.username
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: '登录失败，请稍后重试' });
  }
}