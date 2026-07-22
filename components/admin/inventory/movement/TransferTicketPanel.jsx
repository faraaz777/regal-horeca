'use client';

import { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import { Loader2, ArrowRight } from 'lucide-react';
import { fetchCascadeRacks } from '@/lib/client/locationCascadeApi';
import { cascadeRacksSwrKey } from '@/lib/client/cascadeRacksSwrKey';
import {
  shortLocationLabel,
  locationRackCode,
  locationRackName,
  locationCodePath,
} from '@/lib/client/inventory/locationLabels';
import MovementQtyStepper from './MovementQtyStepper';
import LocationCascadePicker from './LocationCascadePicker';

export const TRANSFER_TICKET =
  'rounded-xl border-2 border-gray-900 bg-[#faf8f3] shadow-[3px_3px_0_0_rgba(0,0,0,0.85)]';
export const TRANSFER_LABEL =
  'text-[10px] font-bold uppercase tracking-widest text-gray-800 font-mono';

/**
 * Transfer source rack — same compact typography as Add/Minus LocationQtyCard:
 * code + name on one line, path under, on-hand as its own tile.
 */
function TransferFromCard({ row, selected, stockUnit, transferQty, onSelect, onQtyChange }) {
  const onHand = row.qty || 0;
  const code = locationRackCode(row) || shortLocationLabel(row);
  const name = locationRackName(row);
  const codePath = locationCodePath(row);
  const showName = Boolean(name && name !== code);
  const showPath = Boolean(codePath && codePath !== '—');

  return (
    <button
      type="button"
      onClick={() => onSelect(row)}
      className={`w-full text-left rounded-xl border-2 px-3 py-2.5 transition-colors ${
        selected
          ? 'border-amber-400 bg-amber-50 shadow-[2px_2px_0_0_rgba(0,0,0,0.75)]'
          : 'border-gray-200 bg-white hover:border-gray-400'
      }`}
    >
      <div className="flex items-center gap-2.5">
        <div className="min-w-0 flex-1">
          <p className="min-w-0 truncate leading-tight">
            <span className="text-[15px] font-bold font-mono tracking-tight text-gray-900">
              {code}
            </span>
            {showName ? (
              <span className="text-[13px] font-medium text-gray-500 ml-2">{name}</span>
            ) : null}
          </p>
          {showPath ? (
            <p
              className="text-[11px] text-gray-400 font-mono truncate leading-none mt-1"
              title={codePath}
            >
              {codePath}
            </p>
          ) : null}
        </div>

        <div
          className={`shrink-0 flex flex-col items-center justify-center min-w-[3.25rem] px-2 py-1.5 rounded-xl border ${
            selected
              ? 'bg-amber-100/80 border-amber-200 text-amber-950'
              : 'bg-gray-50 border-gray-100 text-gray-900'
          }`}
          title={`${onHand} ${stockUnit} on hand`}
        >
          <span className="text-base font-bold font-mono tabular-nums leading-none tracking-tight">
            {onHand}
          </span>
          <span className="text-[8px] font-bold uppercase tracking-wider text-gray-500 mt-0.5 leading-none">
            on hand
          </span>
        </div>
      </div>

      {selected && onHand > 0 && (
        <div
          className="mt-2.5 pt-2.5 border-t border-amber-200/90 flex items-center justify-between gap-2"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          role="presentation"
        >
          <span className="text-[9px] font-bold uppercase tracking-wider text-gray-500">
            Move
          </span>
          <MovementQtyStepper
            value={transferQty}
            max={onHand}
            onChange={onQtyChange}
            accent="amber"
          />
        </div>
      )}
    </button>
  );
}

function TransferToRackTile({
  rack,
  selected,
  disabled,
  productQty,
  stockUnit,
  onSelect,
}) {
  const code = locationRackCode(rack) || String(rack._id).slice(-4);
  const name = locationRackName(rack);
  const hasProduct = (productQty || 0) > 0;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => !disabled && onSelect(rack)}
      title={`${code}${name && name !== code ? ` · ${name}` : ''}${
        hasProduct ? ` · ${productQty} ${stockUnit} here` : ' · Empty for this product'
      }`}
      className={`relative rounded-md border text-left transition-colors min-w-[3.5rem] max-w-[5rem] px-1.5 py-1.5 disabled:opacity-40 disabled:cursor-not-allowed ${
        selected
          ? 'border-amber-500 bg-amber-100 text-gray-900 ring-1 ring-amber-400/50 shadow-[2px_2px_0_0_rgba(0,0,0,0.65)]'
          : hasProduct
            ? 'border-sky-200 bg-white text-gray-900 hover:border-sky-400 hover:bg-sky-50'
            : 'border-gray-200 bg-gray-50/80 text-gray-600 hover:border-gray-300 hover:bg-white'
      }`}
    >
      <p className="text-[10px] font-bold font-mono leading-none truncate text-gray-900">{code}</p>
      <p className="text-[9px] mt-0.5 truncate leading-tight text-gray-500">{name}</p>
      <p
        className={`text-[9px] mt-0.5 leading-none tabular-nums ${
          hasProduct ? 'text-sky-800 font-medium' : 'text-gray-300'
        }`}
      >
        {hasProduct ? productQty : '—'}
      </p>
    </button>
  );
}

