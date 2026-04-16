/* ── Handmake Journal — App ── */

const W = 560, H = 780; // stage dimensions match SVG

const $ = (s) => document.getElementById(s);
const stage     = $("stage");
const viewport  = $("viewport");
const wrapper   = $("wrapper");
const tpl       = $("itemTpl");
const controls     = $("selControls");
const opSlider     = $("opacitySlider");
const bgColorInput = $("bgColorInput");
const bgAlphaSlider= $("bgAlphaSlider");
const saveLabel    = $("saveStatus");
const emptyHint    = $("emptyHint");
const pageLabel    = $("pageLabel");
const prevPageBtn  = $("prevPageBtn");
const nextPageBtn  = $("nextPageBtn");

const MAX_PAGES = 10;
const state = { pages: [{ items: [] }], pageIdx: 0, selId: null };
let saveTimer = null, scale = 1;

function curItems() { return state.pages[state.pageIdx].items; }

/* ═══ Punch Tool State ═══ */
const punchCursor   = $("punchCursor");
const punchSizeWrap = $("punchSizeWrap");
const punchSizeSlider = $("punchSizeSlider");
const punchSizeLabel  = $("punchSizeLabel");
const punch = { active: false, shape: null, size: 80, rotation: 0 };

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
    await window.journalApi.saveJournal({ pages: state.pages, canvas:{width:W,height:H} });
    saveLabel.textContent = "已保存";
  } catch(e) { console.error("save err",e); saveLabel.textContent = "保存失败"; }
}

/* ═══ Viewport fit ═══ */

function fit() {
  const vw = viewport.clientWidth - 28;
  const vh = viewport.clientHeight - 28;
  scale = Math.min(vw/W, vh/H, 1);
  wrapper.style.width = W+"px";
  wrapper.style.height = H+"px";
  wrapper.style.transform = `scale(${scale})`;
}

/* ═══ Selection ═══ */

function sel() { return curItems().find(i=>i.id===state.selId)||null; }

function syncUI() {
  const s = sel();
  if (!s) { controls.classList.add("hidden"); return; }
  controls.classList.remove("hidden");
  opSlider.value = s.opacity;
  const isText = s.type === "text";
  controls.classList.toggle("show-text", isText);
  if (isText) {
    bgColorInput.value = s.bgColor || "#fffdf8";
    bgAlphaSlider.value = s.bgAlpha != null ? s.bgAlpha : 0.92;
  }
}

function select(id) {
  state.selId = id;
  stage.querySelectorAll(".item").forEach(el => {
    el.classList.toggle("selected", el.dataset.id === id);
  });
  syncUI();
}

/* ═══ Render ═══ */

function css(item, el) {
  el.style.left = item.x+"px";
  el.style.top = item.y+"px";
  el.style.width = item.width+"px";
  el.style.opacity = item.opacity;
  el.style.zIndex = item.zIndex;
  el.style.transform = `rotate(${item.rotation}deg)`;
}

