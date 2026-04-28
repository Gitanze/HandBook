const { app, BrowserWindow, globalShortcut, ipcMain, dialog, nativeImage, screen, desktopCapturer, clipboard } = require("electron");
const fs = require("fs");
const path = require("path");
const os = require("os");

const STORE_FILE = "journal-state.json";
const CAPTURE_SHORTCUT = "Shift+Alt+A";
const DEFAULT_DOUBAO_IMAGE_MODEL = "doubao-seedream-4-0-250828";
const DEFAULT_DOUBAO_BASE_URL = "https://ark.cn-beijing.volces.com/api/v3";

let mainWindow = null;
let overlayWindow = null;

function getStorePath() {
  return path.join(app.getPath("userData"), STORE_FILE);
}

/* ════════════════ Main Window ════════════════ */

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 520,
    height: 720,
    minWidth: 380,
    minHeight: 520,
    frame: false,
    resizable: true,
    alwaysOnTop: true,
    skipTaskbar: false,
    autoHideMenuBar: true,
    title: "Handmake Journal",
    backgroundColor: "#f3ebe0",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, "src", "index.html"));

  // F12 → DevTools
  mainWindow.webContents.on("before-input-event", (_event, input) => {
    if (input.key === "F12" && input.type === "keyDown") {
      mainWindow.webContents.toggleDevTools();
    }
  });

  mainWindow.on("closed", () => { mainWindow = null; });
}

/* ════════════════ Screenshot Capture ════════════════ */

async function captureScreen() {
  const cursorPoint = screen.getCursorScreenPoint();
  const activeDisplay = screen.getDisplayNearestPoint(cursorPoint);
  const { width, height } = activeDisplay.size;
  const scaleFactor = activeDisplay.scaleFactor || 1;

  try {
    const sources = await desktopCapturer.getSources({
      types: ["screen"],
      thumbnailSize: {
        width: Math.round(width * scaleFactor),
        height: Math.round(height * scaleFactor)
      }
    });

    const source = sources.find((s) => String(s.display_id) === String(activeDisplay.id)) || sources[0];

    if (!source) {
      console.error("No capture source found");
      return null;
    }

    return {
      dataUrl: source.thumbnail.toDataURL(),
      displayId: String(activeDisplay.id),
      bounds: activeDisplay.bounds
    };
  } catch (err) {
    console.error("Screen capture failed:", err);
    return null;
  }
}

function createOverlayWindow(captureData) {
  const bounds = captureData.bounds;

  overlayWindow = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    frame: false,
    resizable: false,
    movable: false,
    fullscreenable: true,
    fullscreen: true,
    alwaysOnTop: true,
    focusable: true,
    skipTaskbar: true,
    backgroundColor: "#000000",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  overlayWindow.loadFile(path.join(__dirname, "src", "overlay.html"));

  overlayWindow.webContents.once("did-finish-load", () => {
    overlayWindow.webContents.send("screenshot-data", captureData.dataUrl);
  });

  overlayWindow.on("closed", () => { overlayWindow = null; });
  return overlayWindow;
}

async function openCaptureOverlay() {
  if (overlayWindow) {
    overlayWindow.focus();
    return;
  }

  if (mainWindow) {
    mainWindow.hide();
  }

  await new Promise((resolve) => setTimeout(resolve, 200));

  const captureData = await captureScreen();
  if (!captureData) {
    if (mainWindow) { mainWindow.show(); mainWindow.focus(); }
    return;
  }

  const win = createOverlayWindow(captureData);
  win.once("ready-to-show", () => {
    win.show();
    win.focus();
  });
}

/* ════════════════ Persistence ════════════════ */

function loadState() {
  try {
    const raw = fs.readFileSync(getStorePath(), "utf8");
    return JSON.parse(raw);
  } catch {
    return { items: [], canvas: { width: 560, height: 780 } };
  }
}

function saveState(payload) {
  fs.mkdirSync(path.dirname(getStorePath()), { recursive: true });
  fs.writeFileSync(getStorePath(), JSON.stringify(payload, null, 2), "utf8");
}

