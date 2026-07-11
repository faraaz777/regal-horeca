'use client';

import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { RACK_STATUS_STYLES } from '@/lib/client/locatorUtils';

export default function LocatorExportButton({ canvasRef, floorLabel, branchLabel }) {
  const [exporting, setExporting] = useState(false);

  const handleExport = async (format) => {
    if (!canvasRef?.current) return;
    setExporting(true);
    try {
      const node = canvasRef.current;
      const dataUrl = await toPng(node, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: '#f8fafc',
      });

      const dateStr = new Date().toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
      const title = `${branchLabel || 'Branch'} — ${floorLabel || 'Floor'} — ${dateStr}`;

      if (format === 'png') {
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = `floor-locator-${Date.now()}.png`;
        a.click();
        toast.success('PNG exported');
        return;
      }

      const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
      const pageW = pdf.internal.pageSize.getWidth();
      const margin = 24;

      pdf.setFontSize(11);
      pdf.text(title, margin, margin);

      pdf.setFontSize(8);
      let ly = margin + 16;
      Object.values(RACK_STATUS_STYLES).forEach((style) => {
        pdf.text(style.label, margin, ly);
        ly += 10;
      });

      const img = new Image();
      img.src = dataUrl;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      const maxW = pageW - margin * 2;
      const maxH = pdf.internal.pageSize.getHeight() - margin * 3 - 40;
      const scale = Math.min(maxW / img.width, maxH / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      pdf.addImage(dataUrl, 'PNG', margin, margin + 28, w, h);
      pdf.save(`floor-locator-${Date.now()}.pdf`);
      toast.success('PDF exported');
    } catch (err) {
      toast.error(err.message || 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex gap-2">
      <button
        type="button"
        disabled={exporting}
        onClick={() => handleExport('png')}
        className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
      >
        {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
        PNG
      </button>
      <button
        type="button"
        disabled={exporting}
        onClick={() => handleExport('pdf')}
        className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
      >
        PDF
      </button>
    </div>
  );
}
