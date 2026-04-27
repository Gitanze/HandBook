/* ── Handmake Journal — App ── */

const W = 560, H = 780;

const $ = (s) => document.getElementById(s);
const stage          = $("stage");
const viewport       = $("viewport");
const wrapper        = $("wrapper");
const tpl            = $("itemTpl");
const controls       = $("selControls");
const multiSelControls = $("multiSelControls");
const multiSelCount  = $("multiSelCount");
const opSlider       = $("opacitySlider");
const bgColorInput   = $("bgColorInput");
const bgAlphaSlider  = $("bgAlphaSlider");
const tapeStyleBrushBtn = $("tapeStyleBrushBtn");
const saveLabel      = $("saveStatus");
const emptyHint      = $("emptyHint");
const pageLabel      = $("pageLabel");
const prevPageBtn    = $("prevPageBtn");
const nextPageBtn    = $("nextPageBtn");
const rubberBand     = $("rubberBand");
const groupBox       = $("groupBox");
const lassoCanvas    = $("lassoCanvas");
const lassoBtn       = $("lassoBtn");
const wandBtn        = $("wandBtn");
const wandToleranceWrap = $("wandToleranceWrap");
const wandToleranceSlider = $("wandToleranceSlider");
const wandToleranceLabel  = $("wandToleranceLabel");
const fxGrayBtn        = $("fxGrayBtn");
const fxPixelBtn       = $("fxPixelBtn");
const pixelSizeSlider  = $("pixelSizeSlider");
const pixelSizeLabel   = $("pixelSizeLabel");
const fxPopBtn         = $("fxPopBtn");
const fxGradBtn        = $("fxGradBtn");
const gradFromColor    = $("gradFromColor");
const gradToColor      = $("gradToColor");
const gradApplyBtn     = $("gradApplyBtn");
const toolPanel        = $("toolPanel");
const punchGroupBtn    = $("punchGroupBtn");
const cutoutGroupBtn   = $("cutoutGroupBtn");
const styleGroupBtn    = $("styleGroupBtn");
const tpPunch          = $("tpPunch");
const tpCutout         = $("tpCutout");
const tpStyle          = $("tpStyle");
const shell            = document.querySelector(".shell");

/* Tape tool preview */
const tapePreview   = $("tapePreview");
const tapeStartDot  = $("tapeStartDot");
const TAPE_H = 30; // tape strip thickness (px)

/* Typography controls (text items) */
const textFontSelect  = $("textFontSelect");
const textSizeDisplay = $("textSizeDisplay");
const textSizeDownBtn = $("textSizeDown");
const textSizeUpBtn   = $("textSizeUp");
const textLhDisplay   = $("textLhDisplay");
const textLhDownBtn   = $("textLhDown");
const textLhUpBtn     = $("textLhUp");
const textColorInput  = $("textColorInput");

const MAX_PAGES = 10;
/* ── Multi-notebook state ── */
const state = { notebooks: [], activeNotebook: null, pageIdx: 0, selIds: [] };
let saveTimer = null, scale = 1;

function curNotebook() {
  return state.notebooks.find(nb => nb.id === state.activeNotebook) || null;
}
function curPages() { return curNotebook()?.pages || [{ items: [] }]; }
function curItems() { return curPages()[state.pageIdx]?.items || []; }

/* ═══ Tool States ═══ */
const punchCursor     = $("punchCursor");
const punchSizeWrap   = $("punchSizeWrap");
const punchSizeSlider = $("punchSizeSlider");
const punchSizeLabel  = $("punchSizeLabel");
const punch = { active: false, shape: null, size: 80, rotation: 0 };
const lasso = { active: false, drawing: false, targetItem: null, points: [] };
const wand  = { active: false, tolerance: 30 };
const tape  = { active: false, startPt: null };
const tapeStyleBrush = { active: false, sample: null };

/* ═══ Undo History ═══ */
const MAX_HISTORY = 10;
const history = [];

function pushHistory() {
  history.push(JSON.parse(JSON.stringify(curPages())));
  if (history.length > MAX_HISTORY) history.shift();
}

function undo() {
  if (!history.length) return;
  const nb = curNotebook();
  if (!nb) return;
  nb.pages = history.pop();
  state.pageIdx = Math.min(state.pageIdx, nb.pages.length - 1);
  state.selIds = [];
  render(); syncUI(); syncPageUI(); dirty();
}

/* ═══ App Clipboard ═══ */
let appClipboard = null;

function copySelected() {
  const item = sel();
  if (item) appClipboard = JSON.parse(JSON.stringify(item));
}

async function pasteItem() {
  if (appClipboard) {
    pushHistory();
    const newItem = {
      ...JSON.parse(JSON.stringify(appClipboard)),
      id: uid(),
      x: Math.min(appClipboard.x + 20, W - 40),
      y: Math.min(appClipboard.y + 20, H - 40)
    };
    curItems().push(newItem);
    render(); selectOne(newItem.id); dirty();
  } else {
    try {
      const dataUrl = await window.journalApi.readClipboardImage();
      if (dataUrl) { pushHistory(); addImage(dataUrl); }
    } catch(e) { console.error("paste from clipboard failed", e); }
  }
}

/* ═══ Helpers ═══ */

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2,7); }
function clamp(v,lo,hi) { return Math.min(Math.max(v,lo),hi); }
function rnd(r) { return Math.round(Math.random()*r - r/2); }

function hexAlphaToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function dirty() {
  saveLabel.textContent = "保存中…";
  clearTimeout(saveTimer);
  saveTimer = setTimeout(save, 500);
}
async function save() {
  try {
    await window.journalApi.saveJournal({
      notebooks: state.notebooks,
      activeNotebook: state.activeNotebook,
      canvas: { width: W, height: H }
    });
    saveLabel.textContent = "已保存";
  } catch(e) { console.error("save err",e); saveLabel.textContent = "保存失败"; }
}

/* ═══ Viewport fit ═══ */

function fit() {
  const vw = viewport.clientWidth;
  const vh = viewport.clientHeight;
  scale = Math.min(vw/W, vh/H, 1);
  wrapper.style.width = W+"px";
  wrapper.style.height = H+"px";
  wrapper.style.transform = `scale(${scale})`;
}

/* ═══ Selection ═══ */

function sel() {
  return state.selIds.length === 1
    ? curItems().find(i => i.id === state.selIds[0]) || null
    : null;
}
function selItems() { return curItems().filter(i => state.selIds.includes(i.id)); }

function selectOne(id) {
  state.selIds = id ? [id] : [];
  updateSelectionDOM();
  syncUI();
}

function selectMulti(ids) {
  state.selIds = [...ids];
  updateSelectionDOM();
  syncUI();
}

function updateSelectionDOM() {
  const ids = state.selIds;
  stage.querySelectorAll(".item").forEach(el => {
    el.classList.toggle("selected", ids.includes(el.dataset.id));
  });
  // Group mode class on stage (hides individual handles when multi-select)
  stage.classList.toggle("group-mode", ids.length > 1);
  updateGroupBox();
}

function tapeStyleFrom(item) {
  return {
    bgColor: item.bgColor || "#fffdf8",
    bgAlpha: item.bgAlpha != null ? item.bgAlpha : 0.92,
    opacity: item.opacity != null ? item.opacity : 1
  };
}

function applyTapeStyle(item, style) {
  item.bgColor = style.bgColor;
  item.bgAlpha = style.bgAlpha;
  item.opacity = style.opacity;
}

function setTapeBrushActive(active) {
  tapeStyleBrush.active = active;
  if (!active) tapeStyleBrush.sample = null;
  tapeStyleBrushBtn?.classList.toggle("active", active);
  stage.classList.toggle("tape-brush-mode", active);
}

function syncUI() {
  const count = state.selIds.length;
  if (count === 0) {
    controls.classList.add("hidden");
    multiSelControls.classList.add("hidden");
  } else if (count === 1) {
    const s = sel();
    controls.classList.remove("hidden");
    multiSelControls.classList.add("hidden");
    if (s) {
      opSlider.value = s.opacity;
      const isTape = s.type === "tape";
      const isText = s.type === "text";
      controls.classList.toggle("show-tape", isTape);
      controls.classList.toggle("show-text", isText);
      if (isTape) {
        bgColorInput.value = s.bgColor || "#fffdf8";
        bgAlphaSlider.value = s.bgAlpha != null ? s.bgAlpha : 0.92;
      }
      if (isText) {
        textFontSelect.value = s.fontFamily || "'Segoe UI','Microsoft YaHei',sans-serif";
        textSizeDisplay.textContent = s.fontSize || 14;
        textLhDisplay.textContent = Math.round((s.lineHeight || 1.6) * 10) / 10;
        textColorInput.value = s.color || "#3d2b1f";
      }
    }
  } else {
    controls.classList.add("hidden");
    multiSelControls.classList.remove("hidden");
    multiSelCount.textContent = `${count} 个素材`;
  }
}

/* ═══ Text Edit Helper ═══ */

function bindTextEdit(el, txt, item) {
  txt.addEventListener("input", () => { item.text = txt.textContent; dirty(); });
  txt.addEventListener("blur", () => {
    txt.contentEditable = "false";
    txt.classList.remove("editing");
    item.text = txt.textContent;
    dirty();
  });
  el.addEventListener("dblclick", e => {
    if (e.target.closest(".rh") || e.target.closest(".rotate-ring")) return;
    txt.contentEditable = "true";
    txt.classList.add("editing");
    txt.focus();
  });
}

/* ═══ Render ═══ */

function css(item, el) {
  el.style.left   = item.x+"px";
  el.style.top    = item.y+"px";
  el.style.width  = item.width+"px";
  if (item.tapeHeight != null) {
    el.style.height = item.tapeHeight+"px";
    el.dataset.tapeH = "1"; // triggers CSS for height:100% on .item-text
  }
  el.style.opacity = item.opacity;
  el.style.zIndex  = item.zIndex;
  el.style.transform = `rotate(${item.rotation}deg)`;
}

