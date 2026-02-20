/**
 * Background Service Worker for Power Apps Formula Floater.
 *
 * Handles:
 * - Toolbar icon click: sends PAFF_DETACH_FORMULA to active tab
 * - Chrome commands (keyboard shortcuts): same
 * - PAFF_GET_TAB_URL: provides tab URL to content scripts for app-id derivation
 */

console.log('Background service worker loaded')

// -------------------------------------------------------------------
// Installation
// -------------------------------------------------------------------
chrome.runtime.onInstalled.addListener(() => {
    console.log('Power Apps Formula Floater installed')
})

// -------------------------------------------------------------------
// Toolbar action click
// -------------------------------------------------------------------
chrome.action.onClicked.addListener(async (tab) => {
    if (!tab?.id) return
    chrome.tabs.sendMessage(tab.id, { type: 'PAFF_DETACH_FORMULA' })
})

// -------------------------------------------------------------------
// Keyboard shortcut commands
// -------------------------------------------------------------------
chrome.commands.onCommand.addListener(async (command) => {
    if (command === 'toggle-pick-mode' || command === 'detach-formula-bar') {
        await sendToActiveTab({ type: 'PAFF_DETACH_FORMULA' })
    }
})

// -------------------------------------------------------------------
// Message handler: provide tab URL to content scripts
// -------------------------------------------------------------------
chrome.runtime.onMessage.addListener(
    (
        msg: { type?: string },
        sender: chrome.runtime.MessageSender,
        sendResponse: (resp: { url: string | null }) => void,
    ) => {
        if (!msg?.type) return

        if (msg.type === 'PAFF_GET_TAB_URL') {
            try {
                if (sender?.tab?.url) {
                    sendResponse({ url: sender.tab.url })
                } else if (sender?.tab?.id) {
                    chrome.tabs.get(sender.tab.id, (tab) => {
                        sendResponse({ url: tab?.url ?? null })
                    })
                    return true // keep message channel open for async response
                } else {
                    // Fallback: query active tab
                    chrome.tabs.query(
                        { active: true, currentWindow: true },
                        (tabs) => {
                            const url = tabs?.[0]?.url ?? null
                            sendResponse({ url })
                        },
                    )
                    return true
                }
            } catch {
                try {
                    sendResponse({ url: null })
                } catch {
                    /* ignore */
                }
            }
        }
    },
)

// -------------------------------------------------------------------
// Utility
// -------------------------------------------------------------------
async function sendToActiveTab(payload: { type: string }) {
    try {
        const [tab] = await chrome.tabs.query({
            active: true,
            currentWindow: true,
        })
        if (tab?.id) {
            chrome.tabs.sendMessage(tab.id, payload)
        }
    } catch {
        /* ignore */
    }
}