function TransferFloorRacks({
  floorId,
  fromLocationId,
  toLocationId,
  productQtyByLoc,
  stockUnit,
  onSelectRack,
}) {
  const { data: rackData, isLoading } = useSWR(
    cascadeRacksSwrKey('transfer', floorId),
    () => fetchCascadeRacks(floorId),
    { revalidateOnFocus: true, dedupingInterval: 15_000, refreshInterval: 25_000, keepPreviousData: true }
  );

  const racks = rackData?.racks || [];

  if (!rackData && isLoading) {
    return (
      <p className="text-xs text-gray-500 flex items-center gap-1.5 px-1 py-2">
        <Loader2 size={12} className="animate-spin" />
        Loading racks…
      </p>
    );
  }

  if (!racks.length) {
    return <p className="text-[11px] text-gray-500 px-1 py-1">No racks on this floor.</p>;
  }

  return (
    <div className="flex flex-wrap gap-1">
      {racks.map((rack) => {
        const id = String(rack._id);
        const isSource = id === String(fromLocationId || '');
        return (
          <TransferToRackTile
            key={id}
            rack={rack}
            selected={String(toLocationId) === id}
            disabled={isSource}
            productQty={productQtyByLoc[id] || 0}
            stockUnit={stockUnit}
            onSelect={onSelectRack}
          />
        );
      })}
    </div>
  );
}

/**
 * Transfer tab — FROM cards (code/name) + TO nested branch/floor/rack cards.
 * Same API: one source, one destination, one qty.
 */
