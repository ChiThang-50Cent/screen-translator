let isEnabled = false

chrome.runtime.onInstalled.addListener(() => {
    chrome.sidePanel
        .setPanelBehavior({ openPanelOnActionClick: true })
        .catch((error) => console.error(error));
})

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "take_screenshot") {
        chrome.tabs.captureVisibleTab(null, { format: "png" }, (dataUrl) => {
            sendResponse({ dataUrl });
        })
    }
    return true;
});
