const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("journalApi", {
  // Window controls
  commandWindow: (command) => ipcRenderer.invoke("window:command", command),

  // Capture
  startCapture: () => ipcRenderer.invoke("capture:start"),
  completeCapture: (imageDataUrl) => ipcRenderer.invoke("capture:complete", imageDataUrl),
  cancelCapture: () => ipcRenderer.invoke("capture:cancel"),

  // Screenshot data pushed from main process
  onScreenshotData: (callback) => {
    ipcRenderer.on("screenshot-data", (_event, dataUrl) => callback(dataUrl));
  },

  // Capture result pushed from main process
  onCaptureCreated: (callback) => {
    ipcRenderer.on("capture:created", (_event, imageDataUrl) => callback(imageDataUrl));
  },

  // File picker
  pickImage: () => ipcRenderer.invoke("file:pick-image"),

  // Journal persistence
  loadJournal: () => ipcRenderer.invoke("journal:load"),
  saveJournal: (payload) => ipcRenderer.invoke("journal:save", payload),

  // Clipboard image read (for paste from system clipboard)
  readClipboardImage: () => ipcRenderer.invoke("clipboard:read-image"),

  // Export
  saveExportJpg: (args) => ipcRenderer.invoke("export:save-jpg", args),
  saveExportPdf: (args) => ipcRenderer.invoke("export:save-pdf", args),
});
