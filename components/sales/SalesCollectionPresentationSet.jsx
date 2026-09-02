'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { adminJson } from '@/lib/client/adminFetch';
import { uploadSalesCollectionScene } from '@/lib/client/uploadImage';
import { scenesFromPresentationSet } from '@/lib/shared/presentationSet';
import { MAX_PRESENTATION_SCENES } from '@/lib/shared/salesConstants';
import { ChevronLeftIcon, ChevronRightIcon, EditIcon, PlusIcon } from '@/components/Icons';

/**
 * Percent coords must follow the drawn bitmap under object-contain,
 * not the letterboxed <img> box — otherwise pins drift on tablet.
 */
function getContainedImageBox(img) {
  if (!img?.naturalWidth || !img.naturalHeight || !img.clientWidth || !img.clientHeight) {
    return null;
  }
  const scale = Math.min(img.clientWidth / img.naturalWidth, img.clientHeight / img.naturalHeight);
  const renderedW = img.naturalWidth * scale;
  const renderedH = img.naturalHeight * scale;
  return {
    offsetX: (img.clientWidth - renderedW) / 2,
    offsetY: (img.clientHeight - renderedH) / 2,
    renderedW,
    renderedH,
  };
}

function clickToPct(img, clientX, clientY) {
  const box = getContainedImageBox(img);
  if (!box) return null;
  const rect = img.getBoundingClientRect();
  const x = clientX - rect.left - box.offsetX;
  const y = clientY - rect.top - box.offsetY;
  if (x < 0 || y < 0 || x > box.renderedW || y > box.renderedH) return null;
  return {
    xPct: Math.min(100, Math.max(0, (x / box.renderedW) * 100)),
    yPct: Math.min(100, Math.max(0, (y / box.renderedH) * 100)),
  };
}

function serializeScenes(scenes) {
  return scenes.map((scene) => ({
    ...(scene._id ? { _id: scene._id } : {}),
    imageUrl: scene.imageUrl,
    pins: (scene.pins || []).map((pin) => ({
      ...(pin._id ? { _id: pin._id } : {}),
      productId: pin.productId,
      xPct: pin.xPct,
      yPct: pin.yPct,
    })),
  }));
}

function PinDot({ xPct, yPct, pending = false, onClick, label }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="absolute z-10 flex items-center justify-center w-11 h-11 -translate-x-1/2 -translate-y-1/2 pointer-events-auto"
      style={{ left: `${xPct}%`, top: `${yPct}%` }}
    >
      <span
        className={`block w-4 h-4 rounded-full border-2 shadow ring-2 ring-white ${
          pending ? 'bg-rich-black border-white animate-pulse' : 'bg-white border-rich-black'
        }`}
      />
    </button>
  );
}

