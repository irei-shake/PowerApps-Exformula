console.log('Background service worker loaded')

// Listen for messages or commands here
chrome.runtime.onInstalled.addListener(() => {
    console.log('Power Apps Formula Floater installed')
})
