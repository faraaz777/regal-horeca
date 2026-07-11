/** Viewport-independent coordinate math (client + server). */

export function normaliseRect(rect, coordinateWidth, coordinateHeight) {
  if (!coordinateWidth || !coordinateHeight) {
    return { ...rect, xRatio: 0, yRatio: 0, widthRatio: 0, heightRatio: 0 };
  }
  return {
    ...rect,
    xRatio: rect.x / coordinateWidth,
    yRatio: rect.y / coordinateHeight,
    widthRatio: rect.width / coordinateWidth,
    heightRatio: rect.height / coordinateHeight,
  };
}

export function clampRectToCanvas(rect, coordinateWidth, coordinateHeight) {
  const width = Math.min(rect.width, coordinateWidth);
  const height = Math.min(rect.height, coordinateHeight);
  const x = Math.max(0, Math.min(rect.x, coordinateWidth - width));
  const y = Math.max(0, Math.min(rect.y, coordinateHeight - height));
  return { ...rect, x, y, width, height };
}

export function rectCentre(rect) {
  return {
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 2,
  };
}

export function pointInRect(point, rect) {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  );
}

export function findContainingZoneId(point, zones) {
  if (!zones?.length) return null;
  const visible = zones.filter((z) => !z.hidden);
  const sorted = [...visible].sort((a, b) => (b.zIndex ?? 0) - (a.zIndex ?? 0));
  const hit = sorted.find((z) => pointInRect(point, z));
  return hit?.id || null;
}