function render() {
  const items = curItems();
  items.forEach((item,i) => { item.zIndex = i+1; });
  if (emptyHint) emptyHint.style.display = items.length ? "none" : "flex";

  stage.querySelectorAll(".item").forEach(e => e.remove());

  items.forEach(item => {
    const frag = tpl.content.cloneNode(true);
    const el   = frag.querySelector(".item");
    const img  = frag.querySelector(".item-img");
    const txt  = frag.querySelector(".item-text");

    el.dataset.id = item.id;
    el.classList.toggle("selected", state.selIds.includes(item.id));
    css(item, el);

    if (item.type === "image") {
      img.src = item.src;
      txt.style.display = "none";
    } else if (item.type === "tape") {
      img.style.display = "none";
      txt.textContent = item.text || "";
      const bg = item.bgColor || "#fffdf8";
      const ba = item.bgAlpha != null ? item.bgAlpha : 0.92;
      txt.style.background = hexAlphaToRgba(bg, ba);
      // Override min-width/min-height so tape respects the exact item dimensions
      if (item.tapeHeight != null) {
        txt.style.width    = "100%";
        txt.style.minWidth = "0";
          txt.style.height   = "100%";
          txt.style.minHeight = "0";
      }
      (item.holes || []).forEach(hole => {
        const holeEl = document.createElement("div");
        holeEl.className = `tape-hole tape-hole-${hole.shape || "circle"}`;
        const sz = hole.size || punch.size;
        holeEl.style.left = ((hole.x || 0) - sz / 2) + "px";
        holeEl.style.top = ((hole.y || 0) - sz / 2) + "px";
        holeEl.style.width = sz + "px";
        holeEl.style.height = sz + "px";
        holeEl.style.transform = `rotate(${hole.rotation || 0}deg)`;
        el.appendChild(holeEl);
      });
      bindTextEdit(el, txt, item);
    } else {
      // type === "text" — pure typographic, no background
      img.style.display = "none";
      el.dataset.type = "text";
      txt.textContent = item.text || "";
      txt.style.color = item.color || "#3d2b1f";
      txt.style.fontFamily = item.fontFamily || "'Segoe UI','Microsoft YaHei',sans-serif";
      txt.style.fontSize = (item.fontSize || 14) + "px";
      txt.style.lineHeight = item.lineHeight || 1.6;
      bindTextEdit(el, txt, item);
    }

    bindDrag(el, item);
    bindResize(el, item);
    bindRotate(el, item);

    el.addEventListener("mousedown", e => {
      if (tapeStyleBrush.active) {
        e.preventDefault();
        e.stopPropagation();
        if (item.type === "tape" && tapeStyleBrush.sample) {
          pushHistory();
          applyTapeStyle(item, tapeStyleBrush.sample);
          render();
          selectOne(item.id);
          dirty();
        }
        return;
      }
      if (punch.active || lasso.active || wand.active || tape.active) return;
      if (e.target.closest(".rh") || e.target.closest(".rotate-ring")) return;
      if (e.shiftKey) {
        // Shift+click: toggle item in/out of multi-select
        e.stopPropagation();
        const newIds = state.selIds.includes(item.id)
          ? state.selIds.filter(id => id !== item.id)
          : [...state.selIds, item.id];
        if (newIds.length <= 1) selectOne(newIds[0] || null);
        else selectMulti(newIds);
      } else if (!state.selIds.includes(item.id)) {
        selectOne(item.id);
      }
      // If already in multi-select (no shift), keep selection so drag works
    });

    stage.appendChild(frag);

    if (item.type === "tape" || item.type === "text") {
      requestAnimationFrame(() => {
        const appended = stage.querySelector(`[data-id="${item.id}"] .item-text`);
        if (appended) item._domHeight = appended.offsetHeight || 60;
      });
    }
  });

  updateGroupBox();
}

/* ═══ Drag ═══ */

function bindDrag(el, item) {
  el.addEventListener("mousedown", e => {
    if (punch.active || lasso.active || wand.active || tape.active || tapeStyleBrush.active || e.button !== 0) return;
    if (e.target.closest(".rh") || e.target.closest(".rotate-ring") || e.target.closest(".item-text.editing")) return;
    e.preventDefault();
    e.stopPropagation();

    const isGroup = state.selIds.length > 1 && state.selIds.includes(item.id);

    if (isGroup) {
      // Group move: all selected items move together
      pushHistory();
      const startX = e.clientX, startY = e.clientY;
      const startPositions = selItems().map(it => ({ id: it.id, x: it.x, y: it.y }));

      function onMove(ev) {
        const dx = (ev.clientX - startX) / scale;
        const dy = (ev.clientY - startY) / scale;
        startPositions.forEach(sp => {
          const it = curItems().find(i => i.id === sp.id);
          if (!it) return;
          it.x = clamp(sp.x + dx, -it.width + 30, W - 30);
          it.y = clamp(sp.y + dy, -30, H - 30);
          const itemEl = stage.querySelector(`[data-id="${it.id}"]`);
          if (itemEl) css(it, itemEl);
        });
        updateGroupBox();
      }
      function onUp() {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        dirty();
      }
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    } else {
      // Single item drag
      pushHistory();
      const startX = e.clientX, startY = e.clientY;
      const ix = item.x, iy = item.y;
      el.classList.add("dragging");

      function onMove(ev) {
        item.x = clamp(ix + (ev.clientX - startX) / scale, -item.width + 30, W - 30);
        item.y = clamp(iy + (ev.clientY - startY) / scale, -30, H - 30);
        css(item, el);
      }
      function onUp() {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        el.classList.remove("dragging");
        dirty();
      }
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    }
  });
}

/* ═══ Resize ═══ */

function bindResize(el, item) {
  el.querySelectorAll(".rh").forEach(h => {
    h.addEventListener("mousedown", e => {
      if (punch.active || tape.active || tapeStyleBrush.active || e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      pushHistory();
      const startX = e.clientX, startY = e.clientY;
      const sw = item.width, sx = item.x;
      const isL = h.classList.contains("rh-nw") || h.classList.contains("rh-sw");
      const isN = h.classList.contains("rh-nw") || h.classList.contains("rh-ne");
      selectOne(item.id);

      function onMove(ev) {
        const dx = (ev.clientX - startX) / scale;
        const dy = (ev.clientY - startY) / scale;
        const growth = Math.abs(dx) >= Math.abs(dy)
          ? (isL ? -dx : dx)
          : (isN ? -dy : dy);
        const nw = clamp(sw + growth, 10, W - 60);
        item.width = nw;
        if (isL) item.x = sx + (sw - nw);
        css(item, el);
      }
      function onUp() {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        dirty();
      }
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    });
  });
}

/* ═══ Rotate ═══ */

function bindRotate(el, item) {
  const ring = el.querySelector(".rotate-ring");
  if (!ring) return;

  ring.addEventListener("mousedown", e => {
    if (punch.active || tape.active || tapeStyleBrush.active || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    pushHistory();
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const base = Math.atan2(e.clientY - cy, e.clientX - cx) * 180 / Math.PI - item.rotation;
    selectOne(item.id);

    function onMove(ev) {
      const r2 = el.getBoundingClientRect();
      const cx2 = r2.left + r2.width / 2, cy2 = r2.top + r2.height / 2;
      let deg = Math.round(Math.atan2(ev.clientY - cy2, ev.clientX - cx2) * 180 / Math.PI - base);
      deg = ((deg % 360) + 360) % 360;
      if (deg > 180) deg -= 360;
      item.rotation = deg;
      css(item, el);
    }
    function onUp() {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      dirty();
    }
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  });
}

/* ═══ Add Items ═══ */

function addImage(src) {
  const items = curItems();
  const w = 180;
  items.push({
    id: uid(), type: "image", src,
    x: Math.round((W-w)/2) + rnd(40),
    y: Math.round(H/3) + rnd(40),
    width: w, rotation: rnd(6), opacity: 1, zIndex: items.length+1
  });
  render();
  selectOne(items[items.length-1].id);
  dirty();
}

function addTape() {
  const items = curItems();
  const w = 150;
  items.push({
    id: uid(), type: "tape", text: "",
    x: Math.round((W-w)/2) + rnd(40),
    y: Math.round(H/3) + rnd(40),
    width: w, rotation: rnd(4), opacity: 1, zIndex: items.length+1,
    bgColor: "#fffdf8", bgAlpha: 0.92
  });
  render();
  selectOne(items[items.length-1].id);
  dirty();
}

function addText() {
  const items = curItems();
  const w = 200;
  items.push({
    id: uid(), type: "text", text: "",
    x: Math.round((W-w)/2) + rnd(40),
    y: Math.round(H/3) + rnd(40),
    width: w, rotation: 0, opacity: 1, zIndex: items.length+1,
    fontFamily: "'Segoe UI','Microsoft YaHei',sans-serif",
    fontSize: 14,
    lineHeight: 1.6,
    color: "#3d2b1f"
  });
  render();
  selectOne(items[items.length-1].id);
  dirty();
}

/* ═══ Reorder ═══ */

function reorder(dir) {
  const primaryId = state.selIds[0];
  if (!primaryId) return;
  pushHistory();
  const items = curItems();
  const idx = items.findIndex(i => i.id === primaryId);
  if (idx < 0) return;
  if (dir === "up" && idx < items.length-1)
    [items[idx],items[idx+1]] = [items[idx+1],items[idx]];
  if (dir === "down" && idx > 0)
    [items[idx],items[idx-1]] = [items[idx-1],items[idx]];
  render(); dirty();
}

/* ═══ Pagination ═══ */

function syncPageUI() {
  const pages = curPages();
  pageLabel.textContent = `${state.pageIdx + 1} / ${pages.length}`;
  prevPageBtn.disabled = state.pageIdx === 0;
  nextPageBtn.disabled = state.pageIdx >= MAX_PAGES - 1;
  const deletePageBtn = $("deletePageBtn");
  if (deletePageBtn) deletePageBtn.disabled = pages.length <= 1;
}

function goPage(idx) {
  const pages = curPages();
  if (idx < 0 || idx >= pages.length || idx === state.pageIdx) return;
  state.selIds = [];
  state.pageIdx = idx;
  render(); syncUI(); syncPageUI();
  renderStageBg(pages[idx]);
}

function prevPage() { goPage(state.pageIdx - 1); }

function nextPage() {
  const nb = curNotebook();
  if (!nb) return;
  if (state.pageIdx + 1 >= nb.pages.length) {
    if (nb.pages.length >= MAX_PAGES) return;
    nb.pages.push({ items: [] });
    dirty();
  }
  goPage(state.pageIdx + 1);
}

/* ═══ Delete Page ═══ */

function deletePage() {
  const nb = curNotebook();
  if (!nb || nb.pages.length <= 1) return;
  pushHistory();
  nb.pages.splice(state.pageIdx, 1);
  state.pageIdx = Math.min(state.pageIdx, nb.pages.length - 1);
  state.selIds = [];
  render(); syncUI(); syncPageUI(); dirty();
}

/* ═══ Group Box Helpers ═══ */

function getItemAABB(item) {
  const el = stage.querySelector(`[data-id="${item.id}"]`);
  const h = el ? el.offsetHeight : item.width;
  return { x: item.x, y: item.y, w: item.width, h };
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x &&
         a.y < b.y + b.h && a.y + a.h > b.y;
}

function getGroupAABB() {
  let x1=Infinity, y1=Infinity, x2=-Infinity, y2=-Infinity;
  selItems().forEach(item => {
    const { x, y, w, h } = getItemAABB(item);
    x1 = Math.min(x1, x); y1 = Math.min(y1, y);
    x2 = Math.max(x2, x+w); y2 = Math.max(y2, y+h);
  });
  if (!isFinite(x1)) return null;
  return { x:x1, y:y1, w:x2-x1, h:y2-y1, cx:(x1+x2)/2, cy:(y1+y2)/2 };
}

function updateGroupBox() {
  if (state.selIds.length < 2) {
    groupBox.classList.add("hidden");
    return;
  }
  const aabb = getGroupAABB();
  if (!aabb) { groupBox.classList.add("hidden"); return; }
  const pad = 8;
  groupBox.style.left   = (aabb.x - pad) + "px";
  groupBox.style.top    = (aabb.y - pad) + "px";
  groupBox.style.width  = (aabb.w + pad*2) + "px";
  groupBox.style.height = (aabb.h + pad*2) + "px";
  groupBox.classList.remove("hidden");
}

function bindGroupBox() {
  // Scale handles
  groupBox.querySelectorAll(".gbh-scale").forEach(handle => {
    handle.addEventListener("mousedown", e => {
      if (e.button !== 0) return;
      e.preventDefault(); e.stopPropagation();
      pushHistory();
      const aabb = getGroupAABB();
      if (!aabb) return;
      const startClient = { x: e.clientX, y: e.clientY };
      const startW = aabb.w, startH = aabb.h;
      const isL = handle.classList.contains("gbh-nw") || handle.classList.contains("gbh-sw");
      const isN = handle.classList.contains("gbh-nw") || handle.classList.contains("gbh-ne");
      const startPositions = selItems().map(it => ({
        id: it.id, x: it.x, y: it.y, width: it.width
      }));

      function onMove(ev) {
        const dx = (ev.clientX - startClient.x) / scale;
        const dy = (ev.clientY - startClient.y) / scale;
        const growth = Math.abs(dx) >= Math.abs(dy)
          ? (isL ? -dx : dx)
          : (isN ? -dy : dy);
        const newW = Math.max(60, startW + growth);
        const ratio = newW / startW;
        startPositions.forEach(sp => {
          const it = curItems().find(i => i.id === sp.id);
          if (!it) return;
          it.x = aabb.cx + (sp.x - aabb.cx) * ratio;
          it.y = aabb.cy + (sp.y - aabb.cy) * ratio;
          it.width = Math.max(20, sp.width * ratio);
          const el = stage.querySelector(`[data-id="${it.id}"]`);
          if (el) css(it, el);
        });
        updateGroupBox();
      }
      function onUp() {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        dirty();
      }
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    });
  });

  // Rotate handle
  const rotHandle = groupBox.querySelector(".gbh-rot");
  if (rotHandle) {
    rotHandle.addEventListener("mousedown", e => {
      if (e.button !== 0) return;
      e.preventDefault(); e.stopPropagation();
      pushHistory();
      const aabb = getGroupAABB();
      if (!aabb) return;
      const stageRect = wrapper.getBoundingClientRect();
      const screenCx = stageRect.left + aabb.cx * scale;
      const screenCy = stageRect.top  + aabb.cy * scale;
      const startAngle = Math.atan2(e.clientY - screenCy, e.clientX - screenCx);
      const startData = selItems().map(it => {
        const el = stage.querySelector(`[data-id="${it.id}"]`);
        const h = el ? el.offsetHeight : it.width;
        return { id: it.id, rotation: it.rotation,
                 cx: it.x + it.width / 2, cy: it.y + h / 2 };
      });

      function onMove(ev) {
        const curAngle = Math.atan2(ev.clientY - screenCy, ev.clientX - screenCx);
        const delta    = curAngle - startAngle;
        const deltaDeg = delta * 180 / Math.PI;
        startData.forEach(sp => {
          const it = curItems().find(i => i.id === sp.id);
          if (!it) return;
          const el  = stage.querySelector(`[data-id="${it.id}"]`);
          const h   = el ? el.offsetHeight : it.width;
          const dx  = sp.cx - aabb.cx, dy = sp.cy - aabb.cy;
          const dist = Math.hypot(dx, dy);
          const oldA = Math.atan2(dy, dx);
          const newA = oldA + delta;
          it.x = aabb.cx + Math.cos(newA) * dist - it.width / 2;
          it.y = aabb.cy + Math.sin(newA) * dist - h / 2;
          it.rotation = sp.rotation + deltaDeg;
          if (el) css(it, el);
        });
        updateGroupBox();
      }
      function onUp() {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        dirty();
      }
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    });
  }
}

/* ═══ Rubber-band Selection ═══ */

function startRubberBand(e) {
  e.preventDefault();
  const startPos = clientToStage(e.clientX, e.clientY);
  rubberBand.style.left   = startPos.x + "px";
  rubberBand.style.top    = startPos.y + "px";
  rubberBand.style.width  = "0px";
  rubberBand.style.height = "0px";
  rubberBand.classList.remove("hidden");

  function onMove(ev) {
    const pos = clientToStage(ev.clientX, ev.clientY);
    const rx = Math.min(startPos.x, pos.x);
    const ry = Math.min(startPos.y, pos.y);
    const rw = Math.abs(pos.x - startPos.x);
    const rh = Math.abs(pos.y - startPos.y);
    rubberBand.style.left   = rx + "px";
    rubberBand.style.top    = ry + "px";
    rubberBand.style.width  = rw + "px";
    rubberBand.style.height = rh + "px";
  }
  function onUp(ev) {
    document.removeEventListener("mousemove", onMove);
    document.removeEventListener("mouseup", onUp);
    rubberBand.classList.add("hidden");

    const pos = clientToStage(ev.clientX, ev.clientY);
    const rx = Math.min(startPos.x, pos.x);
    const ry = Math.min(startPos.y, pos.y);
    const rw = Math.abs(pos.x - startPos.x);
    const rh = Math.abs(pos.y - startPos.y);

    if (rw < 5 && rh < 5) {
      selectOne(null);
      return;
    }

    const selRect = { x:rx, y:ry, w:rw, h:rh };
    const hits = curItems()
      .filter(item => rectsOverlap(selRect, getItemAABB(item)))
      .map(i => i.id);

    if (hits.length === 1) selectOne(hits[0]);
    else if (hits.length > 1) selectMulti(hits);
    else selectOne(null);
  }
  document.addEventListener("mousemove", onMove);
  document.addEventListener("mouseup", onUp);
}

/* ═══ Punch Tool ═══ */

function punchPath(ctx, shape, cx, cy, size, rot) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rot * Math.PI / 180);
  ctx.beginPath();
  const r = size / 2;
  switch (shape) {
    case "circle":
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      break;
    case "star": {
      const outer = r, inner = r * 0.42, spikes = 5;
      for (let i = 0; i < spikes * 2; i++) {
        const rad = (i * Math.PI / spikes) - Math.PI / 2;
        const d = i % 2 === 0 ? outer : inner;
        if (i === 0) ctx.moveTo(Math.cos(rad)*d, Math.sin(rad)*d);
        else ctx.lineTo(Math.cos(rad)*d, Math.sin(rad)*d);
      }
      break;
    }
    case "heart": {
      const s = r * 0.58;
      ctx.moveTo(0, s*0.4);
      ctx.bezierCurveTo(-s*0.2,-s*0.4,-s*1.1,-s*0.4,-s*1.1,s*0.2);
      ctx.bezierCurveTo(-s*1.1,s*0.8,-s*0.2,s*1.2,0,s*1.7);
      ctx.bezierCurveTo(s*0.2,s*1.2,s*1.1,s*0.8,s*1.1,s*0.2);
      ctx.bezierCurveTo(s*1.1,-s*0.4,s*0.2,-s*0.4,0,s*0.4);
      break;
    }
    case "diamond":
      ctx.moveTo(0,-r); ctx.lineTo(r*0.65,0); ctx.lineTo(0,r); ctx.lineTo(-r*0.65,0);
      break;
  }
  ctx.closePath();
  ctx.restore();
}

