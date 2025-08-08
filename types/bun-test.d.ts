declare module 'bun:test' {
    export const describe: (name: string, fn: () => void) => void;
    export const it: (name: string, fn: () => void | Promise<void>) => void;
    export const test: typeof it;
    export const expect: any;
    export const beforeAll: (fn: () => void | Promise<void>) => void;
    export const beforeEach: (fn: () => void | Promise<void>) => void;
    export const afterAll: (fn: () => void | Promise<void>) => void;
    export const afterEach: (fn: () => void | Promise<void>) => void;
}


