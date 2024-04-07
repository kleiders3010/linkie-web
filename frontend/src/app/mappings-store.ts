import {defineStore} from "pinia"
import {useMappingsDataStore} from "./mappings-data"

interface State {
    namespace: string | undefined,
    version: string | undefined,
    allowSnapshots: boolean,
    allowClasses: boolean,
    allowFields: boolean,
    allowMethods: boolean,
    searchText: string,
    mode: string | undefined,
    translateMode: string | undefined,
    translateAs: string | undefined,
    translateAsVersion: string | undefined,
}

export interface VersionPossible {
    version: string
    hasTranslation: boolean
}

function newState(): State {
    return {
        namespace: undefined,
        version: undefined,
        allowSnapshots: false,
        allowClasses: true,
        allowFields: true,
        allowMethods: true,
        searchText: "",
        mode: undefined,
        translateMode: undefined,
        translateAs: undefined,
        translateAsVersion: undefined,
    }
}

export const useMappingsStore = defineStore({
    id: "mappings",
    state: newState,
    persist: true,
})

export function applicableMappingsVersions(): VersionPossible[] {
    let {namespace, allowSnapshots, translateAs} = useMappingsStore()
    let {mappingsData} = useMappingsDataStore()
    if (!namespace) return []
    let namespaceObj = mappingsData.namespaces.find(value => value.id === namespace)
    if (!namespaceObj) return []
    let versions = namespaceObj.versions
    if (versions && !allowSnapshots) {
        versions = versions.filter(entry => entry.stable)
    }
    if (versions && translateAs) {
        let translateAsObj = mappingsData.namespaces.find(value => value.id === translateAs)
        let retain = translateAsObj?.versions?.map(entry => entry.version) ?? []
        return versions.map(entry => {
            return {
                version: entry.version,
                hasTranslation: retain.includes(entry.version),
            }
        })
    } else {
        return versions.map(entry => {
            return {
                version: entry.version,
                hasTranslation: true,
            }
        })
    }
}