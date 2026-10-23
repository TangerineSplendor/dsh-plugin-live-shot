export function intersect(a, b) {
  const x = Math.max(a.x, b.x), y = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.width, b.x + b.width), bottom = Math.min(a.y + a.height, b.y + b.height);
  return right - x >= 2 && bottom - y >= 2 ? { x, y, width: right - x, height: bottom - y } : null;
}
export function adjustRect(original, start, point, edge, bounds) {
  const dx = point.x - start.x, dy = point.y - start.y;
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  if (edge === 'move') return { ...original,
    x: clamp(original.x + dx, 0, bounds.width - original.width),
    y: clamp(original.y + dy, 0, bounds.height - original.height) };
  let left = original.x, top = original.y, right = left + original.width, bottom = top + original.height;
  if (edge.includes('w')) left = clamp(left + dx, 0, right - 2);
  if (edge.includes('e')) right = clamp(right + dx, left + 2, bounds.width);
  if (edge.includes('n')) top = clamp(top + dy, 0, bottom - 2);
  if (edge.includes('s')) bottom = clamp(bottom + dy, top + 2, bounds.height);
  return { x: left, y: top, width: right - left, height: bottom - top };
}
