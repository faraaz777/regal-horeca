'use client';

import { memo } from 'react';

function FloorPlanBackground({ backgroundImage, coordinateWidth, coordinateHeight }) {
  if (!backgroundImage?.url || backgroundImage.visible === false) return null;

  return (
    <img
      src={backgroundImage.url}
      alt="Floor plan"
      draggable={false}
      className="absolute inset-0 w-full h-full object-contain pointer-events-none select-none"
      style={{
        opacity: backgroundImage.opacity ?? 1,
        width: coordinateWidth,
        height: coordinateHeight,
      }}
    />
  );
}

export default memo(FloorPlanBackground);