function render() {
  const items = curItems();
  items.forEach((item,i) => { item.zIndex = i+1; });
  if (emptyHint) emptyHint.style.display = items.length ? "none" : "flex";

  stage.querySelectorAll(".item").forEach(e=>e.remove());

  items.forEach(item => {
    const frag = tpl.content.cloneNode(true);
    const el   = frag.querySelector(".item");
    const img  = frag.querySelector(".item-img");
    const txt  = frag.querySelector(".item-text");

    el.dataset.id = item.id;
    el.classList.toggle("selected", item.id === state.selId);
    css(item, el);

    if (item.type==="image") {
      img.src = item.src;
      txt.style.display = "none";
    } else {
      img.style.display = "none";
      txt.textContent = item.text||"";
      const bg = item.bgColor || "#fffdf8";
      const ba = item.bgAlpha != null ? item.bgAlpha : 0.92;
      txt.style.background = hexAlphaToRgba(bg, ba);
      txt.addEventListener("input", ()=>{ item.text=txt.textContent; dirty(); });
      txt.addEventListener("blur", ()=>{
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

    // Pointer interactions
    bindDrag(el, item);
    bindResize(el, item);
    bindRotate(el, item);

    el.addEventListener("mousedown", e => {
      if (punch.active) return;
      if (e.target.closest(".rh") || e.target.closest(".rotate-ring")) return;
      select(item.id);
    });

    stage.appendChild(frag);
  });
}

/* ═══ Drag ═══ */

function bindDrag(el, item) {
  el.addEventListener("mousedown", e => {
    if (punch.active || e.button !== 0) return;
    if (e.target.closest(".rh") || e.target.closest(".rotate-ring") || e.target.closest(".item-text.editing")) return;
    e.preventDefault();
    e.stopPropagation();
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
  });
}

/* ═══ Resize ═══ */

function bindResize(el, item) {
  el.querySelectorAll(".rh").forEach(h => {
    h.addEventListener("mousedown", e => {
      if (punch.active || e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      const startX = e.clientX, startY = e.clientY;
      const sw = item.width, sx = item.x, sy = item.y;
      const isL = h.classList.contains("rh-nw") || h.classList.contains("rh-sw");
      const isN = h.classList.contains("rh-nw") || h.classList.contains("rh-ne");
      select(item.id);

      function onMove(ev) {
        const dx = (ev.clientX - startX) / scale;
        const dy = (ev.clientY - startY) / scale;
        const growth = Math.abs(dx) >= Math.abs(dy)
          ? (isL ? -dx : dx)
          : (isN ? -dy : dy);
        const nw = clamp(sw + growth, 40, W - 60);
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
    if (punch.active || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const base = Math.atan2(e.clientY - cy, e.clientX - cx) * 180 / Math.PI - item.rotation;
    select(item.id);

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
    id: uid(), type:"image", src,
    x: Math.round((W-w)/2) + rnd(40),
    y: Math.round(H/3) + rnd(40),
    width: w, rotation: rnd(6), opacity: 1, zIndex: items.length+1
  });
  render();
  select(items[items.length-1].id);
  dirty();
}

function addText() {
  const items = curItems();
  const w = 150;
  items.push({
    id: uid(), type:"text", text:"",
    x: Math.round((W-w)/2) + rnd(40),
    y: Math.round(H/3) + rnd(40),
    width: w, rotation: rnd(4), opacity: 1, zIndex: items.length+1,
    bgColor: "#fffdf8", bgAlpha: 0.92
  });
  render();
  select(items[items.length-1].id);
  dirty();
}

/* ═══ Reorder ═══ */

function reorder(dir) {
  const items = curItems();
  const idx = items.findIndex(i=>i.id===state.selId);
  if (idx<0) return;
  if (dir==="up" && idx<items.length-1)
    [items[idx],items[idx+1]] = [items[idx+1],items[idx]];
  if (dir==="down" && idx>0)
    [items[idx],items[idx-1]] = [items[idx-1],items[idx]];
  render(); dirty();
}

/* ═══ Pagination ═══ */

function syncPageUI() {
  pageLabel.textContent = `${state.pageIdx + 1} / ${state.pages.length}`;
  prevPageBtn.disabled = state.pageIdx === 0;
  nextPageBtn.disabled = state.pageIdx >= MAX_PAGES - 1;
}

function goPage(idx) {
  if (idx < 0 || idx >= state.pages.length || idx === state.pageIdx) return;
  state.selId = null;
  state.pageIdx = idx;
  render(); syncUI(); syncPageUI();
}

function prevPage() {
  goPage(state.pageIdx - 1);
}

function nextPage() {
  if (state.pageIdx + 1 >= state.pages.length) {
    if (state.pages.length >= MAX_PAGES) return;
    state.pages.push({ items: [] });
    dirty();
  }
  goPage(state.pageIdx + 1);
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
        if (i === 0) ctx.moveTo(Math.cos(rad) * d, Math.sin(rad) * d);
        else ctx.lineTo(Math.cos(rad) * d, Math.sin(rad) * d);
      }
      break;
    }
    case "heart": {
      const s = r * 0.58;
      ctx.moveTo(0, s * 0.4);
      ctx.bezierCurveTo(-s * 0.2, -s * 0.4, -s * 1.1, -s * 0.4, -s * 1.1, s * 0.2);
      ctx.bezierCurveTo(-s * 1.1, s * 0.8, -s * 0.2, s * 1.2, 0, s * 1.7);
      ctx.bezierCurveTo(s * 0.2, s * 1.2, s * 1.1, s * 0.8, s * 1.1, s * 0.2);
      ctx.bezierCurveTo(s * 1.1, -s * 0.4, s * 0.2, -s * 0.4, 0, s * 0.4);
      break;
    }
    case "diamond":
      ctx.moveTo(0, -r);
      ctx.lineTo(r * 0.65, 0);
      ctx.lineTo(0, r);
      ctx.lineTo(-r * 0.65, 0);
      break;
  }
  ctx.closePath();
  ctx.restore();
}

function punchSvgPath(shape, size, rot) {
  const c = size / 2;
  let d = "";
  const rotRad = rot * Math.PI / 180;
  function rp(x, y) {
    const rx = x * Math.cos(rotRad) - y * Math.sin(rotRad) + c;
    const ry = x * Math.sin(rotRad) + y * Math.cos(rotRad) + c;
    return `${rx},${ry}`;
  }
  const r = size / 2;
  if (shape === "circle") {
    return `<circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="currentColor" stroke-width="2"/>`;
  }
  if (shape === "star") {
    const outer = r, inner = r * 0.42, spikes = 5;
    const pts = [];
    for (let i = 0; i < spikes * 2; i++) {
      const rad = (i * Math.PI / spikes) - Math.PI / 2;
      const dd = i % 2 === 0 ? outer : inner;
      pts.push(rp(Math.cos(rad) * dd, Math.sin(rad) * dd));
    }
    return `<polygon points="${pts.join(" ")}" fill="none" stroke="currentColor" stroke-width="2"/>`;
  }
  if (shape === "heart") {
    const s = r * 0.58;
    const points = [];
    for (let t = 0; t <= 1; t += 0.02) {
      const a = t * Math.PI * 2;
      const hx = 16 * Math.pow(Math.sin(a), 3) * s / 17;
      const hy = -(13 * Math.cos(a) - 5 * Math.cos(2*a) - 2 * Math.cos(3*a) - Math.cos(4*a)) * s / 17;
      points.push(rp(hx, hy));
    }
    return `<polygon points="${points.join(" ")}" fill="none" stroke="currentColor" stroke-width="2"/>`;
  }
  if (shape === "diamond") {
    const pts = [rp(0,-r), rp(r*0.65,0), rp(0,r), rp(-r*0.65,0)];
    return `<polygon points="${pts.join(" ")}" fill="none" stroke="currentColor" stroke-width="2"/>`;
  }
  return "";
}

function enterPunchMode(shape) {
  if (punch.active && punch.shape === shape) { exitPunchMode(); return; }
  punch.active = true;
  punch.shape = shape;
  punch.rotation = 0;
  select(null);
  document.querySelectorAll(".punch-shape").forEach(b => {
    b.classList.toggle("active", b.dataset.shape === shape);
  });
  punchSizeWrap.classList.remove("hidden");
  stage.classList.add("punch-mode");
  updatePunchCursorShape();
}

function exitPunchMode() {
  punch.active = false;
  punch.shape = null;
  document.querySelectorAll(".punch-shape").forEach(b => b.classList.remove("active"));
  punchSizeWrap.classList.add("hidden");
  punchCursor.classList.add("hidden");
  stage.classList.remove("punch-mode");
}

function updatePunchCursorShape() {
  const sz = punch.size;
  punchCursor.style.width = sz + "px";
  punchCursor.style.height = sz + "px";
  punchCursor.style.border = "none";
  punchCursor.style.borderRadius = "0";
  punchCursor.innerHTML = `<svg viewBox="0 0 ${sz} ${sz}" width="${sz}" height="${sz}" style="overflow:visible">${punchSvgPath(punch.shape, sz, punch.rotation)}</svg>`;
}

function clientToStage(cx, cy) {
  const rect = wrapper.getBoundingClientRect();
  return {
    x: (cx - rect.left) / scale,
    y: (cy - rect.top) / scale
  };
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
    const cx = it.x + it.width / 2, cy = it.y + ih / 2;
    const dx = stageX - cx, dy = stageY - cy;
    const rad = -it.rotation * Math.PI / 180;
    const lx = dx * Math.cos(rad) - dy * Math.sin(rad) + it.width / 2;
    const ly = dx * Math.sin(rad) + dy * Math.cos(rad) + ih / 2;
    if (lx >= 0 && lx <= it.width && ly >= 0 && ly <= ih) {
      return { item: it, localX: lx, localY: ly, imgHeight: ih, ratio };
    }
  }
  return null;
}

async function executePunch(stageX, stageY) {
  const hit = hitTestImage(stageX, stageY);
  if (!hit) return;
  const { item, localX, localY, imgHeight, ratio } = hit;
  const img = await loadImg(item.src);
  const nw = img.naturalWidth, nh = img.naturalHeight;
  const scaleToImg = nw / item.width;
  const pxSize = punch.size * scaleToImg;
  const imgLX = localX * scaleToImg;
  const imgLY = localY * scaleToImg;

  const c1 = document.createElement("canvas");
  const pxCeil = Math.ceil(pxSize);
  c1.width = pxCeil; c1.height = pxCeil;
  const ctx1 = c1.getContext("2d");
  punchPath(ctx1, punch.shape, pxCeil / 2, pxCeil / 2, pxSize, punch.rotation);
  ctx1.clip();
  ctx1.drawImage(img, -(imgLX - pxCeil / 2), -(imgLY - pxCeil / 2), nw, nh);
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

  const pieceStageSize = punch.size;
  const pieceItem = {
    id: uid(), type: "image", src: pieceSrc,
    x: stageX - pieceStageSize / 2,
    y: stageY - pieceStageSize / 2,
    width: pieceStageSize, rotation: item.rotation + punch.rotation,
    opacity: item.opacity, zIndex: 1
  };

  const holeItem = {
    id: uid(), type: "image", src: holeSrc,
    x: item.x, y: item.y,
    width: item.width, rotation: item.rotation,
    opacity: item.opacity, zIndex: 1
  };

  items.splice(idx, 1, holeItem, pieceItem);
  render(); dirty();
}

/* ═══ Bootstrap ═══ */

async function boot() {
  try {
    const d = await window.journalApi.loadJournal();
    if (d.pages) {
      state.pages = d.pages;
    } else {
      state.pages = [{ items: d.items || [] }];
    }
  } catch(e) { console.error("load err",e); state.pages=[{items:[]}]; }
  state.pageIdx = 0;
  render(); syncUI(); syncPageUI(); fit();
  saveLabel.textContent = "已保存";
}

/* ═══ Event Bindings ═══ */

// Window controls
document.querySelectorAll("[data-command]").forEach(b => {
  b.addEventListener("click", ()=> window.journalApi.commandWindow(b.dataset.command));
});

$("pinButton").addEventListener("click", async ()=>{
  const p = await window.journalApi.commandWindow("toggle-pin");
  $("pinButton").classList.toggle("pinned", p);
});

// Tools
$("captureBtn").addEventListener("click", ()=>{
  console.log("capture click");
  window.journalApi.startCapture();
});

$("importBtn").addEventListener("click", async ()=>{
  console.log("import click");
  try {
    const url = await window.journalApi.pickImage();
    if (url) addImage(url);
  } catch(e) { console.error("import err",e); }
});

$("textBtn").addEventListener("click", ()=>{
  console.log("text click");
  addText();
});

// Page navigation
prevPageBtn.addEventListener("click", prevPage);
nextPageBtn.addEventListener("click", nextPage);

// Selected-item controls
$("layerUpBtn").addEventListener("click",   ()=> reorder("up"));
$("layerDownBtn").addEventListener("click", ()=> reorder("down"));

opSlider.addEventListener("input", ()=>{
  const item = sel();
  if (item) {
    item.opacity = Number(opSlider.value);
    const el = stage.querySelector(`[data-id="${item.id}"]`);
    if (el) el.style.opacity = item.opacity;
    dirty();
  }
});

bgColorInput.addEventListener("input", ()=>{
  const item = sel();
  if (!item || item.type !== "text") return;
  item.bgColor = bgColorInput.value;
  const el = stage.querySelector(`[data-id="${item.id}"]`);
  if (el) {
    const txt = el.querySelector(".item-text");
    if (txt) txt.style.background = hexAlphaToRgba(item.bgColor, item.bgAlpha != null ? item.bgAlpha : 0.92);
  }
  dirty();
});

bgAlphaSlider.addEventListener("input", ()=>{
  const item = sel();
  if (!item || item.type !== "text") return;
  item.bgAlpha = Number(bgAlphaSlider.value);
  const el = stage.querySelector(`[data-id="${item.id}"]`);
  if (el) {
    const txt = el.querySelector(".item-text");
    if (txt) txt.style.background = hexAlphaToRgba(item.bgColor || "#fffdf8", item.bgAlpha);
  }
  dirty();
});

$("deleteBtn").addEventListener("click", ()=>{
  if (!state.selId) return;
  state.pages[state.pageIdx].items = curItems().filter(i=>i.id!==state.selId);
  state.selId = null;
  render(); syncUI(); dirty();
});

// Capture result
window.journalApi.onCaptureCreated(url => {
  console.log("capture created, len:", url?.length);
  addImage(url);
});

// Punch tool — shape buttons
document.querySelectorAll(".punch-shape").forEach(btn => {
  btn.addEventListener("click", () => enterPunchMode(btn.dataset.shape));
});
punchSizeSlider.addEventListener("input", () => {
  punch.size = Number(punchSizeSlider.value);
  punchSizeLabel.textContent = punch.size;
  updatePunchCursorShape();
});

// Punch tool — cursor preview on stage
stage.addEventListener("mousemove", e => {
  if (!punch.active) return;
  const pos = clientToStage(e.clientX, e.clientY);
  punchCursor.classList.remove("hidden");
  punchCursor.style.left = pos.x + "px";
  punchCursor.style.top = pos.y + "px";
});
stage.addEventListener("mouseleave", () => {
  if (punch.active) punchCursor.classList.add("hidden");
});
stage.addEventListener("wheel", e => {
  if (!punch.active) return;
  e.preventDefault();
  punch.rotation += e.deltaY > 0 ? 15 : -15;
  punch.rotation = ((punch.rotation % 360) + 360) % 360;
  updatePunchCursorShape();
}, { passive: false });

// Punch tool — execute punch on click
stage.addEventListener("mousedown", e => {
  if (!punch.active) return;
  if (e.button !== 0) return;
  e.preventDefault();
  e.stopPropagation();
  const pos = clientToStage(e.clientX, e.clientY);
  executePunch(pos.x, pos.y);
});

// Click empty stage → deselect
stage.addEventListener("mousedown", e => {
  if (punch.active) return;
  if (e.target === stage || e.target.closest(".empty-hint")) {
    select(null);
  }
});

// Keyboard
document.addEventListener("keydown", e => {
  if (e.key==="Escape") {
    if (punch.active) { exitPunchMode(); return; }
    const editing = stage.querySelector(".item-text.editing");
    if (editing) {
      editing.contentEditable = "false";
      editing.classList.remove("editing");
      editing.blur();
      return;
    }
    if (state.selId) { select(null); }
    return;
  }
  if (!state.selId) return;
  if ((e.key==="Delete"||e.key==="Backspace") && !document.activeElement?.closest(".item-text")) {
    state.pages[state.pageIdx].items = curItems().filter(i=>i.id!==state.selId);
    state.selId = null; render(); syncUI(); dirty();
  }
});

window.addEventListener("resize", fit);

boot();