function punchSvgPath(shape, size, rot) {
  const c = size / 2;
  const rotRad = rot * Math.PI / 180;
  function rp(x, y) {
    return `${x*Math.cos(rotRad)-y*Math.sin(rotRad)+c},${x*Math.sin(rotRad)+y*Math.cos(rotRad)+c}`;
  }
  const r = size / 2;
  if (shape === "circle")
    return `<circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="currentColor" stroke-width="2"/>`;
  if (shape === "star") {
    const outer=r, inner=r*0.42, spikes=5, pts=[];
    for (let i=0;i<spikes*2;i++){
      const rad=(i*Math.PI/spikes)-Math.PI/2, dd=i%2===0?outer:inner;
      pts.push(rp(Math.cos(rad)*dd, Math.sin(rad)*dd));
    }
    return `<polygon points="${pts.join(" ")}" fill="none" stroke="currentColor" stroke-width="2"/>`;
  }
  if (shape === "heart") {
    const s=r*0.58, pts=[];
    for (let t=0;t<=1;t+=0.02){
      const a=t*Math.PI*2;
      const hx=16*Math.pow(Math.sin(a),3)*s/17;
      const hy=-(13*Math.cos(a)-5*Math.cos(2*a)-2*Math.cos(3*a)-Math.cos(4*a))*s/17;
      pts.push(rp(hx,hy));
    }
    return `<polygon points="${pts.join(" ")}" fill="none" stroke="currentColor" stroke-width="2"/>`;
  }
  if (shape === "diamond") {
    const pts=[rp(0,-r),rp(r*0.65,0),rp(0,r),rp(-r*0.65,0)];
    return `<polygon points="${pts.join(" ")}" fill="none" stroke="currentColor" stroke-width="2"/>`;
  }
  return "";
}

function enterPunchMode(shape) {
  if (tapeStyleBrush.active) setTapeBrushActive(false);
  if (lasso.active) exitLassoMode();
  if (wand.active) exitWandMode();
  if (punch.active && punch.shape === shape) { exitPunchMode(); return; }
  punch.active = true;
  punch.shape  = shape;
  punch.rotation = 0;
  selectOne(null);
  document.querySelectorAll(".punch-shape").forEach(b => {
    b.classList.toggle("active", b.dataset.shape === shape);
  });
  punchSizeWrap.classList.remove("hidden");
  stage.classList.add("punch-mode");
  updatePunchCursorShape();
}

function exitPunchMode() {
  punch.active = false;
  punch.shape  = null;
  document.querySelectorAll(".punch-shape").forEach(b => b.classList.remove("active"));
  punchSizeWrap.classList.add("hidden");
  punchCursor.classList.add("hidden");
  stage.classList.remove("punch-mode");
}

function updatePunchCursorShape() {
  const sz = punch.size;
  punchCursor.style.width  = sz + "px";
  punchCursor.style.height = sz + "px";
  punchCursor.style.border = "none";
  punchCursor.style.borderRadius = "0";
  punchCursor.innerHTML = `<svg viewBox="0 0 ${sz} ${sz}" width="${sz}" height="${sz}" style="overflow:visible">${punchSvgPath(punch.shape, sz, punch.rotation)}</svg>`;
}

function clientToStage(cx, cy) {
  const rect = wrapper.getBoundingClientRect();
  return { x: (cx - rect.left) / scale, y: (cy - rect.top) / scale };
}

