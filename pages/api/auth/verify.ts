import { NextApiRequest, NextApiResponse } from 'next';
import { getUserByAuthKey } from '@/lib/d1';

export const runtime = 'edge';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: '未提供认证信息' });
    }

    const authKey = authHeader.substring(7);

    // 根据认证密钥查找用户
    const user = await getUserByAuthKey(authKey);

    if (!user) {
      return res.status(401).json({ error: '认证失败' });
    }

    return res.status(200).json({
      success: true,
      user: {
        id: user.id,
        username: user.username
      }
    });

  } catch (error) {
    console.error('Verify error:', error);
    return res.status(500).json({ error: '验证失败，请稍后重试' });
  }
}