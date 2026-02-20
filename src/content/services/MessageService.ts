import type { PaffTabUrlResponse } from '../types'

/**
 * Background/Content Script messaging service.
 *
 * Provides helpers for:
 * - Listening to messages from the background service worker
 * - Requesting tab URL from background for reliable app-id derivation
 */
export class MessageService {
    private static listeners = new Set<(type: string) => void>()
    private static boundHandler?: (msg: { type?: string }) => void

    /**
     * Register a listener for incoming messages from the background script.
     * Returns an unsubscribe function.
     */
    static onMessage(callback: (type: string) => void): () => void {
        this.listeners.add(callback)

        if (this.listeners.size === 1) {
            this.startListening()
        }

        return () => {
            this.listeners.delete(callback)
            if (this.listeners.size === 0) {
                this.stopListening()
            }
        }
    }

    /**
     * Request the current tab URL from the background service worker.
     * Falls back to `location.href` if the background is unavailable.
     */
    static getTabUrl(): Promise<string | null> {
        return new Promise((resolve) => {
            try {
                if (chrome?.runtime?.sendMessage) {
                    chrome.runtime.sendMessage(
                        { type: 'PAFF_GET_TAB_URL' },
                        (resp: PaffTabUrlResponse | undefined) => {
                            resolve(resp?.url ?? null)
                        },
                    )
                } else {
                    resolve(location.href)
                }
            } catch {
                resolve(location.href)
            }
        })
    }

    private static startListening() {
        if (this.boundHandler) return
        this.boundHandler = (msg: { type?: string }) => {
            if (msg?.type) {
                this.listeners.forEach((cb) => cb(msg.type!))
            }
        }
        try {
            chrome.runtime?.onMessage?.addListener?.(this.boundHandler)
        } catch {
            // Not in extension context
        }
    }

    private static stopListening() {
        if (!this.boundHandler) return
        try {
            chrome.runtime?.onMessage?.removeListener?.(this.boundHandler)
        } catch {
            // Not in extension context
        }
        this.boundHandler = undefined
    }
}
