import { type NextApiRequest, type NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';

// 定义预设角色的数据结构
export interface PresetMagicalGirl {
  name: string;
  description: string;
  filename: string;
}

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<PresetMagicalGirl[] | { error: string }>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // 构建 presets 文件夹的绝对路径
    const presetsDir = path.join(process.cwd(), 'public', 'presets');

    // 同步读取目录下的所有文件名
    const filenames = fs.readdirSync(presetsDir);

    // 过滤并解析文件名
    const presets = filenames
      .filter((name) => name.endsWith('.json'))
      .map((name) => {
        // 使用正则表达式从文件名中提取名字和描述
        // 格式: 魔法少女_名字（描述）.json
        const match = name.match(/^魔法少女_([^(]+)(?:（([^）]+)）)?\.json$/);

        if (match) {
          return {
            name: match[1],
            description: match[2] || '无特殊描述', // 如果没有描述，提供默认值
            filename: name,
          };
        }
        return null;
      })
      .filter((p): p is PresetMagicalGirl => p !== null); // 过滤掉解析失败的项

    res.status(200).json(presets);
  } catch (error) {
    console.error('获取预设角色失败:', error);
    res.status(500).json({ error: '无法加载预设角色列表' });
  }
}