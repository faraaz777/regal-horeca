'use client';

import { useState, useRef, useEffect } from 'react';

/**
 * ColorPicker Component
 * 
 * A custom color picker with:
 * - Color wheel for hue selection
 * - Saturation/Lightness slider
 * - Hex code input
 * - Color name input
 */
export default function ColorPicker({ initialColor = '#000000', initialName = '', onColorChange, onNameChange }) {
  const [hue, setHue] = useState(0); // 0-360
  const [saturation, setSaturation] = useState(100); // 0-100
  const [lightness, setLightness] = useState(50); // 0-100
  const [hex, setHex] = useState(initialColor);
  const [colorName, setColorName] = useState(initialName);
  const [isDragging, setIsDragging] = useState(false);
  const [isDraggingSlider, setIsDraggingSlider] = useState(false);
  
  const wheelRef = useRef(null);
  const sliderRef = useRef(null);

  // Convert HSL to Hex
  const hslToHex = (h, s, l) => {
    s /= 100;
    l /= 100;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m = l - c / 2;
    let r = 0, g = 0, b = 0;

    if (0 <= h && h < 60) {
      r = c; g = x; b = 0;
    } else if (60 <= h && h < 120) {
      r = x; g = c; b = 0;
    } else if (120 <= h && h < 180) {
      r = 0; g = c; b = x;
    } else if (180 <= h && h < 240) {
      r = 0; g = x; b = c;
    } else if (240 <= h && h < 300) {
      r = x; g = 0; b = c;
    } else if (300 <= h && h < 360) {
      r = c; g = 0; b = x;
    }
    r = Math.round((r + m) * 255);
    g = Math.round((g + m) * 255);
    b = Math.round((b + m) * 255);

    return `#${[r, g, b].map(x => {
      const hex = x.toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    }).join('')}`;
  };

  // Convert Hex to HSL
  const hexToHsl = (hex) => {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;

    if (max === min) {
      h = s = 0;
    } else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
        default: h = 0;
      }
    }

    return {
      h: Math.round(h * 360),
      s: Math.round(s * 100),
      l: Math.round(l * 100)
    };
  };

  // Initialize from hex if provided
  useEffect(() => {
    if (initialColor && initialColor.match(/^#[0-9A-Fa-f]{6}$/) && hex !== initialColor) {
      const hsl = hexToHsl(initialColor);
      setHue(hsl.h);
      setSaturation(hsl.s);
      setLightness(hsl.l);
      setHex(initialColor);
    }
  }, [initialColor]);

  // Track if update is from user interaction vs hex input
  const isFromHexInputRef = useRef(false);
  
  // Update hex when HSL changes (but prevent infinite loops)
  useEffect(() => {
    if (isFromHexInputRef.current) {
      isFromHexInputRef.current = false;
      return; // Skip this update if it came from hex input
    }
    
    const newHex = hslToHex(hue, saturation, lightness);
    if (newHex !== hex) {
      setHex(newHex);
      if (onColorChange) {
        onColorChange(newHex);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hue, saturation, lightness]);

  // Handle wheel click/drag
  const handleWheelInteraction = (e) => {
    if (!wheelRef.current) return;
    const rect = wheelRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const x = e.clientX - centerX;
    const y = e.clientY - centerY;
    const distance = Math.sqrt(x * x + y * y);
    const radius = rect.width / 2;

    if (distance <= radius) {
      const angle = Math.atan2(y, x) * (180 / Math.PI);
      const normalizedAngle = (angle + 90 + 360) % 360;
      setHue(normalizedAngle);

      // Calculate saturation based on distance from center
      const maxDistance = radius * 0.85; // Leave some margin
      const newSaturation = Math.min(100, Math.max(0, (distance / maxDistance) * 100));
      setSaturation(newSaturation);
    }
  };

  const handleWheelMouseDown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    handleWheelInteraction(e);
  };

  const handleSliderMouseDown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingSlider(true);
    handleSliderInteraction(e);
  };

  const handleSliderInteraction = (e) => {
    if (!sliderRef.current) return;
    const rect = sliderRef.current.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const percentage = Math.max(0, Math.min(100, (y / rect.height) * 100));
    setLightness(100 - percentage); // Invert so top is light
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isDragging && wheelRef.current) {
        handleWheelInteraction(e);
      }
      if (isDraggingSlider && sliderRef.current) {
        handleSliderInteraction(e);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsDraggingSlider(false);
    };

    if (isDragging || isDraggingSlider) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isDraggingSlider]);

  // Handle hex input change
  const handleHexChange = (e) => {
    e.stopPropagation();
    const value = e.target.value;
    if (value.match(/^#[0-9A-Fa-f]{0,6}$/)) {
      setHex(value);
      if (value.length === 7 && value.match(/^#[0-9A-Fa-f]{6}$/)) {
        isFromHexInputRef.current = true; // Mark that this update is from hex input
        const hsl = hexToHsl(value);
        setHue(hsl.h);
        setSaturation(hsl.s);
        setLightness(hsl.l);
        if (onColorChange) {
          onColorChange(value);
        }
      }
    }
  };

  // Handle name change
  const handleNameChange = (e) => {
    e.stopPropagation();
    const value = e.target.value;
    setColorName(value);
    if (onNameChange) {
      onNameChange(value);
    }
  };

  // Sync initialName prop
  useEffect(() => {
    if (initialName !== colorName) {
      setColorName(initialName);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialName]);

  // Calculate wheel position
  const wheelRadius = 120;
  const selectorRadius = 8;
  const angle = (hue - 90) * (Math.PI / 180);
  const distance = (saturation / 100) * (wheelRadius * 0.85);
  const selectorX = wheelRadius + Math.cos(angle) * distance;
  const selectorY = wheelRadius + Math.sin(angle) * distance;

  // Current color for preview
  const currentColor = hslToHex(hue, saturation, lightness);

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Pick a color:</label>
        <input
          type="text"
          value={hex}
          onChange={handleHexChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-mono"
          placeholder="#000000"
          maxLength={7}
        />
      </div>

      <div className="flex gap-4 items-start">
        {/* Color Wheel */}
        <div className="relative">
          <div
            ref={wheelRef}
            className="relative w-60 h-60 rounded-full cursor-crosshair shadow-lg"
            style={{
              background: `conic-gradient(
                hsl(0, 100%, 50%),
                hsl(60, 100%, 50%),
                hsl(120, 100%, 50%),
                hsl(180, 100%, 50%),
                hsl(240, 100%, 50%),
                hsl(300, 100%, 50%),
                hsl(360, 100%, 50%)
              )`,
              mask: 'radial-gradient(circle at center, transparent 0%, transparent 15%, black 15%, black 85%, transparent 85%)',
              WebkitMask: 'radial-gradient(circle at center, transparent 0%, transparent 15%, black 15%, black 85%, transparent 85%)',
            }}
            onMouseDown={handleWheelMouseDown}
            onClick={(e) => {
              e.stopPropagation();
              handleWheelInteraction(e);
            }}
          >
            {/* Selector */}
            <div
              className="absolute w-4 h-4 rounded-full border-2 border-gray-800 bg-white shadow-lg transform -translate-x-1/2 -translate-y-1/2 pointer-events-none"
              style={{
                left: `${selectorX}px`,
                top: `${selectorY}px`,
              }}
            />
          </div>
        </div>

        {/* Sliders */}
        <div className="flex flex-col gap-4">
          {/* Saturation/Lightness Slider */}
          <div className="relative">
            <div
              ref={sliderRef}
              className="w-12 h-60 rounded-md cursor-pointer shadow-md relative overflow-hidden"
              style={{
                background: `linear-gradient(to bottom, 
                  hsl(${hue}, 100%, 100%),
                  hsl(${hue}, 100%, 50%),
                  hsl(${hue}, 100%, 0%)
                )`,
              }}
              onMouseDown={handleSliderMouseDown}
              onClick={(e) => {
                e.stopPropagation();
                handleSliderInteraction(e);
              }}
            >
              {/* Slider Handle */}
              <div
                className="absolute left-0 right-0 w-full h-2 border border-gray-800 bg-white shadow-lg transform -translate-y-1/2 pointer-events-none"
                style={{
                  top: `${100 - lightness}%`,
                }}
              />
            </div>
          </div>

          {/* Color Preview */}
          <div
            className="w-12 h-12 rounded-md border-2 border-gray-300 shadow-md"
            style={{ backgroundColor: currentColor }}
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Color Name:</label>
        <input
          type="text"
          value={colorName}
          onChange={handleNameChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
          placeholder="e.g., Ocean Blue"
        />
      </div>
    </div>
  );
}

