// Select button by ID (add id="myButton" to your HTML button)
const button = document.getElementById("screenshot-btn");

// Alert placeholder element
const alertPlaceholder = document.getElementById('liveAlertPlaceholder')

// Chat body element
const chatBody = document.getElementById("chat-body");

// Spinner element
const spinner = document.getElementById("loading-spinner");

// Settings panel functionality
const settingsBtn = document.getElementById("settings-btn");
const settingsPanel = document.getElementById("settings-panel");
const saveSettingsBtn = document.getElementById("save-settings");
const ocrAPIKey = document.getElementById("ocr-api-key");
const LLMAPIKey = document.getElementById("lmm-api-key");

const OCR_API_ENDPOINT = "https://apipro1.ocr.space/parse/image";
const LLM_API_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";

// Add click event listener
button.addEventListener("click", () => {
    // Your click handler code here
    chrome.runtime.sendMessage({ action: "take_screenshot" }, (response) => {
        // Send message to content.js
        sendToContentJS({
            action: "screenshot_taken",
            dataUrl: response.dataUrl,
        });
    });
});

const sendToContentJS = (message) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, message);
    });
};

const addCroppedImage = (base64Data) => {
    const container = document.createElement("div");
    container.className = "image-container w-100";
    const img = document.createElement("img");
    img.src = base64Data;
    img.className = "mw-100";
    container.appendChild(img);
    if (chatBody) {
        chatBody.appendChild(container);
    }
};

function addMessage(text) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message w-100';
    
    const paragraph = document.createElement('p');
    paragraph.textContent = text;
    paragraph.style.margin = '0'; // Remove default margins
    
    messageDiv.appendChild(paragraph);
    chatBody.appendChild(messageDiv);

    messageDiv.scrollIntoView({ behavior: 'smooth', block: 'end' });
}

const showSpinner = () => {
    spinner.classList.remove("d-none");
};

const hideSpinner = () => {
    spinner.classList.add("d-none");
};

const appendAlert = (message, type) => {
    const wrapper = document.createElement("div");
    wrapper.innerHTML = [
        `<div class="alert alert-${type} alert-dismissible" role="alert">`,
        `   <div>${message}</div>`,
        '   <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>',
        "</div>",
    ].join("");

    chatBody.appendChild(wrapper);
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "cropped_image") {
        const { base64Data } = message;

        addCroppedImage(base64Data);
        chrome.storage.local.get(["ocr-key", "llm-key"], (result) => {
            showSpinner();
            postOCRRequest(OCR_API_ENDPOINT, base64Data, result["ocr-key"])
                .then((response) => {
                    const responseText = processOCRResponse(response);
                    if (!responseText) {
                        throw new Error('Something went wrong, try again or check api configuration.');
                    }
                    addMessage(responseText);
                    callTranslateGroqAPI(
                        LLM_API_ENDPOINT,
                        responseText,
                        result["llm-key"]
                    )
                        .then((response) => {
                            const responseText = processGroqResponse(response);
                            addMessage(responseText);
                        })
                        .catch((error) => {
                            appendAlert(error, "danger");
                            console.log(error);
                        });
                })
                .catch((error) => {
                    appendAlert(error, "danger");
                    console.log(error);
                })
                .finally(() => {
                    hideSpinner();
                });
        });
    }

    return true;
});

// Toggle settings panel
settingsBtn.addEventListener("click", () => {
    settingsPanel.classList.toggle("d-none");

    // Load existing settings
    chrome.storage.local.get(["ocr-key", "llm-key"], (result) => {
        ocrAPIKey.value = result["ocr-key"] || "";
        LLMAPIKey.value = result["llm-key"] || "";
    });
});

// Save settings
saveSettingsBtn.addEventListener("click", () => {
    chrome.storage.local.set(
        {
            "ocr-key": ocrAPIKey.value,
            "llm-key": LLMAPIKey.value,
        },
        () => {
            settingsPanel.classList.add("d-none");
        }
    );
});

async function postOCRRequest(endpoint, base64Data, ocrKey) {
    try {
        // Create FormData
        const formData = new FormData();
        formData.append("base64Image", base64Data);
        formData.append("OCREngine", "2");
        formData.append("apikey", ocrKey);
        formData.append("isOverlayRequired", "true");

        const response = await fetch(endpoint, {
            method: "POST",
            body: formData,
        });
        return await response.json();
    } catch (error) {
        console.error("Error:", error);
        throw error;
    }
}

