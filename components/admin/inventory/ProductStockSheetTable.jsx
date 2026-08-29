'use client';

/**
 * Printable product-family stock table (Vishwas-style columns).
 */
export default function ProductStockSheetTable({ groups, showImages = true }) {
  if (!groups?.length) return null;

  return (
    <div className="space-y-10 print:space-y-8">
      {groups.map((group) => (
        <section key={group.familyId} className="break-inside-avoid">
          <p className="text-lg font-bold text-red-700 tracking-wide">
            BRAND <span className="ml-2">{group.brand}</span>
          </p>
          <p className="text-sm font-semibold text-gray-800 mt-0.5 mb-2">{group.familyTitle}</p>

          <div className="overflow-x-auto print:overflow-visible">
            <table className="w-full min-w-[960px] border-collapse text-[11px] print:min-w-0 print:text-[8.5pt]">
              <thead>
                <tr className="bg-gray-50">
                  {[
                    'S.NO',
                    ...(showImages ? ['Image'] : []),
                    'Name',
                    'Size',
                    'Unit',
                    'Color',
                    'SKU',
                    'Barcode',
                    'HSN Code',
                    'GST%',
                    'MRP',
                    'SP',
                    'MAX DISCOUNT %',
                    'TOTAL QNTY',
                    'LOCATION',
                  ].map((label) => (
                    <th
                      key={label}
                      className="border border-gray-800 px-1.5 py-1.5 text-left font-bold text-gray-900 whitespace-nowrap"
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {group.rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={showImages ? 15 : 14}
                      className="border border-gray-800 px-2 py-3 text-gray-500"
                    >
                      No variants for this product.
                    </td>
                  </tr>
                ) : (
                  group.rows.map((row, index) => (
                    <tr key={row.productId} className="align-middle">
                      <td className="border border-gray-800 px-1.5 py-1 text-center">{index + 1}</td>
                      {showImages && (
                        <td className="border border-gray-800 px-1 py-1 w-14">
                          {row.image ? (
                            // Native img: reliable in print / Save as PDF
                            <img
                              src={row.image}
                              alt=""
                              className="h-11 w-11 object-contain mx-auto"
                            />
                          ) : (
                            <span className="block text-center text-gray-400">—</span>
                          )}
                        </td>
                      )}
                      <td className="border border-gray-800 px-1.5 py-1 font-medium text-gray-900">
                        {row.name}
                      </td>
                      <td className="border border-gray-800 px-1.5 py-1 whitespace-nowrap">
                        {row.size || '—'}
                      </td>
                      <td className="border border-gray-800 px-1.5 py-1 whitespace-nowrap">
                        {row.unit || '—'}
                      </td>
                      <td className="border border-gray-800 px-1.5 py-1 whitespace-nowrap">
                        {row.color || '—'}
                      </td>
                      <td className="border border-gray-800 px-1.5 py-1 font-mono whitespace-nowrap">
                        {row.sku || '—'}
                      </td>
                      <td className="border border-gray-800 px-1.5 py-1 font-mono whitespace-nowrap">
                        {row.barcode || '—'}
                      </td>
                      <td className="border border-gray-800 px-1.5 py-1 font-mono whitespace-nowrap">
                        {row.hsnCode || '—'}
                      </td>
                      <td className="border border-gray-800 px-1.5 py-1 text-center whitespace-nowrap">
                        {row.gstPercent ? `${row.gstPercent}%` : '—'}
                      </td>
                      <td className="border border-gray-800 px-1.5 py-1 text-right whitespace-nowrap">
                        {row.mrp || '—'}
                      </td>
                      <td className="border border-gray-800 px-1.5 py-1 text-right whitespace-nowrap">
                        {row.sellingPrice || '—'}
                      </td>
                      <td className="border border-gray-800 px-1.5 py-1 text-center whitespace-nowrap">
                        {row.maxDiscountPercent ? `${row.maxDiscountPercent}%` : '—'}
                      </td>
                      <td className="border border-gray-800 px-1.5 py-1 text-right font-semibold whitespace-nowrap">
                        {row.qty}
                      </td>
                      <td className="border border-gray-800 px-1.5 py-1 font-mono text-[10px]">
                        {row.location || '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}
