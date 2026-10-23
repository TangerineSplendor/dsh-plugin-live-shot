'use strict';
const $ = id => document.getElementById(id);
const canvas = $('image'), context = canvas.getContext('2d');
const selection = $('selection'), toolbar = $('toolbar'), textInput = $('text');
let mode = 'selecting', dragging = false, tool = 'select', rect, imageRect, base, ops = [], draft = null, gesture = null;
let busy = false, pendingFrame = 0, latestPoint;
function fail(error) { $('error').textContent = error.message || String(error); $('error').hidden = false; }
async function call(op, data) {
  try { return await window.shot.call(op, data); }
  catch (e) { fail(e); throw e; }
}
function point(event) { return { x: event.clientX, y: event.clientY }; }
function imagePoint(event) {
  return { x: Math.max(0, Math.min(canvas.width, (event.clientX - rect.x) * canvas.width / rect.width)),
    y: Math.max(0, Math.min(canvas.height, (event.clientY - rect.y) * canvas.height / rect.height)) };
}
function box(a, b) { return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.abs(a.x - b.x), height: Math.abs(a.y - b.y) }; }
function place(element, r) { Object.assign(element.style, { left: r.x + 'px', top: r.y + 'px', width: r.width + 'px', height: r.height + 'px' }); }
function hideEditor() { canvas.style.display = 'none'; toolbar.hidden = $('handles').hidden = textInput.hidden = true; }
function showEditor() {
  canvas.style.display = 'block'; toolbar.hidden = $('handles').hidden = false;
  place($('handles'), rect); canvas.style.cursor = tool === 'select' ? 'move' : 'crosshair';
  const w = toolbar.offsetWidth, h = toolbar.offsetHeight, below = rect.y + rect.height + 8;
  toolbar.style.left = Math.max(4, Math.min(innerWidth - w - 4, rect.x + rect.width - w)) + 'px';
  toolbar.style.top = Math.max(4, Math.min(innerHeight - h - 4, below + h <= innerHeight ? below : rect.y - h - 8)) + 'px';
  $('size').textContent = `${canvas.width} × ${canvas.height}`;
}
function paint(op) {
  const p = op.points, a = p[0], b = p[p.length - 1], r = box(a, b);
  context.save(); context.strokeStyle = op.color; context.fillStyle = op.color;
  context.lineWidth = op.width; context.lineCap = 'round'; context.lineJoin = 'round';
  if (op.tool === 'rect') context.strokeRect(r.x, r.y, r.width, r.height);
  else if (op.tool === 'ellipse') {
    context.beginPath(); context.ellipse(r.x + r.width / 2, r.y + r.height / 2, Math.max(.1, r.width / 2), Math.max(.1, r.height / 2), 0, 0, Math.PI * 2); context.stroke();
  } else if (op.tool === 'arrow') {
    const angle = Math.atan2(b.y - a.y, b.x - a.x), head = Math.max(12, op.width * 4);
    context.beginPath(); context.moveTo(a.x, a.y); context.lineTo(b.x, b.y); context.stroke();
    context.beginPath(); context.moveTo(b.x, b.y);
    context.lineTo(b.x - head * Math.cos(angle - .45), b.y - head * Math.sin(angle - .45));
    context.lineTo(b.x - head * Math.cos(angle + .45), b.y - head * Math.sin(angle + .45)); context.closePath(); context.fill();
  } else if (op.tool === 'pen') {
    context.beginPath(); context.moveTo(a.x, a.y); for (const pt of p) context.lineTo(pt.x, pt.y); context.stroke();
  } else if (op.tool === 'text') {
      context.font = `${op.width * 4 + 14}px "Segoe UI", sans-serif`; context.textBaseline = 'top'; if (op.text) context.fillText(op.text, a.x, a.y);
  } else if (op.tool === 'mosaic') {
    const x = Math.max(0, Math.floor(r.x)), y = Math.max(0, Math.floor(r.y));
    const w = Math.min(canvas.width, Math.ceil(r.x + r.width)) - x, h = Math.min(canvas.height, Math.ceil(r.y + r.height)) - y;
    if (w > 0 && h > 0) {
      const pixels = context.getImageData(x, y, w, h);
      const step = Math.max(10, Math.round(op.width * 4));
      for (let by = 0; by < pixels.height; by += step) for (let bx = 0; bx < pixels.width; bx += step) {
        let red = 0, green = 0, blue = 0, count = 0;
        const bw = Math.min(step, pixels.width - bx), bh = Math.min(step, pixels.height - by);
        for (let dy = 0; dy < bh; dy++) for (let dx = 0; dx < bw; dx++) {
          const i = ((by + dy) * pixels.width + bx + dx) * 4;
          red += pixels.data[i]; green += pixels.data[i + 1]; blue += pixels.data[i + 2]; count++;
        }
        context.fillStyle = `rgb(${Math.round(red/count)},${Math.round(green/count)},${Math.round(blue/count)})`;
        context.fillRect(x + bx, y + by, bw, bh);
      }
    }
  }
  context.restore();
}
function render() {
  if (!base) return;
  context.clearRect(0, 0, canvas.width, canvas.height); context.drawImage(base, 0, 0);
  for (const op of ops) paint(op); if (draft) paint(draft);
}
function commitText() {
  if (!textInput.hidden) {
    if (draft && textInput.value.trim()) { draft.text = textInput.value; ops.push(draft); }
    draft = null; textInput.hidden = true; render();
  }
}
function finishStroke() { if (draft && draft.tool !== 'text') { ops.push(draft); draft = null; render(); } }
async function exportImage(op) {
  if (mode !== 'editing' || busy) return;
  commitText(); finishStroke(); busy = true;
  try { render(); await call(op, canvas.toDataURL('image/png')); }
  catch (_) {} finally { busy = false; }
}
window.shot.on(async data => {
  if (data.type === 'reset') {
    cancelAnimationFrame(pendingFrame); pendingFrame = 0; latestPoint = null;
    mode = 'selecting'; dragging = false; gesture = null; ops = []; draft = null; base = null; imageRect = null;
    tool = 'select'; for (const button of document.querySelectorAll('[data-tool]')) button.classList.toggle('active', button.dataset.tool === tool);
    selection.style.display = 'none'; selection.classList.remove('hover'); hideEditor(); $('error').hidden = true;
    document.activeElement?.blur();
  } else if (data.type === 'hover' && mode === 'selecting' && !dragging) {
    selection.classList.add('hover'); selection.style.display = data.rect ? 'block' : 'none';
    if (data.rect) place(selection, data.rect);
  } else if (data.type === 'adjusting') {
    mode = 'adjusting'; hideEditor();
  } else if (data.type === 'adjust-cancel') {
    mode = 'editing'; dragging = false; gesture = null; rect = { ...imageRect }; showEditor();
  } else if (data.type === 'selection') {
    selection.classList.remove('hover');
    rect = data.rect; place(selection, rect); selection.style.display = 'block';
  } else if (data.type === 'edit') {
    mode = 'loading'; dragging = false; gesture = null; rect = data.rect;
    const image = new Image(); image.src = 'data:image/png;base64,' + data.png;
    try {
      await image.decode();
      if (data.preserve && imageRect) {
        const oldScale = canvas.width / imageRect.width, newScale = data.width / rect.width;
        ops = ops.map(op => ({ ...op, width: op.width * newScale / oldScale, points: op.points.map(p => ({
          x: (imageRect.x + p.x / oldScale - rect.x) * newScale,
          y: (imageRect.y + p.y / oldScale - rect.y) * newScale,
        })) }));
      } else ops = [];
      imageRect = { ...rect }; base = image; canvas.width = data.width; canvas.height = data.height;
      place(selection, rect); selection.style.display = 'block'; selection.classList.remove('hover');
      place(canvas, rect); canvas.style.display = 'block'; render(); mode = 'editing';
      showEditor();
    } catch (e) { fail(e); return; }
  }
  if (data.readyId) {
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    void call('ready', data.readyId).catch(() => {});
  }
});
window.addEventListener('mousedown', event => {
  if (event.button !== 0 || busy) return;
  if (mode === 'selecting') { dragging = true; void call('down', point(event)).catch(() => {}); }
  else if (mode === 'editing' && (event.target.dataset.edge || (event.target === canvas && tool === 'select'))) {
    commitText(); gesture = { point: point(event), edge: event.target.dataset.edge || 'move' }; event.preventDefault();
  }
  else if (mode === 'editing' && event.target === canvas) {
    commitText();
    if (event.detail > 1) return;
    const p = imagePoint(event);
    draft = { tool, points: [p], color: $('color').value, width: Number($('weight').value) * canvas.width / rect.width };
    if (tool === 'text') {
      textInput.value = ''; textInput.hidden = false;
      textInput.style.left = Math.min(event.clientX, innerWidth - 220) + 'px'; textInput.style.top = Math.min(event.clientY, innerHeight - 40) + 'px'; textInput.focus();
    }
  }
});
window.addEventListener('mousemove', event => {
  if (mode === 'editing' && gesture && event.buttons && Math.hypot(event.clientX - gesture.point.x, event.clientY - gesture.point.y) >= 3) {
    mode = 'adjusting'; dragging = true; hideEditor();
    void call('adjust-down', gesture).catch(() => {});
  }
  if (mode === 'selecting' && !dragging) { void call('hover', point(event)).catch(() => {}); }
  if (['selecting', 'adjusting'].includes(mode) && dragging) {
    latestPoint = point(event);
    if (!event.buttons) { dragging = false; void call('up', latestPoint).catch(() => {}); return; }
    if (!pendingFrame) pendingFrame = requestAnimationFrame(() => { pendingFrame = 0; if (dragging) void call('move', latestPoint).catch(() => {}); });
  } else if (mode === 'editing' && draft && draft.tool !== 'text') {
    if (!event.buttons) { finishStroke(); return; }
    const p = imagePoint(event); draft.tool === 'pen' ? draft.points.push(p) : draft.points[1] = p; render();
  }
});
window.addEventListener('mouseup', event => {
  if (event.button !== 0) return;
  gesture = null;
  if (dragging) { dragging = false; void call('up', point(event)).catch(() => {}); }
  if (mode === 'editing') finishStroke();
});
window.addEventListener('contextmenu', event => { event.preventDefault(); void call('cancel').catch(() => {}); });
canvas.addEventListener('dblclick', () => { void exportImage('complete'); });
window.addEventListener('keydown', event => {
  if (event.key === 'Escape') { event.preventDefault(); void call('cancel').catch(() => {}); }
  else if (event.target === textInput) {
    if (event.key === 'Enter') { event.preventDefault(); commitText(); }
  } else if (event.key === 'Enter') { event.preventDefault(); void exportImage('complete'); }
  else if (event.ctrlKey && event.key.toLowerCase() === 'c') { event.preventDefault(); void exportImage('copy'); }
  else if (event.ctrlKey && event.key.toLowerCase() === 'z') { event.preventDefault(); ops.pop(); render(); }
});
for (const button of document.querySelectorAll('[data-tool]')) button.onclick = () => {
  commitText(); tool = button.dataset.tool;
  canvas.style.cursor = tool === 'select' ? 'move' : 'crosshair';
  for (const item of document.querySelectorAll('[data-tool]')) item.classList.toggle('active', item === button);
};
$('undo').onclick = () => { commitText(); ops.pop(); render(); };
$('save').onclick = () => { void exportImage('save'); };
$('complete').onclick = () => { void exportImage('complete'); };
$('close').onclick = () => { void call('cancel').catch(() => {}); };
document.querySelector('[data-tool="select"]').classList.add('active');
