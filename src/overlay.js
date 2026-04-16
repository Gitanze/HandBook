const screenshotLayer = document.getElementById("screenshotLayer");
const dimLayer = document.getElementById("dimLayer");
const selectionBox = document.getElementById("selectionBox");

let screenshotImage = null;
let anchor = null;
let phase = "idle"; // idle → anchored → committed

function normalizeRect(a, b) {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    w: Math.abs(b.x - a.x),
    h: Math.abs(b.y - a.y)
  };
}

function showSelection(r) {
  selectionBox.classList.remove("hidden");
  selectionBox.style.left = `${r.x}px`;
  selectionBox.style.top = `${r.y}px`;
  selectionBox.style.width = `${r.w}px`;
  selectionBox.style.height = `${r.h}px`;
}

// Receive screenshot from main process via IPC
window.journalApi.onScreenshotData((dataUrl) => {
  screenshotLayer.src = dataUrl;
  screenshotImage = new Image();
  screenshotImage.src = dataUrl;
});

// ESC to cancel
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    window.journalApi.cancelCapture();
  }
});

// Click to anchor, click again to commit
window.addEventListener("click", async (e) => {
  if (phase === "committed") return;

  if (phase === "idle") {
    anchor = { x: e.clientX, y: e.clientY };
    phase = "anchored";
    showSelection({ x: e.clientX, y: e.clientY, w: 0, h: 0 });
    dimLayer.style.display = "none";
    return;
  }

  if (phase === "anchored" && anchor && screenshotImage) {
    const r = normalizeRect(anchor, { x: e.clientX, y: e.clientY });
    anchor = null;

    if (r.w < 8 || r.h < 8) {
      selectionBox.classList.add("hidden");
      dimLayer.style.display = "block";
      phase = "idle";
      return;
    }

    phase = "committed";

    // Crop the selected region
    const rx = screenshotImage.naturalWidth / window.innerWidth;
    const ry = screenshotImage.naturalHeight / window.innerHeight;
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(r.w * rx));
    canvas.height = Math.max(1, Math.round(r.h * ry));
    const ctx = canvas.getContext("2d");
    ctx.drawImage(
      screenshotImage,
      r.x * rx, r.y * ry, r.w * rx, r.h * ry,
      0, 0, canvas.width, canvas.height
    );

    selectionBox.classList.add("hidden");
    await window.journalApi.completeCapture(canvas.toDataURL("image/png"));
  }
});

// Mouse move → update selection box
window.addEventListener("pointermove", (e) => {
  if (phase !== "anchored" || !anchor) return;
  showSelection(normalizeRect(anchor, { x: e.clientX, y: e.clientY }));
});
