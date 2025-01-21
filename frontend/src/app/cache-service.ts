// frontend/src/app/cache-service.ts (create this file)

interface CachedData<T> {
    timestamp: number;
    data: T;
    version: number;
}

const CACHE_VERSION = 1;
const DEFAULT_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

export class CacheService {
    private static createCacheKey(key: string): string {
        return `linkie-web-cache-${key}`;
    }

    static async store<T>(key: string, data: T): Promise<void> {
        const cacheData: CachedData<T> = {
            timestamp: Date.now(),
            data: data,
            version: CACHE_VERSION
        };
        console.log(`Storing data in cache for key ${key}:`, cacheData);
        localStorage.setItem(
            this.createCacheKey(key),
            JSON.stringify(cacheData)
        );
    }

    static async retrieve<T>(key: string, maxAge: number = DEFAULT_CACHE_DURATION): Promise<T | null> {
        try {
            const cachedStr = localStorage.getItem(this.createCacheKey(key));
            console.log(`Attempting to retrieve cache for key ${key}`);
            if (!cachedStr) {
                console.log(`No cache found for key ${key}`);
                return null;
            }

            const cached: CachedData<T> = JSON.parse(cachedStr);
            console.log(`Found cached data for key ${key}:`, cached);
            
            if (cached.version !== CACHE_VERSION) {
                console.log(`Cache version mismatch for key ${key}`);
                localStorage.removeItem(this.createCacheKey(key));
                return null;
            }

            if (Date.now() - cached.timestamp > maxAge) {
                console.log(`Cache expired for key ${key}`);
                return null;
            }

            return cached.data;
        } catch (error) {
            console.error(`Error retrieving cache for key ${key}:`, error);
            return null;
        }
    }

    static async clear(key: string): Promise<void> {
        localStorage.removeItem(this.createCacheKey(key));
    }

    static async clearAll(): Promise<void> {
        Object.keys(localStorage)
            .filter(key => key.startsWith('linkie-web-cache-'))
            .forEach(key => localStorage.removeItem(key));
    }
}