const processOCRResponse = (response) => {
    let responseText = "";

    response?.ParsedResults?.forEach((result) => {
        responseText += ` ${result.ParsedText}`;
    });

    // Xử lý tất cả escape characters phổ biến
    return responseText
        .replace(/[\n\r\t\f\v\b]/g, " ") // Loại bỏ newline, carriage return, tab, form feed, vertical tab, backspace
        .replace(/\s+/g, " ") // Thay thế nhiều khoảng trắng liên tiếp bằng 1 khoảng trắng
        .trim()
        .toLowerCase(); // Xóa khoảng trắng đầu và cuối
};

async function callTranslateGroqAPI(endpoint, sentence, LLMAPIKey) {
    try {
        const response = await fetch(endpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${LLMAPIKey}`,
            },
            body: JSON.stringify({
                model: "gemma2-9b-it",
                messages: [
                    {
                        role: "system",
                        content: `You are a professional translator. Translate each word or sentence I provide from English to Vietnamese accurately, preserving the original meaning, tone, and style.
Additionally, explain the meanings of any words or phrases that may need clarification`,
                    },
                    {
                        role: "user",
                        content: "here you go! it's frozen barley tea.",
                    },
                    {
                        role: "assistant",
                        content: `Của bạn đây! Đây là trà mạch nha đông lạnh.

Giải nghĩa:

- Của bạn đây: Dùng để diễn tả việc đưa hoặc cung cấp một vật cho ai đó, tương tự như "Here you go" trong tiếng Anh. Trong ngữ cảnh này, có thể dịch là "Của bạn đây" để cảm giác tự nhiên hơn.
- trà mạch nha đông lạnh: "Frozen barley tea" là trà làm từ mạch nha (lúa mạch) đã được làm lạnh. "Trà mạch nha" (barley tea) là một loại trà phổ biến ở các nước châu Á, trong khi "đông lạnh" (frozen) chỉ ra rằng trà này đã được làm lạnh hoặc là trà mát lạnh.`,
                    },
                    {
                        role: "user",
                        content: `the members are the usual four...`,
                    },
                    {
                        role: "assistant",
                        content: `Các thành viên là bốn người như thường lệ...

Giải nghĩa:

- Các thành viên: "Members" chỉ những người trong một nhóm hoặc tổ chức.
- bốn người như thường lệ: "The usual four" có nghĩa là bốn người mà thường xuyên có mặt hoặc là thành viên cố định trong nhóm. Cụm từ "như thường lệ" thể hiện sự quen thuộc và không thay đổi.`,
                    },
                    {
                        role: "user",
                        content: `sorry, he couldn't make it!`,
                    },
                    {
                        role: "assistant",
                        content: `Xin lỗi, anh ấy không thể đến được!

Giải nghĩa:

- Xin lỗi: "Sorry" dùng để bày tỏ sự tiếc nuối hoặc xin lỗi về một tình huống không như mong muốn.
- anh ấy không thể đến được: "He couldn't make it" có nghĩa là anh ấy không thể tham dự hoặc không thể có mặt ở một sự kiện hoặc cuộc hẹn.`,
                    },
                    {
                        role: "user",
                        content: `seems like he had a last minute work thing.`,
                    },
                    {
                        role: "assistant",
                        content: `Có vẻ như anh ấy có một công việc gấp vào phút cuối.

Giải nghĩa:

- Có vẻ như: "Seems like" diễn tả một sự phỏng đoán, cảm giác hoặc nhận định về một tình huống.
- công việc gấp vào phút cuối: "Last minute work thing" chỉ một công việc hoặc nhiệm vụ đột ngột và phải giải quyết ngay trước khi một sự kiện xảy ra, thường là vào thời điểm rất gần.`,
                    },
                    {
                        role: "user",
                        content: sentence,
                    },
                ],
            }),
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error("Error calling Groq API:", error);
        throw error;
    }
}

function processGroqResponse(response) {
    try {
        // Parse response if it's a string
        const data = typeof response === 'string' ? JSON.parse(response) : response;

        // Extract content from the response structure
        let content = data?.choices?.[0]?.message?.content;
        if (content) {
            return content = content.trim();
        }

        // Handle empty or invalid response
        console.error('Invalid Groq API response format');
        return null;

    } catch (error) {
        console.error('Error processing Groq response:', error);
        return null;
    }
}

