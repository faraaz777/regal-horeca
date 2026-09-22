'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { UNIT_OPTIONS } from '@/components/product-form/constants';
import {
  getPredefinedColorSwatchClassName,
  resolveColorDisplay,
} from '@/components/product-form/lib/colors';
import { formatIndianNumberInput } from '@/components/product-form/lib/formatters';
import { useProductForm } from '@/components/product-form/ProductFormContext';

const PASTEL = [
  {
    accent: '#34A87C',
    accentLight: '#EDFAF5',
    accentMid: '#A8E6D0',
    badge: '#D4F3E8',
    badgeText: '#1E7A57',
  },
  {
    accent: '#7C6FF5',
    accentLight: '#F1F0FD',
    accentMid: '#C8C4FA',
    badge: '#E5E4FB',
    badgeText: '#4A3FBF',
  },
  {
    accent: '#F07840',
    accentLight: '#FEF4EE',
    accentMid: '#FAD0B8',
    badge: '#FDEADE',
    badgeText: '#B85320',
  },
  {
    accent: '#3B9FE8',
    accentLight: '#EEF7FE',
    accentMid: '#BBDDF8',
    badge: '#DDEFFE',
    badgeText: '#1A6DB5',
  },
];

const GROUP_COLORS = {
  identity: { bg: '#C6EFE0', text: '#1E7A57', dot: '#34A87C', pill: '#EDFAF5', left: '#34A87C33' },
  inventory: { bg: '#D5D2FB', text: '#4A3FBF', dot: '#7C6FF5', pill: '#F1F0FD', left: '#7C6FF533' },
  pricing: { bg: '#FADCC6', text: '#B85320', dot: '#F07840', pill: '#FEF4EE', left: '#F0784033' },
  images: { bg: '#DDEFFE', text: '#1A6DB5', dot: '#3B9FE8', pill: '#EEF7FE', left: '#3B9FE833' },
};

const GST_OPTIONS = [0, 5, 12, 18, 28];

const dm = { fontFamily: "'DM Sans', sans-serif" };
const inter = { fontFamily: "'Inter', sans-serif" };

