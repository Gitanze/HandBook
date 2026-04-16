const { app, BrowserWindow, globalShortcut, ipcMain, dialog, nativeImage, screen, desktopCapturer } = require("electron");
const fs = require("fs");
const path = require("path");

const STORE_FILE = "journal-state.json";
const CAPTURE_SHORTCUT = "Shift+A";

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

  mainWindow.setAspectRatio(3 / 4);
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
  // Take screenshot BEFORE showing overlay, so we don't capture the overlay itself
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

    // Find the matching display
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
    // Send the pre-captured screenshot data to the overlay
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

  // Hide main window first so it's not in the screenshot
  if (mainWindow) {
    mainWindow.hide();
  }

  // Small delay to ensure window is hidden before capture
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