function loadImg(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function hitTestImage(stageX, stageY) {
  const items = curItems();
  for (let i = items.length - 1; i >= 0; i--) {
    const it = items[i];
    if (it.type !== "image") continue;
    const el = stage.querySelector(`[data-id="${it.id}"] .item-img`);
    if (!el) continue;
    const ratio = el.naturalHeight / (el.naturalWidth || 1);
    const ih = it.width * ratio;
    const cx = it.x + it.width/2, cy = it.y + ih/2;
    const dx = stageX - cx, dy = stageY - cy;
    const rad = -it.rotation * Math.PI / 180;
    const lx = dx*Math.cos(rad) - dy*Math.sin(rad) + it.width/2;
    const ly = dx*Math.sin(rad) + dy*Math.cos(rad) + ih/2;
    if (lx >= 0 && lx <= it.width && ly >= 0 && ly <= ih)
      return { item: it, localX: lx, localY: ly, imgHeight: ih, ratio };
  }
  return null;
}

function getTapeHeight(item) {
  return item.tapeHeight || item._domHeight || 60;
}

function hitTestPunchTarget(stageX, stageY) {
  const items = curItems();
  for (let i = items.length - 1; i >= 0; i--) {
    const it = items[i];
    if (it.type === "image") {
      const el = stage.querySelector(`[data-id="${it.id}"] .item-img`);
      if (!el) continue;
      const ratio = el.naturalHeight / (el.naturalWidth || 1);
      const ih = it.width * ratio;
      const local = stageToItemLocal(stageX, stageY, it, ih);
      if (local.x >= 0 && local.x <= it.width && local.y >= 0 && local.y <= ih) {
        return { kind: "image", item: it, localX: local.x, localY: local.y, imgHeight: ih, ratio };
      }
    } else if (it.type === "tape") {
      const ih = getTapeHeight(it);
      const local = stageToItemLocal(stageX, stageY, it, ih);
      if (local.x >= 0 && local.x <= it.width && local.y >= 0 && local.y <= ih) {
        return { kind: "tape", item: it, localX: local.x, localY: local.y, tapeHeight: ih };
      }
    }
  }
  return null;
}

function drawTapeHoles(ctx, item, iw, ih) {
  if (!item.holes?.length) return;
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "destination-out";
  item.holes.forEach(hole => {
    punchPath(ctx, hole.shape || "circle", (hole.x || 0) - iw / 2, (hole.y || 0) - ih / 2, hole.size || punch.size, hole.rotation || 0);
    ctx.fill();
  });
  ctx.restore();
}

function drawTapeContent(ctx, item, iw, ih, includeHoles = true) {
  ctx.fillStyle = hexAlphaToRgba(item.bgColor||"#fffdf8", item.bgAlpha!=null?item.bgAlpha:0.92);
  ctx.fillRect(-iw/2, -ih/2, iw, ih);
  ctx.fillStyle = "#3d2b1f";
  ctx.font = "14px 'Segoe UI', serif";
  ctx.textBaseline = "top";
  const tapePad = 8, tapeMaxW = iw - tapePad*2, tapeLineH = 20;
  wrapText(ctx, item.text||"", tapeMaxW).forEach((line, li) => {
    ctx.fillText(line, -iw/2+tapePad, -ih/2+tapePad+li*tapeLineH);
  });
  if (includeHoles) drawTapeHoles(ctx, item, iw, ih);
}

function makeTapePunchPiece(item, localX, localY, tapeHeight, localRotation) {
  const iw = item.width, ih = tapeHeight;
  const full = document.createElement("canvas");
  full.width = Math.ceil(iw);
  full.height = Math.ceil(ih);
  const fullCtx = full.getContext("2d");
  fullCtx.translate(iw/2, ih/2);
  drawTapeContent(fullCtx, item, iw, ih, true);

  const pc = Math.ceil(punch.size);
  const piece = document.createElement("canvas");
  piece.width = pc;
  piece.height = pc;
  const pieceCtx = piece.getContext("2d");
  punchPath(pieceCtx, punch.shape, pc/2, pc/2, punch.size, localRotation);
  pieceCtx.clip();
  pieceCtx.drawImage(full, -(localX - pc/2), -(localY - pc/2));
  return piece.toDataURL("image/png");
}

async function executePunch(stageX, stageY) {
  const hit = hitTestPunchTarget(stageX, stageY);
  if (!hit) return;
  if (hit.kind === "tape") {
    executePunchTape(hit, stageX, stageY);
    return;
  }
  pushHistory();
  const { item, localX, localY } = hit;
  const img = await loadImg(item.src);
  const nw = img.naturalWidth, nh = img.naturalHeight;
  const s2i = nw / item.width;
  const pxSize = punch.size * s2i;
  const imgLX = localX * s2i, imgLY = localY * s2i;

  const c1 = document.createElement("canvas");
  const pc = Math.ceil(pxSize);
  c1.width = pc; c1.height = pc;
  const ctx1 = c1.getContext("2d");
  punchPath(ctx1, punch.shape, pc/2, pc/2, pxSize, punch.rotation);
  ctx1.clip();
  ctx1.drawImage(img, -(imgLX - pc/2), -(imgLY - pc/2), nw, nh);
  const pieceSrc = c1.toDataURL("image/png");

  const c2 = document.createElement("canvas");
  c2.width = nw; c2.height = nh;
  const ctx2 = c2.getContext("2d");
  ctx2.drawImage(img, 0, 0, nw, nh);
  ctx2.globalCompositeOperation = "destination-out";
  punchPath(ctx2, punch.shape, imgLX, imgLY, pxSize, punch.rotation);
  ctx2.fill();
  const holeSrc = c2.toDataURL("image/png");

  const items = curItems();
  const idx = items.indexOf(item);
  const psz = punch.size;
  items.splice(idx, 1,
    { id:uid(), type:"image", src:holeSrc,  x:item.x, y:item.y,
      width:item.width, rotation:item.rotation, opacity:item.opacity, zIndex:1 },
    { id:uid(), type:"image", src:pieceSrc, x:stageX-psz/2, y:stageY-psz/2,
      width:psz, rotation:item.rotation+punch.rotation, opacity:item.opacity, zIndex:1 }
  );
  render(); dirty();
}

function executePunchTape(hit, stageX, stageY) {
  const { item, localX, localY, tapeHeight } = hit;
  pushHistory();
  const localRotation = punch.rotation - (item.rotation || 0);
  const pieceSrc = makeTapePunchPiece(item, localX, localY, tapeHeight, localRotation);
  item.holes = [...(item.holes || []), {
    shape: punch.shape,
    x: localX,
    y: localY,
    size: punch.size,
    rotation: localRotation
  }];
  const items = curItems();
  const idx = items.indexOf(item);
  items.splice(idx + 1, 0, {
    id: uid(), type: "image", src: pieceSrc,
    x: stageX - punch.size / 2, y: stageY - punch.size / 2,
    width: punch.size, rotation: item.rotation || 0,
    opacity: item.opacity != null ? item.opacity : 1, zIndex: 1
  });
  render(); dirty();
}

/* ═══ Lasso Tool ═══ */

function stageToItemLocal(sx, sy, item, imgH) {
  const cx = item.x + item.width/2, cy = item.y + imgH/2;
  const dx = sx - cx, dy = sy - cy;
  const rad = -item.rotation * Math.PI / 180;
  return {
    x: dx*Math.cos(rad) - dy*Math.sin(rad) + item.width/2,
    y: dx*Math.sin(rad) + dy*Math.cos(rad) + imgH/2
  };
}

function enterLassoMode() {
  if (lasso.active) { exitLassoMode(); return; }
  if (tapeStyleBrush.active) setTapeBrushActive(false);
  if (punch.active) exitPunchMode();
  if (wand.active)  exitWandMode();
  lasso.active = true;
  lassoBtn.classList.add("active");
  lassoCanvas.classList.remove("hidden");
  lassoCanvas.style.pointerEvents = "auto";
  stage.style.cursor = "crosshair";
}

function exitLassoMode() {
  lasso.active  = false;
  lasso.drawing = false;
  lasso.targetItem = null;
  lasso.points  = [];
  lassoBtn.classList.remove("active");
  lassoCanvas.classList.add("hidden");
  lassoCanvas.style.pointerEvents = "none";
  clearLassoCanvas();
  stage.style.cursor = "";
}

function clearLassoCanvas() {
  const ctx = lassoCanvas.getContext("2d");
  ctx.clearRect(0, 0, W, H);
}

function drawLassoPreview() {
  const ctx = lassoCanvas.getContext("2d");
  ctx.clearRect(0, 0, W, H);
  const pts = lasso.points;
  if (pts.length < 2) return;
  ctx.save();
  ctx.strokeStyle = "#e03030";
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 3]);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.shadowColor = "rgba(0,0,0,0.3)";
  ctx.shadowBlur = 2;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.stroke();
  ctx.restore();
}

async function executeLasso() {
  const { targetItem: item, points } = lasso;
  if (!item || points.length < 5) return;

  const img = await loadImg(item.src);
  const nw = img.naturalWidth, nh = img.naturalHeight;
  const imgH = nh * item.width / nw;
  const s2i = nw / item.width;

  // Convert stage-space lasso points to image pixel coordinates
  const imgPts = points.map(p => {
    const local = stageToItemLocal(p.x, p.y, item, imgH);
    return { x: local.x * s2i, y: local.y * s2i };
  });

  // Piece canvas: clip to polygon, draw image inside
  const c1 = document.createElement("canvas");
  c1.width = nw; c1.height = nh;
  const ctx1 = c1.getContext("2d");
  ctx1.beginPath();
  imgPts.forEach((p,i) => i ? ctx1.lineTo(p.x, p.y) : ctx1.moveTo(p.x, p.y));
  ctx1.closePath();
  ctx1.clip();
  ctx1.drawImage(img, 0, 0, nw, nh);
  const pieceSrc = c1.toDataURL("image/png");

  // Hole canvas: draw image, erase polygon region
  const c2 = document.createElement("canvas");
  c2.width = nw; c2.height = nh;
  const ctx2 = c2.getContext("2d");
  ctx2.drawImage(img, 0, 0, nw, nh);
  ctx2.globalCompositeOperation = "destination-out";
  ctx2.beginPath();
  imgPts.forEach((p,i) => i ? ctx2.lineTo(p.x, p.y) : ctx2.moveTo(p.x, p.y));
  ctx2.closePath();
  ctx2.fill();
  const holeSrc = c2.toDataURL("image/png");

  // Compute piece position (lasso AABB center in stage coords)
  const xs = points.map(p => p.x), ys = points.map(p => p.y);
  const px = (Math.min(...xs) + Math.max(...xs)) / 2;
  const py = (Math.min(...ys) + Math.max(...ys)) / 2;
  const pw = (Math.max(...xs) - Math.min(...xs));
  const pieceW = Math.max(40, pw);

  const items = curItems();
  const idx = items.indexOf(item);
  pushHistory();
  items.splice(idx, 1,
    { id:uid(), type:"image", src:holeSrc,  x:item.x, y:item.y,
      width:item.width, rotation:item.rotation, opacity:item.opacity, zIndex:1 },
    { id:uid(), type:"image", src:pieceSrc, x:px - pieceW/2, y:py - pieceW/2,
      width:pieceW, rotation:item.rotation, opacity:item.opacity, zIndex:1 }
  );
  render(); dirty();
  clearLassoCanvas();
}

/* ═══ Magic Wand Tool ═══ */

function enterWandMode() {
  if (wand.active) { exitWandMode(); return; }
  if (tapeStyleBrush.active) setTapeBrushActive(false);
  if (punch.active) exitPunchMode();
  if (lasso.active) exitLassoMode();
  wand.active = true;
  wandBtn.classList.add("active");
  wandToleranceWrap.classList.remove("hidden");
  stage.classList.add("wand-mode");
}

function exitWandMode() {
  wand.active = false;
  wandBtn.classList.remove("active");
  wandToleranceWrap.classList.add("hidden");
  stage.classList.remove("wand-mode");
}

function floodFill(imgData, sx, sy, tolerance) {
  const { width, height, data } = imgData;
  if (sx < 0 || sx >= width || sy < 0 || sy >= height)
    return new Uint8Array(width * height);

  function getColor(pos) {
    const i = pos * 4;
    return [data[i], data[i+1], data[i+2], data[i+3]];
  }
  function colorDiff(a, b) {
    return Math.sqrt(
      (a[0]-b[0])**2 + (a[1]-b[1])**2 + (a[2]-b[2])**2 + (a[3]-b[3])**2
    );
  }

  const startPos = sy * width + sx;
  const target = getColor(startPos);
  const visited = new Uint8Array(width * height);
  const mask    = new Uint8Array(width * height);
  const stack   = [startPos];

  while (stack.length) {
    const pos = stack.pop();
    if (visited[pos]) continue;
    visited[pos] = 1;
    const x = pos % width, y = Math.floor(pos / width);
    if (colorDiff(getColor(pos), target) <= tolerance) {
      mask[pos] = 1;
      if (x+1 < width)  stack.push(pos+1);
      if (x-1 >= 0)     stack.push(pos-1);
      if (y+1 < height) stack.push(pos+width);
      if (y-1 >= 0)     stack.push(pos-width);
    }
  }
  return mask;
}

