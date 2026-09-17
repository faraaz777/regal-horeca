/**
 * Specifications JSON helpers for the product form editor.
 *
 * Accepted shapes:
 *   { "specifications": [ { "label", "value", "unit" }, ... ] }
 *   [ { "label", "value", "unit" }, ... ]   // legacy array
 */

/**
 * Serialize form specifications into pretty JSON for the editor.
 */
export function convertSpecsToJson(specs = []) {
  const list = Array.isArray(specs) ? specs : [];
  const validSpecs = list
    .filter((spec) => spec !== null && spec !== undefined)
    .map((spec) => ({
      label: String(spec.label || ''),
      value: String(spec.value || ''),
      unit: String(spec.unit || ''),
    }))
    .filter((spec) => spec.label || spec.value || spec.unit);

  return JSON.stringify({ specifications: validSpecs }, null, 2);
}

/**
 * Normalize one specification item. Returns null when the item is not an object.
 */
function normalizeSpecItem(item, index) {
  if (item === null || item === undefined) {
    return { label: '', value: '', unit: '' };
  }
  if (typeof item !== 'object' || Array.isArray(item)) {
    return { error: `Specification at index ${index} must be an object` };
  }
  return {
    label: String(item.label || ''),
    value: String(item.value || ''),
    unit: String(item.unit || ''),
  };
}

/**
 * Parse + validate specifications JSON.
 * Pure: does not touch React state.
 *
 * @returns {{ ok: true, specifications: Array } | { ok: false, error: string, specifications?: Array }}
 */
export function parseSpecificationsJson(jsonString) {
  if (!jsonString || !String(jsonString).trim()) {
    return { ok: true, specifications: [] };
  }

  let parsed;
  try {
    parsed = JSON.parse(String(jsonString).trim());
  } catch (error) {
    const message =
      error instanceof SyntaxError
        ? `Invalid JSON: ${error.message}`
        : `Error parsing JSON: ${error.message}`;
    return { ok: false, error: message };
  }

  let specifications = [];
  if (Array.isArray(parsed)) {
    specifications = parsed;
  } else if (typeof parsed === 'object' && parsed !== null) {
    if (!Object.prototype.hasOwnProperty.call(parsed, 'specifications')) {
      return {
        ok: false,
        error: 'JSON must be an object with "specifications" array, or an array of specification objects',
      };
    }
    if (!Array.isArray(parsed.specifications)) {
      return { ok: false, error: '"specifications" must be an array of objects' };
    }
    specifications = parsed.specifications;
  } else {
    return {
      ok: false,
      error: 'JSON must be an object with "specifications" array, or an array of specification objects',
    };
  }

  const validatedSpecs = [];
  let filteredInvalid = false;

  for (let index = 0; index < specifications.length; index += 1) {
    const result = normalizeSpecItem(specifications[index], index);
    if (result.error) {
      return { ok: false, error: result.error };
    }
    validatedSpecs.push(result);
  }

  if (filteredInvalid) {
    return {
      ok: true,
      specifications: validatedSpecs,
      warning: 'Some specifications were invalid and have been filtered out',
    };
  }

  return { ok: true, specifications: validatedSpecs };
}
