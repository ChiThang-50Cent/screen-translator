console.log("Content script loaded");

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "screenshot_taken") {
        createCanvasOverlay(message.dataUrl);
    }
    return true;
});

function cropImage(img, selection) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = selection.width;
    canvas.height = selection.height;
    ctx.drawImage(
        img,
        selection.x, selection.y, selection.width, selection.height,
        0, 0, selection.width, selection.height
    );
    return canvas.toDataURL();
}

function createCanvasOverlay(screenshotUrl) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    canvas.style.position = 'fixed';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.zIndex = '10000';
    canvas.style.cursor = 'crosshair';

    let isDrawing = false;
    let startX, startY, width, height;

    img.onload = () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        document.body.appendChild(canvas);
    };
    img.src = screenshotUrl;

    canvas.addEventListener('mousedown', (e) => {
        isDrawing = true;
        startX = e.clientX;
        startY = e.clientY;
    });

    canvas.addEventListener('mousemove', (e) => {
        if (!isDrawing) return;
        const currentX = e.clientX;
        const currentY = e.clientY;
        width = currentX - startX;
        height = currentY - startY;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = 'red';
        ctx.strokeRect(startX, startY, width, height);
    });

    canvas.addEventListener('mouseup', () => {
        isDrawing = false;
        const selection = {
            x: startX,
            y: startY,
            width: width,
            height: height
        };
        const croppedDataUrl = cropImage(img, selection);
        document.body.removeChild(canvas);
    });
}