function toNumber(value) {
  if (value == null || value === '') return 0;
  const n = Number(String(value).replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function formatInr(value) {
  return `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(value)}`;
}

/** Readable text on a filled colour cell (yellow → black, navy → white). */
function contrastOnHex(hex) {
  if (!hex || typeof hex !== 'string' || !hex.startsWith('#') || hex.length < 7) {
    return '#1E293B';
  }
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const lin = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return L > 0.55 ? '#111827' : '#FFFFFF';
}

/**
 * Sheet col widths as % so table-layout:fixed truly spans the viewport.
 * Without this, browsers size from first-row content and leave a dead right gap.
 */
function buildSheetColPercents({ showSize, showColor, showUnitCount, showWeight }) {
  const weights = [
    2.4, // #
    2.2, // Def — compact radio
    3.0, // Cat — toggle still needs a bit more room
    12.0, // Name — primary identity field, needs room
  ];
  if (showSize) weights.push(5.5);
  weights.push(5.5); // Unit
  if (showColor) weights.push(7.5);
  if (showUnitCount) weights.push(5);
  if (showWeight) weights.push(5);
  weights.push(
    7.5, // SKU
    6.5, // Barcode
    5, // HSN
    4.2, // GST
    5.8, // MRP
    5.8, // Sell
    4.2, // Disc
    5.8, // Margin
    10.5, // Images — room for + and thumbnails
    3.2 // Actions / Apply
  );
  const total = weights.reduce((sum, w) => sum + w, 0);
  return weights.map((w) => `${((w / total) * 100).toFixed(3)}%`);
}

/**
 * Variant SKUs — Cards / Table inline editor (Figma reference)
 * plus optional full-screen sheet for dense editing.
 * Product save stays on the form Save action (no duplicate Save here).
 */
export default function ProductVariantsTable() {
  const {
    formData,
    variantRows,
    variantFieldSelection,
    handleSetDefaultVariantRow,
    handleVariantRowChange,
    handleVariantRowImageUpload,
    handleRemoveVariantRowImage,
    handleDeleteVariantRow,
    recentlyDeletedVariantRow,
    handleUndoDeleteVariantRow,
    handleAddSingleVariantRow,
    bulkVariantInputs,
    handleBulkVariantInputChange,
    handleApplyBulkInputs,
    isUploading,
    variantTableColorOptions,
    getVariantPricingErrors,
  } = useProductForm();

  const [view, setView] = useState('cards');
  const [sheetOpen, setSheetOpen] = useState(false);
  const openButtonRef = useRef(null);
  const titleId = useId();

  useEffect(() => {
    if (!sheetOpen) return undefined;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => {
      if (e.key === 'Escape') setSheetOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
      openButtonRef.current?.focus?.();
    };
  }, [sheetOpen]);

  const summary = useMemo(() => {
    const catalogCount = variantRows.filter((r) => r.showInCatalog === true).length;
    const withMrp = variantRows.filter((r) => toNumber(r.mrp) > 0);
    const withSell = variantRows.filter((r) => toNumber(r.sellingPrice) > 0);
    const avgMrp = withMrp.length
      ? Math.round(withMrp.reduce((s, r) => s + toNumber(r.mrp), 0) / withMrp.length)
      : 0;
    const avgSell = withSell.length
      ? Math.round(withSell.reduce((s, r) => s + toNumber(r.sellingPrice), 0) / withSell.length)
      : 0;
    const hasDefault = variantRows.some((r) => r.isDefault);
    return { catalogCount, avgMrp, avgSell, hasDefault };
  }, [variantRows]);

  const tableProps = {
    formData,
    variantRows,
    variantFieldSelection,
    variantTableColorOptions,
    getVariantPricingErrors,
    handleSetDefaultVariantRow,
    handleVariantRowChange,
    handleVariantRowImageUpload,
    handleRemoveVariantRowImage,
    handleDeleteVariantRow,
    handleAddSingleVariantRow,
    bulkVariantInputs,
    handleBulkVariantInputChange,
    handleApplyBulkInputs,
    isUploading,
  };

  if (!variantRows.length) {
    return (
      <div
        className="overflow-hidden rounded-3xl bg-white"
        style={{
          boxShadow: '0 2px 20px rgba(15,23,42,0.07), 0 0 0 1px rgba(226,232,240,0.8)',
        }}
      >
        <div className="border-b border-[#EEF2F7] px-6 pb-4 pt-5">
          <h3 className="text-[18px] font-bold text-[#1E293B]" style={dm}>
            Variant SKUs
          </h3>
          <p className="mt-0.5 text-[12.5px] text-[#94A3B8]" style={inter}>
            Generate from attributes or add a blank row to start.
          </p>
        </div>
        <div className="px-6 py-10 text-center">
          <p className="text-[13px] text-[#94A3B8]" style={inter}>
            No variants yet.
          </p>
          <button
            type="button"
            onClick={handleAddSingleVariantRow}
            className="mt-4 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-[#64748B] hover:text-[#1E293B]"
            style={dm}
          >
            + Add variant row
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="overflow-hidden rounded-3xl bg-white"
      style={{
        boxShadow: '0 2px 20px rgba(15,23,42,0.07), 0 0 0 1px rgba(226,232,240,0.8)',
      }}
    >
      {/* Header */}
      <div className="border-b border-[#EEF2F7] px-6 pb-4 pt-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-[18px] font-bold leading-tight text-[#1E293B]" style={dm}>
              Variant SKUs
            </h3>
            <p className="mt-0.5 text-[12.5px] text-[#94A3B8]" style={inter}>
              Edit inline in Cards or Table — open full screen when you need more space.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span
              className="rounded-full px-2.5 py-1 text-[11px] font-semibold tabular-nums"
              style={{ ...dm, background: '#EEF2F7', color: '#64748B' }}
            >
              {variantRows.length} {variantRows.length === 1 ? 'variant' : 'variants'}
            </span>

            <div
              className="flex items-center gap-0.5 rounded-xl p-0.5"
              style={{ background: '#EEF2F7' }}
              role="group"
              aria-label="Variant view"
            >
              <ViewToggleButton
                active={view === 'cards'}
                onClick={() => setView('cards')}
                icon={<CardsIcon />}
                label="Cards"
              />
              <ViewToggleButton
                active={view === 'table'}
                onClick={() => setView('table')}
                icon={<TableIcon />}
                label="Table"
              />
            </div>

            <button
              ref={openButtonRef}
              type="button"
              onClick={() => setSheetOpen(true)}
              className="flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-[12px] font-semibold text-white transition-all hover:bg-[#1E293B] active:scale-95"
              style={{ ...dm, background: '#0F172A' }}
            >
              <ExpandIcon />
              Full screen
            </button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {[
            { label: 'Identity', ...GROUP_COLORS.identity },
            { label: 'Inventory & Classification', ...GROUP_COLORS.inventory },
            { label: 'Pricing', ...GROUP_COLORS.pricing },
            { label: 'Images', ...GROUP_COLORS.images },
          ].map((g) => (
            <span
              key={g.label}
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-medium"
              style={{ ...inter, background: g.pill, color: g.text }}
            >
              <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: g.dot }} />
              {g.label}
            </span>
          ))}
        </div>
      </div>

      {recentlyDeletedVariantRow ? (
        <div className="flex items-center justify-between border-b border-amber-200 bg-amber-50 px-6 py-2 text-[12.5px]" style={inter}>
          <span>Unsaved row removed.</span>
          <button
            type="button"
            onClick={handleUndoDeleteVariantRow}
            className="font-semibold text-[#1E293B] underline underline-offset-2"
          >
            Undo
          </button>
        </div>
      ) : null}

      {/* Body */}
      {view === 'cards' ? (
        <div className="flex flex-col gap-4 p-5">
          {variantRows.map((row, index) => (
            <VariantCard
              key={row._rowId || index}
              row={row}
              index={index}
              palette={PASTEL[index % PASTEL.length]}
              formData={formData}
              variantFieldSelection={variantFieldSelection}
              variantTableColorOptions={variantTableColorOptions}
              isUploading={isUploading}
              getVariantPricingErrors={getVariantPricingErrors}
              handleSetDefaultVariantRow={handleSetDefaultVariantRow}
              handleVariantRowChange={handleVariantRowChange}
              handleVariantRowImageUpload={handleVariantRowImageUpload}
              handleRemoveVariantRowImage={handleRemoveVariantRowImage}
              handleDeleteVariantRow={handleDeleteVariantRow}
            />
          ))}
          <button
            type="button"
            onClick={handleAddSingleVariantRow}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed py-3 text-[12.5px] font-semibold text-[#94A3B8] transition-all hover:border-[#CBD5E1] hover:text-[#475569]"
            style={{ ...dm, borderColor: '#D1D9E6' }}
          >
            <PlusIcon />
            Add variant row
          </button>
        </div>
      ) : (
        <div className="p-5">
          <VariantTable {...tableProps} />
        </div>
      )}

      {/* Footer */}
      <div
        className="flex flex-wrap items-center justify-between gap-2 px-6 py-3.5 text-[11.5px]"
        style={{ ...inter, background: '#F8FAFC', borderTop: '1px solid #EEF2F7', color: '#94A3B8' }}
      >
        <span>
          {summary.catalogCount} of {variantRows.length} variants in catalogue
          {summary.hasDefault ? ' · 1 set as default' : ''}
        </span>
        {summary.avgMrp > 0 || summary.avgSell > 0 ? (
          <div className="flex items-center gap-4">
            {summary.avgMrp > 0 ? (
              <span>
                Avg MRP:{' '}
                <strong className="text-[#475569]">{formatInr(summary.avgMrp)}</strong>
              </span>
            ) : null}
            {summary.avgSell > 0 ? (
              <span>
                Avg Sell:{' '}
                <strong className="text-[#475569]">{formatInr(summary.avgSell)}</strong>
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      {sheetOpen
        ? createPortal(
            <div
              className="fixed inset-0 z-[200] flex flex-col bg-neutral-950/40"
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
            >
              <div className="flex min-h-0 flex-1 flex-col bg-white shadow-2xl">
                <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[#EEF2F7] bg-white px-4 py-3 sm:px-6">
                  <div className="min-w-0">
                    <h2
                      id={titleId}
                      className="text-lg font-bold tracking-tight text-[#1E293B]"
                      style={dm}
                    >
                      Variant SKU sheet
                    </h2>
                    <p className="mt-0.5 text-[12.5px] text-[#94A3B8]" style={inter}>
                      {variantRows.length} variant{variantRows.length === 1 ? '' : 's'} · Fill row
                      applies empty cells · Esc or Done to close
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSheetOpen(false)}
                      className="rounded-xl px-4 py-2 text-[12px] font-semibold text-white"
                      style={{ ...dm, background: '#0F172A' }}
                    >
                      Done
                    </button>
                    <button
                      type="button"
                      onClick={() => setSheetOpen(false)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFC]"
                      aria-label="Close sheet"
                    >
                      <XIcon />
                    </button>
                  </div>
                </header>

                {recentlyDeletedVariantRow ? (
                  <div className="flex shrink-0 items-center justify-between border-b border-amber-200 bg-amber-50 px-4 py-2 text-[12.5px] sm:px-6" style={inter}>
                    <span>Unsaved row removed.</span>
                    <button
                      type="button"
                      onClick={handleUndoDeleteVariantRow}
                      className="font-semibold text-[#1E293B] underline underline-offset-2"
                    >
                      Undo
                    </button>
                  </div>
                ) : null}

                <div className="min-h-0 w-full flex-1 overflow-y-auto overflow-x-hidden bg-[#F8FAFC] p-4 sm:p-6">
                  <VariantTable {...tableProps} layout="sheet" />
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}

function ViewToggleButton({ active, onClick, icon, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all duration-200"
      style={{
        ...dm,
        background: active ? '#FFFFFF' : 'transparent',
        color: active ? '#1E293B' : '#94A3B8',
        boxShadow: active ? '0 1px 3px rgba(15,23,42,0.1)' : 'none',
      }}
      aria-pressed={active}
    >
      {icon}
      {label}
    </button>
  );
}

function Toggle({ checked, onChange, accent, label, size = 'md' }) {
  const w = size === 'sm' ? 'w-7 h-3.5' : 'w-8 h-4';
  const knob = size === 'sm' ? 'w-2.5 h-2.5 top-0.5 left-0.5' : 'w-3 h-3 top-0.5 left-0.5';
  const tx = size === 'sm' ? (checked ? 'translateX(13px)' : 'translateX(0)') : checked ? 'translateX(16px)' : 'translateX(0)';

  return (
    <button type="button" onClick={() => onChange(!checked)} className="group flex items-center gap-1.5">
      <span
        className={`relative ${w} flex-shrink-0 rounded-full transition-all duration-200`}
        style={{ background: checked ? accent : '#CBD5E1' }}
      >
        <span
          className={`absolute ${knob} rounded-full bg-white shadow-sm transition-transform duration-200`}
          style={{ transform: tx }}
        />
      </span>
      {label ? (
        <span
          className="text-[11px] font-medium text-[#64748B] transition-colors group-hover:text-[#334155]"
          style={inter}
        >
          {label}
        </span>
      ) : null}
    </button>
  );
}

/**
 * Def is single-select (one commercial default SKU), so a radio is clearer and narrower than a toggle.
 */
function DefRadio({ checked, onSelect, accent, label }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      aria-label={label || 'Set as default'}
      title="Default child SKU"
      onClick={onSelect}
      className="group inline-flex items-center justify-center gap-1.5"
    >
      <span
        className="flex h-[15px] w-[15px] shrink-0 items-center justify-center rounded-full border-[1.5px] transition-all duration-150"
        style={{
          borderColor: checked ? accent : '#CBD5E1',
          background: checked ? accent : '#FFFFFF',
          boxShadow: checked ? `0 0 0 2px ${accent}22` : undefined,
        }}
      >
        {checked ? <span className="h-1.5 w-1.5 rounded-full bg-white" /> : null}
      </span>
      {label ? (
        <span
          className="text-[11px] font-medium text-[#64748B] transition-colors group-hover:text-[#334155]"
          style={inter}
        >
          {label}
        </span>
      ) : null}
    </button>
  );
}

function FieldLabel({ children }) {
  return (
    <span
      className="mb-0.5 block text-[10px] font-semibold uppercase leading-none tracking-[0.1em] text-[#94A3B8]"
      style={dm}
    >
      {children}
    </span>
  );
}

function TextInput({ value, onChange, placeholder, accent }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-lg border border-[#E2E8F0] bg-white/70 px-2.5 py-1.5 text-[13px] text-[#334155] placeholder:text-[#CBD5E1] transition-all focus:border-transparent focus:outline-none focus:ring-2"
      style={{ ...inter, ['--tw-ring-color']: `${accent}55` }}
    />
  );
}

function SelectInput({ value, options, onChange, accent }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full cursor-pointer appearance-none rounded-lg border border-[#E2E8F0] bg-white/70 px-2 py-1.5 text-[13px] text-[#334155] transition-all focus:border-transparent focus:outline-none focus:ring-2"
      style={{ ...inter, ['--tw-ring-color']: `${accent}55` }}
    >
      {options.map((o) => (
        <option key={String(o.value ?? o)} value={o.value ?? o}>
          {o.label ?? o}
        </option>
      ))}
    </select>
  );
}

function PriceInput({ value, onChange, placeholder, accent, prefix, suffix }) {
  return (
    <div className="relative flex items-center">
      {prefix ? (
        <span className="pointer-events-none absolute left-2.5 text-[12px] text-[#94A3B8]" style={inter}>
          {prefix}
        </span>
      ) : null}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-[#E2E8F0] bg-white/70 py-1.5 text-[13px] text-[#334155] placeholder:text-[#CBD5E1] transition-all focus:border-transparent focus:outline-none focus:ring-2"
        style={{
          ...inter,
          ['--tw-ring-color']: `${accent}55`,
          paddingLeft: prefix ? '1.4rem' : '0.625rem',
          paddingRight: suffix ? '1.6rem' : '0.625rem',
        }}
      />
      {suffix ? (
        <span className="pointer-events-none absolute right-2.5 text-[12px] text-[#94A3B8]" style={inter}>
          {suffix}
        </span>
      ) : null}
    </div>
  );
}

function VariantCard({
  row,
  index,
  palette,
  formData,
  variantFieldSelection,
  variantTableColorOptions,
  isUploading,
  getVariantPricingErrors,
  handleSetDefaultVariantRow,
  handleVariantRowChange,
  handleVariantRowImageUpload,
  handleRemoveVariantRowImage,
  handleDeleteVariantRow,
}) {
  const showSize = Boolean(variantFieldSelection.size);
  const showColor = Boolean(variantFieldSelection.color);
  const showUnitCount = Boolean(variantFieldSelection.unitCount);
  const showWeight = Boolean(variantFieldSelection.weight);
  const rowErrors = getVariantPricingErrors(row);
  const mrp = toNumber(row.mrp);
  const sell = toNumber(row.sellingPrice);
  const savings = Math.max(0, mrp - sell);
  const disc =
    toNumber(row.discountPercent) > 0
      ? toNumber(row.discountPercent)
      : mrp > 0
        ? Math.round((savings / mrp) * 1000) / 10
        : 0;
  const imgCount = (row.images || []).length;

  const display = row.color
    ? resolveColorDisplay(
        row.colorDetails ||
          (row.colorHex
            ? { colorName: row.color, colorHex: row.colorHex, swatch: row.colorSwatch }
            : row.color),
        formData.colorVariants
      )
    : null;

  const colourOptions = [
    { value: '', label: '—' },
    ...variantTableColorOptions.map((o) => ({ value: o.name, label: o.name })),
  ];

  return (
    <div
      className="rounded-2xl border transition-shadow hover:shadow-md"
      style={{
        background: palette.accentLight,
        borderColor: palette.accentMid,
        boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 pb-2.5 pt-3.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <div
            className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
            style={{ ...dm, background: palette.accent }}
          >
            {index + 1}
          </div>
          <span className="truncate text-[13px] font-semibold text-[#334155]" style={dm}>
            {row.name || <span className="font-normal text-[#94A3B8]">Unnamed variant</span>}
          </span>
          {imgCount > 0 ? (
            <span
              className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
              style={{ background: palette.badge, color: palette.badgeText }}
            >
              {imgCount} img{imgCount === 1 ? '' : 's'}
            </span>
          ) : null}
          {row._childProductId ? (
            <span className="text-[10px] font-semibold uppercase text-amber-700">saved</span>
          ) : null}
        </div>

        <div className="flex items-center gap-4">
          <DefRadio
            checked={Boolean(row.isDefault)}
            onSelect={() => handleSetDefaultVariantRow(index)}
            accent={palette.accent}
            label="Default"
          />
          <Toggle
            checked={row.showInCatalog === true}
            onChange={(v) => handleVariantRowChange(index, 'showInCatalog', v)}
            accent={palette.accent}
            label="Catalogue"
          />
          <button
            type="button"
            onClick={() => handleDeleteVariantRow(index)}
            className="ml-1 text-[#CBD5E1] transition-colors hover:text-red-400"
            aria-label="Delete variant"
          >
            <TrashIcon />
          </button>
        </div>
      </div>

      <div className="mx-4" style={{ height: 1, background: `${palette.accentMid}88` }} />

      <div className="grid gap-y-3 px-4 py-3">
        <div>
          <p
            className="mb-2 text-[9px] font-bold uppercase tracking-[0.12em]"
            style={{ ...dm, color: palette.accent }}
          >
            Identity
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="col-span-2">
              <FieldLabel>Name</FieldLabel>
              <TextInput
                value={row.name || ''}
                onChange={(v) => handleVariantRowChange(index, 'name', v)}
                placeholder="Variant name"
                accent={palette.accent}
              />
            </div>
            {showSize ? (
              <div>
                <FieldLabel>Size</FieldLabel>
                <TextInput
                  value={row.size || ''}
                  onChange={(v) => handleVariantRowChange(index, 'size', v)}
                  placeholder="S / M / L…"
                  accent={palette.accent}
                />
              </div>
            ) : null}
            <div>
              <FieldLabel>Unit</FieldLabel>
              <SelectInput
                value={row.unit || ''}
                options={['', ...UNIT_OPTIONS]}
                onChange={(v) => handleVariantRowChange(index, 'unit', v)}
                accent={palette.accent}
              />
            </div>
            {showColor ? (
              <div>
                <FieldLabel>Colour</FieldLabel>
                <div className="relative">
                  {display ? (
                    <span
                      style={display.swatch ? undefined : { backgroundColor: display.colorHex }}
                      className={`pointer-events-none absolute left-2.5 top-[calc(50%+4px)] h-2.5 w-2.5 -translate-y-1/2 rounded-full border border-black/15 ${getPredefinedColorSwatchClassName(display)}`}
                    />
                  ) : null}
                  <select
                    value={row.color || ''}
                    onChange={(e) => handleVariantRowChange(index, 'color', e.target.value)}
                    className={`w-full cursor-pointer appearance-none rounded-lg border py-1.5 text-[13px] font-semibold transition-all focus:border-transparent focus:outline-none focus:ring-2 ${display ? 'pl-7 pr-2' : 'px-2'}`}
                    style={{
                      ...inter,
                      ['--tw-ring-color']: `${palette.accent}55`,
                      background:
                        display?.swatch === 'multicolour'
                          ? 'linear-gradient(135deg,#ef4444,#eab308,#3b82f6)'
                          : display?.swatch === 'transparent'
                            ? 'repeating-conic-gradient(#e5e7eb 0% 25%, #fff 0% 50%) 50% / 8px 8px'
                            : display?.colorHex || 'rgba(255,255,255,0.7)',
                      color:
                        display?.swatch === 'multicolour'
                          ? '#fff'
                          : display?.colorHex
                            ? contrastOnHex(display.colorHex)
                            : '#334155',
                      borderColor: display?.colorHex ? `${display.colorHex}66` : '#E2E8F0',
                    }}
                  >
                    {colourOptions.map((o) => (
                      <option key={o.value || 'empty'} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ) : null}
            {showUnitCount ? (
              <div>
                <FieldLabel>Count</FieldLabel>
                <TextInput
                  value={row.unitCount || ''}
                  onChange={(v) => handleVariantRowChange(index, 'unitCount', v)}
                  accent={palette.accent}
                />
              </div>
            ) : null}
            {showWeight ? (
              <div>
                <FieldLabel>Weight</FieldLabel>
                <TextInput
                  value={row.weight || ''}
                  onChange={(v) => handleVariantRowChange(index, 'weight', v)}
                  accent={palette.accent}
                />
              </div>
            ) : null}
          </div>
        </div>

        <div>
          <p
            className="mb-2 text-[9px] font-bold uppercase tracking-[0.12em]"
            style={{ ...dm, color: palette.accent }}
          >
            Inventory & Classification
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div>
              <FieldLabel>SKU</FieldLabel>
              <TextInput
                value={row.sku || ''}
                onChange={(v) => handleVariantRowChange(index, 'sku', v)}
                placeholder="SKU code"
                accent={palette.accent}
              />
            </div>
            <div>
              <FieldLabel>Barcode</FieldLabel>
              <TextInput
                value={row.barcode || ''}
                onChange={(v) => handleVariantRowChange(index, 'barcode', v)}
                placeholder="Barcode / EAN"
                accent={palette.accent}
              />
            </div>
            <div>
              <FieldLabel>HSN Code</FieldLabel>
              <TextInput
                value={row.hsnCode || ''}
                onChange={(v) => handleVariantRowChange(index, 'hsnCode', v)}
                placeholder="HSN"
                accent={palette.accent}
              />
            </div>
            <div>
              <FieldLabel>GST %</FieldLabel>
              <SelectInput
                value={row.gstPercent ?? 0}
                options={GST_OPTIONS}
                onChange={(v) => handleVariantRowChange(index, 'gstPercent', v)}
                accent={palette.accent}
              />
            </div>
          </div>
        </div>

        <div>
          <p
            className="mb-2 text-[9px] font-bold uppercase tracking-[0.12em]"
            style={{ ...dm, color: palette.accent }}
          >
            Pricing
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div>
              <FieldLabel>MRP (₹)</FieldLabel>
              <PriceInput
                value={formatIndianNumberInput(row.mrp ?? '')}
                onChange={(v) => handleVariantRowChange(index, 'mrp', v)}
                placeholder="0"
                accent={palette.accent}
                prefix="₹"
              />
            </div>
            <div>
              <FieldLabel>Sell Price (₹)</FieldLabel>
              <PriceInput
                value={formatIndianNumberInput(row.sellingPrice ?? '')}
                onChange={(v) => handleVariantRowChange(index, 'sellingPrice', v)}
                placeholder="0"
                accent={palette.accent}
                prefix="₹"
              />
              {rowErrors.sellingPrice ? (
                <p className="mt-0.5 text-[10px] text-red-500">Check sell price</p>
              ) : null}
            </div>
            <div>
              <FieldLabel>Discount %</FieldLabel>
              <PriceInput
                value={row.discountPercent ?? ''}
                onChange={(v) => handleVariantRowChange(index, 'discountPercent', v)}
                placeholder="0"
                accent={palette.accent}
                suffix="%"
              />
            </div>
            <div>
              <FieldLabel>Margin (₹)</FieldLabel>
              <PriceInput
                value={formatIndianNumberInput(row.marginPrice ?? '')}
                onChange={(v) => handleVariantRowChange(index, 'marginPrice', v)}
                placeholder="0"
                accent={palette.accent}
                prefix="₹"
              />
            </div>
          </div>
        </div>

        <div>
          <p
            className="mb-2 text-[9px] font-bold uppercase tracking-[0.12em]"
            style={{ ...dm, color: palette.accent }}
          >
            Images
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              id={`variant-figma-img-${row._rowId || index}`}
              type="file"
              multiple
              accept="image/*"
              className="hidden"
              onChange={(e) => handleVariantRowImageUpload(e, index)}
            />
            <label
              htmlFor={`variant-figma-img-${row._rowId || index}`}
              className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed text-[#94A3B8] transition-colors hover:text-[#64748B]"
              style={{ borderColor: palette.accentMid }}
            >
              {isUploading ? '…' : <PlusIcon small />}
            </label>
            {(row.images || []).slice(0, 4).map((url, imageIndex) => (
              <div key={`${url}-${imageIndex}`} className="relative h-10 w-10">
                <Image
                  src={url}
                  alt=""
                  width={40}
                  height={40}
                  unoptimized
                  className="h-10 w-10 rounded-lg border-2 object-cover"
                  style={{ borderColor: palette.accentMid }}
                />
                <button
                  type="button"
                  onClick={() => handleRemoveVariantRowImage(index, imageIndex)}
                  className="absolute -right-1 -top-1 z-10 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] text-white ring-2 ring-white"
                  aria-label="Remove image"
                >
                  ×
                </button>
              </div>
            ))}
            <span className="ml-1 text-[11px] text-[#94A3B8]" style={inter}>
              {imgCount === 0 ? 'No images added' : `${imgCount} image${imgCount === 1 ? '' : 's'}`}
            </span>
          </div>
        </div>
      </div>

      {mrp > 0 && sell > 0 ? (
        <div className="px-4 pb-3.5">
          <div
            className="flex flex-wrap items-center gap-3 rounded-xl px-3 py-2 text-[11px]"
            style={{ ...inter, background: 'white', border: `1px solid ${palette.accentMid}` }}
          >
            <span className="text-[#94A3B8]">Quick calc —</span>
            <span className="text-[#475569]">
              MRP <strong className="text-[#334155]">{formatInr(mrp)}</strong>
            </span>
            <span className="text-[#CBD5E1]">·</span>
            <span className="text-[#475569]">
              Sell <strong className="text-[#334155]">{formatInr(sell)}</strong>
            </span>
            <span className="text-[#CBD5E1]">·</span>
            <span className="font-semibold" style={{ color: palette.accent }}>
              Savings {formatInr(savings)} ({disc}% off)
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Ordered navigable field keys matching VariantTable column order.
 * Includes select-backed columns so Left/Right can skip over them when
 * focusing inputs only (bulk row uses inputs for unit / GST).
 */
function buildVariantNavFields({ showSize, showColor, showUnitCount, showWeight }) {
  const fields = ['name'];
  if (showSize) fields.push('size');
  fields.push('unit');
  if (showColor) fields.push('color');
  if (showUnitCount) fields.push('unitCount');
  if (showWeight) fields.push('weight');
  fields.push('sku', 'barcode', 'hsnCode', 'gstPercent', 'mrp', 'sellingPrice', 'discountPercent', 'marginPrice');
  return fields;
}

/**
 * Focus a navigable cell inside `root` (scoped so inline + sheet tables
 * do not steal each other's focus via document.querySelector).
 * When inputsOnly, SELECT cells are skipped so arrows behave like a sheet.
 */
function focusVariantCell(root, rowIndex, field, { inputsOnly = true } = {}) {
  if (!root) return false;
  const el = root.querySelector(`[data-variant-nav="${rowIndex}:${field}"]`);
  if (!el || typeof el.focus !== 'function') return false;
  if (inputsOnly && el.tagName !== 'INPUT') return false;
  el.focus();
  if (typeof el.select === 'function' && el.tagName === 'INPUT') {
    try {
      el.select();
    } catch {
      /* number inputs may reject select() in some browsers */
    }
  }
  return true;
}

function VariantTable({
  formData,
  variantRows,
  variantFieldSelection,
  variantTableColorOptions,
  getVariantPricingErrors,
  handleSetDefaultVariantRow,
  handleVariantRowChange,
  handleVariantRowImageUpload,
  handleRemoveVariantRowImage,
  handleDeleteVariantRow,
  handleAddSingleVariantRow,
  bulkVariantInputs,
  handleBulkVariantInputChange,
  handleApplyBulkInputs,
  isUploading,
  layout = 'inline',
}) {
  const sheet = layout === 'sheet';
  const tableRootRef = useRef(null);
  const showSize = Boolean(variantFieldSelection.size);
  const showColor = Boolean(variantFieldSelection.color);
  const showUnitCount = Boolean(variantFieldSelection.unitCount);
  const showWeight = Boolean(variantFieldSelection.weight);

  const navFields = useMemo(
    () => buildVariantNavFields({ showSize, showColor, showUnitCount, showWeight }),
    [showSize, showColor, showUnitCount, showWeight]
  );

  const hasBulkRow = Boolean(bulkVariantInputs && handleApplyBulkInputs);
  const minRow = hasBulkRow ? -1 : 0;
  const maxRow = variantRows.length - 1;

  const handleVariantCellKeyDown = (e, rowIndex, field) => {
    const { key } = e;
    const isEnter = key === 'Enter';
    if (
      key !== 'ArrowUp' &&
      key !== 'ArrowDown' &&
      key !== 'ArrowLeft' &&
      key !== 'ArrowRight' &&
      !isEnter
    ) {
      return;
    }

    const root = tableRootRef.current;
    const isSelect = e.target.tagName === 'SELECT';
    const isNumberInput = e.target.tagName === 'INPUT' && e.target.type === 'number';
    const fieldIndex = navFields.indexOf(field);
    if (fieldIndex === -1) return;

    // Enter → same column, next row (Excel-like).
    if (isEnter) {
      if (isSelect) return;
      let nextRow = rowIndex + 1;
      while (nextRow >= minRow && nextRow <= maxRow) {
        if (focusVariantCell(root, nextRow, field)) {
          e.preventDefault();
          return;
        }
        nextRow += 1;
      }
      e.preventDefault();
      return;
    }

    if (key === 'ArrowLeft' || key === 'ArrowRight') {
      if (!isSelect) {
        const input = e.target;
        const value = String(input.value ?? '');
        const start = input.selectionStart;
        const end = input.selectionEnd;
        // Only leave the cell when caret is at the edge (mid-text editing still works).
        // type=number often reports null selection — treat as edge so arrows move cells.
        if (typeof start === 'number' && typeof end === 'number' && start !== end) return;
        if (key === 'ArrowLeft' && start != null && start > 0) return;
        if (key === 'ArrowRight' && end != null && end < value.length) return;
      }

      const step = key === 'ArrowLeft' ? -1 : 1;
      let nextFieldIndex = fieldIndex + step;
      while (nextFieldIndex >= 0 && nextFieldIndex < navFields.length) {
        const nextField = navFields[nextFieldIndex];
        if (focusVariantCell(root, rowIndex, nextField)) {
          e.preventDefault();
          return;
        }
        nextFieldIndex += step;
      }
      return;
    }

    // ArrowUp / ArrowDown — same field, adjacent row (including bulk as -1).
    // Always preventDefault for number inputs so the spinner does not change the value.
    const step = key === 'ArrowUp' ? -1 : 1;
    let nextRow = rowIndex + step;
    while (nextRow >= minRow && nextRow <= maxRow) {
      if (focusVariantCell(root, nextRow, field)) {
        e.preventDefault();
        return;
      }
      nextRow += step;
    }
    if (isSelect || isNumberInput) e.preventDefault();
  };

  const identityCols =
    1 + (showSize ? 1 : 0) + 1 + (showColor ? 1 : 0) + (showUnitCount ? 1 : 0) + (showWeight ? 1 : 0);

  const sheetColPercents = sheet
    ? buildSheetColPercents({ showSize, showColor, showUnitCount, showWeight })
    : null;

  /**
   * Sheet mode: fixed layout + colgroup % fills viewport width — no sideways scroll.
   * Inline table may still scroll if the Selling column is narrow.
   */
  const inputBase = sheet
    ? 'box-border w-full min-w-0 rounded-md border border-[#E2E8F0] bg-white px-2 py-1.5 text-[12.5px] text-[#334155] placeholder:text-[#CBD5E1] outline-none transition-colors focus:border-[#94A3B8] focus:ring-1 focus:ring-[#94A3B8]/40'
    : 'w-full rounded border-0 bg-transparent px-1 py-0.5 text-[12px] text-[#334155] placeholder:text-[#CBD5E1] transition-colors focus:bg-white/80 focus:outline-none';
  const selectBase = `${inputBase} cursor-pointer appearance-none`;
  const nameInputClass = sheet
    ? `${inputBase} font-medium`
    : inputBase;

  return (
    <div
      ref={tableRootRef}
      className={
        sheet
          ? 'w-full min-w-0 overflow-x-hidden rounded-2xl border border-[#E2E8F0] bg-white'
          : 'overflow-x-auto [&::-webkit-scrollbar]:h-[5px] [&::-webkit-scrollbar]:w-[5px] [&::-webkit-scrollbar-thumb]:rounded-[10px] [&::-webkit-scrollbar-thumb]:bg-[#CBD5E1] [&::-webkit-scrollbar-track]:bg-transparent'
      }
    >
      <table
        className={`w-full border-collapse ${sheet ? 'table-fixed' : ''}`}
        style={sheet ? { tableLayout: 'fixed', width: '100%' } : { minWidth: 1100 }}
      >
        {sheetColPercents ? (
          <colgroup>
            {sheetColPercents.map((pct, i) => (
              <col key={`sheet-col-${i}`} style={{ width: pct }} />
            ))}
          </colgroup>
        ) : null}
        <thead>
          <tr>
            <th style={{ background: '#F8FAFC', borderBottom: '2px solid #E2E8F0' }} />
            <th className="text-center" style={{ background: '#F8FAFC', borderBottom: '2px solid #E2E8F0' }}>
              <span className="text-[9px] font-bold uppercase tracking-widest text-[#94A3B8]" style={dm}>
                Def
              </span>
            </th>
            <th className="text-center" style={{ background: '#F8FAFC', borderBottom: '2px solid #E2E8F0' }}>
              <span className="text-[9px] font-bold uppercase tracking-widest text-[#94A3B8]" style={dm}>
                Cat
              </span>
            </th>
            <th
              colSpan={identityCols}
              className="px-3 py-2 text-left"
              style={{
                background: GROUP_COLORS.identity.bg,
                borderBottom: `2px solid ${GROUP_COLORS.identity.dot}`,
              }}
            >
              <GroupHead color={GROUP_COLORS.identity} label="Identity" />
            </th>
            <th
              colSpan={4}
              className="px-3 py-2 text-left"
              style={{
                background: GROUP_COLORS.inventory.bg,
                borderBottom: `2px solid ${GROUP_COLORS.inventory.dot}`,
              }}
            >
              <GroupHead color={GROUP_COLORS.inventory} label="Inventory" />
            </th>
            <th
              colSpan={4}
              className="px-3 py-2 text-left"
              style={{
                background: GROUP_COLORS.pricing.bg,
                borderBottom: `2px solid ${GROUP_COLORS.pricing.dot}`,
              }}
            >
              <GroupHead color={GROUP_COLORS.pricing} label="Pricing" />
            </th>
            <th
              className="px-3 py-2 text-left"
              style={{
                background: GROUP_COLORS.images.bg,
                borderBottom: `2px solid ${GROUP_COLORS.images.dot}`,
              }}
            >
              <GroupHead color={GROUP_COLORS.images} label="Imgs" />
            </th>
            <th style={{ background: '#F8FAFC', borderBottom: '2px solid #E2E8F0' }} />
          </tr>

          <tr style={{ background: '#F8FAFC' }}>
            <ColHead>#</ColHead>
            <th style={{ borderBottom: '1px solid #EEF2F7' }} />
            <th style={{ borderBottom: '1px solid #EEF2F7' }} />
            <ColHead left={GROUP_COLORS.identity.left}>Name</ColHead>
            {showSize ? <ColHead>Size</ColHead> : null}
            <ColHead>Unit</ColHead>
            {showColor ? <ColHead>Colour</ColHead> : null}
            {showUnitCount ? <ColHead>Count</ColHead> : null}
            {showWeight ? <ColHead>Weight</ColHead> : null}
            <ColHead left={GROUP_COLORS.inventory.left}>SKU</ColHead>
            <ColHead>Barcode</ColHead>
            <ColHead>HSN</ColHead>
            <ColHead>GST %</ColHead>
            <ColHead left={GROUP_COLORS.pricing.left}>MRP ₹</ColHead>
            <ColHead>Sell ₹</ColHead>
            <ColHead>Disc %</ColHead>
            <ColHead>Margin ₹</ColHead>
            <ColHead left={GROUP_COLORS.images.left}>Images</ColHead>
            <th style={{ borderBottom: '1px solid #EEF2F7' }} />
          </tr>

          {/* Bulk fill — restores Apply-to-empty-cells from prior sheet */}
          {bulkVariantInputs && handleApplyBulkInputs ? (
            <tr style={{ background: '#FFFFFF' }}>
              <td style={{ borderBottom: '1px solid #EEF2F7' }} />
              <td style={{ borderBottom: '1px solid #EEF2F7' }} />
              <td className="px-1 py-1.5" style={{ borderBottom: '1px solid #EEF2F7' }}>
                <select
                  value={bulkVariantInputs.showInCatalog}
                  onChange={(e) => handleBulkVariantInputChange('showInCatalog', e.target.value)}
                  className={selectBase}
                  style={inter}
                  title="Apply catalogue visibility"
                >
                  <option value="">Cat</option>
                  <option value="yes">On</option>
                  <option value="no">Off</option>
                </select>
              </td>
              <BareCell left={GROUP_COLORS.identity.left}>
                <input
                  className={nameInputClass}
                  style={inter}
                  value={bulkVariantInputs.name}
                  onChange={(e) => handleBulkVariantInputChange('name', e.target.value)}
                  onKeyDown={(e) => handleVariantCellKeyDown(e, -1, 'name')}
                  data-variant-nav="-1:name"
                  placeholder="Fill name…"
                />
              </BareCell>
              {showSize ? <BareCell /> : null}
              <BareCell>
                <input
                  className={inputBase}
                  style={inter}
                  value={bulkVariantInputs.unit}
                  onChange={(e) => handleBulkVariantInputChange('unit', e.target.value)}
                  onKeyDown={(e) => handleVariantCellKeyDown(e, -1, 'unit')}
                  data-variant-nav="-1:unit"
                  placeholder="Unit"
                />
              </BareCell>
              {showColor ? <BareCell /> : null}
              {showUnitCount ? <BareCell /> : null}
              {showWeight ? <BareCell /> : null}
              <BareCell left={GROUP_COLORS.inventory.left}>
                <input
                  className={inputBase}
                  style={inter}
                  value={bulkVariantInputs.sku}
                  onChange={(e) => handleBulkVariantInputChange('sku', e.target.value)}
                  onKeyDown={(e) => handleVariantCellKeyDown(e, -1, 'sku')}
                  data-variant-nav="-1:sku"
                  placeholder="SKU"
                />
              </BareCell>
              <BareCell>
                <input
                  className={inputBase}
                  style={inter}
                  value={bulkVariantInputs.barcode}
                  onChange={(e) => handleBulkVariantInputChange('barcode', e.target.value)}
                  onKeyDown={(e) => handleVariantCellKeyDown(e, -1, 'barcode')}
                  data-variant-nav="-1:barcode"
                  placeholder="Barcode"
                />
              </BareCell>
              <BareCell>
                <input
                  className={inputBase}
                  style={inter}
                  value={bulkVariantInputs.hsnCode}
                  onChange={(e) => handleBulkVariantInputChange('hsnCode', e.target.value)}
                  onKeyDown={(e) => handleVariantCellKeyDown(e, -1, 'hsnCode')}
                  data-variant-nav="-1:hsnCode"
                  placeholder="HSN"
                />
              </BareCell>
              <BareCell>
                <input
                  className={inputBase}
                  style={inter}
                  value={bulkVariantInputs.gstPercent}
                  onChange={(e) => handleBulkVariantInputChange('gstPercent', e.target.value)}
                  onKeyDown={(e) => handleVariantCellKeyDown(e, -1, 'gstPercent')}
                  data-variant-nav="-1:gstPercent"
                  placeholder="GST"
                />
              </BareCell>
              <BareCell left={GROUP_COLORS.pricing.left}>
                <input
                  className={`${inputBase} text-right`}
                  style={inter}
                  value={formatIndianNumberInput(bulkVariantInputs.mrp)}
                  onChange={(e) => handleBulkVariantInputChange('mrp', e.target.value)}
                  onKeyDown={(e) => handleVariantCellKeyDown(e, -1, 'mrp')}
                  data-variant-nav="-1:mrp"
                  placeholder="MRP"
                />
              </BareCell>
              <BareCell>
                <input
                  className={`${inputBase} text-right`}
                  style={inter}
                  value={formatIndianNumberInput(bulkVariantInputs.sellingPrice)}
                  onChange={(e) => handleBulkVariantInputChange('sellingPrice', e.target.value)}
                  onKeyDown={(e) => handleVariantCellKeyDown(e, -1, 'sellingPrice')}
                  data-variant-nav="-1:sellingPrice"
                  placeholder="Sell"
                />
              </BareCell>
              <BareCell>
                <input
                  className={`${inputBase} text-right`}
                  style={inter}
                  value={bulkVariantInputs.discountPercent}
                  onChange={(e) => handleBulkVariantInputChange('discountPercent', e.target.value)}
                  onKeyDown={(e) => handleVariantCellKeyDown(e, -1, 'discountPercent')}
                  data-variant-nav="-1:discountPercent"
                  placeholder="%"
                />
              </BareCell>
              <BareCell>
                <input
                  className={`${inputBase} text-right`}
                  style={inter}
                  value={formatIndianNumberInput(bulkVariantInputs.marginPrice)}
                  onChange={(e) => handleBulkVariantInputChange('marginPrice', e.target.value)}
                  onKeyDown={(e) => handleVariantCellKeyDown(e, -1, 'marginPrice')}
                  data-variant-nav="-1:marginPrice"
                  placeholder="Margin"
                />
              </BareCell>
              <BareCell left={GROUP_COLORS.images.left} />
              <td className="px-1 py-1.5 text-center" style={{ borderBottom: '1px solid #EEF2F7' }}>
                <button
                  type="button"
                  onClick={handleApplyBulkInputs}
                  className="rounded-md px-2 py-1 text-[10px] font-bold text-emerald-700 hover:bg-emerald-50"
                  style={dm}
                  title="Apply fill row to empty cells (confirm to overwrite)"
                >
                  Apply
                </button>
              </td>
            </tr>
          ) : null}
        </thead>

        <tbody>
          {variantRows.map((row, index) => {
            const palette = PASTEL[index % PASTEL.length];
            const rowErrors = getVariantPricingErrors(row);
            const colorDisplay = row.color
              ? resolveColorDisplay(
                  row.colorDetails ||
                    (row.colorHex
                      ? { colorName: row.color, colorHex: row.colorHex, swatch: row.colorSwatch }
                      : row.color),
                  formData?.colorVariants
                )
              : null;
            const colorFill =
              colorDisplay?.swatch === 'transparent' || colorDisplay?.swatch === 'multicolour'
                ? null
                : colorDisplay?.colorHex || null;
            const colorText = colorFill ? contrastOnHex(colorFill) : '#334155';

            return (
              <tr
                key={row._rowId || index}
                className="group transition-colors"
                style={{ background: index % 2 === 0 ? '#FFFFFF' : '#FAFBFD' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = palette.accentLight;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = index % 2 === 0 ? '#FFFFFF' : '#FAFBFD';
                }}
              >
                <td className="px-2 py-2.5 text-center" style={{ borderBottom: '1px solid #EEF2F7' }}>
                  <div
                    className="mx-auto flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white"
                    style={{ ...dm, background: palette.accent }}
                  >
                    {index + 1}
                  </div>
                </td>
                <td className="px-1 py-2.5 text-center" style={{ borderBottom: '1px solid #EEF2F7' }}>
                  <div className="mx-auto flex justify-center">
                    <DefRadio
                      checked={Boolean(row.isDefault)}
                      onSelect={() => handleSetDefaultVariantRow(index)}
                      accent={palette.accent}
                    />
                  </div>
                </td>
                <td className="px-1 py-2.5 text-center" style={{ borderBottom: '1px solid #EEF2F7' }}>
                  <div className="mx-auto flex justify-center">
                    <Toggle
                      checked={row.showInCatalog === true}
                      onChange={(v) => handleVariantRowChange(index, 'showInCatalog', v)}
                      accent={palette.accent}
                      size="sm"
                    />
                  </div>
                </td>

                <BareCell left={GROUP_COLORS.identity.left} roomy={sheet}>
                  <input
                    className={nameInputClass}
                    style={inter}
                    value={row.name || ''}
                    onChange={(e) => handleVariantRowChange(index, 'name', e.target.value)}
                    onKeyDown={(e) => handleVariantCellKeyDown(e, index, 'name')}
                    data-variant-nav={`${index}:name`}
                    placeholder="Variant name"
                  />
                </BareCell>
                {showSize ? (
                  <BareCell roomy={sheet}>
                    <input
                      className={inputBase}
                      style={inter}
                      value={row.size || ''}
                      onChange={(e) => handleVariantRowChange(index, 'size', e.target.value)}
                      onKeyDown={(e) => handleVariantCellKeyDown(e, index, 'size')}
                      data-variant-nav={`${index}:size`}
                    />
                  </BareCell>
                ) : null}
                <BareCell roomy={sheet}>
                  <select
                    className={selectBase}
                    style={inter}
                    value={row.unit || ''}
                    onChange={(e) => handleVariantRowChange(index, 'unit', e.target.value)}
                    onKeyDown={(e) => handleVariantCellKeyDown(e, index, 'unit')}
                    data-variant-nav={`${index}:unit`}
                  >
                    <option value="">—</option>
                    {UNIT_OPTIONS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </BareCell>
                {showColor ? (
                  <BareCell roomy={sheet}>
                    <select
                      className={`${selectBase} font-semibold`}
                      style={{
                        ...inter,
                        background:
                          colorDisplay?.swatch === 'multicolour'
                            ? 'linear-gradient(135deg,#ef4444,#eab308,#3b82f6)'
                            : colorDisplay?.swatch === 'transparent'
                              ? 'repeating-conic-gradient(#e5e7eb 0% 25%, #fff 0% 50%) 50% / 8px 8px'
                              : colorFill || '#fff',
                        color: colorDisplay?.swatch === 'multicolour' ? '#fff' : colorText,
                        borderColor: colorFill ? `${colorFill}88` : '#E2E8F0',
                      }}
                      value={row.color || ''}
                      onChange={(e) => handleVariantRowChange(index, 'color', e.target.value)}
                      onKeyDown={(e) => handleVariantCellKeyDown(e, index, 'color')}
                      data-variant-nav={`${index}:color`}
                    >
                      <option value="">—</option>
                      {variantTableColorOptions.map((o) => (
                        <option key={o.name} value={o.name}>
                          {o.name}
                        </option>
                      ))}
                    </select>
                  </BareCell>
                ) : null}
                {showUnitCount ? (
                  <BareCell roomy={sheet}>
                    <input
                      className={inputBase}
                      style={inter}
                      value={row.unitCount || ''}
                      onChange={(e) => handleVariantRowChange(index, 'unitCount', e.target.value)}
                      onKeyDown={(e) => handleVariantCellKeyDown(e, index, 'unitCount')}
                      data-variant-nav={`${index}:unitCount`}
                    />
                  </BareCell>
                ) : null}
                {showWeight ? (
                  <BareCell roomy={sheet}>
                    <input
                      className={inputBase}
                      style={inter}
                      value={row.weight || ''}
                      onChange={(e) => handleVariantRowChange(index, 'weight', e.target.value)}
                      onKeyDown={(e) => handleVariantCellKeyDown(e, index, 'weight')}
                      data-variant-nav={`${index}:weight`}
                    />
                  </BareCell>
                ) : null}

                <BareCell left={GROUP_COLORS.inventory.left} roomy={sheet}>
                  <input
                    className={inputBase}
                    style={inter}
                    value={row.sku || ''}
                    onChange={(e) => handleVariantRowChange(index, 'sku', e.target.value)}
                    onKeyDown={(e) => handleVariantCellKeyDown(e, index, 'sku')}
                    data-variant-nav={`${index}:sku`}
                    placeholder="SKU"
                  />
                </BareCell>
                <BareCell roomy={sheet}>
                  <input
                    className={inputBase}
                    style={inter}
                    value={row.barcode || ''}
                    onChange={(e) => handleVariantRowChange(index, 'barcode', e.target.value)}
                    onKeyDown={(e) => handleVariantCellKeyDown(e, index, 'barcode')}
                    data-variant-nav={`${index}:barcode`}
                  />
                </BareCell>
                <BareCell roomy={sheet}>
                  <input
                    className={inputBase}
                    style={inter}
                    value={row.hsnCode || ''}
                    onChange={(e) => handleVariantRowChange(index, 'hsnCode', e.target.value)}
                    onKeyDown={(e) => handleVariantCellKeyDown(e, index, 'hsnCode')}
                    data-variant-nav={`${index}:hsnCode`}
                  />
                </BareCell>
                <BareCell roomy={sheet}>
                  <select
                    className={selectBase}
                    style={inter}
                    value={row.gstPercent ?? 0}
                    onChange={(e) => handleVariantRowChange(index, 'gstPercent', e.target.value)}
                    onKeyDown={(e) => handleVariantCellKeyDown(e, index, 'gstPercent')}
                    data-variant-nav={`${index}:gstPercent`}
                  >
                    {GST_OPTIONS.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </BareCell>

                <BareCell left={GROUP_COLORS.pricing.left} roomy={sheet}>
                  <input
                    className={`${inputBase} text-right`}
                    style={inter}
                    value={formatIndianNumberInput(row.mrp ?? '')}
                    onChange={(e) => handleVariantRowChange(index, 'mrp', e.target.value)}
                    onKeyDown={(e) => handleVariantCellKeyDown(e, index, 'mrp')}
                    data-variant-nav={`${index}:mrp`}
                    placeholder="0"
                  />
                </BareCell>
                <BareCell roomy={sheet}>
                  <input
                    className={`${inputBase} text-right ${rowErrors.sellingPrice ? 'bg-red-50' : ''}`}
                    style={inter}
                    value={formatIndianNumberInput(row.sellingPrice ?? '')}
                    onChange={(e) => handleVariantRowChange(index, 'sellingPrice', e.target.value)}
                    onKeyDown={(e) => handleVariantCellKeyDown(e, index, 'sellingPrice')}
                    data-variant-nav={`${index}:sellingPrice`}
                    placeholder="0"
                  />
                </BareCell>
                <BareCell roomy={sheet}>
                  <input
                    className={`${inputBase} text-right`}
                    style={inter}
                    type="number"
                    value={row.discountPercent ?? ''}
                    onChange={(e) => handleVariantRowChange(index, 'discountPercent', e.target.value)}
                    onKeyDown={(e) => handleVariantCellKeyDown(e, index, 'discountPercent')}
                    data-variant-nav={`${index}:discountPercent`}
                    placeholder="0"
                  />
                </BareCell>
                <BareCell roomy={sheet}>
                  <input
                    className={`${inputBase} text-right`}
                    style={inter}
                    value={formatIndianNumberInput(row.marginPrice ?? '')}
                    onChange={(e) => handleVariantRowChange(index, 'marginPrice', e.target.value)}
                    onKeyDown={(e) => handleVariantCellKeyDown(e, index, 'marginPrice')}
                    data-variant-nav={`${index}:marginPrice`}
                    placeholder="0"
                  />
                </BareCell>

                <BareCell left={GROUP_COLORS.images.left} roomy={sheet} overflowVisible>
                  <VariantRowImageCell
                    row={row}
                    index={index}
                    layout={layout}
                    isUploading={isUploading}
                    handleVariantRowImageUpload={handleVariantRowImageUpload}
                    handleRemoveVariantRowImage={handleRemoveVariantRowImage}
                  />
                </BareCell>

                <td className="px-1 py-1.5 text-center" style={{ borderBottom: '1px solid #EEF2F7' }}>
                  <button
                    type="button"
                    onClick={() => handleDeleteVariantRow(index)}
                    className="text-[#E2E8F0] opacity-0 transition-colors hover:text-red-400 group-hover:opacity-100"
                    aria-label="Delete"
                  >
                    <XIcon />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>

        <tfoot>
          <tr>
            <td colSpan={3} style={{ borderTop: '1px solid #EEF2F7', paddingTop: 8, paddingBottom: 8 }} />
            <td colSpan={20} style={{ borderTop: '1px solid #EEF2F7' }}>
              <button
                type="button"
                onClick={handleAddSingleVariantRow}
                className="flex items-center gap-1.5 px-2 text-[11.5px] font-semibold text-[#94A3B8] hover:text-[#475569]"
                style={dm}
              >
                <PlusIcon small />
                Add variant row
              </button>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function GroupHead({ color, label }) {
  return (
    <span
      className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest"
      style={{ ...dm, color: color.text }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color.dot }} />
      {label}
    </span>
  );
}

function ColHead({ children, left }) {
  return (
    <th
      className="min-w-0 px-2.5 py-2 text-left"
      style={{
        borderBottom: '1px solid #EEF2F7',
        borderLeft: left ? `2px solid ${left}` : undefined,
      }}
    >
      {children ? (
        <span className="block truncate text-[10px] font-semibold uppercase tracking-wider text-[#94A3B8]" style={dm}>
          {children}
        </span>
      ) : null}
    </th>
  );
}

function BareCell({ children, left, roomy, overflowVisible }) {
  return (
    <td
      className={`${roomy ? 'min-w-0 px-2.5 py-2.5' : 'px-2 py-1.5'}${
        overflowVisible ? ' overflow-visible' : ''
      }`}
      style={{
        borderBottom: '1px solid #EEF2F7',
        borderLeft: left ? `2px solid ${left}` : undefined,
      }}
    >
      {children}
    </td>
  );
}

/**
 * Compact images cell: + first, then thumbnails with overlapping red remove badge.
 */
function VariantRowImageCell({
  row,
  index,
  layout,
  isUploading,
  handleVariantRowImageUpload,
  handleRemoveVariantRowImage,
  maxVisible = 3,
}) {
  const images = row.images || [];
  const visible = images.slice(0, maxVisible);
  const extra = images.length - visible.length;
  const inputId = `variant-table-img-${layout}-${row._rowId || index}`;

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5 overflow-visible py-1 pr-1">
      <input
        id={inputId}
        type="file"
        multiple
        accept="image/*"
        className="hidden"
        onChange={(e) => handleVariantRowImageUpload(e, index)}
      />
      <label
        htmlFor={inputId}
        className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md border border-dashed border-[#CBD5E1] text-[#94A3B8] transition-colors hover:border-[#94A3B8] hover:text-[#64748B]"
        title={images.length ? 'Add more images' : 'Add images'}
        style={inter}
      >
        {isUploading ? '…' : <PlusIcon small />}
      </label>
      {visible.map((url, imageIndex) => (
        <div key={`${url}-${imageIndex}`} className="relative h-8 w-8 shrink-0">
          <div className="h-8 w-8 overflow-hidden rounded-md border border-[#E2E8F0] bg-white">
            <Image
              src={url}
              alt=""
              width={32}
              height={32}
              unoptimized
              className="h-full w-full object-cover"
            />
          </div>
          <button
            type="button"
            onClick={() => handleRemoveVariantRowImage(index, imageIndex)}
            className="absolute -right-1 -top-1 z-10 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-500 text-[9px] leading-none text-white shadow-sm ring-1 ring-white"
            aria-label="Remove image"
          >
            ×
          </button>
        </div>
      ))}
      {extra > 0 ? (
        <span className="text-[10px] font-semibold tabular-nums text-[#94A3B8]" style={inter}>
          +{extra}
        </span>
      ) : null}
    </div>
  );
}

function CardsIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <rect x="0.75" y="0.75" width="4.5" height="4.5" rx="1.2" stroke="currentColor" strokeWidth="1.2" />
      <rect x="6.75" y="0.75" width="4.5" height="4.5" rx="1.2" stroke="currentColor" strokeWidth="1.2" />
      <rect x="0.75" y="6.75" width="4.5" height="4.5" rx="1.2" stroke="currentColor" strokeWidth="1.2" />
      <rect x="6.75" y="6.75" width="4.5" height="4.5" rx="1.2" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

function ExpandIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TableIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path
        d="M0.75 3.5h10.5M0.75 6.5h10.5M0.75 9.5h10.5M0.75 0.75v10.5"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <path d="M4 0.75v10.5M8 0.75v10.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function PlusIcon({ small }) {
  const s = small ? 13 : 15;
  return (
    <svg width={s} height={s} viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <path d="M7.5 1.5v12M1.5 7.5h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <path
        d="M5.5 1.5h4M1.5 3.5h12M6 3.5V2.5a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v1M2.5 3.5l.9 8.1a1 1 0 0 0 1 .9h6.2a1 1 0 0 0 1-.9l.9-8.1"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
      <path d="M2 2l9 9M11 2l-9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