async function executeWand(item, localX, localY) {
  const img = await loadImg(item.src);
  const nw = img.naturalWidth, nh = img.naturalHeight;
  const s2i = nw / item.width;
  const imgX = Math.round(localX * s2i);
  const imgY = Math.round(localY * s2i);

  // Get image pixel data
  const c0 = document.createElement("canvas");
  c0.width = nw; c0.height = nh;
  const ctx0 = c0.getContext("2d");
  ctx0.drawImage(img, 0, 0, nw, nh);
  const imgData = ctx0.getImageData(0, 0, nw, nh);

  const mask = floodFill(imgData, imgX, imgY, wand.tolerance);

  // Build piece (selected region) and hole (original with region removed)
  const c1 = document.createElement("canvas");
  const c2 = document.createElement("canvas");
  c1.width = c2.width = nw;
  c1.height = c2.height = nh;
  const d1 = c1.getContext("2d").createImageData(nw, nh);
  const d2 = c2.getContext("2d").createImageData(nw, nh);
  const src = imgData.data;

  for (let i = 0; i < mask.length; i++) {
    const pi = i * 4;
    if (mask[i]) {
      // piece gets this pixel
      d1.data[pi]   = src[pi];
      d1.data[pi+1] = src[pi+1];
      d1.data[pi+2] = src[pi+2];
      d1.data[pi+3] = src[pi+3];
      // hole: erase this pixel
      d2.data[pi+3] = 0;
    } else {
      // hole keeps this pixel
      d2.data[pi]   = src[pi];
      d2.data[pi+1] = src[pi+1];
      d2.data[pi+2] = src[pi+2];
      d2.data[pi+3] = src[pi+3];
    }
  }
  c1.getContext("2d").putImageData(d1, 0, 0);
  c2.getContext("2d").putImageData(d2, 0, 0);
  const pieceSrc = c1.toDataURL("image/png");
  const holeSrc  = c2.toDataURL("image/png");

  // Piece position: center on click point in stage coords
  const pieceW = Math.max(40, item.width * 0.4);
  const stageClickX = item.x + localX;
  const stageClickY = item.y + (localY * item.width / nw);

  const items = curItems();
  const idx = items.indexOf(item);
  pushHistory();
  items.splice(idx, 1,
    { id:uid(), type:"image", src:holeSrc,  x:item.x, y:item.y,
      width:item.width, rotation:item.rotation, opacity:item.opacity, zIndex:1 },
    { id:uid(), type:"image", src:pieceSrc, x:stageClickX - pieceW/2 + 20, y:stageClickY - pieceW/2 + 20,
      width:pieceW, rotation:item.rotation, opacity:item.opacity, zIndex:1 }
  );
  render(); dirty();
}

/* ═══ Export — Canvas Rendering ═══ */

async function renderPageToDataUrl(pages, pageIdx) {
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");

  const page = pages[pageIdx];
  if (page?.bg) {
    // Custom background
    ctx.fillStyle = "#fcfcfc";
    ctx.fillRect(0, 0, W, H);
    try {
      const bgImg = await loadImg(page.bg.src);
      ctx.save();
      ctx.translate(W / 2, H / 2);
      ctx.rotate(page.bg.rotation * Math.PI / 180);
      ctx.scale(page.bg.scale, page.bg.scale);
      ctx.translate(page.bg.offsetX, page.bg.offsetY);
      if (page.bg.type === "fill") {
        ctx.beginPath();
        ctx.rect(-W / 2, -H / 2, W, H);
        ctx.clip();
      }
      ctx.drawImage(bgImg, -bgImg.naturalWidth / 2, -bgImg.naturalHeight / 2);
      ctx.restore();
    } catch(e) {}
  } else {
    ctx.fillStyle = "#f3ebe0";
    ctx.fillRect(0, 0, W, H);
    try {
      const bg = await loadImg("./assets/journal-page.svg");
      ctx.drawImage(bg, 0, 0, W, H);
    } catch(e) {}
  }

  const items = [...(pages[pageIdx]?.items || [])].sort((a,b) => (a.zIndex||0)-(b.zIndex||0));
  for (const item of items) {
    ctx.save();
    ctx.globalAlpha = item.opacity != null ? item.opacity : 1;
    if (item.type === "image") {
      try {
        const img = await loadImg(item.src);
        const iw = item.width;
        const ih = img.naturalHeight * iw / (img.naturalWidth || 1);
        ctx.translate(item.x + iw/2, item.y + ih/2);
        ctx.rotate(item.rotation * Math.PI / 180);
        ctx.drawImage(img, -iw/2, -ih/2, iw, ih);
      } catch(e) {}
    } else if (item.type === "tape") {
      const iw = item.width, ih = item.tapeHeight || item._domHeight || 60;
      ctx.translate(item.x + iw/2, item.y + ih/2);
      ctx.rotate(item.rotation * Math.PI / 180);
      const tapeCanvas = document.createElement("canvas");
      tapeCanvas.width = Math.ceil(iw);
      tapeCanvas.height = Math.ceil(ih);
      const tapeCtx = tapeCanvas.getContext("2d");
      tapeCtx.translate(iw/2, ih/2);
      drawTapeContent(tapeCtx, item, iw, ih, true);
      ctx.drawImage(tapeCanvas, -iw/2, -ih/2, iw, ih);
    } else if (item.type === "text") {
      const iw = item.width, ih = item._domHeight || 60;
      const fontSize = item.fontSize || 14;
      const lh = Math.round(fontSize * (item.lineHeight || 1.6));
      ctx.translate(item.x + iw/2, item.y + ih/2);
      ctx.rotate(item.rotation * Math.PI / 180);
      ctx.fillStyle = item.color || "#3d2b1f";
      ctx.font = `${fontSize}px ${item.fontFamily || "'Segoe UI',sans-serif"}`;
      ctx.textBaseline = "top";
      const textPad = 10, textMaxW = iw - textPad*2;
      wrapText(ctx, item.text||"", textMaxW).forEach((line, li) => {
        ctx.fillText(line, -iw/2+textPad, -ih/2+textPad+li*lh);
      });
    }
    ctx.restore();
  }
  return canvas.toDataURL("image/jpeg", 0.95);
}

function wrapText(ctx, text, maxWidth) {
  const result = [];
  for (const para of text.split("\n")) {
    if (!para) { result.push(""); continue; }
    let line = "";
    for (const ch of para.split("")) {
      const test = line + ch;
      if (ctx.measureText(test).width > maxWidth && line) { result.push(line); line = ch; }
      else line = test;
    }
    if (line) result.push(line);
  }
  return result.length ? result : [""];
}

/* ═══ Tape Tool ═══ */

function enterTapeMode() {
  // Exit any other active tool first
  if (tapeStyleBrush.active) setTapeBrushActive(false);
  if (punch.active) exitPunchMode();
  if (lasso.active) exitLassoMode();
  if (wand.active)  exitWandMode();
  tape.active  = true;
  tape.startPt = null;
  stage.classList.add("tape-mode");
  $("tapeModeBtn").classList.add("active");
  tapePreview.classList.add("hidden");
  tapeStartDot.classList.add("hidden");
}

function exitTapeMode() {
  tape.active  = false;
  tape.startPt = null;
  stage.classList.remove("tape-mode");
  $("tapeModeBtn").classList.remove("active");
  tapePreview.classList.add("hidden");
  tapeStartDot.classList.add("hidden");
}

function updateTapePreview(p1, cursor) {
  if (!p1 || !cursor) { tapePreview.classList.add("hidden"); return; }
  const dx = cursor.x - p1.x, dy = cursor.y - p1.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 4) { tapePreview.classList.add("hidden"); return; }
  const angle = Math.atan2(dy, dx) * 180 / Math.PI;
  tapePreview.classList.remove("hidden");
  tapePreview.style.left      = p1.x + "px";
  tapePreview.style.top       = (p1.y - TAPE_H / 2) + "px";
  tapePreview.style.width     = len + "px";
  tapePreview.style.height    = TAPE_H + "px";
  tapePreview.style.transform = `rotate(${angle}deg)`;
}

function placeTapeStartDot(p) {
  if (!p) { tapeStartDot.classList.add("hidden"); return; }
  tapeStartDot.classList.remove("hidden");
  tapeStartDot.style.left = p.x + "px";
  tapeStartDot.style.top  = p.y + "px";
}

function createTapeFromPoints(p1, p2) {
  const dx = p2.x - p1.x, dy = p2.y - p1.y;
  const len = Math.max(Math.sqrt(dx * dx + dy * dy), 2);
  const angle = Math.atan2(dy, dx) * 180 / Math.PI;
  const cx = (p1.x + p2.x) / 2, cy = (p1.y + p2.y) / 2;
  const items = curItems();
  items.push({
    id: uid(), type: "tape", text: "",
    x: cx - len / 2,
    y: cy - TAPE_H / 2,
    width: len, tapeHeight: TAPE_H,
    rotation: angle, opacity: 1, zIndex: items.length + 1,
    bgColor: "#fffdf8", bgAlpha: 0.92
  });
  render();
  selectOne(items[items.length - 1].id);
  dirty();
}

/* ═══ Typography Controls ═══ */

textFontSelect.addEventListener("change", () => {
  const item = sel();
  if (!item || item.type !== "text") return;
  pushHistory();
  item.fontFamily = textFontSelect.value;
  const el = stage.querySelector(`[data-id="${item.id}"] .item-text`);
  if (el) el.style.fontFamily = item.fontFamily;
  dirty();
});

textSizeDownBtn.addEventListener("click", () => {
  const item = sel();
  if (!item || item.type !== "text") return;
  pushHistory();
  item.fontSize = Math.max(8, (item.fontSize || 14) - 1);
  textSizeDisplay.textContent = item.fontSize;
  const el = stage.querySelector(`[data-id="${item.id}"] .item-text`);
  if (el) el.style.fontSize = item.fontSize + "px";
  dirty();
});

textSizeUpBtn.addEventListener("click", () => {
  const item = sel();
  if (!item || item.type !== "text") return;
  pushHistory();
  item.fontSize = Math.min(72, (item.fontSize || 14) + 1);
  textSizeDisplay.textContent = item.fontSize;
  const el = stage.querySelector(`[data-id="${item.id}"] .item-text`);
  if (el) el.style.fontSize = item.fontSize + "px";
  dirty();
});

textLhDownBtn.addEventListener("click", () => {
  const item = sel();
  if (!item || item.type !== "text") return;
  pushHistory();
  item.lineHeight = Math.max(1.0, Math.round(((item.lineHeight || 1.6) - 0.1) * 10) / 10);
  textLhDisplay.textContent = item.lineHeight;
  const el = stage.querySelector(`[data-id="${item.id}"] .item-text`);
  if (el) el.style.lineHeight = item.lineHeight;
  dirty();
});

textLhUpBtn.addEventListener("click", () => {
  const item = sel();
  if (!item || item.type !== "text") return;
  pushHistory();
  item.lineHeight = Math.min(3.0, Math.round(((item.lineHeight || 1.6) + 0.1) * 10) / 10);
  textLhDisplay.textContent = item.lineHeight;
  const el = stage.querySelector(`[data-id="${item.id}"] .item-text`);
  if (el) el.style.lineHeight = item.lineHeight;
  dirty();
});

let textColorChanged = false;
textColorInput.addEventListener("focus", () => { textColorChanged = false; });
textColorInput.addEventListener("input", () => {
  if (!textColorChanged) { pushHistory(); textColorChanged = true; }
  const item = sel();
  if (!item || item.type !== "text") return;
  item.color = textColorInput.value;
  const el = stage.querySelector(`[data-id="${item.id}"] .item-text`);
  if (el) el.style.color = item.color;
  dirty();
});

/* ═══ Export Modal Logic ═══ */

const exportModal    = $("exportModal");
const exportOverlay  = $("exportOverlay");
const exportPageList = $("exportPageList");
const exportFormatJpg = $("exportFormatJpg");
const exportFormatPdf = $("exportFormatPdf");
const exportSelectAll = $("exportSelectAll");
const exportCancelBtn = $("exportCancelBtn");
const exportDoBtn     = $("exportDoBtn");
const exportStatus    = $("exportStatus");

