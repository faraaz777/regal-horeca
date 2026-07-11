/**
 * Logical canvas coordinate helpers — viewport-independent storage.
 */

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

export function denormaliseRect(rect, coordinateWidth, coordinateHeight) {
  if (rect.xRatio != null && rect.yRatio != null) {
    return {
      x: rect.xRatio * coordinateWidth,
      y: rect.yRatio * coordinateHeight,
      width: (rect.widthRatio ?? rect.width / coordinateWidth) * coordinateWidth,
      height: (rect.heightRatio ?? rect.height / coordinateHeight) * coordinateHeight,
      rotation: rect.rotation ?? 0,
    };
  }
  return {
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    rotation: rect.rotation ?? 0,
  };
}

export function clampRectToCanvas(rect, coordinateWidth, coordinateHeight) {
  const width = Math.min(rect.width, coordinateWidth);
  const height = Math.min(rect.height, coordinateHeight);
  const x = Math.max(0, Math.min(rect.x, coordinateWidth - width));
  const y = Math.max(0, Math.min(rect.y, coordinateHeight - height));
  return { ...rect, x, y, width, height };
}

export function canvasToScreenPoint(point, { pan, zoom }) {
  return {
    x: point.x * zoom + pan.x,
    y: point.y * zoom + pan.y,
  };
}

export function screenToCanvasPoint(point, { pan, zoom }, viewportRect) {
  return {
    x: (point.x - viewportRect.left - pan.x) / zoom,
    y: (point.y - viewportRect.top - pan.y) / zoom,
  };
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