function getDoubaoConfig() {
  const apiKey = process.env.DOUBAO_API_KEY || process.env.ARK_API_KEY || process.env.VOLCENGINE_API_KEY;
  const baseUrl = (process.env.DOUBAO_BASE_URL || process.env.ARK_BASE_URL || DEFAULT_DOUBAO_BASE_URL).replace(/\/$/, "");
  const model = process.env.DOUBAO_IMAGE_MODEL || DEFAULT_DOUBAO_IMAGE_MODEL;
  return { apiKey, baseUrl, model };
}

function normalizeBase64Image(value) {
  if (!value) return null;
  if (value.startsWith("data:image/")) return value;
  return `data:image/png;base64,${value}`;
}

async function fetchImageAsDataUrl(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Image download failed (${response.status})`);
  }
  const contentType = response.headers.get("content-type") || "image/png";
  const buffer = Buffer.from(await response.arrayBuffer());
  return `data:${contentType};base64,${buffer.toString("base64")}`;
}

async function generateDoubaoImage({ prompt, size = "1024x1024" }) {
  const cleanPrompt = String(prompt || "").trim();
  if (!cleanPrompt) throw new Error("Prompt is required");

  const { apiKey, baseUrl, model } = getDoubaoConfig();
  if (!apiKey) {
    throw new Error("Missing DOUBAO_API_KEY or ARK_API_KEY environment variable");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 180000);

  try {
    const response = await fetch(`${baseUrl}/images/generations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        prompt: cleanPrompt,
        size,
        response_format: "b64_json",
        watermark: false
      }),
      signal: controller.signal
    });

    const text = await response.text();
    let payload = null;
    try { payload = text ? JSON.parse(text) : null; } catch { /* keep raw text for error below */ }

    if (!response.ok) {
      const message = payload?.error?.message || payload?.message || text || `Request failed (${response.status})`;
      throw new Error(message);
    }

    const first = payload?.data?.[0] || payload?.data?.images?.[0] || payload?.result?.data?.[0];
    const dataUrl = normalizeBase64Image(first?.b64_json || first?.base64 || first?.image_base64);
    if (dataUrl) return dataUrl;

    const imageUrl = first?.url || first?.image_url || first;
    if (typeof imageUrl === "string" && /^https?:\/\//i.test(imageUrl)) {
      return await fetchImageAsDataUrl(imageUrl);
    }

    throw new Error("No image returned from Doubao");
  } finally {
    clearTimeout(timeout);
  }
}

/* ════════════════ App Lifecycle ════════════════ */