function openExportModal() {
  exportPageList.innerHTML = "";
  curPages().forEach((_, i) => {
    const label = document.createElement("label");
    label.className = "export-page-item";
    const cb = document.createElement("input");
    cb.type = "checkbox"; cb.value = i; cb.checked = (i === state.pageIdx);
    label.appendChild(cb);
    label.appendChild(document.createTextNode(` 第 ${i+1} 页`));
    exportPageList.appendChild(label);
  });
  exportStatus.textContent = "";
  exportModal.classList.remove("hidden");
  exportOverlay.classList.remove("hidden");
}

function closeExportModal() {
  exportModal.classList.add("hidden");
  exportOverlay.classList.add("hidden");
}

exportSelectAll.addEventListener("click", () => {
  const cbs = exportPageList.querySelectorAll("input[type=checkbox]");
  const allChecked = [...cbs].every(c => c.checked);
  cbs.forEach(c => { c.checked = !allChecked; });
  exportSelectAll.textContent = allChecked ? "全选" : "取消全选";
});

exportCancelBtn.addEventListener("click", closeExportModal);
exportOverlay.addEventListener("click", closeExportModal);

exportDoBtn.addEventListener("click", async () => {
  const cbs = [...exportPageList.querySelectorAll("input[type=checkbox]")];
  const selectedPages = cbs.filter(c => c.checked).map(c => Number(c.value));
  if (!selectedPages.length) { exportStatus.textContent = "请至少选择一页"; return; }
  const format = exportFormatPdf.checked ? "pdf" : "jpg";
  exportDoBtn.disabled = true;
  exportStatus.textContent = "渲染中…";
  try {
    const dataUrls = [];
    for (const pi of selectedPages) dataUrls.push(await renderPageToDataUrl(curPages(), pi));
    exportStatus.textContent = "保存中…";
    const ok = format === "jpg"
      ? await window.journalApi.saveExportJpg({ dataUrls })
      : await window.journalApi.saveExportPdf({ dataUrls });
    exportStatus.textContent = ok ? "导出成功！" : "已取消";
    if (ok) setTimeout(closeExportModal, 1200);
  } catch(e) {
    exportStatus.textContent = "导出失败：" + (e.message || e);
  } finally {
    exportDoBtn.disabled = false;
  }
});

/* ═══ Bootstrap ═══ */

async function boot() {
  try {
    const d = await window.journalApi.loadJournal();
    if (d && d.notebooks && d.notebooks.length) {
      // New multi-notebook format
      state.notebooks = d.notebooks;
      state.activeNotebook = d.activeNotebook || state.notebooks[0].id;
    } else if (d && (d.pages || d.items)) {
      // Migrate old single-notebook format
      const migratedNb = {
        id: uid(), name: "手账1",
        pages: d.pages || [{ items: d.items || [] }],
        pageIdx: 0, coverDataUrl: null
      };
      state.notebooks = [migratedNb];
      state.activeNotebook = migratedNb.id;
    } else {
      const defaultNb = { id: uid(), name: "手账1", pages: [{ items: [] }], pageIdx: 0, coverDataUrl: null };
      state.notebooks = [defaultNb];
      state.activeNotebook = defaultNb.id;
    }
  } catch(e) {
    const defaultNb = { id: uid(), name: "手账1", pages: [{ items: [] }], pageIdx: 0, coverDataUrl: null };
    state.notebooks = [defaultNb];
    state.activeNotebook = defaultNb.id;
  }
  // Migrate old type:"text" (tape-style) items to type:"tape"
  state.notebooks.forEach(nb => {
    nb.pages.forEach(page => {
      (page.items || []).forEach(item => {
        if (item.type === "text" && (item.bgColor || item.bgAlpha != null)) {
          item.type = "tape";
        }
      });
    });
  });

  const nb = curNotebook();
  state.pageIdx = nb ? (nb.pageIdx || 0) : 0;

  if (state.activeNotebook) {
    shell.classList.remove("at-home");
    render(); syncUI(); syncPageUI(); fit();
    renderStageBg(curPages()[state.pageIdx]);
  } else {
    shell.classList.add("at-home");
    await renderHome();
  }

  saveLabel.textContent = "已保存";
  bindGroupBox();
}

/* ═══ Event Bindings ═══ */

document.querySelectorAll("[data-command]").forEach(b => {
  b.addEventListener("click", () => window.journalApi.commandWindow(b.dataset.command));
});

$("pinButton").addEventListener("click", async () => {
  const p = await window.journalApi.commandWindow("toggle-pin");
  $("pinButton").classList.toggle("pinned", p);
});

$("captureBtn").addEventListener("click", () => window.journalApi.startCapture());

$("importBtn").addEventListener("click", async () => {
  try {
    const url = await window.journalApi.pickImage();
    if (url) { pushHistory(); addImage(url); }
  } catch(e) { console.error("import err",e); }
});

$("tapeModeBtn").addEventListener("click", () => {
  if (tape.active) { exitTapeMode(); } else { enterTapeMode(); }
});
$("textModeBtn").addEventListener("click", () => {
  if (tape.active) exitTapeMode();
  if (tapeStyleBrush.active) setTapeBrushActive(false);
  pushHistory(); addText();
});
$("exportBtn").addEventListener("click", openExportModal);

prevPageBtn.addEventListener("click", prevPage);
nextPageBtn.addEventListener("click", nextPage);
$("deletePageBtn").addEventListener("click", deletePage);

$("layerUpBtn").addEventListener("click",   () => reorder("up"));
$("layerDownBtn").addEventListener("click", () => reorder("down"));

// Multi-select delete
$("multiDeleteBtn").addEventListener("click", () => {
  if (!state.selIds.length) return;
  pushHistory();
  const ids = state.selIds;
  curPages()[state.pageIdx].items = curItems().filter(i => !ids.includes(i.id));
  state.selIds = [];
  render(); syncUI(); dirty();
});

// Opacity slider
let opSliderDragging = false;
opSlider.addEventListener("mousedown", () => { if (!opSliderDragging) { pushHistory(); opSliderDragging = true; } });
opSlider.addEventListener("mouseup", () => { opSliderDragging = false; });
opSlider.addEventListener("input", () => {
  const item = sel();
  if (item) {
    item.opacity = Number(opSlider.value);
    const el = stage.querySelector(`[data-id="${item.id}"]`);
    if (el) el.style.opacity = item.opacity;
    dirty();
  }
});

// BgColor
let bgColorChanged = false;
bgColorInput.addEventListener("focus", () => { bgColorChanged = false; });
bgColorInput.addEventListener("input", () => {
  if (!bgColorChanged) { pushHistory(); bgColorChanged = true; }
  const item = sel();
  if (!item || item.type !== "tape") return;
  item.bgColor = bgColorInput.value;
  const el = stage.querySelector(`[data-id="${item.id}"]`);
  if (el) {
    const txt = el.querySelector(".item-text");
    if (txt) txt.style.background = hexAlphaToRgba(item.bgColor, item.bgAlpha != null ? item.bgAlpha : 0.92);
  }
  dirty();
});

// BgAlpha
let bgAlphaDragging = false;
bgAlphaSlider.addEventListener("mousedown", () => { if (!bgAlphaDragging) { pushHistory(); bgAlphaDragging = true; } });
bgAlphaSlider.addEventListener("mouseup", () => { bgAlphaDragging = false; });
bgAlphaSlider.addEventListener("input", () => {
  const item = sel();
  if (!item || item.type !== "tape") return;
  item.bgAlpha = Number(bgAlphaSlider.value);
  const el = stage.querySelector(`[data-id="${item.id}"]`);
  if (el) {
    const txt = el.querySelector(".item-text");
    if (txt) txt.style.background = hexAlphaToRgba(item.bgColor||"#fffdf8", item.bgAlpha);
  }
  dirty();
});

tapeStyleBrushBtn?.addEventListener("click", () => {
  if (tapeStyleBrush.active) { setTapeBrushActive(false); return; }
  const item = sel();
  if (!item || item.type !== "tape") return;
  if (punch.active) exitPunchMode();
  if (lasso.active) exitLassoMode();
  if (wand.active) exitWandMode();
  if (tape.active) exitTapeMode();
  tapeStyleBrush.sample = tapeStyleFrom(item);
  setTapeBrushActive(true);
});

$("deleteBtn").addEventListener("click", () => {
  if (!state.selIds.length) return;
  pushHistory();
  const ids = state.selIds;
  curPages()[state.pageIdx].items = curItems().filter(i => !ids.includes(i.id));
  state.selIds = [];
  render(); syncUI(); dirty();
});

window.journalApi.onCaptureCreated(url => { pushHistory(); addImage(url); });

// Punch shape buttons (only those with data-shape)
document.querySelectorAll(".punch-shape[data-shape]").forEach(btn => {
  btn.addEventListener("click", () => enterPunchMode(btn.dataset.shape));
});
punchSizeSlider.addEventListener("input", () => {
  punch.size = Number(punchSizeSlider.value);
  punchSizeLabel.textContent = punch.size;
  updatePunchCursorShape();
});

// Lasso & Wand buttons
lassoBtn.addEventListener("click", enterLassoMode);
wandBtn.addEventListener("click", enterWandMode);
wandToleranceSlider.addEventListener("input", () => {
  wand.tolerance = Number(wandToleranceSlider.value);
  wandToleranceLabel.textContent = wand.tolerance;
});

// Lasso canvas events
lassoCanvas.addEventListener("mousedown", e => {
  if (!lasso.active || e.button !== 0) return;
  e.preventDefault(); e.stopPropagation();
  const pos = clientToStage(e.clientX, e.clientY);
  const hit = hitTestImage(pos.x, pos.y);
  if (!hit) return;
  lasso.drawing = true;
  lasso.targetItem = hit.item;
  lasso.points = [pos];
  clearLassoCanvas();
});

lassoCanvas.addEventListener("mousemove", e => {
  if (!lasso.active || !lasso.drawing) return;
  const pos = clientToStage(e.clientX, e.clientY);
  lasso.points.push(pos);
  drawLassoPreview();
});

lassoCanvas.addEventListener("mouseup", e => {
  if (!lasso.active || !lasso.drawing) return;
  lasso.drawing = false;
  executeLasso();
  lasso.points = [];
  lasso.targetItem = null;
});

// Stage mouse events
stage.addEventListener("mousemove", e => {
  const pos = clientToStage(e.clientX, e.clientY);
  if (punch.active) {
    punchCursor.classList.remove("hidden");
    punchCursor.style.left = pos.x + "px";
    punchCursor.style.top  = pos.y + "px";
  }
  if (tape.active && tape.startPt) {
    updateTapePreview(tape.startPt, pos);
  }
});

stage.addEventListener("mouseleave", () => {
  if (punch.active) punchCursor.classList.add("hidden");
  if (tape.active)  tapePreview.classList.add("hidden");
});

stage.addEventListener("wheel", e => {
  if (!punch.active) return;
  e.preventDefault();
  punch.rotation += e.deltaY > 0 ? 15 : -15;
  punch.rotation = ((punch.rotation % 360) + 360) % 360;
  updatePunchCursorShape();
}, { passive: false });

