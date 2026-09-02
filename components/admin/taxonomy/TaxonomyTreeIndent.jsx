'use client';

import { TAXONOMY_GUIDE_COL_W } from './taxonomyMenuLayout';

/**
 * Subtle tree guides (vertical lines + elbow) showing parent → child depth.
 */
export default function TaxonomyTreeIndent({ depth, isLastInGroup = false }) {
  if (depth <= 0) return null;

  return (
    <div
      className="relative mr-1 flex shrink-0 self-stretch"
      style={{ width: depth * TAXONOMY_GUIDE_COL_W + 8 }}
      aria-hidden
    >
      {Array.from({ length: depth }).map((_, index) => {
        const isElbow = index === depth - 1;
        const left = index * TAXONOMY_GUIDE_COL_W + 10;

        if (isElbow) {
          return (
            <span
              key={index}
              className="absolute border-gray-200"
              style={{
                left,
                top: 0,
                width: 12,
                height: '50%',
                borderLeftWidth: 1,
                borderBottomWidth: 1,
                borderBottomLeftRadius: 6,
              }}
            />
          );
        }

        return (
          <span
            key={index}
            className="absolute top-0 bottom-0 w-px bg-gray-200"
            style={{ left: left + 6 }}
          />
        );
      })}
      {!isLastInGroup && depth > 0 && (
        <span
          className="absolute w-px bg-gray-200"
          style={{
            left: (depth - 1) * TAXONOMY_GUIDE_COL_W + 16,
            top: '50%',
            bottom: 0,
          }}
        />
      )}
    </div>
  );
}
