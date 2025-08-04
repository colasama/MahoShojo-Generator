import { useState, useEffect, useCallback } from 'react';

const getLocalStorageItem = (key: string): number | null => {
    if (typeof window === 'undefined') {
        return null;
    }
    const item = localStorage.getItem(key);
    return item ? parseInt(item, 10) : null;
};

const setLocalStorageItem = (key: string, value: number) => {
    if (typeof window === 'undefined') {
        return;
    }
    localStorage.setItem(key, value.toString());
};

export const useCooldown = (key: string, duration: number) => {
    const [cooldownEndTime, setCooldownEndTime] = useState<number | null>(() => getLocalStorageItem(key));
    const [remainingTime, setRemainingTime] = useState<number>(0);

    useEffect(() => {
        if (!cooldownEndTime) return;

        const calculateRemainingTime = () => {
            const now = Date.now();
            const remaining = cooldownEndTime - now;
            if (remaining <= 0) {
                setRemainingTime(0);
                setCooldownEndTime(null);
                localStorage.removeItem(key);
            } else {
                setRemainingTime(Math.ceil(remaining / 1000));
            }
        };

        calculateRemainingTime();

        const interval = setInterval(calculateRemainingTime, 1000);

        return () => clearInterval(interval);
    }, [cooldownEndTime, key]);

    const startCooldown = useCallback(() => {
        const endTime = Date.now() + duration;
        setLocalStorageItem(key, endTime);
        setCooldownEndTime(endTime);
    }, [duration, key]);

    const isCooldown = remainingTime > 0;

    return { isCooldown, startCooldown, remainingTime };
};
