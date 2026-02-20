export interface Pin {
    control: string
    prop: string
}

export class StorageService {
    private static STORAGE_NS = 'paff:pins:'

    static async getPins(appId: string): Promise<Pin[]> {
        const key = this.STORAGE_NS + appId
        return new Promise(resolve => {
            if (chrome?.storage?.sync) {
                chrome.storage.sync.get(key, (obj) => {
                    const arr = obj?.[key]
                    resolve(Array.isArray(arr) ? arr : [])
                })
            } else {
                try {
                    const raw = localStorage.getItem(key)
                    resolve(raw ? JSON.parse(raw) : [])
                } catch {
                    resolve([])
                }
            }
        })
    }

    static async savePins(appId: string, pins: Pin[]) {
        const key = this.STORAGE_NS + appId
        if (chrome?.storage?.sync) {
            chrome.storage.sync.set({ [key]: pins })
        } else {
            localStorage.setItem(key, JSON.stringify(pins))
        }
    }

    static getAppId(): string {
        // Simple heuristic for now, can be improved
        try {
            const u = new URL(location.href)
            // Try to find GUID in path
            const m = u.pathname.match(/[0-9a-fA-F-]{36}/)
            if (m) return m[0].toLowerCase()
            return u.host // Fallback
        } catch {
            return 'unknown-app'
        }
    }
}
