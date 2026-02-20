import type { Pin } from '../types'
import { MessageService } from './MessageService'

/**
 * Manages persistent storage of pinned properties per Power App.
 *
 * Uses `chrome.storage.sync` in extension context with `localStorage` fallback.
 * App identification uses a multi-strategy approach to extract the app GUID
 * from the current URL or the top-level tab URL (via background service worker).
 */
export class StorageService {
    private static STORAGE_NS = 'paff:pins:'
    private static cachedAppId: string | null = null

    // -------------------------------------------------------------------
    // App ID Resolution
    // -------------------------------------------------------------------

    /**
     * Resolve the current Power App's identifier.
     * Tries: current frame URL -> background tab URL -> fallback.
     */
    static async resolveAppId(): Promise<string> {
        if (this.cachedAppId) return this.cachedAppId

        // 1) From current frame URL
        const fromFrame = this.deriveAppIdFromUrl(location.href)
        if (fromFrame) {
            this.cachedAppId = fromFrame
            return fromFrame
        }

        // 2) From top-level tab URL via background
        try {
            const tabUrl = await MessageService.getTabUrl()
            if (tabUrl) {
                const fromTab = this.deriveAppIdFromUrl(tabUrl)
                if (fromTab) {
                    this.cachedAppId = fromTab
                    return fromTab
                }
                // 3) Fallback: origin + first two path segments
                try {
                    const u = new URL(tabUrl)
                    const seg = u.pathname
                        .split('/')
                        .filter(Boolean)
                        .slice(0, 2)
                        .join('/')
                    this.cachedAppId = `${u.origin}/${seg}`.toLowerCase()
                    return this.cachedAppId
                } catch {
                    /* fall through */
                }
            }
        } catch {
            /* fall through */
        }

        // 4) Last resort
        this.cachedAppId = location.host.toLowerCase()
        return this.cachedAppId
    }

    /**
     * Extract a Power App GUID from a URL string using multiple heuristics:
     * - Path pattern: /e/{env}/apps/{GUID}/... or /apps/{GUID}
     * - Short form: /a/{GUID}
     * - Query / hash params: appId, AppId, id, app-id
     * - Generic GUID in path
     */
    private static deriveAppIdFromUrl(urlStr: string): string | null {
        try {
            const href = String(urlStr)

            // Path: /e/{env}/apps/{GUID}/ or /apps/{GUID}
            const mPath = href.match(
                /\/(?:e\/[^/]+\/)?apps\/([0-9a-fA-F-]{36})(?:\b|\/)/,
            )
            if (mPath?.[1]) return mPath[1].toLowerCase()

            // Short form: /a/{GUID}
            const mShort = href.match(/\/a\/([0-9a-fA-F-]{36})(?:\b|\/)/)
            if (mShort?.[1]) return mShort[1].toLowerCase()

            // Search and hash params
            const u = new URL(href)
            const params: [string, string][] = []
            u.searchParams.forEach((v, k) => params.push([k, v]))

            const hash = (u.hash || '').replace(/^#/, '')
            if (hash) {
                try {
                    const uh = new URL(`https://x/?${hash}`)
                    uh.searchParams.forEach((v, k) => params.push([k, v]))
                } catch {
                    /* ignore */
                }
            }

            for (const [k, v] of params) {
                if (
                    /^(appId|appid|app-id|id)$/i.test(k) &&
                    /[0-9a-fA-F-]{36}/.test(v)
                ) {
                    const g = v.match(/[0-9a-fA-F-]{36}/)
                    if (g) return g[0].toLowerCase()
                }
            }

            // Generic GUID anywhere in path
            const mGeneric = u.pathname.match(/[0-9a-fA-F-]{36}/)
            if (mGeneric) return mGeneric[0].toLowerCase()
        } catch {
            /* ignore */
        }
        return null
    }

    // -------------------------------------------------------------------
    // Pin CRUD
    // -------------------------------------------------------------------

    static async getPins(appId: string): Promise<Pin[]> {
        const key = this.STORAGE_NS + appId
        return new Promise((resolve) => {
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

    static async savePins(appId: string, pins: Pin[]): Promise<void> {
        const key = this.STORAGE_NS + appId
        if (chrome?.storage?.sync) {
            chrome.storage.sync.set({ [key]: pins })
        } else {
            localStorage.setItem(key, JSON.stringify(pins))
        }
    }
}
