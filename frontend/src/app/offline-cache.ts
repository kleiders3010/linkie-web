// frontend/src/app/offline-cache.ts

interface CachedData<T> {
    timestamp: number;
    data: T;
}

interface MappingEntry {
    name: string;
    mapped: string;
    owner?: string;
}

interface Namespace {
    id: string;
    versions: Array<{
        version: string;
        stable: boolean;
    }>;
}

interface MappingSearchIndex {
    entries?: any[];
    fuzzy?: boolean;
    classes?: MappingEntry[];
    methods?: MappingEntry[];
    fields?: MappingEntry[];
    query?: string;
}

export class OfflineCache {
    private static readonly PREFIX = 'linkie-web-cache-';

    private static createKey(type: string, ...parts: string[]): string {
        return `${this.PREFIX}${type}-${parts.join('-')}`;
    }

	static set<T>(type: string, key: string, data: T): void {
        try {
            const cacheKey = this.createKey(type, key);
            
            // Special handling for namespaces data to ensure it's an array
            if (type === 'namespaces' && !Array.isArray(data)) {
                console.warn('[Cache] Namespaces data must be an array');
                return;
            }

            const cacheData: CachedData<T> = {
                timestamp: Date.now(),
                data: data
            };
            
            localStorage.setItem(cacheKey, JSON.stringify(cacheData));
            console.log(`[Cache] Stored ${type} data for ${key}`);
        } catch (error) {
            console.error(`[Cache] Error storing ${type} data:`, error);
            throw error;
        }
    }

    static get<T>(type: string, key: string): T | null {
        try {
            const cacheKey = this.createKey(type, key);
            const item = localStorage.getItem(cacheKey);
            if (!item) {
                console.log(`[Cache] No cached data found for ${type}:${key}`);
                return null;
            }
            
            const cached = JSON.parse(item) as CachedData<T>;
            
            // For namespaces, ensure we have a valid array
            if (type === 'namespaces' && !Array.isArray(cached.data)) {
                console.warn('[Cache] Invalid namespaces data in cache');
                return null;
            }
            
            console.log(`[Cache] Retrieved ${type} data for ${key}`);
            return cached.data;
        } catch (error) {
            console.error(`[Cache] Error retrieving ${type} data:`, error);
            return null;
        }
    }

    // Special handling for mapping data
    static setMappingSearch(namespace: string, version: string, data: any): void {
        try {
            const key = this.createKey('mapping', namespace, version);
            const existingData = this.get<MappingSearchIndex>('mapping', namespace, version) || {};
            
            // Safely merge arrays, handling cases where they might not exist
            const mergedData: MappingSearchIndex = {
                classes: [
                    ...(existingData.classes || []),
                    ...(data.classes || [])
                ].filter((item, index, self) => 
                    index === self.findIndex(t => t.name === item.name)
                ),
                methods: [
                    ...(existingData.methods || []),
                    ...(data.methods || [])
                ].filter((item, index, self) => 
                    index === self.findIndex(t => t.name === item.name)
                ),
                fields: [
                    ...(existingData.fields || []),
                    ...(data.fields || [])
                ].filter((item, index, self) => 
                    index === self.findIndex(t => t.name === item.name)
                )
            };

            this.set('mapping', mergedData, namespace, version);
        } catch (error) {
            console.error(`[Cache] Error storing mapping data:`, error);
            throw error;
        }
    }

	static async searchMappings(
        namespace: string,
        version: string,
        query: string,
        allowClasses: boolean,
        allowFields: boolean,
        allowMethods: boolean
    ): Promise<MappingSearchIndex> {
        const cached = this.get<MappingSearchIndex>('mapping', namespace, version);
        const emptyResult: MappingSearchIndex = {
            entries: [],
            fuzzy: false,
            classes: [],
            methods: [],
            fields: [],
            query: query || ''
        };

        if (!cached) {
            return emptyResult;
        }

        try {
            const searchRegex = new RegExp(query || '', 'i');
            const results: MappingSearchIndex = {
                ...emptyResult,
                query: query || ''
            };

            if (allowClasses && cached.classes) {
                results.classes = cached.classes.filter(c => 
                    searchRegex.test(c.name) || searchRegex.test(c.mapped)
                );
            }

            if (allowMethods && cached.methods) {
                results.methods = cached.methods.filter(m => 
                    searchRegex.test(m.name) || searchRegex.test(m.mapped)
                );
            }

            if (allowFields && cached.fields) {
                results.fields = cached.fields.filter(f => 
                    searchRegex.test(f.name) || searchRegex.test(f.mapped)
                );
            }

            return results;
        } catch (error) {
            console.error('[Cache] Search error:', error);
            return emptyResult;
        }
    }
}