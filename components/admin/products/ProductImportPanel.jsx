'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { FileSpreadsheet, Upload, X } from 'lucide-react';
import { adminFetch } from '@/lib/client/adminFetch';
import { showToast } from '@/lib/utils/toast';

export async function downloadProductImportTemplate() {
  const response = await adminFetch('/api/admin/products/import/template');
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Could not download template');
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'regal-product-import-template.xlsx';
  a.click();
  URL.revokeObjectURL(url);
}

export function ProductImportButtons({ onImport }) {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await downloadProductImportTemplate();
    } catch (error) {
      showToast.error(error.message || 'Could not download template');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleDownload}
        disabled={downloading}
        className="inline-flex items-center justify-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60 transition-colors"
      >
        <FileSpreadsheet className="h-4 w-4" />
        <span className="hidden sm:inline">{downloading ? 'Downloading…' : 'Template'}</span>
        <span className="sm:hidden">XLSX</span>
      </button>
      <button
        type="button"
        onClick={onImport}
        className="inline-flex items-center justify-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
      >
        <Upload className="h-4 w-4" />
        Import
      </button>
    </>
  );
}

/**
 * Optional Excel on-ramp. The Add Product wizard is unchanged; this panel
 * only downloads the template and validates a workbook. Opening a row
 * prefills the form — catalog write still happens on Save.
 */
export default function ProductImportPanel({ open, onClose, onOpenInForm }) {
  const titleId = useId();
  const inputRef = useRef(null);
  const closeRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [selectedRow, setSelectedRow] = useState(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape' && !busy) onClose();
    };
    document.addEventListener('keydown', onKey);
    closeRef.current?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [open, busy, onClose]);

  const reset = useCallback(() => {
    setFileName('');
    setResult(null);
    setSelectedRow(null);
    if (inputRef.current) inputRef.current.value = '';
  }, []);

  const handleClose = () => {
    if (busy) return;
    reset();
    onClose();
  };

  const downloadTemplate = async () => {
    try {
      await downloadProductImportTemplate();
    } catch (error) {
      showToast.error(error.message || 'Could not download template');
    }
  };

  const validateFile = async (file) => {
    if (!file) return;
    const lower = file.name.toLowerCase();
    if (!lower.endsWith('.xlsx')) {
      showToast.error('Use the .xlsx template (Excel).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast.error('File is larger than 5 MB.');
      return;
    }

    setBusy(true);
    setFileName(file.name);
    setResult(null);
    setSelectedRow(null);
    try {
      const body = new FormData();
      body.append('file', file);
      const response = await adminFetch('/api/admin/products/import/validate', {
        method: 'POST',
        body,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'Could not validate this spreadsheet');
      }
      setResult(data);
      const firstValid = (data.products || []).find((row) => row.payload);
      if (firstValid) setSelectedRow(firstValid.excelRow);
    } catch (error) {
      showToast.error(error.message || 'Could not validate this spreadsheet');
    } finally {
      setBusy(false);
    }
  };

  const onDrop = (event) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files?.[0];
    validateFile(file);
  };

  const openSelected = () => {
    const row = (result?.products || []).find((item) => item.excelRow === selectedRow && item.payload);
    if (!row?.payload) {
      showToast.error('Select a valid product row first.');
      return;
    }
    onOpenInForm(row.payload);
    reset();
    onClose();
  };

  if (!open) return null;

  const products = result?.products || [];
  const validCount = result?.validCount || 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-gray-900/40"
        aria-label="Close import dialog"
        onClick={handleClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl border border-gray-200 bg-white shadow-xl sm:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
          <div>
            <h2 id={titleId} className="text-lg font-semibold text-gray-900">
              Import from Excel
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Optional. Download the template, fill it offline, then review here. Nothing is
              saved until you click Save on the product form.
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={handleClose}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <button
            type="button"
            onClick={downloadTemplate}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Download template
          </button>

          <div
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={`rounded-xl border-2 border-dashed px-4 py-8 text-center ${
              dragging ? 'border-primary bg-primary/5' : 'border-gray-300 bg-gray-50'
            }`}
          >
            <Upload className="mx-auto h-6 w-6 text-gray-400" />
            <p className="mt-2 text-sm font-medium text-gray-700">Drop an .xlsx file here</p>
            <p className="mt-1 text-xs text-gray-500">Max 100 product rows · 5 MB</p>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              onChange={(event) => validateFile(event.target.files?.[0])}
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
              className="mt-3 rounded-lg bg-gray-900 px-3 py-2 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-60"
            >
              {busy ? 'Checking…' : 'Choose file'}
            </button>
            {fileName ? <p className="mt-2 text-xs text-gray-500">{fileName}</p> : null}
          </div>

          {result ? (
            <div className="space-y-3">
              {result.fileErrors?.length > 0 ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  <ul className="list-disc space-y-1 pl-4">
                    {result.fileErrors.map((msg) => (
                      <li key={msg}>{msg}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <p className="text-sm text-gray-600">
                {validCount} valid · {result.errorCount || 0} with errors. Open one valid row in
                the Add form — bulk create is not enabled yet.
              </p>

              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-gray-600"> </th>
                      <th className="px-3 py-2 text-left font-medium text-gray-600">Row</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-600">Title</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-600">Type</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-600">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {products.map((row) => {
                      const valid = Boolean(row.payload);
                      return (
                        <tr key={row.excelRow} className="align-top">
                          <td className="px-3 py-2">
                            <input
                              type="radio"
                              name="import-row"
                              disabled={!valid}
                              checked={selectedRow === row.excelRow}
                              onChange={() => setSelectedRow(row.excelRow)}
                              aria-label={`Select row ${row.excelRow}`}
                            />
                          </td>
                          <td className="px-3 py-2 text-gray-500">{row.excelRow}</td>
                          <td className="px-3 py-2 font-medium text-gray-900">{row.title}</td>
                          <td className="px-3 py-2 capitalize text-gray-600">
                            {row.sellingType}
                            {row.variantCount ? ` · ${row.variantCount} variants` : ''}
                          </td>
                          <td className="px-3 py-2">
                            {valid ? (
                              <span className="font-medium text-emerald-700">Ready</span>
                            ) : (
                              <span className="font-medium text-red-600">Blocked</span>
                            )}
                            {row.errors?.length > 0 ? (
                              <ul className="mt-1 list-disc pl-4 text-xs text-red-600">
                                {row.errors.map((msg) => (
                                  <li key={msg}>{msg}</li>
                                ))}
                              </ul>
                            ) : null}
                            {row.warnings?.length > 0 ? (
                              <ul className="mt-1 list-disc pl-4 text-xs text-amber-700">
                                {row.warnings.map((msg) => (
                                  <li key={msg}>{msg}</li>
                                ))}
                              </ul>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-gray-100 px-5 py-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!validCount || busy}
            onClick={openSelected}
            className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Open in Add form
          </button>
        </div>
      </div>
    </div>
  );
}
