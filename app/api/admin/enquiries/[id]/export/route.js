import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { connectToDatabase } from '@/lib/db/connect';
import Enquiry from '@/lib/models/Enquiry';
import EnquiryItem from '@/lib/models/EnquiryItem';
import { requireAuth } from '@/lib/server/auth/requireAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

function safeNumber(value, fallback = 0) {
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function getImageExtensionFromContentType(contentType) {
  const ct = (contentType || '').toLowerCase();
  if (ct.includes('png')) return 'png';
  if (ct.includes('jpeg') || ct.includes('jpg')) return 'jpeg';
  if (ct.includes('webp')) return 'webp';
  return null;
}

async function fetchImageBuffer(url) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) return null;

  const contentType = res.headers.get('content-type') || '';
  const extension = getImageExtensionFromContentType(contentType);
  if (!extension) return null;

  const ab = await res.arrayBuffer();
  const buffer = Buffer.from(ab);
  if (!buffer?.length) return null;

  return { buffer, extension };
}

function setAllBorders(cell) {
  cell.border = {
    top: { style: 'thin' },
    left: { style: 'thin' },
    bottom: { style: 'thin' },
    right: { style: 'thin' },
  };
}

export async function GET(request, { params }) {
  const auth = await requireAuth(request, { permission: 'enquiries:read' });
  if (auth.error) return auth.error;

  try {
    await connectToDatabase();

    const { id } = params;
    const url = new URL(request.url);
    const origin = url.origin;
    const gstPercent = safeNumber(url.searchParams.get('gst'), 0);

    const enquiry = await Enquiry.findById(id).populate('customerId').lean();
    if (!enquiry) {
      return NextResponse.json({ error: 'Enquiry not found' }, { status: 404 });
    }

    const items = await EnquiryItem.find({ enquiryId: id })
      .populate('productId', 'title heroImage slug price sku')
      .lean();

    const customer = enquiry.customerId || {};
    const clientName =
      customer?.name ||
      enquiry?.name ||
      customer?.companyName ||
      enquiry?.company ||
      'N/A';

    const orderDate = enquiry?.createdAt ? new Date(enquiry.createdAt) : new Date();
    const dateStr = orderDate.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'REGAL Admin';
    workbook.created = new Date();

    const ws = workbook.addWorksheet('Order');

    // Column layout matching provided sheet image
    ws.columns = [
      { header: 'S. NO', key: 'sno', width: 7 },
      { header: 'CODE', key: 'code', width: 18 },
      { header: 'Discription', key: 'description', width: 48 }, // Keep spelling as in provided image
      { header: 'Qty', key: 'qty', width: 8 },
      { header: 'image', key: 'image', width: 14 },
      { header: 'Net price', key: 'netPrice', width: 12 },
      { header: 'Amt', key: 'amt', width: 12 },
      { header: 'Gst%', key: 'gst', width: 10 },
      { header: 'Gst Amt', key: 'gstAmt', width: 12 },
    ];

    // Top header rows
    ws.getCell('A1').value = 'CLIENT NAME';
    ws.getCell('A2').value = 'DATE';
    ws.getCell('B1').value = clientName;
    ws.getCell('B2').value = dateStr;
    ws.mergeCells('B1:I1');
    ws.mergeCells('B2:I2');

    ['A1', 'A2'].forEach((addr) => {
      const cell = ws.getCell(addr);
      cell.font = { bold: true };
      cell.alignment = { vertical: 'middle', horizontal: 'left' };
    });

    ['B1', 'B2'].forEach((addr) => {
      const cell = ws.getCell(addr);
      cell.alignment = { vertical: 'middle', horizontal: 'left' };
    });

    ws.getRow(1).height = 20;
    ws.getRow(2).height = 20;

    // Table header row
    const headerRowNumber = 4;
    const headerRow = ws.getRow(headerRowNumber);
    headerRow.values = [
      'S. NO',
      'CODE',
      'Discription',
      'Qty',
      'image',
      'Net price',
      'Amt',
      'Gst%',
      'Gst Amt',
    ];
    headerRow.font = { bold: true };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 20;

    for (let c = 1; c <= 9; c++) {
      const cell = headerRow.getCell(c);
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF3F4F6' }, // light gray
      };
      setAllBorders(cell);
    }

    // Data rows
    const startRow = headerRowNumber + 1;
    for (let i = 0; i < items.length; i++) {
      const rowNumber = startRow + i;
      const item = items[i] || {};
      const product = item.productId || {};

      const code = product.sku || product.slug || (product._id ? String(product._id).slice(-8) : '');
      const description = item.productName || product.title || 'Product';
      const qty = safeNumber(item.quantity, 0);
      const netPrice = safeNumber(product.price, 0);
      const amt = netPrice * qty;
      const gst = gstPercent;
      const gstAmt = (amt * gst) / 100;

      const row = ws.getRow(rowNumber);
      row.values = {
        sno: i + 1,
        code,
        description,
        qty,
        image: '', // image will be embedded
        netPrice,
        amt,
        gst,
        gstAmt,
      };
      row.height = 52;

      // Alignments
      row.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell(2).alignment = { vertical: 'middle', horizontal: 'left' };
      row.getCell(3).alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
      row.getCell(4).alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell(5).alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell(6).alignment = { vertical: 'middle', horizontal: 'right' };
      row.getCell(7).alignment = { vertical: 'middle', horizontal: 'right' };
      row.getCell(8).alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell(9).alignment = { vertical: 'middle', horizontal: 'right' };

      // Number formats
      row.getCell(6).numFmt = '0.00';
      row.getCell(7).numFmt = '0.00';
      row.getCell(9).numFmt = '0.00';

      // Borders
      for (let c = 1; c <= 9; c++) {
        setAllBorders(row.getCell(c));
      }

      // Embed product image
      const heroImage = product.heroImage;
      if (heroImage) {
        const imgUrl = heroImage.startsWith('http') ? heroImage : new URL(heroImage, origin).toString();
        const img = await fetchImageBuffer(imgUrl);
        if (img) {
          const imageId = workbook.addImage({
            buffer: img.buffer,
            extension: img.extension,
          });

          // Place image within the "image" column (E)
          ws.addImage(imageId, {
            tl: { col: 4, row: rowNumber - 1 },
            ext: { width: 60, height: 60 },
            editAs: 'oneCell',
          });
        }
      }
    }

    // Add borders around the top header area similar to sheet feel
    ['A1', 'A2', 'B1', 'B2'].forEach((addr) => setAllBorders(ws.getCell(addr)));
    for (let col = 2; col <= 9; col++) {
      setAllBorders(ws.getRow(1).getCell(col));
      setAllBorders(ws.getRow(2).getCell(col));
    }

    const buffer = await workbook.xlsx.writeBuffer();

    const fileId = enquiry.enquiryId || String(enquiry._id).slice(-8);
    const filename = `order-${fileId}.xlsx`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      },
    });
  } catch (error) {
    console.error('Error exporting enquiry to Excel:', error);
    return NextResponse.json(
      { error: 'Failed to export Excel', details: error.message },
      { status: 500 }
    );
  }
}

