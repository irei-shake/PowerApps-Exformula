// MV3 background service worker: toggles pick mode via toolbar click or shortcut

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab?.id) return;
  // Try direct formula bar detach
  chrome.tabs.sendMessage(tab.id, { type: 'PAFF_DETACH_FORMULA' });
});

async function sendToActiveTab(payload) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.id) chrome.tabs.sendMessage(tab.id, payload);
  } catch (e) {
    // no-op
  }
}

chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'toggle-pick-mode') {
    // Alt+Shift+F → フォーミュラバーの切り離し
    await sendToActiveTab({ type: 'PAFF_DETACH_FORMULA' });
  } else if (command === 'detach-formula-bar') {
    await sendToActiveTab({ type: 'PAFF_DETACH_FORMULA' });
  }
});

// Provide tab URL to content scripts for app identification
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || !msg.type) return; // ignore
  if (msg.type === 'PAFF_GET_TAB_URL') {
    try {
      if (sender?.tab?.url) {
        sendResponse({ url: sender.tab.url });
      } else if (sender?.tab?.id) {
        chrome.tabs.get(sender.tab.id, (tab) => {
          sendResponse({ url: tab?.url || null });
        });
        return true; // keep the message channel open for async response
      } else {
        // Fallback: query active tab
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          const url = tabs && tabs[0] ? tabs[0].url : null;
          sendResponse({ url });
        });
        return true;
      }
    } catch {
      try { sendResponse({ url: null }); } catch {}
    }
  }
});