export default function TransferTicketPanel({
  fromRows,
  fromLocationId,
  onSelectFrom,
  transferQty,
  onTransferQtyChange,
  toLocationId,
  onSelectTo,
  toDisplayPath,
  fromRow,
  stockUnit,
  isLoading,
}) {
  const [toBranchId, setToBranchId] = useState(
    fromRow?.branchId ? String(fromRow.branchId) : ''
  );

  useEffect(() => {
    if (fromRow?.branchId) {
      setToBranchId(String(fromRow.branchId));
    }
  }, [fromRow?.branchId, fromRow?.floorId, fromRow?.locationId]);

  const productQtyByLoc = useMemo(() => {
    const map = {};
    for (const row of fromRows || []) {
      if (row.locationId) map[String(row.locationId)] = row.qty || 0;
    }
    return map;
  }, [fromRows]);

  const sameLocation =
    fromLocationId &&
    toLocationId &&
    String(fromLocationId) === String(toLocationId);

  const fromLabel = fromRow
    ? locationRackCode(fromRow) || locationRackName(fromRow)
    : '—';
  const toLabel =
    toDisplayPath ||
    (toLocationId ? String(toLocationId).slice(-6) : '—');

  const pickBranch = (id) => {
    setToBranchId(String(id));
    onSelectTo({
      branchId: String(id),
      floorId: null,
      rackId: null,
      locationId: '',
      displayPath: '',
      locationCode: '',
      locationName: '',
      locationCodePath: '',
    });
  };

  const pickRack = (rack, floor, branchIdForRack) => {
    const code = locationRackCode(rack);
    const name = locationRackName(rack);
    onSelectTo({
      branchId: branchIdForRack || toBranchId,
      floorId: String(floor._id),
      rackId: String(rack._id),
      locationId: String(rack._id),
      displayPath: code || name,
      locationCode: code,
      locationName: name,
      locationCodePath: '',
    });
  };

  if (isLoading) {
    return (
      <p className="text-sm text-gray-500 flex items-center gap-2">
        <Loader2 size={14} className="animate-spin" />
        Loading stock…
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className={`${TRANSFER_TICKET} p-3 flex flex-col min-h-[220px]`}>
          <p className={`${TRANSFER_LABEL} mb-2`}>From · source rack</p>
          {fromRows.length === 0 ? (
            <p className="text-xs text-sky-900 bg-sky-50 border border-sky-200 rounded-lg px-3 py-2 mt-1">
              No sellable stock at any location to transfer from.
            </p>
          ) : (
            <div className="space-y-2 flex-1">
              {fromRows.map((row) => (
                <TransferFromCard
                  key={String(row.locationId)}
                  row={row}
                  selected={String(fromLocationId || '') === String(row.locationId)}
                  stockUnit={stockUnit}
                  transferQty={transferQty}
                  onSelect={onSelectFrom}
                  onQtyChange={onTransferQtyChange}
                />
              ))}
            </div>
          )}
        </div>

        <div className={`${TRANSFER_TICKET} p-3 flex flex-col min-h-[220px]`}>
          <p className={`${TRANSFER_LABEL} mb-2`}>To · target rack</p>

          {!fromLocationId ? (
            <p className="text-xs text-gray-500 mt-2">Select a source rack first.</p>
          ) : (
            <div className="space-y-2 flex-1">
              <LocationCascadePicker
                accent="sky"
                swrKeyPrefix="transfer"
                enabled={Boolean(fromLocationId)}
                defaultBranchId={fromRow?.branchId || null}
                defaultFloorId={fromRow?.floorId || null}
                onBranchChange={pickBranch}
                renderFloorRacks={(floor, ctx) => (
                  <TransferFloorRacks
                    floorId={String(floor._id)}
                    fromLocationId={fromLocationId}
                    toLocationId={toLocationId}
                    productQtyByLoc={productQtyByLoc}
                    stockUnit={stockUnit}
                    onSelectRack={(rack) => pickRack(rack, floor, ctx?.branchId)}
                  />
                )}
              />

              {toLocationId && (
                <div className="pt-2 border-t-2 border-dashed border-gray-300">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500 font-mono mb-1">
                    Selected rack
                  </p>
                  <p className="text-xs font-mono font-semibold text-gray-900 truncate">
                    {toLabel}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {fromLocationId && toLocationId && (
        <div
          className={`rounded-xl border-2 px-3 py-2.5 flex flex-wrap items-center justify-center gap-2 text-sm font-mono ${
            sameLocation
              ? 'border-red-400 bg-red-50 text-red-800'
              : 'border-gray-900 bg-white text-gray-900'
          }`}
        >
          <span className="font-bold truncate max-w-[40%]">{fromLabel}</span>
          <span className="tabular-nums text-sky-700 font-bold">
            {transferQty} {stockUnit}
          </span>
          <ArrowRight size={16} className="shrink-0 text-gray-500" />
          <span className="font-bold truncate max-w-[40%]">{toLabel}</span>
          {sameLocation && (
            <span className="w-full text-center text-[11px] font-semibold">
              Source and destination must be different
            </span>
          )}
        </div>
      )}
    </div>
  );
}
