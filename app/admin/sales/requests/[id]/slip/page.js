'use client';

import { useMemo } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { adminJson } from '@/lib/client/adminFetch';
import { formatPaise } from '@/lib/shared/formatMoney';
import { code128Svg } from '@/lib/client/code128Svg';

const fetcher = (url) => adminJson(url);

export default function FulfilmentSlipPage() {
  const params = useParams();
  const id = params.id;
  const { data, isLoading, error } = useSWR(
    id ? `/api/sales/requests/${id}/slip` : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  const slip = data?.slip;
  const barcodes = useMemo(() => {
    const map = {};
    for (const line of slip?.lines || []) {
      const code = line.barcode || line.sku;
      if (code) map[line._id] = code128Svg(code);
    }
    return map;
  }, [slip]);

  return (
    <div className="max-w-2xl mx-auto">
      <div className="print:hidden flex items-center justify-between gap-3 mb-4">
        <Link href="/admin/sales/requests" className="text-sm text-gray-600 hover:underline">
          ← My requests
        </Link>
        <button
          type="button"
          onClick={() => window.print()}
          className="px-4 py-2 bg-black text-white rounded-lg text-sm"
        >
          Print / Save PDF
        </button>
      </div>

      {error ? (
        <p className="text-sm text-red-600">{error.message}</p>
      ) : isLoading ? (
        <p className="text-sm text-gray-500">Loading slip…</p>
      ) : !slip ? (
        <p className="text-sm text-gray-500">No slip.</p>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg p-6 print:border-0 print:rounded-none">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-gray-400">
            Counter charge sheet
          </p>
          <h1 className="text-2xl font-semibold text-gray-900 mt-1">{slip.requestNumber}</h1>
          <p className="text-sm text-gray-800 mt-2">{slip.customerName || 'Walk-in'}</p>
          {slip.phone ? <p className="text-sm text-gray-600">{slip.phone}</p> : null}
          <p className="text-xs text-gray-500 mt-1">
            Sales: {slip.salesUserName || '—'}
            {slip.fulfilledAt
              ? ` · Fulfilled ${new Date(slip.fulfilledAt).toLocaleString('en-IN')}`
              : ''}
          </p>

          <table className="w-full text-sm mt-6">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-gray-500 border-b">
                <th className="py-2 pr-2">Item</th>
                <th className="py-2 text-right">Qty</th>
                <th className="py-2 text-right">Rate</th>
                <th className="py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {slip.lines.map((line) => (
                <tr key={line._id} className="border-b border-gray-100 align-top">
                  <td className="py-3 pr-2">
                    <p className="font-medium text-gray-900">{line.productTitle}</p>
                    <p className="text-[11px] font-mono text-gray-500">
                      {line.sku ? `SKU ${line.sku}` : ''}
                      {line.barcode && line.barcode !== line.sku ? ` · ${line.barcode}` : ''}
                    </p>
                    {barcodes[line._id] ? (
                      <div
                        className="mt-2 max-w-[220px] text-black"
                        dangerouslySetInnerHTML={{ __html: barcodes[line._id] }}
                      />
                    ) : (
                      <p className="text-[11px] text-amber-800 mt-1">No barcode on this product</p>
                    )}
                  </td>
                  <td className="py-3 text-right tabular-nums">{line.qty}</td>
                  <td className="py-3 text-right tabular-nums whitespace-nowrap">
                    {formatPaise(line.ratePaise)}
                  </td>
                  <td className="py-3 text-right tabular-nums whitespace-nowrap font-medium">
                    {formatPaise(line.lineTotalPaise)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3} className="pt-3 text-right text-sm text-gray-600">
                  Total (offered)
                </td>
                <td className="pt-3 text-right text-lg font-semibold tabular-nums">
                  {formatPaise(slip.totalPaise)}
                </td>
              </tr>
            </tfoot>
          </table>

          <p className="text-[11px] text-gray-500 mt-6 leading-relaxed">
            Not a tax invoice. These are the offered rates from the sales request.
            Scan the barcode at the counter, then bill in your billing software.
          </p>
        </div>
      )}
    </div>
  );
}
