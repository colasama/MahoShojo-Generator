import { NextApiRequest, NextApiResponse } from 'next';
import { 
  getUserByAuthKey, 
  createDataCardWithAuthor, 
  getUserDataCards, 
  updateDataCard, 
  deleteDataCard 
} from '@/lib/d1';

export const runtime = 'edge';

// 辅助函数：从请求头获取用户认证信息
async function getUserFromAuth(req: NextApiRequest): Promise<{ id: number; username: string } | null> {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const authKey = authHeader.substring(7);
  const user = await getUserByAuthKey(authKey);
  
  return user;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // 验证用户身份
  const user = await getUserFromAuth(req);
  if (!user) {
    return res.status(401).json({ error: '未授权' });
  }

  const userId = user.id;

  switch (req.method) {
    case 'GET':
      // 获取用户的所有数据卡
      try {
        const cards = await getUserDataCards(userId);
        return res.status(200).json({ success: true, cards });
      } catch (error) {
        console.error('Get cards error:', error);
        return res.status(500).json({ error: '获取数据卡失败' });
      }

    case 'POST':
      // 创建新数据卡
      try {
        const { type, name, description, data, isPublic } = req.body;

        if (!type || !name || !data) {
          return res.status(400).json({ error: '缺少必要参数' });
        }

        if (type !== 'character' && type !== 'scenario') {
          return res.status(400).json({ error: '无效的数据卡类型' });
        }

        const result = await createDataCardWithAuthor(
          userId,
          user.username,
          type,
          name,
          description || '',
          JSON.stringify(data),
          isPublic || false
        );

        if (!result.success) {
          return res.status(result.error?.includes('同名') ? 409 : 500).json({ 
            error: result.error || '创建数据卡失败' 
          });
        }

        return res.status(201).json({ 
          success: true, 
          id: result.id,
          message: '数据卡创建成功' 
        });
      } catch (error) {
        console.error('Create card error:', error);
        return res.status(500).json({ error: '创建数据卡失败' });
      }

    case 'PUT':
      // 更新数据卡
      try {
        const { id, name, description, isPublic } = req.body;

        if (!id) {
          return res.status(400).json({ error: '缺少数据卡ID' });
        }

        const success = await updateDataCard(id, userId, name, description, isPublic);

        if (!success) {
          return res.status(404).json({ error: '数据卡不存在或无权访问' });
        }

        return res.status(200).json({ success: true, message: '数据卡更新成功' });
      } catch (error) {
        console.error('Update card error:', error);
        return res.status(500).json({ error: '更新数据卡失败' });
      }

    case 'DELETE':
      // 删除数据卡
      try {
        const { id } = req.query;

        if (!id) {
          return res.status(400).json({ error: '缺少数据卡ID' });
        }

        const success = await deleteDataCard(Number(id), userId);

        if (!success) {
          return res.status(404).json({ error: '数据卡不存在或无权访问' });
        }

        return res.status(200).json({ success: true, message: '数据卡删除成功' });
      } catch (error) {
        console.error('Delete card error:', error);
        return res.status(500).json({ error: '删除数据卡失败' });
      }

    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}