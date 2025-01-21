import axios, {AxiosResponse} from "axios"
import {OfflineCache} from './offline-cache';
import {isTauri} from "./tauri/tauri"
import {LocationQuery, RouteLocationNormalizedLoaded, useRoute} from "vue-router"

export const backendServer = "https://linkieapi.shedaniel.me"
export const localBackendServer = "http://localhost:6969"

export async function reqVersions<T = any>(): Promise<AxiosResponse<T>> {
    try {
        console.log('[API] Fetching versions...');
        const response = await HTTP.get(`/api/versions/all`);
        console.log('[API] Successfully fetched versions:', response.data);
        OfflineCache.set('versions', response.data);
        return response;
    } catch (error) {
        console.log('[API] Error fetching versions, trying cache...');
        const cached = OfflineCache.get<T>('versions');
        if (cached) {
            console.log('[API] Using cached versions data');
            return { data: cached } as AxiosResponse<T>;
        }
        throw error;
    }
}

// frontend/src/app/backend.ts

export function reqNamespaces<T = any>(): Promise<AxiosResponse<T>> {
    // First check if we're offline
    if (!navigator.onLine) {
        const cached = OfflineCache.get<T>('namespaces', 'all');
        if (cached) {
            console.log('[API] Using cached namespaces data');
            return Promise.resolve({ data: cached } as AxiosResponse<T>);
        }
    }

    return HTTP.get(`/api/namespaces`).then(response => {
        // Ensure response has the expected structure before caching
        if (response.data && Array.isArray(response.data)) {
            console.log('[API] Caching namespaces data');
            OfflineCache.set('namespaces', 'all', response.data);
        }
        return response;
    }).catch(async error => {
        console.log('[API] Error fetching namespaces:', error);
        // Try cache as fallback even if we thought we were online
        const cached = OfflineCache.get<T>('namespaces', 'all');
        if (cached) {
            console.log('[API] Using cached namespaces data after error');
            return { data: cached } as AxiosResponse<T>;
        }
        throw error;
    });
}

// frontend/src/app/backend.ts

export function reqSearch<T = any>(
    namespace: string, 
    version: string, 
    query: string, 
    allowClasses: boolean, 
    allowFields: boolean, 
    allowMethods: boolean,
    translateMode?: string, 
    translate?: string, 
    abortController?: AbortController, 
    limit: number = 100
): Promise<AxiosResponse<T>> {
    // Prepare base result structure
    const emptyResult = {
        entries: [],
        fuzzy: false,
        classes: [],
        methods: [],
        fields: [],
        query: query || ''
    };

    if (!navigator.onLine) {
        return OfflineCache.searchMappings(
            namespace,
            version,
            query || '',
            allowClasses,
            allowFields,
            allowMethods
        ).then(results => {
            return { 
                data: {
                    ...emptyResult,
                    ...results,
                    query: query || ''
                } 
            } as AxiosResponse<T>;
        });
    }

    return HTTP.get(`/api/search`, {
        signal: abortController?.signal,
        params: {
            namespace,
            query: query || '',
            version,
            limit,
            allowClasses,
            allowFields,
            allowMethods,
            translateMode: translateMode || "ns",
            translate,
        },
    }).then(response => {
        const data = response.data || emptyResult;
        // Ensure all required properties exist
        response.data = {
            ...emptyResult,
            ...data,
            query: query || ''
        };
        
        // Cache the normalized data
        OfflineCache.setMappingSearch(namespace, version, response.data);
        return response;
    }).catch(error => {
        if (error.name === 'CanceledError') {
            return { data: emptyResult } as AxiosResponse<T>;
        }
        
        if (!navigator.onLine) {
            return OfflineCache.searchMappings(
                namespace,
                version,
                query || '',
                allowClasses,
                allowFields,
                allowMethods
            ).then(results => ({ 
                data: {
                    ...emptyResult,
                    ...results,
                    query: query || ''
                } 
            } as AxiosResponse<T>));
        }
        throw error;
    });
}

export const HTTP = axios.create({
    baseURL: currentBackendServer(),
})

export function currentBackendServer(): string {
    return isTauri() ? localBackendServer : backendServer
}

export async function cacheMappingData(namespace: string, version: string): Promise<void> {
    try {
        console.log(`[API] Caching mapping data for ${namespace}:${version}...`);
        // Cache an initial empty search to get all mappings
        const response = await HTTP.get(`/api/search`, {
            params: {
                namespace,
                version,
                query: '',
                limit: 100000, // Get all mappings
                allowClasses: true,
                allowFields: true,
                allowMethods: true,
                translateMode: 'ns'
            },
        });

        const cacheKey = OfflineCache.createKey(namespace, version);
        OfflineCache.set(cacheKey, {
            classes: response.data.classes || [],
            methods: response.data.methods || [],
            fields: response.data.fields || []
        });
        console.log(`[API] Successfully cached mapping data for ${namespace}:${version}`);
    } catch (error) {
        console.error(`[API] Failed to cache mapping data for ${namespace}:${version}:`, error);
    }
}

export function reqSource<T = any>(namespace: string, version: string, className: string): Promise<AxiosResponse<T>> {
    return HTTP.get(`/api/source`, {
        params: {
            namespace,
            "class": className,
            version,
        },
    })
}

export function reqOss<T = any>(): Promise<AxiosResponse<T>> {
    return HTTP.get(`/api/oss`)
}

export function reqStatusSource<T = any>(namespace: string): Promise<AxiosResponse<T>> {
    return HTTP.get(`/api/status/sources/${namespace}`)
}

export function fullPath(route: RouteLocationNormalizedLoaded | undefined = undefined) {
    if (!route) route = useRoute()
    if (!route) return undefined
    return new URL(route.fullPath, window.location.origin).href
}

export function getQuery(query: LocationQuery | null, key: string): string | null {
    if (!query) return null
    let value = query[key]
    if (Array.isArray(value)) {
        return value[0]
    } else {
        return value
    }
}

export function hasQuery(query: LocationQuery | null, key: string): boolean {
    return query != null && query[key] != null
}

export let allNamespaceGroups: string[] = [
    "Official",
    "Fabric",
    "Forge",
    "Quilt",
    "Others",
]

export let hiddenNamespaceGroups: string[] = [
    "Quilt",
    "Others",
]

export let namespaceGroups: { [key: string]: string | string[] } = {
    "yarn": "Fabric",
    "mojang": "Fabric",
    "mojang_raw": "Official",
    "mojang_srg": "Forge",
    "mojang_hashed": "Quilt",
    "mcp": "Forge",
    "quilt-mappings": "Quilt",
}

export let namespaceLocalizations: { [namespace: string]: string } = {
    "yarn": "Yarn",
    "mojang_raw": "Mojang",
    "mojang": "Mojang (via Intermediary)",
    "mojang_srg": "Mojang (via SRG)",
    "mojang_hashed": "Mojang (via Hashed)",
    "mcp": "Legacy MCP",
    "quilt-mappings": "Quilt Mappings",
    "legacy-yarn": "Legacy Yarn",
    "yarrn": "Yarrn",
    "plasma": "Plasma",
    "barn": "Barn",
    "feather": "Feather",
} 
