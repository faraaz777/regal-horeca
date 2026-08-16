import {
  MAX_PRESENTATION_PINS_PER_SCENE,
  MAX_PRESENTATION_SCENES,
} from '@/lib/shared/salesConstants';

function mapPin(pin) {
  if (!pin) return null;
  return {
    ...(pin._id ? { _id: String(pin._id) } : {}),
    productId: String(pin.productId),
    xPct: pin.xPct,
    yPct: pin.yPct,
  };
}

/**
 * Normalizes v1 (single imageUrl) and v2 (scenes[]) into a capped scene list.
 * Used by the detail UI so a collection saved before galleries still opens.
 */
export function scenesFromPresentationSet(ps) {
  if (!ps) return [];

  const rawScenes = Array.isArray(ps.scenes) && ps.scenes.length > 0
    ? ps.scenes
    : ps.imageUrl
      ? [{ imageUrl: ps.imageUrl, pins: ps.pins || [] }]
      : [];

  return rawScenes
    .filter((scene) => scene?.imageUrl)
    .slice(0, MAX_PRESENTATION_SCENES)
    .map((scene) => ({
      ...(scene._id ? { _id: String(scene._id) } : {}),
      imageUrl: String(scene.imageUrl),
      pins: (scene.pins || []).map(mapPin).filter(Boolean).slice(0, MAX_PRESENTATION_PINS_PER_SCENE),
    }));
}

export function presentationSceneUrls(ps) {
  return scenesFromPresentationSet(ps)
    .map((scene) => scene.imageUrl)
    .filter(Boolean);
}
