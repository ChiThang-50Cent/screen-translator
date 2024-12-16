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
        .replace(/[\n\r\t\f\v\b]/g, "") // Loại bỏ newline, carriage return, tab, form feed, vertical tab, backspace
        .replace(/\s+/g, " ") // Thay thế nhiều khoảng trắng liên tiếp bằng 1 khoảng trắng
        .trim(); // Xóa khoảng trắng đầu và cuối
};

async function callTranslateGroqAPI(endpoint, word, LLMAPIKey) {
    try {
        const response = await fetch(endpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${LLMAPIKey}`,
            },
            body: JSON.stringify({
                model: "llama-3.1-8b-instant",
                messages: [
                    {
                        role: "system",
                        content: `You are a professional translator. Translate English text into Vietnamese. For each response, include:

Translation: Provide the Vietnamese translation.
Explanation: Explain the meaning of the English word in both English and Vietnamese.
Examples:
One English example sentence.
One corresponding Vietnamese example sentence.

Ensure clarity and maintain the original tone and context of the English text.`,
                    },
                    {
                        role: "user",
                        content: "corresponding",
                    },
                    {
                        role: "assistant",
                        content: `Translations: tương ứng

Explanation: 
- English: This adjective describes a relationship between two or more things that have a logical connection or a direct relevance to each other.
- Vietnamese: Đây là tính từ mô tả mối quan hệ giữa hai hoặc nhiều thứ có mối liên hệ logic hoặc có liên quan trực tiếp với nhau.

Examples:
English: The data in the report corresponds to the results of the survey.
Translation: Dữ liệu trong báo cáo chính xác tương ứng với kết quả khảo sát.`,
                    },
                    {
                        role: "user",
                        content: word,
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
        if (data?.choices?.[0]?.message?.content) {
            return data.choices[0].message.content;
        }

        // Handle empty or invalid response
        console.error('Invalid Groq API response format');
        return null;

    } catch (error) {
        console.error('Error processing Groq response:', error);
        return null;
    }
}

