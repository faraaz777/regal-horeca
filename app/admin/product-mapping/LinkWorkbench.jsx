'use client';

/**
 * Link Workbench — full-screen multi-select catalog picker.
 * Opens from Link SKU / F6. Stages picks, then creates plain SKU↔SKU links.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LayoutGrid, List, Search, X } from 'lucide-react';
import { adminJson } from '@/lib/client/adminFetch';
import { showToast } from '@/lib/utils/toast';
import styles from './workbench.module.css';

function norm(value) {
  return String(value || '').trim().toLowerCase();
}

function sameSize(a, b) {
  return norm(a?.size) && norm(a?.size) === norm(b?.size);
}

function sameType(a, b) {
  const left = norm(a?.subcategory) || norm(a?.category);
  const right = norm(b?.subcategory) || norm(b?.category);
  if (left && right && left === right) return true;
  /** Title stem when category labels are sparse. */
  const stem = (title) =>
    String(title || '')
      .toLowerCase()
      .replace(/\d+(\.\d+)?/g, ' ')
      .replace(/["']/g, ' ')
      .replace(/\b(inch|in|mm|cm|white|black|cream|gold|silver)\b/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  const sa = stem(a?.title);
  const sb = stem(b?.title);
  return Boolean(sa && sb && (sa.includes(sb) || sb.includes(sa)));
}

function matchTier(master, product) {
  if (sameType(master, product) && sameSize(master, product)) return 'best';
  if (sameType(master, product)) return 'close';
  return 'other';
}

function stockTone(label) {
  if (label === 'Out of Stock') return { cls: styles.bad, dot: styles.dotBad };
  if (label === 'Below Min') return { cls: styles.warn, dot: styles.dotWarn };
  return { cls: styles.ok, dot: styles.dot };
}

function pickWarnings(master, product) {
  const notes = [];
  if (master?.size && product?.size && !sameSize(master, product)) notes.push(`Size ${product.size}`);
  if (!sameType(master, product)) notes.push('Different type');
  if (product?.stockLabel === 'Out of Stock') notes.push('Out of stock');
  else if (product?.stockLabel === 'Below Min') notes.push('Below min');
  return notes;
}

function facetCounts(rows, key) {
  const map = new Map();
  for (const row of rows) {
    const value = String(row[key] || '').trim() || '—';
    map.set(value, (map.get(value) || 0) + 1);
  }
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([value, count]) => ({ value, count }));
}

function Thumb({ src, className }) {
  return <div className={className}>{src ? <img src={src} alt="" /> : null}</div>;
}

export default function LinkWorkbench({
  open,
  source,
  existingLinks,
  initialPickId,
  onClose,
  onSaved,
}) {
  const searchRef = useRef(null);
  const lastClickedRef = useRef(null);

  const [query, setQuery] = useState('');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState('cards');
  const [hideLinked, setHideLinked] = useState(false);
  const [brands, setBrands] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [sizes, setSizes] = useState([]);
  const [stockFilter, setStockFilter] = useState([]);
  const [picked, setPicked] = useState([]);
  const [saving, setSaving] = useState(false);

  const linkedIds = useMemo(
    () => new Set(existingLinks.map((row) => row.product.id)),
    [existingLinks]
  );

  const sessionKey = open && source?.id ? `${source.id}:${initialPickId || ''}` : '';

  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!sessionKey) return undefined;
    setQuery('');
    setPicked([]);
    setBrands([]);
    setMaterials([]);
    setSizes([]);
    setStockFilter([]);
    setHideLinked(false);
    lastClickedRef.current = null;
    const timer = setTimeout(() => searchRef.current?.focus(), 40);
    return () => clearTimeout(timer);
  }, [sessionKey]);

  useEffect(() => {
    if (!open || !source?.id) return undefined;
    const q = query.trim();
    const isOpenLoad = !q;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ sourceId: source.id, limit: '60' });
        if (q) params.set('q', q);
        const body = await adminJson(`/api/admin/product-links/search?${params}`);
        const data = body.data || [];
        setRows(data);
        if (isOpenLoad && initialPickId) {
          const hit = data.find((row) => row.id === initialPickId);
          if (hit && !linkedIds.has(hit.id)) {
            setPicked((prev) => (prev.some((row) => row.id === hit.id) ? prev : [hit]));
          }
        }
      } catch {
        setRows([]);
      } finally {
        setLoading(false);
      }
    }, q ? 220 : 0);
    return () => clearTimeout(timer);
  }, [query, open, source?.id, initialPickId, sessionKey]);

  const visible = useMemo(
    () =>
      rows.filter((row) => {
        if (hideLinked && linkedIds.has(row.id)) return false;
        if (brands.length && !brands.includes(row.brand || '—')) return false;
        if (materials.length && !materials.includes(row.material || '—')) return false;
        if (sizes.length && !sizes.includes(row.size || '—')) return false;
        if (stockFilter.length && !stockFilter.includes(row.stockLabel || '—')) return false;
        return true;
      }),
    [rows, hideLinked, linkedIds, brands, materials, sizes, stockFilter]
  );

  const groups = useMemo(() => {
    const best = [];
    const close = [];
    const other = [];
    for (const row of visible) {
      const tier = matchTier(source, row);
      if (tier === 'best') best.push(row);
      else if (tier === 'close') close.push(row);
      else other.push(row);
    }
    return [
      { key: 'best', title: 'Best match · same type & size', rows: best },
      { key: 'close', title: 'Same type, different size', rows: close },
      { key: 'other', title: 'Other', rows: other },
    ].filter((group) => group.rows.length);
  }, [visible, source]);

  const flatVisible = useMemo(() => groups.flatMap((group) => group.rows), [groups]);
  const brandFacets = useMemo(() => facetCounts(rows, 'brand'), [rows]);
  const materialFacets = useMemo(() => facetCounts(rows, 'material'), [rows]);
  const sizeFacets = useMemo(() => facetCounts(rows, 'size'), [rows]);
  const stockFacets = useMemo(() => facetCounts(rows, 'stockLabel'), [rows]);

  const toggleFacet = useCallback((value, setList) => {
    setList((prev) => (prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]));
  }, []);

  function togglePick(product, event) {
    if (linkedIds.has(product.id)) return;

    if (event?.shiftKey && lastClickedRef.current) {
      const ids = flatVisible.map((row) => row.id);
      const from = ids.indexOf(lastClickedRef.current);
      const to = ids.indexOf(product.id);
      if (from >= 0 && to >= 0) {
        const [start, end] = from < to ? [from, to] : [to, from];
        const range = flatVisible.slice(start, end + 1).filter((row) => !linkedIds.has(row.id));
        setPicked((prev) => {
          const map = new Map(prev.map((row) => [row.id, row]));
          range.forEach((row) => map.set(row.id, row));
          return [...map.values()];
        });
        lastClickedRef.current = product.id;
        return;
      }
    }

    setPicked((prev) => {
      if (prev.some((row) => row.id === product.id)) return prev.filter((row) => row.id !== product.id);
      return [...prev, product];
    });
    lastClickedRef.current = product.id;
  }

  function selectGroup(groupRows) {
    const addable = groupRows.filter((row) => !linkedIds.has(row.id));
    setPicked((prev) => {
      const map = new Map(prev.map((row) => [row.id, row]));
      addable.forEach((row) => map.set(row.id, row));
      return [...map.values()];
    });
  }

  function removePick(id) {
    setPicked((prev) => prev.filter((row) => row.id !== id));
  }

  const saveLinks = useCallback(async () => {
    if (!picked.length || !source?.id || saving) return;
    setSaving(true);
    try {
      /**
       * Parallel creates — each pair is independent and capped server-side.
       * Partial failures are reported; successful links still refresh.
       */
      const results = await Promise.allSettled(
        picked.map((product) =>
          adminJson('/api/admin/product-links', {
            method: 'POST',
            body: JSON.stringify({
              productId: source.id,
              otherProductId: product.id,
            }),
          })
        )
      );
      const ok = results.filter((r) => r.status === 'fulfilled').length;
      const fail = results.length - ok;
      if (ok) showToast.success(ok === 1 ? '1 product linked.' : `${ok} products linked.`);
      if (fail) showToast.error(`${fail} could not be linked.`);
      if (ok) {
        await onSaved?.();
        onClose?.();
      }
    } finally {
      setSaving(false);
    }
  }, [picked, source?.id, saving, onSaved, onClose]);

  useEffect(() => {
    if (!open) return undefined;
    function onKey(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose?.();
      }
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault();
        saveLinks();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, saveLinks]);

  if (!open || !source) return null;

  const afterSave = existingLinks.length + picked.length;

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Link Workbench">
      <header className={styles.head}>
        <div className={styles.masterBlock}>
          <p className={styles.masterKicker}>Master</p>
          <p className={styles.masterTitle} title={source.title}>{source.title}</p>
          <p className={styles.masterMeta}>
            {[source.brand, source.sku].filter(Boolean).join(' · ')}
          </p>
        </div>
        <div className={styles.searchBar}>
          <Search size={14} />
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, SKU, brand or barcode…"
          />
        </div>
        <div className={styles.headRight}>
          <div className={styles.viewToggle}>
            <button
              type="button"
              className={`${styles.viewBtn} ${view === 'cards' ? styles.viewBtnOn : ''}`}
              onClick={() => setView('cards')}
            >
              <LayoutGrid size={13} /> Cards
            </button>
            <button
              type="button"
              className={`${styles.viewBtn} ${view === 'list' ? styles.viewBtnOn : ''}`}
              onClick={() => setView('list')}
            >
              <List size={13} /> List
            </button>
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>
      </header>

      <div className={styles.body}>
        <aside className={styles.filters}>
          <div className={styles.filterBlock}>
            <p className={styles.filterTitle}>Show</p>
            <label className={styles.filterRow}>
              <input
                type="checkbox"
                checked={hideLinked}
                onChange={(e) => setHideLinked(e.target.checked)}
              />
              Hide already linked
            </label>
          </div>
          <FacetBlock title="Brand" facets={brandFacets} selected={brands} onToggle={(v) => toggleFacet(v, setBrands)} />
          <FacetBlock title="Material" facets={materialFacets} selected={materials} onToggle={(v) => toggleFacet(v, setMaterials)} />
          <FacetBlock title="Size" facets={sizeFacets} selected={sizes} onToggle={(v) => toggleFacet(v, setSizes)} />
          <FacetBlock title="Stock" facets={stockFacets} selected={stockFilter} onToggle={(v) => toggleFacet(v, setStockFilter)} />
        </aside>

        <section className={styles.main}>
          <div className={styles.mainBar}>
            <span>
              <strong>{visible.length}</strong> shown{loading ? ' · …' : ''}
            </span>
            <button
              type="button"
              className={styles.textBtn}
              onClick={() => selectGroup(flatVisible)}
              disabled={!flatVisible.length}
            >
              Select all
            </button>
          </div>

          <div className={styles.scroll}>
            {!loading && !visible.length ? (
              <div className={styles.empty}>
                <strong>No candidates</strong>
                Broaden filters or search.
              </div>
            ) : null}

            {view === 'cards'
              ? groups.map((group) => (
                  <div key={group.key} className={styles.group}>
                    <div className={styles.groupHead}>
                      <h3 className={styles.groupTitle}>
                        {group.title} <span>({group.rows.length})</span>
                      </h3>
                      <button type="button" className={styles.textBtn} onClick={() => selectGroup(group.rows)}>
                        Select group
                      </button>
                    </div>
                    <div className={styles.cards}>
                      {group.rows.map((product) => (
                        <ProductCard
                          key={product.id}
                          product={product}
                          master={source}
                          linked={linkedIds.has(product.id)}
                          selectedIndex={picked.findIndex((row) => row.id === product.id)}
                          onToggle={togglePick}
                        />
                      ))}
                    </div>
                  </div>
                ))
              : (
                <table className={styles.listTable}>
                  <thead>
                    <tr>
                      <th className={styles.colPick}>#</th>
                      <th className={styles.colBrand}>Brand</th>
                      <th>Product</th>
                      <th className={styles.colSize}>Size</th>
                      <th className={styles.colMat}>Material</th>
                      <th className={styles.colSku}>SKU</th>
                      <th className={styles.colStock}>Stock</th>
                      <th className={styles.colMatch}>Match</th>
                    </tr>
                  </thead>
                  <tbody>
                    {flatVisible.map((product) => {
                      const linked = linkedIds.has(product.id);
                      const selectedIndex = picked.findIndex((row) => row.id === product.id);
                      const tier = matchTier(source, product);
                      const tone = stockTone(product.stockLabel);
                      return (
                        <tr
                          key={product.id}
                          className={[
                            selectedIndex >= 0 ? styles.listSelected : '',
                            linked ? styles.listLinked : '',
                          ]
                            .filter(Boolean)
                            .join(' ') || undefined}
                          onClick={(event) => togglePick(product, event)}
                        >
                          <td>{linked ? '—' : selectedIndex >= 0 ? selectedIndex + 1 : ''}</td>
                          <td>{product.brand || '—'}</td>
                          <td title={product.title}>{product.title}</td>
                          <td className={!sameSize(source, product) ? styles.warn : undefined}>
                            {product.size || '—'}
                          </td>
                          <td>{product.material || '—'}</td>
                          <td className={styles.sku}>{product.sku || '—'}</td>
                          <td className={tone.cls}>{product.stockQty}</td>
                          <td>{tier === 'best' ? 'Exact' : tier === 'close' ? 'Close' : 'Other'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
          </div>
        </section>

        <aside className={styles.tray}>
          <div className={styles.trayHead}>
            <h2 className={styles.trayTitle}>Tray</h2>
            <span className={styles.trayCount}>{picked.length}</span>
          </div>

          <div className={styles.trayScroll}>
            <div className={styles.masterNode}>
              <span className={styles.masterNodeLabel}>Master</span>
              <strong title={source.title}>{source.title}</strong>
              <span>{[source.brand, source.sku].filter(Boolean).join(' · ')}</span>
            </div>

            <div className={styles.pickBox}>
              {!picked.length ? (
                <p className={styles.pickEmpty}>Select products to stage links here.</p>
              ) : (
                picked.map((product) => {
                  const warns = pickWarnings(source, product);
                  return (
                    <div key={product.id} className={styles.pickRow}>
                      <Thumb src={product.imageUrl} className={styles.pickThumb} />
                      <div className={styles.pickMeta}>
                        <strong title={product.title}>{product.title}</strong>
                        <span>{[product.brand, product.sku].filter(Boolean).join(' · ')}</span>
                        {warns.length ? <div className={styles.pickWarn}>{warns.join(' · ')}</div> : null}
                      </div>
                      <button
                        type="button"
                        className={styles.removeBtn}
                        aria-label="Remove"
                        onClick={() => removePick(product.id)}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {existingLinks.length ? (
              <div className={styles.linkedBlock}>
                <p className={styles.linkedTitle}>Already linked ({existingLinks.length})</p>
                {existingLinks.map((row) => (
                  <div key={row.id} className={styles.linkedRow}>
                    <Thumb src={row.product.imageUrl} className={styles.pickThumb} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <strong title={row.product.title}>{row.product.title}</strong>
                      <span>{[row.product.brand, row.product.sku].filter(Boolean).join(' · ')}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <div className={styles.controls}>
            <div className={styles.summary}>
              <div className={styles.summaryCell}>
                <span>New</span>
                <strong>{picked.length}</strong>
              </div>
              <div className={styles.summaryCell}>
                <span>Existing</span>
                <strong>{existingLinks.length}</strong>
              </div>
              <div className={styles.summaryCell}>
                <span>After</span>
                <strong>{afterSave}</strong>
              </div>
            </div>

            <div className={styles.actions}>
              <button type="button" className={styles.cancelBtn} onClick={onClose}>
                Cancel
              </button>
              <button
                type="button"
                className={styles.saveBtn}
                disabled={!picked.length || saving}
                onClick={saveLinks}
              >
                {saving
                  ? 'Linking…'
                  : picked.length
                    ? `Link ${picked.length}  [Ctrl+Enter]`
                    : 'Select to link'}
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function FacetBlock({ title, facets, selected, onToggle }) {
  if (!facets.length) return null;
  return (
    <div className={styles.filterBlock}>
      <p className={styles.filterTitle}>{title}</p>
      {facets.map((facet) => (
        <label key={facet.value} className={styles.filterRow}>
          <input
            type="checkbox"
            checked={selected.includes(facet.value)}
            onChange={() => onToggle(facet.value)}
          />
          <span className={styles.filterLabel}>{facet.value}</span>
          <span className={styles.filterCount}>{facet.count}</span>
        </label>
      ))}
    </div>
  );
}

function ProductCard({ product, master, linked, selectedIndex, onToggle }) {
  const tier = matchTier(master, product);
  const tone = stockTone(product.stockLabel);
  const selected = selectedIndex >= 0;
  const badgeClass =
    linked
      ? styles.badgeLinked
      : tier === 'best'
        ? styles.badgeExact
        : tier === 'close'
          ? styles.badgeClose
          : styles.badgeOther;
  const badgeLabel = linked ? 'Linked' : tier === 'best' ? 'Exact' : tier === 'close' ? 'Close' : 'Other';

  return (
    <button
      type="button"
      className={[
        styles.card,
        selected ? styles.cardSelected : '',
        linked ? styles.cardLinked : '',
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={(event) => onToggle(product, event)}
      disabled={linked}
    >
      <div className={styles.cardImg}>
        {product.imageUrl ? <img src={product.imageUrl} alt="" /> : null}
        <span className={`${styles.badge} ${badgeClass}`}>{badgeLabel}</span>
        {!linked ? <span className={styles.check}>{selected ? selectedIndex + 1 : ''}</span> : null}
      </div>
      <div className={styles.cardBody}>
        <p className={styles.cardBrand}>{product.brand || '—'}</p>
        <p className={styles.cardTitle} title={product.title}>{product.title}</p>
        <div className={styles.tags}>
          {product.size ? (
            <span className={`${styles.tag} ${!sameSize(master, product) ? styles.tagDiff : ''}`}>
              {product.size}
            </span>
          ) : null}
          {product.material ? (
            <span
              className={`${styles.tag} ${
                master?.material && norm(master.material) !== norm(product.material) ? styles.tagDiff : ''
              }`}
            >
              {product.material}
            </span>
          ) : null}
          {product.color ? (
            <span
              className={`${styles.tag} ${
                master?.color && norm(master.color) !== norm(product.color) ? styles.tagDiff : ''
              }`}
            >
              {product.color}
            </span>
          ) : null}
        </div>
        <div className={styles.cardFoot}>
          <span className={styles.sku}>{product.sku || '—'}</span>
          <span className={`${styles.stock} ${tone.cls}`}>
            <span className={`${styles.dot} ${tone.dot}`} />
            {product.stockQty}
          </span>
        </div>
      </div>
    </button>
  );
}
