import type { NextApiRequest, NextApiResponse } from 'next';
import { generateMagicalGirlWithAI } from '../../lib/magical-girl';
import { withRateLimit } from '../../lib/rate-limiter';

async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { name } = req.body;

  if (!name || typeof name !== 'string') {
    return res.status(400).json({ error: 'Name is required' });
  }

  try {
    const magicalGirl = await generateMagicalGirlWithAI(name.trim());
    res.status(200).json(magicalGirl);
  } catch (error) {
    console.error('生成魔法少女失败:', error);
    res.status(500).json({ error: '生成失败，请稍后重试' });
  }
}

// 使用 rate limiter 包装处理函数
export default withRateLimit('generate-magical-girl')(handler);