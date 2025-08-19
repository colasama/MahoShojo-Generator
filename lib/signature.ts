// lib/signature.ts

// 在Edge Runtime中，`crypto`是全局对象。在Node.js环境中，我们需要从'crypto'模块导入。
// 这种方式可以确保在两种环境下都能正确工作。
import { webcrypto } from 'crypto';

const subtle = typeof crypto !== 'undefined' ? crypto.subtle : webcrypto.subtle;
const TextEncoder = globalThis.TextEncoder;

let secretKeyPromise: Promise<CryptoKey | null> | null = null;

// 从环境变量异步加载和准备密钥
const getSecretKey = (): Promise<CryptoKey | null> => {
    if (secretKeyPromise) {
        return secretKeyPromise;
    }

    secretKeyPromise = (async () => {
        const secret = process.env.SIGNATURE_SECRET_KEY;
        if (!secret) {
            console.warn('警告：未设置 SIGNATURE_SECRET_KEY 环境变量。签名机制将不安全，所有校验都会失败。');
            return null;
        }
        const encoder = new TextEncoder();
        return subtle.importKey(
            'raw',
            encoder.encode(secret),
            { name: 'HMAC', hash: 'SHA-256' },
            false, // non-exportable
            ['sign', 'verify']
        );
    })();
    return secretKeyPromise;
};

/**
 * 递归地对对象的键进行排序，以确保JSON字符串的稳定性。
 * 这是生成一致哈希值的关键步骤。
 * @param obj 需要排序的对象
 * @returns 键已排序的新对象
 */
const sortObjectKeys = (obj: any): any => {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }
    if (Array.isArray(obj)) {
        return obj.map(sortObjectKeys);
    }
    const sortedKeys = Object.keys(obj).sort((a, b) => a.localeCompare(b));
    const result: { [key: string]: any } = {};
    for (const key of sortedKeys) {
        result[key] = sortObjectKeys(obj[key]);
    }
    return result;
};


// 将ArrayBuffer转换为十六进制字符串
const bufferToHex = (buffer: ArrayBuffer): string => {
    return Array.from(new Uint8Array(buffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
};

/**
 * 为一个对象生成HMAC-SHA256签名。
 * @param data - 需要签名的对象。
 * @returns 返回十六进制格式的签名字符串，如果密钥未设置则返回null。
 */
export const generateSignature = async (data: object): Promise<string | null> => {
    const key = await getSecretKey();
    if (!key) return null;

    // 创建一个不包含现有签名的新对象以进行签名
    const dataToSign = { ...data };
    if ('signature' in dataToSign) {
        delete (dataToSign as any).signature;
    }

    // 使用递归排序确保JSON字符串的稳定性
    const sortedData = sortObjectKeys(dataToSign);
    const jsonString = JSON.stringify(sortedData);
    const encoder = new TextEncoder();
    const signatureBuffer = await subtle.sign('HMAC', key, encoder.encode(jsonString));
    
    return bufferToHex(signatureBuffer);
};

/**
 * 验证一个带有签名的对象的完整性。
 * @param dataWithSignature - 包含`signature`字段的完整对象。
 * @returns 如果签名有效则返回 `true`，否则返回 `false`。
 */
export const verifySignature = async (dataWithSignature: any): Promise<boolean> => {
    const key = await getSecretKey();
    if (!key) return false; // 如果没有密钥，所有内容都视为无效

    if (typeof dataWithSignature !== 'object' || dataWithSignature === null || typeof dataWithSignature.signature !== 'string') {
        return false; // 没有签名或格式不正确则无效
    }

    const { signature, ...dataToVerify } = dataWithSignature;
    const expectedSignature = await generateSignature(dataToVerify);
    
    // 比较两个签名是否一致
    return signature === expectedSignature;
};