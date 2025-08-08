import journalistsData from '../public/journalists.json';

export interface JournalistInfo {
  name: string;
  publication: string;
}

// 定义记者条目的接口，允许 name 或 source 为可选
interface JournalistEntry {
    name?: string;
    source?: string;
}

/**
 * 从 journalists.json 中随机抽取记者和媒体。
 * 规则：
 * 1. 分离出所有记者（有name）和所有自由媒体（只有source）。
 * 2. 随机抽取一名记者。
 * 3. 如果该记者有绑定的媒体（source），则直接使用。
 * 4. 如果该记者没有绑定的媒体（自由记者），则从自由媒体列表中随机选择一个。
 * @returns {JournalistInfo} 包含记者和媒体信息的对象
 */
export function getRandomJournalist(): JournalistInfo {
    const entries: JournalistEntry[] = journalistsData.journalists;

    if (!entries || entries.length === 0) {
        // 如果列表为空，返回一个默认值以避免崩溃
        return { name: '佚名记者', publication: '魔法国度时报' };
    }

    // 1. 分离记者和自由媒体
    const allJournalists = entries.filter(j => j.name);
    const freelanceSources = entries.filter(j => j.source && !j.name).map(j => j.source as string);

    if (allJournalists.length === 0) {
        // 如果没有记者，就从自由媒体里选一个，记者叫佚名
        const randomSource = freelanceSources.length > 0 ? freelanceSources[Math.floor(Math.random() * freelanceSources.length)] : '魔法国度时报';
        return { name: '佚名', publication: randomSource };
    }

    // 2. 随机抽取一名记者
    const randomJournalistIndex = Math.floor(Math.random() * allJournalists.length);
    const selectedJournalist = allJournalists[randomJournalistIndex];

    const name = selectedJournalist.name!;
    let publication = selectedJournalist.source;

    // 3. 如果是自由记者，则分配一个自由媒体
    if (!publication) {
        if (freelanceSources.length > 0) {
            const randomSourceIndex = Math.floor(Math.random() * freelanceSources.length);
            publication = freelanceSources[randomSourceIndex];
        } else {
            // 如果没有自由媒体，给一个默认值
            publication = '魔法国度时报';
        }
    }

    return { name, publication: publication! };
}