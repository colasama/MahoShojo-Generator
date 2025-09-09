import { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';
import { createUser, getUserByUsername } from '@/lib/d1';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { username, code } = req.body;

    if (!username || !code) {
      return res.status(400).json({ error: '用户名和验证码不能为空' });
    }

    if (username.length < 2 || username.length > 20) {
      return res.status(400).json({ error: '用户名长度必须在2-20个字符之间' });
    }

    // 检查用户名是否已存在
    const existingUser = await getUserByUsername(username);
    if (existingUser) {
      return res.status(409).json({ error: '用户名已存在' });
    }

    // 生成唯一的认证密钥
    const authKey = crypto.randomBytes(32).toString('hex');

    // 创建用户
    const userId = await createUser(username, authKey);
    
    if (!userId) {
      return res.status(500).json({ error: '创建用户失败' });
    }

    return res.status(200).json({
      success: true,
      username,
      authKey,
      message: '注册成功！请妥善保存您的登录密钥'
    });

  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({ error: '注册失败，请稍后重试' });
  }
}