import {CacheService} from './cache-service';
import {getQuery, reqVersions} from "./backend"
import {addAlert} from "./alerts"
import {applicableDependencyVersions, useDependencySearchStore} from "./dependency-store"
import {DependencyType} from "./dep-format"
import {defineStore} from "pinia"
import {LocationQuery} from "vue-router"

export interface VersionEntry {
    version: string,
    stable: boolean,
    blocks: DependencyBlocks,
}

export interface DependencyEntry {
    name: string,
    type: DependencyType,
    notation: string,
    version: string,
}

export interface MavenInfo {
    subtitle?: string,
    url: string,
}

export interface DependencyBlockData {
    mavens: MavenInfo[],
    dependencies: DependencyEntry[],
}

export type DependencyBlocks = { [name: string]: DependencyBlockData }

export interface DependencySearchData {
    versions: { [loader: string]: VersionEntry[]; }
}

export interface State {
    reqVersionsPromise: Promise<any> | undefined,
    searchData: DependencySearchData,
    hasFirstLoaded: boolean,
}

function newState(): State {
    return {
        reqVersionsPromise: undefined,
        searchData: {
            versions: {},
        },
        hasFirstLoaded: false,
    }
}

export const useDependenciesDataStore = defineStore({
    id: "dependencies-data",
    state: newState,
})

const VERSIONS_CACHE_KEY = 'versions';

async function reqVersionsWithCache(): Promise<{ data: DependencySearchData }> {
    console.log('Checking cache for versions data...');
    const cachedData = await CacheService.retrieve<DependencySearchData>(VERSIONS_CACHE_KEY);
    if (cachedData) {
        console.log('Using cached dependency data:', cachedData);
        return { data: cachedData };
    }

    try {
        console.log('Fetching fresh dependency data...');
        const response = await reqVersions();
        console.log('Storing new dependency data in cache...', response.data);
        await CacheService.store(VERSIONS_CACHE_KEY, response.data);
        return response;
    } catch (error) {
        console.error('Error fetching versions:', error);
        const expiredData = await CacheService.retrieve<DependencySearchData>(
            VERSIONS_CACHE_KEY,
            Infinity
        );
        
        if (expiredData) {
            console.log('Using expired cached data:', expiredData);
            return { data: expiredData };
        }
        
        throw error;
    }
}

async function fetchVersionsWithCache(): Promise<DependencySearchData> {
    const cachedData = await CacheService.retrieve<DependencySearchData>(VERSIONS_CACHE_KEY);
    if (cachedData) {
        console.log('Using cached data:', cachedData);
        return cachedData;
    }

    try {
        console.log('Fetching fresh data...');
        const response = await reqVersions();
        console.log('Storing new data in cache...');
        await CacheService.store(VERSIONS_CACHE_KEY, response.data);
        return response.data;
    } catch (error) {
        console.log('Network error, attempting to use expired cache...');
        const expiredData = await CacheService.retrieve<DependencySearchData>(
            VERSIONS_CACHE_KEY,
            Infinity
        );
        
        if (expiredData) {
            console.log('Using expired cached data:', expiredData);
            return expiredData;
        }
        
        console.error('No cached data available:', error);
        throw error;
    }
}

export function updateDependencyData(fullPath?: string, query: LocationQuery | null = null) {
    let store = useDependenciesDataStore()
    if (query || (Object.keys(store.searchData.versions).length == 0 && !store.reqVersionsPromise)) {
        console.log('Updating dependency data...');
        store.reqVersionsPromise = reqVersionsWithCache().then(value => {
            console.log('Successfully fetched dependency data:', value.data);
            store.searchData.versions = value.data;
            ensureDependencyData(fullPath, query);
        }).catch(reason => {
            console.error('Failed to fetch versions:', reason);
            addAlert({
                type: "error",
                message: `Failed to fetch versions: ${reason.message}`,
            });
        }).finally(() => {
            store.reqVersionsPromise = undefined;
        });
    }
}

// Add this new function:
export async function refreshDependencyCache(): Promise<void> {
    console.log('Refreshing dependency cache...');
    await CacheService.clear(VERSIONS_CACHE_KEY);
    const store = useDependenciesDataStore();
    store.reqVersionsPromise = undefined;
    await updateDependencyData();
}

export function ensureDependencyData(fullPath?: string, query: LocationQuery | null = null) {
    let store = useDependenciesDataStore()

    if (query) {
        let {searchData} = useDependenciesDataStore()
        let loaders = Object.keys(searchData.versions)

        if (loaders.includes(getQuery(query, "loader") ?? "")) {
            useDependencySearchStore().loader = (getQuery(query, "loader") ?? "") as string
            useDependencySearchStore().version = undefined
        }

        if (applicableDependencyVersions().includes(getQuery(query, "version") ?? "")) {
            useDependencySearchStore().version = (getQuery(query, "version") ?? "") as string
        }

        useDependenciesDataStore().hasFirstLoaded = true
    }

    let {loader, version, allowSnapshots} = useDependencySearchStore()
    if (!loader) {
        loader = Object.keys(store.searchData.versions)[0]
        useDependencySearchStore().loader = loader
    }
    let applicable_versions = store.searchData.versions[loader!!]
    if (applicable_versions) {
        if (!allowSnapshots) {
            applicable_versions = applicable_versions.filter(entry => entry.stable)
        }
        if (!version || !applicable_versions.find(entry => entry.version === version)) {
            version = applicable_versions.find(entry => entry.stable)?.version
            useDependencySearchStore().version = version
        }
    }

    if (useDependenciesDataStore().hasFirstLoaded && fullPath) {
        updateDependenciesWindowUrl(fullPath)
    }
}

export function updateDependenciesWindowUrl(fullPath: string) {
    let {loader, version} = useDependencySearchStore()
    let url = new URL(fullPath)
    url.searchParams.set("loader", loader ?? "")
    url.searchParams.set("version", version ?? "")
    window.history.replaceState({}, "", url.toString())
}