stage.addEventListener("mousedown", e => {
  if (e.button !== 0) return;

  if (tapeStyleBrush.active) {
    e.preventDefault(); e.stopPropagation();
    return;
  }

  if (punch.active) {
    e.preventDefault(); e.stopPropagation();
    const pos = clientToStage(e.clientX, e.clientY);
    executePunch(pos.x, pos.y);
    return;
  }

  if (wand.active) {
    e.preventDefault(); e.stopPropagation();
    const pos = clientToStage(e.clientX, e.clientY);
    const hit = hitTestImage(pos.x, pos.y);
    if (hit) executeWand(hit.item, hit.localX, hit.localY);
    return;
  }

  if (lasso.active) return; // handled by lassoCanvas

  if (tape.active) {
    e.preventDefault(); e.stopPropagation();
    const pos = clientToStage(e.clientX, e.clientY);
    if (!tape.startPt) {
      // First click — set start point
      tape.startPt = pos;
      placeTapeStartDot(pos);
    } else {
      // Second click — create tape segment
      pushHistory();
      createTapeFromPoints(tape.startPt, pos);
      if (e.shiftKey) {
        // Shift: chain next segment from this point
        tape.startPt = pos;
        placeTapeStartDot(pos);
        tapePreview.classList.add("hidden");
      } else {
        exitTapeMode();
      }
    }
    return;
  }

  // Normal: rubber-band on empty stage / hint area
  if (e.target === stage || e.target.closest(".empty-hint")) {
    startRubberBand(e);
  }
});

// Keyboard
document.addEventListener("keydown", e => {
  const inTextEdit = !!document.activeElement?.closest(".item-text.editing");

  if (e.ctrlKey && e.key === "z" && !inTextEdit) {
    e.preventDefault(); undo(); return;
  }
  if (e.ctrlKey && e.key === "c" && !inTextEdit) {
    copySelected(); return;
  }
  if (e.ctrlKey && e.key === "v" && !inTextEdit) {
    e.preventDefault(); pasteItem(); return;
  }
  if (e.key === "Escape") {
    if (tapeStyleBrush.active) { setTapeBrushActive(false); return; }
    if (tape.active)  { exitTapeMode();  return; }
    if (lasso.active) { exitLassoMode(); return; }
    if (wand.active)  { exitWandMode();  return; }
    if (punch.active) { exitPunchMode(); return; }
    if (openGroup !== null) { toggleToolGroup(null); return; }
    if (inTextEdit) {
      const editing = stage.querySelector(".item-text.editing");
      if (editing) {
        editing.contentEditable = "false";
        editing.classList.remove("editing");
        editing.blur();
      }
      return;
    }
    if (state.selIds.length) { selectOne(null); }
    return;
  }
  if ((e.key === "Delete" || e.key === "Backspace") && !inTextEdit) {
    if (!state.selIds.length) return;
    pushHistory();
    const ids = state.selIds;
    curPages()[state.pageIdx].items = curItems().filter(i => !ids.includes(i.id));
    state.selIds = [];
    render(); syncUI(); dirty();
  }
});

window.addEventListener("resize", fit);

/* ═══ Tool Group Panel ═══ */

let openGroup = null; // 'punch' | 'cutout' | 'style' | null

function toggleToolGroup(name) {
  openGroup = (openGroup === name) ? null : name;
  updateToolPanel();
}

function updateToolPanel() {
  tpPunch.classList.toggle("hidden",  openGroup !== "punch");
  tpCutout.classList.toggle("hidden", openGroup !== "cutout");
  tpStyle.classList.toggle("hidden",  openGroup !== "style");
  toolPanel.classList.toggle("hidden", openGroup === null);
  punchGroupBtn.classList.toggle("active",  openGroup === "punch");
  cutoutGroupBtn.classList.toggle("active", openGroup === "cutout");
  styleGroupBtn.classList.toggle("active",  openGroup === "style");
}

punchGroupBtn.addEventListener("click",  () => toggleToolGroup("punch"));
cutoutGroupBtn.addEventListener("click", () => toggleToolGroup("cutout"));
styleGroupBtn.addEventListener("click",  () => toggleToolGroup("style"));

/* ═══ Image Effects ═══ */

function hexToRgb(hex) {
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16)
  };
}

async function applyImageEffect(name, opts = {}) {
  const item = sel();
  if (!item || item.type !== "image") return;
  pushHistory();
  const img = await loadImg(item.src);
  const canvas = document.createElement("canvas");
  canvas.width  = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0);

  switch (name) {
    case "grayscale": effectGrayscale(ctx, canvas.width, canvas.height); break;
    case "pixelate":  effectPixelate(canvas, ctx, opts.size || 10);      break;
    case "popart":    effectPopArt(ctx, canvas.width, canvas.height);    break;
    case "gradient":  effectGradientMap(ctx, canvas.width, canvas.height, opts.from, opts.to); break;
  }

  item.src = canvas.toDataURL("image/png");
  const imgEl = stage.querySelector(`[data-id="${item.id}"] .item-img`);
  if (imgEl) imgEl.src = item.src;
  dirty();
}

function effectGrayscale(ctx, w, h) {
  const id = ctx.getImageData(0, 0, w, h);
  const d = id.data;
  for (let i = 0; i < d.length; i += 4) {
    const g = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
    d[i] = d[i + 1] = d[i + 2] = g;
  }
  ctx.putImageData(id, 0, 0);
}

function effectPixelate(canvas, ctx, size) {
  const w = canvas.width, h = canvas.height;
  const tmp = document.createElement("canvas");
  tmp.width  = Math.max(1, Math.ceil(w / size));
  tmp.height = Math.max(1, Math.ceil(h / size));
  const tc = tmp.getContext("2d");
  tc.imageSmoothingEnabled = false;
  tc.drawImage(canvas, 0, 0, tmp.width, tmp.height);
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(tmp, 0, 0, w, h);
}

function effectPopArt(ctx, w, h) {
  const id = ctx.getImageData(0, 0, w, h);
  const d = id.data;
  const levels = 4;
  const step = 255 / (levels - 1);
  for (let i = 0; i < d.length; i += 4) {
    d[i]     = Math.round(d[i]     / step) * step;
    d[i + 1] = Math.round(d[i + 1] / step) * step;
    d[i + 2] = Math.round(d[i + 2] / step) * step;
  }
  ctx.putImageData(id, 0, 0);
}

function effectGradientMap(ctx, w, h, fromHex, toHex) {
  const from = hexToRgb(fromHex), to = hexToRgb(toHex);
  const id = ctx.getImageData(0, 0, w, h);
  const d = id.data;
  for (let i = 0; i < d.length; i += 4) {
    const t = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) / 255;
    d[i]     = Math.round(from.r + (to.r - from.r) * t);
    d[i + 1] = Math.round(from.g + (to.g - from.g) * t);
    d[i + 2] = Math.round(from.b + (to.b - from.b) * t);
  }
  ctx.putImageData(id, 0, 0);
}

fxGrayBtn.addEventListener("click", () => applyImageEffect("grayscale"));
fxPixelBtn.addEventListener("click", () => applyImageEffect("pixelate", { size: +pixelSizeSlider.value }));
fxPopBtn.addEventListener("click",  () => applyImageEffect("popart"));
document.querySelectorAll(".grad-preset").forEach(btn => {
  btn.addEventListener("click", () =>
    applyImageEffect("gradient", { from: btn.dataset.from, to: btn.dataset.to })
  );
});
gradApplyBtn.addEventListener("click", () =>
  applyImageEffect("gradient", { from: gradFromColor.value, to: gradToColor.value })
);
pixelSizeSlider.addEventListener("input", () => {
  pixelSizeLabel.textContent = pixelSizeSlider.value;
});

/* ═══ Notebook Navigation ═══ */

function openNotebook(id) {
  const nb = curNotebook();
  if (nb) nb.pageIdx = state.pageIdx;
  state.activeNotebook = id;
  state.selIds = [];
  history.length = 0;
  const newNb = curNotebook();
  state.pageIdx = newNb ? (newNb.pageIdx || 0) : 0;
  shell.classList.remove("at-home");
  render(); syncUI(); syncPageUI(); fit();
  renderStageBg(curPages()[state.pageIdx]);
  dirty();
}

async function goHome() {
  const nb = curNotebook();
  if (nb) {
    nb.pageIdx = state.pageIdx;
    try { nb.coverDataUrl = await renderPageToDataUrl(nb.pages, 0); } catch(e) {}
  }
  state.activeNotebook = null;
  state.selIds = [];
  shell.classList.add("at-home");
  await renderHome();
  dirty();
}

function createNotebook(name) {
  const trimmed = name.trim() || `手账${state.notebooks.length + 1}`;
  const nb = { id: uid(), name: trimmed, pages: [{ items: [] }], pageIdx: 0, coverDataUrl: null };
  state.notebooks.push(nb);
  renderHome();
  dirty();
}

function deleteNotebook(id) {
  if (state.notebooks.length <= 1) {
    alert("至少保留一个手账本");
    return;
  }
  if (!confirm("确定要删除这个手账本吗？删除后无法恢复。")) return;
  state.notebooks = state.notebooks.filter(nb => nb.id !== id);
  renderHome();
  dirty();
}

function renameNotebook(id, newName) {
  const nb = state.notebooks.find(n => n.id === id);
  if (!nb) return;
  const trimmed = newName.trim();
  if (trimmed) nb.name = trimmed;
  dirty();
}

let dragSrcIdx = -1;

