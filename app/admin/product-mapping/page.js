'use client';

/**
 * Product Mapping — stockroom console.
 *
 * Toolbar → source strip → linked table + inspector.
 * Links open in Link Workbench (Link SKU / F6).
 * A link is only SKU ↔ SKU. No type or audience.
 */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Download, Link2, Pencil, Unlink, X } from 'lucide-react';
import { adminJson } from '@/lib/client/adminFetch';
import { showToast } from '@/lib/utils/toast';
import LinkWorkbench from './LinkWorkbench';
import styles from './mapping.module.css';

function stockClass(label) {
  if (label === 'Out of Stock') return styles.bad;
  if (label === 'Below Min') return styles.warn;
  return styles.ok;
}

function formatInr(value) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

function skuMeta(product) {
  return [product?.brand, product?.size, product?.color, product?.sku].filter(Boolean).join(' · ');
}

function downloadCsv(source, rows) {
  const header = ['Product', 'Brand', 'SKU', 'Stock', 'Min', 'Max', 'Status', 'MRP', 'Selling', 'Note'];
  const lines = rows.map((row) => [
    row.product.title,
    row.product.brand,
    row.product.sku,
    row.product.stockQty,
    row.product.minStock ?? '',
    row.product.maxStock ?? '',
    row.product.maintained ? 'Maintained' : 'Non-maintained',
    row.product.mrp,
    row.product.sellingPrice,
    row.note,
  ]);
  const csv = [header, ...lines]
    .map((cells) => cells.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${source?.sku || 'product'}-mapping.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function Thumb({ src, large }) {
  return (
    <div className={large ? styles.thumbLg : styles.thumb}>
      {src ? <img src={src} alt="" /> : null}
    </div>
  );
}

function HitList({ hits, onPick }) {
  if (!hits.length) return null;
  return (
    <ul className={styles.hits}>
      {hits.map((row) => (
        <li key={row.id}>
          <button type="button" className={styles.hit} onClick={() => onPick(row)}>
            <Thumb src={row.imageUrl} />
            <span style={{ minWidth: 0, flex: 1 }}>
              <span className={styles.hitTitle}>{row.title}</span>
              <span className={styles.hitMeta}>{skuMeta(row)}</span>
            </span>
            <span className={`${styles.num} ${stockClass(row.stockLabel)}`}>{row.stockQty}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

export default function ProductMappingPage() {
  const searchParams = useSearchParams();
  const initialId = searchParams.get('productId') || '';

  const [sourceQuery, setSourceQuery] = useState('');
  const [sourceHits, setSourceHits] = useState([]);
  const [sourceSearching, setSourceSearching] = useState(false);
  const [source, setSource] = useState(null);
  const [links, setLinks] = useState([]);
  const [canWrite, setCanWrite] = useState(false);
  const [loading, setLoading] = useState(false);
  const [brandFilter, setBrandFilter] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [workbenchOpen, setWorkbenchOpen] = useState(false);
  const [workbenchPickId, setWorkbenchPickId] = useState('');

  async function loadLinks(productId) {
    setLoading(true);
    try {
      const body = await adminJson(`/api/admin/product-links?productId=${encodeURIComponent(productId)}`);
      const nextSource = body.data?.source || null;
      setSource(nextSource);
      setLinks(body.data?.links || []);
      setCanWrite(Boolean(body.canWrite));
      setSelectedId('');
      setBrandFilter('');
      if (nextSource?.title) setSourceQuery(nextSource.title);
    } catch (error) {
      showToast.error(error.message || 'Could not load mappings.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (initialId) loadLinks(initialId);
  }, [initialId]);

  useEffect(() => {
    const q = sourceQuery.trim();
    if (q.length < 2 || source) {
      setSourceHits([]);
      return undefined;
    }
    const timer = setTimeout(async () => {
      setSourceSearching(true);
      try {
        const body = await adminJson(`/api/admin/product-links/search?q=${encodeURIComponent(q)}`);
        setSourceHits(body.data || []);
      } catch {
        setSourceHits([]);
      } finally {
        setSourceSearching(false);
      }
    }, 220);
    return () => clearTimeout(timer);
  }, [sourceQuery, source]);

  useEffect(() => {
    function onKey(event) {
      if (event.key !== 'F6') return;
      if (!source || !canWrite || workbenchOpen) return;
      event.preventDefault();
      setWorkbenchPickId('');
      setWorkbenchOpen(true);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [source, canWrite, workbenchOpen]);

  const brands = useMemo(() => {
    const names = new Set(links.map((row) => row.product.brand).filter(Boolean));
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [links]);

  const visibleLinks = useMemo(
    () => links.filter((row) => !brandFilter || row.product.brand === brandFilter),
    [links, brandFilter]
  );

  const selectedLink = visibleLinks.find((row) => row.id === selectedId) || null;
  const detail = selectedLink?.product || source;

  async function pickSource(row) {
    setSourceHits([]);
    await loadLinks(row.id);
  }

  function clearSource() {
    setSource(null);
    setLinks([]);
    setSourceQuery('');
    setSourceHits([]);
    setSelectedId('');
    setBrandFilter('');
    setWorkbenchOpen(false);
    setWorkbenchPickId('');
  }

  function openWorkbench(preselectId = '') {
    if (!source || !canWrite) return;
    setWorkbenchPickId(preselectId || '');
    setWorkbenchOpen(true);
  }

  async function removeLink(id) {
    try {
      await adminJson(`/api/admin/product-links/${id}`, { method: 'DELETE' });
      setLinks((prev) => prev.filter((row) => row.id !== id));
      if (selectedId === id) setSelectedId('');
      showToast.success('Unlinked.');
    } catch (error) {
      showToast.error(error.message || 'Could not unlink.');
    }
  }

  return (
    <div className={styles.shell}>
      <div className={styles.band}>
        <div>
          <p className={styles.bandKicker}>Catalog · Equivalence</p>
          <h1 className={styles.bandTitle}>Product Mapping</h1>
          <p className={styles.bandSub}>
            Link sellable SKUs to each other. Live stock, MRP and selling price.
          </p>
        </div>
        <button
          type="button"
          className={styles.bandBtn}
          disabled={!source || !visibleLinks.length}
          onClick={() => downloadCsv(source, visibleLinks)}
        >
          <Download size={14} /> Export
        </button>
      </div>

      <div className={styles.work}>
        <div className={styles.toolbar}>
          <div className={styles.searchWrap}>
            <label className={styles.fieldLabel}>Find SKU</label>
            <input
              className={styles.input}
              value={sourceQuery}
              onChange={(e) => {
                if (source) clearSource();
                setSourceQuery(e.target.value);
              }}
              placeholder="Title / SKU / barcode / brand"
            />
            {!source ? <HitList hits={sourceHits} onPick={pickSource} /> : null}
            {!source && sourceSearching ? (
              <p style={{ margin: '3px 0 0', fontSize: 11, color: '#7a8694' }}>Searching…</p>
            ) : null}
          </div>
          <div>
            <label className={styles.fieldLabel}>Brand</label>
            <select
              className={styles.select}
              value={brandFilter}
              onChange={(e) => setBrandFilter(e.target.value)}
              disabled={!source || !brands.length}
            >
              <option value="">All</option>
              {brands.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>
          <button
            type="button"
            className={styles.primaryBtn}
            disabled={!source || !canWrite}
            onClick={() => openWorkbench()}
            title="Open Link Workbench (F6)"
          >
            <Link2 size={14} /> Link
            <span className={styles.kbd}>F6</span>
          </button>
        </div>

        {!source ? (
          <div className={styles.panel} style={{ marginTop: 8 }}>
            <div className={styles.empty}>
              <strong>No SKU selected</strong>
              Search for a variant or standalone. Parent families cannot be mapped.
            </div>
          </div>
        ) : (
          <>
            <div className={styles.sourceStrip}>
              <Thumb src={source.imageUrl} large />
              <div style={{ minWidth: 0 }}>
                <p className={styles.sourceTitle}>{source.title}</p>
                <p className={styles.sourceMeta}>{skuMeta(source)}</p>
                <div className={styles.stats}>
                  <span className={styles.stat}>
                    Stock{' '}
                    <strong className={stockClass(source.stockLabel)}>
                      {source.stockQty}
                    </strong>
                  </span>
                  <span className={styles.stat}>
                    MRP <strong>{formatInr(source.mrp)}</strong>
                  </span>
                  <span className={styles.stat}>
                    Sell <strong>{formatInr(source.sellingPrice)}</strong>
                  </span>
                  <span className={styles.stat}>
                    Min/Max{' '}
                    <strong>
                      {source.minStock == null ? '—' : `${source.minStock}/${source.maxStock}`}
                    </strong>
                  </span>
                  <span className={styles.stat}>
                    <strong>{source.maintained ? 'Maintained' : 'Non-maintained'}</strong>
                  </span>
                </div>
              </div>
              <div className={styles.stripActions}>
                <Link href={`/admin/products/${source.id}/edit`} className={styles.ghostBtn}>
                  <Pencil size={13} /> Edit
                </Link>
                <button type="button" className={styles.ghostBtn} onClick={clearSource}>
                  <X size={13} /> Clear
                </button>
              </div>
            </div>

            {!canWrite ? (
              <p className={styles.footerNote} style={{ marginTop: 6 }}>
                View only. Catalog or inventory editors can add and remove links.
              </p>
            ) : null}

            <div className={styles.layout}>
              <div className={styles.panel}>
                <div className={styles.panelHead}>
                  <h2 className={styles.panelTitle}>Linked products</h2>
                  <span className={styles.count}>
                    {visibleLinks.length}
                    {visibleLinks.length !== links.length ? ` / ${links.length}` : ''}
                    {loading ? ' · …' : ''}
                  </span>
                </div>

                {loading ? (
                  <div className={styles.empty}>Loading…</div>
                ) : visibleLinks.length === 0 ? (
                  <div className={styles.empty}>
                    <strong>No links yet</strong>
                    Press F6 or Link to open the workbench.
                  </div>
                ) : (
                  <div className={styles.tableWrap}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th className={styles.colIdx}>#</th>
                          <th>Product</th>
                          <th className={styles.colBrand}>Brand</th>
                          <th className={styles.colSku}>SKU</th>
                          <th className={styles.colAvail}>Avail</th>
                          <th className={styles.colMinMax}>Min/Max</th>
                          <th className={styles.colStatus}>Status</th>
                          <th className={styles.colAction} />
                        </tr>
                      </thead>
                      <tbody>
                        {visibleLinks.map((row, index) => (
                          <tr
                            key={row.id}
                            className={selectedId === row.id ? styles.rowActive : undefined}
                            onClick={() => setSelectedId(row.id)}
                          >
                            <td className={styles.num}>{index + 1}</td>
                            <td>
                              <div className={styles.productCell}>
                                <Thumb src={row.product.imageUrl} />
                                <p className={styles.productName} title={row.product.title}>
                                  {row.product.title}
                                </p>
                              </div>
                            </td>
                            <td title={row.product.brand || ''}>{row.product.brand || '—'}</td>
                            <td className={styles.code}>{row.product.sku || '—'}</td>
                            <td>
                              <span className={`${styles.num} ${stockClass(row.product.stockLabel)}`}>
                                {row.product.stockQty}
                              </span>
                            </td>
                            <td className={styles.num}>
                              {row.product.minStock == null
                                ? '—'
                                : `${row.product.minStock}/${row.product.maxStock}`}
                            </td>
                            <td>
                              <span
                                className={`${styles.statusText} ${
                                  row.product.maintained ? styles.statusOk : styles.statusMute
                                }`}
                              >
                                {row.product.maintained ? 'Maintained' : 'Non-maint.'}
                              </span>
                            </td>
                            <td>
                              {canWrite ? (
                                <button
                                  type="button"
                                  className={styles.dangerBtn}
                                  title="Unlink"
                                  aria-label="Unlink"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    removeLink(row.id);
                                  }}
                                >
                                  <Unlink size={13} />
                                </button>
                              ) : null}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <aside className={styles.panel}>
                <div className={styles.panelHead}>
                  <h2 className={styles.panelTitle}>
                    {selectedLink ? 'Linked detail' : 'Source detail'}
                  </h2>
                  {detail?.id ? (
                    <Link href={`/admin/products/${detail.id}/edit`} className={styles.ghostBtn}>
                      <Pencil size={12} />
                    </Link>
                  ) : null}
                </div>
                <div className={styles.inspectorBody}>
                  {detail ? (
                    <>
                      <div className={styles.inspectorTop}>
                        <Thumb src={detail.imageUrl} large />
                        <div style={{ minWidth: 0 }}>
                          <p className={styles.productName} title={detail.title}>{detail.title}</p>
                          <p className={styles.sourceMeta}>{skuMeta(detail)}</p>
                        </div>
                      </div>

                      <dl className={styles.kv}>
                        <dt>Barcode</dt>
                        <dd className={styles.code}>{detail.barcode || '—'}</dd>
                        <dt>Category</dt>
                        <dd>{detail.category || '—'}</dd>
                        <dt>Subcat.</dt>
                        <dd>{detail.subcategory || '—'}</dd>
                        <dt>Material</dt>
                        <dd>{detail.material || '—'}</dd>
                        <dt>Size</dt>
                        <dd>{detail.size || '—'}</dd>
                        <dt>Colour</dt>
                        <dd>{detail.color || '—'}</dd>
                        <dt>MRP</dt>
                        <dd>{formatInr(detail.mrp)}</dd>
                        <dt>Selling</dt>
                        <dd>{formatInr(detail.sellingPrice)}</dd>
                        <dt>Rule</dt>
                        <dd>{detail.maintained ? 'Maintained' : 'Non-maintained'}</dd>
                      </dl>

                      <div className={styles.stockBlock}>
                        <div className={styles.stockCell}>
                          <span>Avail</span>
                          <strong className={stockClass(detail.stockLabel)}>{detail.stockQty}</strong>
                        </div>
                        <div className={styles.stockCell}>
                          <span>Min</span>
                          <strong>{detail.minStock ?? '—'}</strong>
                        </div>
                        <div className={styles.stockCell}>
                          <span>Max</span>
                          <strong>{detail.maxStock ?? '—'}</strong>
                        </div>
                      </div>

                      {selectedLink?.note ? <p className={styles.note}>{selectedLink.note}</p> : null}
                    </>
                  ) : (
                    <div className={styles.empty}>Select a row</div>
                  )}
                </div>
              </aside>
            </div>

            <p className={styles.footerNote}>
              Variant ↔ variant only · bidirectional · prices and stock are live reads
            </p>
          </>
        )}
      </div>

      <LinkWorkbench
        open={workbenchOpen}
        source={source}
        existingLinks={links}
        initialPickId={workbenchPickId}
        onClose={() => {
          setWorkbenchOpen(false);
          setWorkbenchPickId('');
        }}
        onSaved={() => source?.id && loadLinks(source.id)}
      />
    </div>
  );
}
