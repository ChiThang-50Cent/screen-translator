// Select button by ID (add id="myButton" to your HTML button)
const button = document.getElementById('screenshot-btn');

// Add click event listener
button.addEventListener('click', () => {
    // Your click handler code here
    chrome.runtime.sendMessage({action: 'take_screenshot'}, (response) => {
        // Send message to content.js
        sendToContentJS({action: 'screenshot_taken', dataUrl: response.dataUrl});
        return true;
    });
});

const sendToContentJS = (message) => {
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, message);
        return true;
    });
}