async function renderHome() {
  const grid = $("notebookGrid");
  grid.innerHTML = "";

  for (let idx = 0; idx < state.notebooks.length; idx++) {
    const nb = state.notebooks[idx];

    const card = document.createElement("div");
    card.className = "notebook-card";
    card.dataset.nbId = nb.id;

    // Cover
    const cover = document.createElement("div");
    cover.className = "nb-cover";
    if (nb.coverDataUrl) {
      const img = document.createElement("img");
      img.src = nb.coverDataUrl;
      img.alt = nb.name;
      cover.appendChild(img);
    } else {
      const placeholder = document.createElement("div");
      placeholder.className = "nb-cover-placeholder";
      placeholder.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>`;
      cover.appendChild(placeholder);
    }
    card.appendChild(cover);

    // Footer with name
    const footer = document.createElement("div");
    footer.className = "nb-footer";

    const nameEl = document.createElement("span");
    nameEl.className = "nb-name";
    nameEl.textContent = nb.name;
    nameEl.title = nb.name;

    nameEl.addEventListener("dblclick", e => {
      e.stopPropagation();
      nameEl.contentEditable = "true";
      nameEl.focus();
      const range = document.createRange();
      range.selectNodeContents(nameEl);
      window.getSelection().removeAllRanges();
      window.getSelection().addRange(range);
    });
    nameEl.addEventListener("blur", () => {
      nameEl.contentEditable = "false";
      renameNotebook(nb.id, nameEl.textContent);
      nameEl.textContent = state.notebooks.find(n => n.id === nb.id)?.name || nb.name;
    });
    nameEl.addEventListener("keydown", e => {
      if (e.key === "Enter") { e.preventDefault(); nameEl.blur(); }
      if (e.key === "Escape") {
        nameEl.textContent = nb.name;
        nameEl.contentEditable = "false";
        nameEl.blur();
      }
    });

    footer.appendChild(nameEl);
    card.appendChild(footer);

    // Delete button
    const delBtn = document.createElement("button");
    delBtn.className = "nb-delete-btn";
    delBtn.title = "删除手账本";
    delBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
    delBtn.addEventListener("click", e => {
      e.stopPropagation();
      deleteNotebook(nb.id);
    });
    card.appendChild(delBtn);

    // Open notebook on click
    card.addEventListener("click", e => {
      if (e.target.closest(".nb-delete-btn")) return;
      if (nameEl.contentEditable === "true") return;
      openNotebook(nb.id);
    });

    // Drag to reorder
    card.draggable = true;
    card.addEventListener("dragstart", () => {
      dragSrcIdx = idx;
      setTimeout(() => card.classList.add("nb-dragging"), 0);
    });
    card.addEventListener("dragend", () => {
      card.classList.remove("nb-dragging");
      grid.querySelectorAll(".notebook-card").forEach(c => c.classList.remove("nb-drag-over"));
    });
    card.addEventListener("dragover", e => {
      e.preventDefault();
      grid.querySelectorAll(".notebook-card").forEach(c => c.classList.remove("nb-drag-over"));
      card.classList.add("nb-drag-over");
    });
    card.addEventListener("drop", e => {
      e.preventDefault();
      card.classList.remove("nb-drag-over");
      if (dragSrcIdx === idx || dragSrcIdx < 0) return;
      const [moved] = state.notebooks.splice(dragSrcIdx, 1);
      state.notebooks.splice(idx, 0, moved);
      dragSrcIdx = -1;
      renderHome();
      dirty();
    });

    grid.appendChild(card);
  }
}

/* ═══ Notebook Modal ═══ */

const newNbOverlay   = $("newNbOverlay");
const newNbModal     = $("newNbModal");
const newNbNameInput = $("newNbNameInput");
const newNbOkBtn     = $("newNbOkBtn");
const newNbCancelBtn = $("newNbCancelBtn");

function openNewNbModal() {
  newNbNameInput.value = "";
  newNbModal.classList.remove("hidden");
  newNbOverlay.classList.remove("hidden");
  setTimeout(() => newNbNameInput.focus(), 50);
}

function closeNewNbModal() {
  newNbModal.classList.add("hidden");
  newNbOverlay.classList.add("hidden");
}

$("newNotebookBtn").addEventListener("click", openNewNbModal);
newNbCancelBtn.addEventListener("click", closeNewNbModal);
newNbOverlay.addEventListener("click", closeNewNbModal);

newNbOkBtn.addEventListener("click", () => {
  createNotebook(newNbNameInput.value.trim() || `手账${state.notebooks.length + 1}`);
  closeNewNbModal();
});

newNbNameInput.addEventListener("keydown", e => {
  if (e.key === "Enter") newNbOkBtn.click();
  if (e.key === "Escape") closeNewNbModal();
});

/* ═══ Home Button ═══ */

$("homeBtn").addEventListener("click", goHome);

/* ═══ Stage Background Rendering ═══ */

function renderStageBg(page) {
  const bg = page?.bg || null;
  const layer = $("stageBgLayer");
  const img   = $("stageBgImg");
  if (!bg || !bg.src) {
    stage.classList.remove("has-custom-bg");
    layer.className = "stage-bg-layer";
    img.src = "";
    img.style.transform = "";
    return;
  }
  stage.classList.add("has-custom-bg");
  layer.className = "stage-bg-layer " + (bg.type === "fill" ? "mode-fill" : "mode-shape");
  img.src = bg.src;
  // translate(-50%,-50%) centres the img on the layer, then apply user transforms
  img.style.transform = `translate(-50%,-50%) rotate(${bg.rotation || 0}deg) scale(${bg.scale || 1}) translate(${bg.offsetX || 0}px,${bg.offsetY || 0}px)`;
}

/* ═══ Paper / Background Modal ═══ */

const paperOverlay      = $("paperOverlay");
const paperModal        = $("paperModal");
const paperPreviewCanvas = $("paperPreviewCanvas");
const paperTabFill      = $("paperTabFill");
const paperTabShape     = $("paperTabShape");
const paperUploadBtn    = $("paperUploadBtn");
const paperRotSlider    = $("paperRotSlider");
const paperRotVal       = $("paperRotVal");
const paperRotRow       = $("paperRotRow");
const paperScaleSlider  = $("paperScaleSlider");
const paperScaleVal     = $("paperScaleVal");
const paperResetBtn     = $("paperResetBtn");
const paperRemoveBtn    = $("paperRemoveBtn");
const paperCancelBtn    = $("paperCancelBtn");
const paperOkBtn        = $("paperOkBtn");
const paperTip          = $("paperTip");

const PW = 280, PH = 390; // preview canvas size (half of 560x780)
const PREVIEW_SCALE = PW / W; // 0.5

// Working state for the modal (not yet applied)
let paperState = {
  src: null,       // data URL
  type: "fill",    // "fill" | "shape"
  rotation: 0,
  scale: 1,
  offsetX: 0,
  offsetY: 0,
  imgW: 0, imgH: 0  // natural size of uploaded image
};
let paperDragging = false, paperDragStartX = 0, paperDragStartY = 0;
let paperDragOffX = 0, paperDragOffY = 0;

function calcDefaultScale(imgW, imgH, type) {
  if (type === "fill") return Math.max(W / imgW, H / imgH);
  return Math.min(W / imgW, H / imgH);
}

function updatePaperTip() {
  paperTip.textContent = paperState.type === "fill"
    ? "填充模式：图片将铺满页面，超出部分自动裁剪"
    : "异形模式：保留PNG透明区域，图片等比缩放至不超出页面";
}

function updatePaperSliders() {
  paperRotSlider.value  = paperState.rotation;
  paperRotVal.textContent = paperState.rotation + "°";
  paperScaleSlider.value  = Math.round(paperState.scale * 100);
  paperScaleVal.textContent = Math.round(paperState.scale * 100) + "%";
  paperRotRow.classList.toggle("hidden", paperState.type === "shape");
}

async function drawPaperPreview() {
  const ctx = paperPreviewCanvas.getContext("2d");
  ctx.clearRect(0, 0, PW, PH);

  // Paper background
  ctx.fillStyle = "#fcfcfc";
  ctx.fillRect(0, 0, PW, PH);
  try {
    const svgBg = await loadImg("./assets/journal-page.svg");
    ctx.drawImage(svgBg, 0, 0, PW, PH);
  } catch(e) {}

  if (!paperState.src) return;

  try {
    const img = await loadImg(paperState.src);
    ctx.save();
    if (paperState.type === "fill") {
      ctx.beginPath(); ctx.rect(0, 0, PW, PH); ctx.clip();
    }
    ctx.translate(PW / 2, PH / 2);
    ctx.rotate((paperState.rotation || 0) * Math.PI / 180);
    ctx.scale((paperState.scale || 1) * PREVIEW_SCALE, (paperState.scale || 1) * PREVIEW_SCALE);
    ctx.translate(paperState.offsetX || 0, paperState.offsetY || 0);
    ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
    ctx.restore();
  } catch(e) {}

  // Page border outline
  ctx.strokeStyle = "rgba(212,82,122,.4)";
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, PW - 1, PH - 1);
}

function openPaperModal() {
  // Load current page's bg into working state
  const page = curPages()[state.pageIdx];
  if (page?.bg) {
    paperState = { ...page.bg, imgW: 0, imgH: 0 };
    // Load natural dimensions
    if (page.bg.src) {
      loadImg(page.bg.src).then(img => {
        paperState.imgW = img.naturalWidth;
        paperState.imgH = img.naturalHeight;
      });
    }
  } else {
    paperState = { src: null, type: "fill", rotation: 0, scale: 1, offsetX: 0, offsetY: 0, imgW: 0, imgH: 0 };
  }

  // Sync UI
  paperTabFill.classList.toggle("active",  paperState.type === "fill");
  paperTabShape.classList.toggle("active", paperState.type === "shape");
  updatePaperSliders();
  updatePaperTip();

  paperModal.classList.remove("hidden");
  paperOverlay.classList.remove("hidden");
  drawPaperPreview();
}

function closePaperModal() {
  paperModal.classList.add("hidden");
  paperOverlay.classList.add("hidden");
}

// Mode tab switching
paperTabFill.addEventListener("click", () => {
  paperState.type = "fill";
  paperTabFill.classList.add("active");
  paperTabShape.classList.remove("active");
  // Recalc scale for fill mode if image is loaded
  if (paperState.src && paperState.imgW) {
    paperState.scale = calcDefaultScale(paperState.imgW, paperState.imgH, "fill");
  }
  updatePaperSliders(); updatePaperTip(); drawPaperPreview();
});

paperTabShape.addEventListener("click", () => {
  paperState.type = "shape";
  paperTabShape.classList.add("active");
  paperTabFill.classList.remove("active");
  if (paperState.src && paperState.imgW) {
    paperState.scale = calcDefaultScale(paperState.imgW, paperState.imgH, "shape");
  }
  updatePaperSliders(); updatePaperTip(); drawPaperPreview();
});

// Upload
paperUploadBtn.addEventListener("click", async () => {
  try {
    const url = await window.journalApi.pickImage();
    if (!url) return;
    const img = await loadImg(url);
    paperState.src  = url;
    paperState.imgW = img.naturalWidth;
    paperState.imgH = img.naturalHeight;
    paperState.rotation = 0;
    paperState.offsetX  = 0;
    paperState.offsetY  = 0;
    paperState.scale = calcDefaultScale(img.naturalWidth, img.naturalHeight, paperState.type);
    updatePaperSliders();
    drawPaperPreview();
  } catch(e) { console.error("paper upload error", e); }
});

// Rotation slider
paperRotSlider.addEventListener("input", () => {
  paperState.rotation = Number(paperRotSlider.value);
  paperRotVal.textContent = paperState.rotation + "°";
  drawPaperPreview();
});

// Scale slider
paperScaleSlider.addEventListener("input", () => {
  paperState.scale = Number(paperScaleSlider.value) / 100;
  paperScaleVal.textContent = paperScaleSlider.value + "%";
  drawPaperPreview();
});

// Reset
paperResetBtn.addEventListener("click", () => {
  paperState.rotation = 0;
  paperState.offsetX  = 0;
  paperState.offsetY  = 0;
  if (paperState.imgW) {
    paperState.scale = calcDefaultScale(paperState.imgW, paperState.imgH, paperState.type);
  }
  updatePaperSliders();
  drawPaperPreview();
});

// Preview canvas drag to pan
paperPreviewCanvas.addEventListener("mousedown", e => {
  if (!paperState.src) return;
  paperDragging = true;
  paperDragStartX = e.clientX;
  paperDragStartY = e.clientY;
  paperDragOffX = paperState.offsetX;
  paperDragOffY = paperState.offsetY;
  e.preventDefault();
});
document.addEventListener("mousemove", e => {
  if (!paperDragging) return;
  // Convert drag delta from preview-canvas pixels to image-coordinate pixels
  // Preview scale = PREVIEW_SCALE * paperState.scale, so divide by that
  const divisor = (paperState.scale || 1) * PREVIEW_SCALE;
  paperState.offsetX = paperDragOffX + (e.clientX - paperDragStartX) / divisor;
  paperState.offsetY = paperDragOffY + (e.clientY - paperDragStartY) / divisor;
  drawPaperPreview();
});
document.addEventListener("mouseup", () => { paperDragging = false; });

// Remove background
paperRemoveBtn.addEventListener("click", () => {
  const pages = curPages();
  if (!pages[state.pageIdx]) return;
  pushHistory();
  pages[state.pageIdx].bg = null;
  renderStageBg(pages[state.pageIdx]);
  dirty();
  closePaperModal();
});

// Cancel
paperCancelBtn.addEventListener("click", closePaperModal);
paperOverlay.addEventListener("click", closePaperModal);

// Apply
paperOkBtn.addEventListener("click", () => {
  if (!paperState.src) { closePaperModal(); return; }
  const pages = curPages();
  if (!pages[state.pageIdx]) return;
  pushHistory();
  pages[state.pageIdx].bg = {
    type:     paperState.type,
    src:      paperState.src,
    rotation: paperState.rotation,
    scale:    paperState.scale,
    offsetX:  paperState.offsetX,
    offsetY:  paperState.offsetY
  };
  renderStageBg(pages[state.pageIdx]);
  dirty();
  closePaperModal();
});

$("paperBtn").addEventListener("click", openPaperModal);

boot();