app.whenReady().then(() => {
  createMainWindow();

  globalShortcut.unregisterAll();
  globalShortcut.register(CAPTURE_SHORTCUT, () => { openCaptureOverlay(); });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("will-quit", () => { globalShortcut.unregisterAll(); });

/* ════════════════ IPC Handlers ════════════════ */

ipcMain.handle("window:command", (_event, command) => {
  if (!mainWindow) return false;
  switch (command) {
    case "minimize": mainWindow.minimize(); return true;
    case "toggle-pin":
      mainWindow.setAlwaysOnTop(!mainWindow.isAlwaysOnTop());
      return mainWindow.isAlwaysOnTop();
    case "close": mainWindow.close(); return true;
    default: return false;
  }
});

ipcMain.handle("capture:start", () => {
  openCaptureOverlay();
  return true;
});

ipcMain.handle("capture:complete", (_event, imageDataUrl) => {
  if (overlayWindow) { overlayWindow.close(); }
  if (mainWindow && imageDataUrl) {
    mainWindow.show();
    mainWindow.focus();
    mainWindow.webContents.send("capture:created", imageDataUrl);
  }
  return true;
});

ipcMain.handle("capture:cancel", () => {
  if (overlayWindow) { overlayWindow.close(); }
  if (mainWindow) { mainWindow.show(); mainWindow.focus(); }
  return true;
});

ipcMain.handle("file:pick-image", async () => {
  const result = await dialog.showOpenDialog({
    title: "导入图片",
    properties: ["openFile"],
    filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp", "gif", "bmp"] }]
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  const img = nativeImage.createFromPath(result.filePaths[0]);
  return img.isEmpty() ? null : img.toDataURL();
});

ipcMain.handle("journal:load", () => loadState());

ipcMain.handle("journal:save", (_event, payload) => {
  saveState(payload);
  return true;
});

/* ════════════════ Clipboard ════════════════ */

ipcMain.handle("clipboard:read-image", () => {
  const img = clipboard.readImage();
  return img.isEmpty() ? null : img.toDataURL();
});

/* ════════════════ Export ════════════════ */

ipcMain.handle("ai:generate-image", async (_event, args) => {
  return await generateDoubaoImage(args || {});
});

// Decode a base64 data URL to a Buffer
function dataUrlToBuffer(dataUrl) {
  const base64 = dataUrl.split(",")[1];
  return Buffer.from(base64, "base64");
}

ipcMain.handle("export:save-jpg", async (_event, { dataUrls }) => {
  if (!dataUrls || !dataUrls.length) return false;

  if (dataUrls.length === 1) {
    // Single page: show save dialog
    const result = await dialog.showSaveDialog(mainWindow, {
      title: "导出 JPG",
      defaultPath: "handmake-page.jpg",
      filters: [{ name: "JPEG 图片", extensions: ["jpg", "jpeg"] }]
    });
    if (result.canceled || !result.filePath) return false;
    fs.writeFileSync(result.filePath, dataUrlToBuffer(dataUrls[0]));
    return true;
  } else {
    // Multiple pages: pick a folder, then save page_1.jpg, page_2.jpg, ...
    const result = await dialog.showOpenDialog(mainWindow, {
      title: "选择保存文件夹（将依次保存每页为 page_N.jpg）",
      properties: ["openDirectory", "createDirectory"]
    });
    if (result.canceled || !result.filePaths.length) return false;
    const dir = result.filePaths[0];
    dataUrls.forEach((url, i) => {
      const filePath = path.join(dir, `page_${i + 1}.jpg`);
      fs.writeFileSync(filePath, dataUrlToBuffer(url));
    });
    return true;
  }
});

ipcMain.handle("export:save-pdf", async (_event, { dataUrls }) => {
  if (!dataUrls || !dataUrls.length) return false;

  // Show save dialog first
  const result = await dialog.showSaveDialog(mainWindow, {
    title: "导出 PDF",
    defaultPath: "handmake.pdf",
    filters: [{ name: "PDF 文档", extensions: ["pdf"] }]
  });
  if (result.canceled || !result.filePath) return false;
  const savePath = result.filePath;

  // Build a temporary HTML file with one img per page
  const imgTags = dataUrls.map((url) =>
    `<div class="page"><img src="${url}" /></div>`
  ).join("\n");

  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8"/>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { background: white; }
.page {
  width: 148mm;
  height: 206mm;
  overflow: hidden;
  page-break-after: always;
  page-break-inside: avoid;
}
.page img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
</style>
</head>
<body>${imgTags}</body>
</html>`;

  const tempPath = path.join(os.tmpdir(), `handmake-export-${Date.now()}.html`);
  fs.writeFileSync(tempPath, html, "utf8");

  // Create a hidden BrowserWindow to render the HTML
  const printWin = new BrowserWindow({
    show: false,
    width: 600,
    height: 800,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  try {
    await printWin.loadFile(tempPath);

    // Wait a moment for images to fully render
    await new Promise((resolve) => setTimeout(resolve, 800));

    const pdfBuffer = await printWin.webContents.printToPDF({
      // Page size in microns: 148mm x 206mm
      pageSize: { width: 148000, height: 206000 },
      marginsType: 1, // no margins
      printBackground: true,
      landscape: false
    });

    fs.writeFileSync(savePath, pdfBuffer);
    return true;
  } finally {
    printWin.close();
    try { fs.unlinkSync(tempPath); } catch(e) { /* ignore cleanup errors */ }
  }
});
