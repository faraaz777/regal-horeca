'use client';

import { Loader2, Pencil } from 'lucide-react';
import {
  DEAD_STOCK_PERIOD_LABELS,
  DEAD_STOCK_PERIODS,
} from '@/lib/shared/inventoryConstants';

function Field({ label, required, children }) {
  return (
    <div>
      <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

function RuleRow({ label, value, highlight }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b border-gray-100 last:border-0">
      <span className="text-xs font-semibold text-gray-700 shrink-0">{label}</span>
      <span
        className={`text-sm text-right ${
          highlight ? 'font-semibold text-emerald-800' : 'font-medium text-gray-900'
        }`}
      >
        {value}
      </span>
    </div>
  );
}

const inputClass =
  'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500';

export function buildRulesFormFromRule(rule) {
  if (!rule) return null;
  return {
    minStock: String(rule.minStock ?? ''),
    maxStock: String(rule.maxStock ?? ''),
    reorderQty: String(rule.reorderQty ?? '0'),
    deadStockPeriod: rule.deadStockPeriod || 'month',
    deadStockQty: String(rule.deadStockQty ?? ''),
    deadStockMarked: Boolean(rule.deadStockMarked),
    gateRemark: rule.gateRemark || '',
  };
}

function RulesReadView({ rule, stockUnit, showPermissionNote = false }) {
  const unit = stockUnit || 'units';
  const periodLabel = DEAD_STOCK_PERIOD_LABELS[rule.deadStockPeriod] || rule.deadStockPeriod;
  const setAtLabel = rule.setAt
    ? new Date(rule.setAt).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : '—';
  const updatedAtLabel = rule.updatedAt
    ? new Date(rule.updatedAt).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : '—';

  return (
    <>
      <div className="rounded-lg border border-gray-200 bg-gray-50/50 px-4 py-1">
        <RuleRow label="Min stock" value={`${rule.minStock} ${unit}`} />
        <RuleRow label="Max stock" value={`${rule.maxStock} ${unit}`} />
        <RuleRow label="Reorder qty" value={`${rule.reorderQty ?? 0} ${unit}`} />
        <RuleRow label="Dead stock rule" value={periodLabel} />
        <RuleRow label="Qty to sell in period" value={`${rule.deadStockQty} ${unit}`} />
        <RuleRow
          label="Dead stock tag"
          value={rule.deadStockMarked ? 'Yes (sales can still sell)' : 'No'}
          highlight={rule.deadStockMarked}
        />
        <RuleRow label="Set at intake" value={setAtLabel} />
        <RuleRow label="Last updated" value={updatedAtLabel} />
      </div>
      {rule.gateRemark && (
        <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
            Intake remark
          </p>
          <p className="text-sm text-gray-800">{rule.gateRemark}</p>
        </div>
      )}
      {showPermissionNote && (
        <p className="text-[11px] text-gray-500">
          Only Super Admin and Inventory Manager can edit these rules.
        </p>
      )}
    </>
  );
}

export default function RulesPanel({
  rule,
  stockUnit,
  isLoading,
  canEdit,
  isEditing,
  onStartEdit,
  rulesForm,
  onRulesChange,
}) {
  if (isLoading) {
    return (
      <p className="text-sm text-gray-500 flex items-center gap-2 py-6 justify-center">
        <Loader2 size={14} className="animate-spin" />
        Loading inventory rules…
      </p>
    );
  }

  if (!rule) {
    return (
      <div className="rounded-lg border border-amber-100 bg-amber-50/60 px-4 py-5 text-center">
        <p className="text-sm font-medium text-amber-900">No inventory rules on file</p>
        <p className="text-xs text-amber-800 mt-1">
          Rules are set during the first inventory gate when opening stock is recorded.
        </p>
      </div>
    );
  }

  const unit = stockUnit || 'units';
  const setAtLabel = rule.setAt
    ? new Date(rule.setAt).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : '—';
  const updatedAtLabel = rule.updatedAt
    ? new Date(rule.updatedAt).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : '—';

  if (!canEdit || !isEditing) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
            Inventory gate rules
          </p>
          {canEdit && !isEditing && (
            <button
              type="button"
              onClick={onStartEdit}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 border border-emerald-200 rounded-lg bg-emerald-50 hover:bg-emerald-100 transition-colors"
            >
              <Pencil size={13} />
              Edit
            </button>
          )}
        </div>
        <RulesReadView rule={rule} stockUnit={stockUnit} showPermissionNote={!canEdit} />
      </div>
    );
  }

  const update = (key, value) => {
    onRulesChange((prev) => ({ ...prev, [key]: value }));
  };

  const toggleDeadStock = (checked) => {
    onRulesChange((prev) => ({ ...prev, deadStockMarked: checked }));
  };

  return (
    <div className="space-y-4">
      <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
        Inventory gate rules
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Min stock" required>
          <div className="relative">
            <input
              type="number"
              min="0"
              className={`${inputClass} pr-14`}
              value={rulesForm?.minStock ?? ''}
              onChange={(e) => update('minStock', e.target.value)}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
              {unit}
            </span>
          </div>
        </Field>
        <Field label="Max stock" required>
          <div className="relative">
            <input
              type="number"
              min="0"
              className={`${inputClass} pr-14`}
              value={rulesForm?.maxStock ?? ''}
              onChange={(e) => update('maxStock', e.target.value)}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
              {unit}
            </span>
          </div>
        </Field>
        <Field label="Reorder qty">
          <div className="relative">
            <input
              type="number"
              min="0"
              className={`${inputClass} pr-14`}
              value={rulesForm?.reorderQty ?? '0'}
              onChange={(e) => update('reorderQty', e.target.value)}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
              {unit}
            </span>
          </div>
        </Field>
        <Field label="Dead stock rule" required>
          <select
            className={inputClass}
            value={rulesForm?.deadStockPeriod ?? 'month'}
            onChange={(e) => update('deadStockPeriod', e.target.value)}
          >
            {DEAD_STOCK_PERIODS.map((period) => (
              <option key={period} value={period}>
                {DEAD_STOCK_PERIOD_LABELS[period]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Qty to sell in period" required>
          <div className="relative">
            <input
              type="number"
              min="1"
              className={`${inputClass} pr-14`}
              value={rulesForm?.deadStockQty ?? ''}
              onChange={(e) => update('deadStockQty', e.target.value)}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
              {unit}
            </span>
          </div>
        </Field>
      </div>

      <label className="flex items-start gap-2.5 cursor-pointer select-none rounded-lg border border-gray-200 bg-white px-3 py-2.5">
        <input
          type="checkbox"
          checked={Boolean(rulesForm?.deadStockMarked)}
          onChange={(e) => toggleDeadStock(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
        />
        <span>
          <span className="text-sm font-medium text-gray-800">Dead stock tag</span>
          <span className="block text-[11px] text-gray-500 mt-0.5">
            Product-wide label only — sales can still sell this item.
          </span>
        </span>
      </label>

      <Field label="Intake remark">
        <textarea
          className={`${inputClass} resize-none`}
          rows={2}
          value={rulesForm?.gateRemark ?? ''}
          onChange={(e) => update('gateRemark', e.target.value)}
          placeholder="Optional note from original intake"
        />
      </Field>

      <p className="text-[11px] text-gray-500">
        Set at intake: {setAtLabel}
        {rule.updatedAt && ` · Last updated: ${updatedAtLabel}`}
      </p>
    </div>
  );
}