export default function SalesCollectionPresentationSet({
  collectionId,
  presentationSet,
  products = [],
  canAddToBucket = false,
  onAddToBucket,
  onUpdated,
}) {
  const addInputId = useId();
  const replaceInputId = useId();
  const addInputRef = useRef(null);
  const replaceInputRef = useRef(null);
  const imgRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [contentBox, setContentBox] = useState(null);
  const [pendingPin, setPendingPin] = useState(null);
  const [selectedPinKey, setSelectedPinKey] = useState(null);
  const [activeIndex, setActiveIndex] = useState(0);
  /**
   * View is the default: look at pins, add to bucket.
   * Tagging is opt-in so a tap on the photo does not keep asking for another product.
   */
  const [tagging, setTagging] = useState(false);
  const [sceneMenuOpen, setSceneMenuOpen] = useState(false);
  const sceneMenuRef = useRef(null);

  const scenes = useMemo(
    () => scenesFromPresentationSet(presentationSet),
    [presentationSet]
  );
  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const atCap = scenes.length >= MAX_PRESENTATION_SCENES;
  const remainingSlots = Math.max(0, MAX_PRESENTATION_SCENES - scenes.length);

  const safeIndex = scenes.length === 0 ? 0 : Math.min(activeIndex, scenes.length - 1);
  const activeScene = scenes[safeIndex] || null;
  const imageUrl = activeScene?.imageUrl || '';

  const pins = useMemo(
    () => (activeScene?.pins || []).filter((pin) => productById.has(String(pin.productId))),
    [activeScene, productById]
  );

  const measure = useCallback(() => {
    const img = imgRef.current;
    const box = getContainedImageBox(img);
    if (!img || !box) {
      setContentBox(null);
      return;
    }
    setContentBox({
      offsetX: img.offsetLeft + box.offsetX,
      offsetY: img.offsetTop + box.offsetY,
      renderedW: box.renderedW,
      renderedH: box.renderedH,
    });
  }, []);

  const enterTagging = () => {
    setTagging(true);
    setSelectedPinKey(null);
  };

  const exitTagging = () => {
    setTagging(false);
    setPendingPin(null);
    setSelectedPinKey(null);
  };

  const selectScene = (index) => {
    setActiveIndex(index);
    setPendingPin(null);
    setSelectedPinKey(null);
    setContentBox(null);
  };

  useEffect(() => {
    if (activeIndex >= scenes.length) {
      setActiveIndex(Math.max(0, scenes.length - 1));
    }
  }, [scenes.length, activeIndex]);

  useEffect(() => {
    if (!sceneMenuOpen) return undefined;
    const onDoc = (e) => {
      if (sceneMenuRef.current && !sceneMenuRef.current.contains(e.target)) {
        setSceneMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [sceneMenuOpen]);

  useEffect(() => {
    const img = imgRef.current;
    if (!img) return undefined;
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(img);
    return () => ro.disconnect();
  }, [imageUrl, measure]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (pendingPin) {
        setPendingPin(null);
        return;
      }
      if (selectedPinKey) {
        setSelectedPinKey(null);
        return;
      }
      if (tagging) exitTagging();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pendingPin, selectedPinKey, tagging]);

  const persist = async (nextScenes) => {
    setSaving(true);
    try {
      await adminJson(`/api/sales/collections/${collectionId}`, {
        method: 'PATCH',
        body: JSON.stringify({ presentationSet: { scenes: serializeScenes(nextScenes) } }),
      });
      await onUpdated?.();
    } catch (e) {
      toast.error(e.message || 'Failed to save presentation set');
      throw e;
    } finally {
      setSaving(false);
    }
  };

  const handleAddFiles = async (e) => {
    const picked = Array.from(e.target.files || []);
    if (addInputRef.current) addInputRef.current.value = '';
    if (picked.length === 0) return;
    if (remainingSlots <= 0) {
      toast.error(`Maximum ${MAX_PRESENTATION_SCENES} photos`);
      return;
    }

    const files = picked.slice(0, remainingSlots);
    if (picked.length > remainingSlots) {
      toast.error(`Only ${remainingSlots} more photo${remainingSlots === 1 ? '' : 's'} allowed`);
    }
    setUploading(true);
    try {
      const urls = [];
      for (const file of files) {
        urls.push(await uploadSalesCollectionScene(file));
      }
      const existing = new Set(scenes.map((s) => s.imageUrl));
      const added = urls
        .filter((url) => !existing.has(url))
        .map((url) => ({ imageUrl: url, pins: [] }));
      if (added.length === 0) {
        toast.error('That photo is already in this set');
        return;
      }
      const next = [...scenes, ...added];
      await persist(next);
      setActiveIndex(scenes.length);
      setPendingPin(null);
      setSelectedPinKey(null);
      if (products.length > 0) enterTagging();
      toast.success(added.length === 1 ? 'Photo added' : `${added.length} photos added`);
    } catch (err) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleReplaceFile = async (e) => {
    const file = e.target.files?.[0];
    if (replaceInputRef.current) replaceInputRef.current.value = '';
    if (!file || !activeScene) return;
    setUploading(true);
    try {
      const url = await uploadSalesCollectionScene(file);
      if (scenes.some((s, i) => i !== safeIndex && s.imageUrl === url)) {
        toast.error('That photo is already in this set');
        return;
      }
      /**
       * Replacing this table-setup photo invalidates pin positions on this
       * scene only — other photos keep their pins.
       */
      const next = scenes.map((scene, i) =>
        i === safeIndex ? { ...scene, imageUrl: url, pins: [] } : scene
      );
      await persist(next);
      setPendingPin(null);
      setSelectedPinKey(null);
      if (products.length > 0) enterTagging();
      toast.success('Photo replaced');
    } catch (err) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveScene = async () => {
    if (!activeScene) return;
    try {
      const next = scenes.filter((_, i) => i !== safeIndex);
      await persist(next);
      setActiveIndex(Math.max(0, safeIndex - 1));
      setPendingPin(null);
      setSelectedPinKey(null);
      if (next.length === 0) exitTagging();
      toast.success('Photo removed');
    } catch {
      /* persist already toasts */
    }
  };

  const handleImageClick = (e) => {
    if (!tagging || saving || uploading || products.length === 0) return;
    const pct = clickToPct(imgRef.current, e.clientX, e.clientY);
    if (!pct) return;
    setSelectedPinKey(null);
    setPendingPin(pct);
  };

  const handlePickProduct = async (product) => {
    if (!pendingPin || !activeScene) return;
    const nextPins = [
      ...pins.map((pin) => ({
        ...(pin._id ? { _id: pin._id } : {}),
        productId: pin.productId,
        xPct: pin.xPct,
        yPct: pin.yPct,
      })),
      { productId: product.id, xPct: pendingPin.xPct, yPct: pendingPin.yPct },
    ];
    const next = scenes.map((scene, i) =>
      i === safeIndex ? { ...scene, pins: nextPins } : scene
    );
    try {
      await persist(next);
      setPendingPin(null);
    } catch {
      /* persist already toasts */
    }
  };

  const handleDeletePin = async (pin) => {
    const nextPins = pins
      .filter((p) => (p._id && pin._id ? p._id !== pin._id : p !== pin))
      .map((p) => ({
        ...(p._id ? { _id: p._id } : {}),
        productId: p.productId,
        xPct: p.xPct,
        yPct: p.yPct,
      }));
    const next = scenes.map((scene, i) =>
      i === safeIndex ? { ...scene, pins: nextPins } : scene
    );
    try {
      await persist(next);
      setSelectedPinKey(null);
    } catch {
      /* persist already toasts */
    }
  };

  const selectedPin = pins.find((p, i) => (p._id || String(i)) === selectedPinKey);
  const selectedProduct = selectedPin ? productById.get(String(selectedPin.productId)) : null;
  const busy = uploading || saving;

  return (
    <div className="space-y-2">
      <input
        ref={addInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        multiple
        onChange={handleAddFiles}
        disabled={busy || atCap}
        className="sr-only"
        id={addInputId}
      />
      <input
        ref={replaceInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        onChange={handleReplaceFile}
        disabled={busy || !imageUrl}
        className="sr-only"
        id={replaceInputId}
      />

      {scenes.length === 0 ? (
        <label
          htmlFor={addInputId}
          className={`flex items-center justify-center min-h-[220px] lg:min-h-[360px] bg-warm-white text-[10px] font-semibold uppercase tracking-[0.18em] text-black/35 cursor-pointer rounded-sm ${
            busy || atCap ? 'opacity-50 pointer-events-none' : ''
          }`}
        >
          {uploading ? 'Uploading…' : 'Add table photos'}
        </label>
      ) : (
        <>
          <div className="relative bg-warm-white rounded-sm">
            <img
              ref={imgRef}
              src={imageUrl}
              alt={`Presentation ${safeIndex + 1}`}
              onLoad={measure}
              onClick={handleImageClick}
              className={`block w-full max-h-[min(70vh,560px)] object-contain mx-auto select-none ${
                tagging ? 'cursor-crosshair' : 'cursor-default'
              }`}
            />

            {scenes.length > 1 && (
              <>
                <button
                  type="button"
                  aria-label="Previous photo"
                  onClick={() => selectScene((safeIndex - 1 + scenes.length) % scenes.length)}
                  className="absolute left-2 top-1/2 -translate-y-1/2 z-20 w-11 h-11 inline-flex items-center justify-center bg-white/95 text-rich-black border border-black/[0.06] shadow-sm rounded-sm"
                >
                  <ChevronLeftIcon className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  aria-label="Next photo"
                  onClick={() => selectScene((safeIndex + 1) % scenes.length)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 z-20 w-11 h-11 inline-flex items-center justify-center bg-white/95 text-rich-black border border-black/[0.06] shadow-sm rounded-sm"
                >
                  <ChevronRightIcon className="w-5 h-5" />
                </button>
              </>
            )}

            <div className="absolute top-2 right-2 z-20 flex items-center gap-1">
              {!atCap && (
                <label
                  htmlFor={addInputId}
                  className={`w-11 h-11 inline-flex items-center justify-center bg-white/95 text-rich-black border border-black/[0.06] shadow-sm cursor-pointer rounded-sm ${
                    busy ? 'opacity-50 pointer-events-none' : ''
                  }`}
                  aria-label="Add photos"
                >
                  <PlusIcon className="w-4 h-4" />
                </label>
              )}
              <div ref={sceneMenuRef} className="relative">
                <button
                  type="button"
                  onClick={() => setSceneMenuOpen((v) => !v)}
                  className="w-11 h-11 inline-flex items-center justify-center bg-white/95 text-rich-black border border-black/[0.06] shadow-sm rounded-sm"
                  aria-label="Edit this photo"
                  aria-expanded={sceneMenuOpen}
                >
                  <EditIcon className="w-4 h-4" />
                </button>
                {sceneMenuOpen && (
                  <div className="absolute right-0 top-full mt-1 w-40 bg-white border border-black/[0.08] shadow-lg py-1 rounded-sm">
                    <label
                      htmlFor={replaceInputId}
                      className="block px-3 py-2.5 text-sm text-rich-black hover:bg-warm-white cursor-pointer"
                      onClick={() => setSceneMenuOpen(false)}
                    >
                      Replace photo
                    </label>
                    <button
                      type="button"
                      disabled={busy}
                      className="w-full text-left px-3 py-2.5 text-sm text-accent hover:bg-warm-white disabled:opacity-40"
                      onClick={() => {
                        setSceneMenuOpen(false);
                        handleRemoveScene();
                      }}
                    >
                      Remove photo
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="absolute bottom-2 left-2 z-20 flex items-center gap-2">
              {imageUrl && products.length > 0 && (
                tagging ? (
                  <button
                    type="button"
                    onClick={exitTagging}
                    className="min-h-[44px] px-3 text-[10px] font-semibold uppercase tracking-[0.14em] bg-rich-black text-white rounded-sm"
                  >
                    Done tagging
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={enterTagging}
                    className="min-h-[44px] px-3 text-[10px] font-semibold uppercase tracking-[0.14em] bg-white/95 text-rich-black border border-black/[0.06] shadow-sm rounded-sm"
                  >
                    Tag products
                  </button>
                )
              )}
              {tagging && (
                <span className="text-[10px] uppercase tracking-[0.14em] text-white bg-rich-black/60 px-2 py-1 rounded-sm">
                  Tap the photo to pin
                </span>
              )}
            </div>

            {contentBox && (
              <div
                className="absolute pointer-events-none"
                style={{
                  left: contentBox.offsetX,
                  top: contentBox.offsetY,
                  width: contentBox.renderedW,
                  height: contentBox.renderedH,
                }}
              >
                {pins.map((pin, index) => {
                  const key = pin._id || String(index);
                  const product = productById.get(String(pin.productId));
                  return (
                    <PinDot
                      key={key}
                      xPct={pin.xPct}
                      yPct={pin.yPct}
                      label={product?.title || 'Pinned product'}
                      onClick={(e) => {
                        e.stopPropagation();
                        setPendingPin(null);
                        setSelectedPinKey(key);
                      }}
                    />
                  );
                })}
                {tagging && pendingPin && (
                  <PinDot
                    xPct={pendingPin.xPct}
                    yPct={pendingPin.yPct}
                    pending
                    label="New pin"
                    onClick={(e) => e.stopPropagation()}
                  />
                )}

                {selectedPin && selectedProduct && (
                  <div
                    className="absolute z-20 w-56 pointer-events-auto bg-white border border-black/[0.08] shadow-lg p-2 rounded-sm"
                    style={{
                      left: `${selectedPin.xPct}%`,
                      top: selectedPin.yPct > 70 ? undefined : `${selectedPin.yPct}%`,
                      bottom: selectedPin.yPct > 70 ? `${100 - selectedPin.yPct}%` : undefined,
                      transform: selectedPin.yPct > 70 ? 'translate(-50%, -8px)' : 'translate(-50%, 22px)',
                    }}
                  >
                    <div className="flex gap-2">
                      {selectedProduct.heroImage ? (
                        <img
                          src={selectedProduct.heroImage}
                          alt=""
                          className="w-12 h-12 object-cover shrink-0 bg-warm-white rounded-sm"
                        />
                      ) : (
                        <div className="w-12 h-12 bg-warm-white shrink-0 rounded-sm" />
                      )}
                      <p className="text-xs font-medium text-rich-black line-clamp-3 leading-snug">
                        {selectedProduct.title}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        type="button"
                        disabled={!canAddToBucket}
                        onClick={() => onAddToBucket?.(selectedProduct)}
                        className="flex-1 min-h-[44px] text-[10px] font-semibold uppercase tracking-[0.14em] bg-rich-black text-white disabled:opacity-40 rounded-sm"
                      >
                        Add
                      </button>
                      {tagging && (
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => handleDeletePin(selectedPin)}
                          className="min-h-[44px] px-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-accent"
                        >
                          Remove pin
                        </button>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedPinKey(null)}
                      className="mt-1 w-full text-[10px] uppercase tracking-[0.14em] text-black/35 min-h-[32px]"
                    >
                      Close
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 overflow-x-auto">
            {scenes.map((scene, index) => (
              <button
                key={scene._id || scene.imageUrl}
                type="button"
                onClick={() => selectScene(index)}
                aria-pressed={index === safeIndex}
                aria-label={`Photo ${index + 1}`}
                className={`relative shrink-0 w-14 h-14 overflow-hidden rounded-sm border ${
                  index === safeIndex ? 'border-rich-black' : 'border-black/[0.08] hover:border-black/25'
                }`}
              >
                <img
                  src={scene.imageUrl}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover bg-warm-white"
                />
              </button>
            ))}
            {!atCap && (
              <label
                htmlFor={addInputId}
                className={`shrink-0 w-14 h-14 rounded-sm border border-black/10 text-black/30 text-lg flex items-center justify-center cursor-pointer bg-warm-white hover:border-black/25 hover:text-rich-black ${
                  busy ? 'opacity-50 pointer-events-none' : ''
                }`}
              >
                +
              </label>
            )}
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-black/30 shrink-0">
              {scenes.length}/{MAX_PRESENTATION_SCENES}
            </span>
          </div>
        </>
      )}

      {tagging && pendingPin && (
        <div className="border border-black/10 p-3 bg-warm-white rounded-sm">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-black/40 mb-2">
            Pin a product from this collection
          </p>
          <ul className="max-h-48 overflow-y-auto divide-y divide-black/[0.06] bg-white rounded-sm">
            {products.map((product) => (
              <li key={product.id}>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handlePickProduct(product)}
                  className="w-full flex items-center gap-2 py-2 px-2 text-left min-h-[44px] hover:bg-warm-white disabled:opacity-50"
                >
                  {product.heroImage ? (
                    <img
                      src={product.heroImage}
                      alt=""
                      className="w-10 h-10 object-cover shrink-0 bg-warm-white rounded-sm"
                    />
                  ) : (
                    <div className="w-10 h-10 bg-warm-white shrink-0 rounded-sm" />
                  )}
                  <span className="text-[13px] text-rich-black line-clamp-2">{product.title}</span>
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => setPendingPin(null)}
            className="mt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-black/35 min-h-[44px]"
          >
            Cancel pin
          </button>
        </div>
      )}
    </div>
  );
}
