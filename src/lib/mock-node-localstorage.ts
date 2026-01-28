export class LocalStorage {
    constructor(_pathname: string) {
        // Pathname ignored in browser environment
    }

    getItem(key: string): string | null {
        if (typeof window !== 'undefined') {
            return window.localStorage.getItem(key);
        }
        return null;
    }

    setItem(key: string, value: string): void {
        if (typeof window !== 'undefined') {
            window.localStorage.setItem(key, value);
        }
    }

    removeItem(key: string): void {
        if (typeof window !== 'undefined') {
            window.localStorage.removeItem(key);
        }
    }

    clear(): void {
        if (typeof window !== 'undefined') {
            window.localStorage.clear();
        }
    }

    key(n: number): string | null {
        if (typeof window !== 'undefined') {
            return window.localStorage.key(n);
        }
        return null;
    }

    get length(): number {
        if (typeof window !== 'undefined') {
            return window.localStorage.length;
        }
        return 0;
    }
}
