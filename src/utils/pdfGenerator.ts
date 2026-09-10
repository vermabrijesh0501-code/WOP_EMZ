import { jsPDF } from 'jspdf';
import { ReturnBatch, ScannedReturnItem, InwardGateEntry, Warehouse, Client, Courier } from '../types';

export function generateBatchPDF(
  batch: ReturnBatch,
  items: ScannedReturnItem[],
  warehouse?: Warehouse,
  client?: Client,
  courier?: Courier
) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 12;
  const contentWidth = pageWidth - margin * 2;

  const formatDate = (dateStr?: string | number | Date) => {
    if (!dateStr) return 'N/A';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return String(dateStr);
      return d.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }) + ', ' + d.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      });
    } catch {
      return String(dateStr);
    }
  };

  const drawHeader = () => {
    // Header background banner
    doc.setFillColor(15, 23, 42); // #0f172a
    doc.rect(0, 0, pageWidth, 28, 'F');

    // Accent line
    doc.setFillColor(99, 102, 241); // #6366f1
    doc.rect(0, 28, pageWidth, 1.5, 'F');

    // Title
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(15);
    doc.setFont('helvetica', 'bold');
    doc.text('EMIZA WAREHOUSE OPERATIONS', margin, 12);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(203, 213, 225);
    doc.text('RTO / B2C RETURNS BATCH MANIFEST & HANDOVER SHEET', margin, 19);

    // Status badge on top right
    const isClosed = batch.status === 'Closed';
    if (isClosed) {
      doc.setFillColor(16, 185, 129); // #10b981
    } else {
      doc.setFillColor(245, 158, 11); // #f59e0b
    }
    doc.roundedRect(pageWidth - margin - 30, 8, 30, 9, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.text(batch.status.toUpperCase(), pageWidth - margin - 23, 14);
  };

  drawHeader();

  let y = 35;

  // Metadata Grid Box
  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin, y, contentWidth, 40, 2, 2, 'FD');

  doc.setFontSize(8.5);

  // Column 1
  const col1X = margin + 4;
  const col1ValX = margin + 34;

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('Batch Number:', col1X, y + 7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(99, 102, 241);
  doc.text(batch.batchNumber, col1ValX, y + 7);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('Client / Account:', col1X, y + 14);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(client ? `${client.name} (${client.code})` : batch.clientId, col1ValX, y + 14);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('Courier Partner:', col1X, y + 21);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(courier ? courier.name : batch.courierId, col1ValX, y + 21);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('Batch Type / Dock:', col1X, y + 28);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(`${batch.batchType || 'RTO/B2C'}${batch.dockNumber ? ` (${batch.dockNumber})` : ''}`, col1ValX, y + 28);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('Created By:', col1X, y + 35);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(batch.createdByName || 'Warehouse Staff', col1ValX, y + 35);

  // Column 2
  const col2X = margin + (contentWidth / 2) + 2;
  const col2ValX = col2X + 34;

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('Facility / Hub:', col2X, y + 7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(warehouse ? `${warehouse.name} (${warehouse.code})` : batch.warehouseId, col2ValX, y + 7);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('Total Scanned:', col2X, y + 14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(16, 185, 129);
  doc.text(`${batch.totalScanned} Parcels / AWBs`, col2ValX, y + 14);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('Batch Created:', col2X, y + 21);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(formatDate(batch.createdAt), col2ValX, y + 21);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('Batch Closed:', col2X, y + 28);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(batch.closedAt ? formatDate(batch.closedAt) : 'Open / In-Progress', col2ValX, y + 28);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('Driver / Rep:', col2X, y + 35);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(batch.driverName ? `${batch.driverName} (${batch.driverMobile || 'N/A'})` : 'Supervisor Sign-off', col2ValX, y + 35);

  y += 46;

  // Remarks Breakdown Box
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('QC CONDITIONS BREAKDOWN SUMMARY', margin, y);

  y += 3.5;
  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(margin, y, contentWidth, 12, 1.5, 1.5, 'FD');

  // Compute breakdown from items directly if not present
  const breakdown: Record<string, number> = {};
  items.forEach(i => {
    breakdown[i.remark] = (breakdown[i.remark] || 0) + 1;
  });

  const remarksEntries = Object.entries(breakdown);
  let rx = margin + 4;
  doc.setFontSize(7.5);

  if (remarksEntries.length === 0) {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text('No items scanned in this batch yet.', rx, y + 7.5);
  } else {
    remarksEntries.forEach(([remark, count]) => {
      if (rx + 25 < pageWidth - margin) {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(71, 85, 105);
        doc.text(`${remark}:`, rx, y + 7.5);
        doc.setFont('helvetica', 'bold');
        if (remark === 'Good') {
          doc.setTextColor(16, 185, 129);
        } else if (remark === 'Damage' || remark === 'Missing Product') {
          doc.setTextColor(225, 29, 72);
        } else {
          doc.setTextColor(217, 119, 6);
        }
        const textWidth = doc.getTextWidth(`${remark}: `);
        doc.text(`${count}`, rx + textWidth + 0.5, y + 7.5);
        rx += textWidth + 14;
      }
    });
  }

  y += 18;

  // Item Table Header
  const renderTableHeader = (currentY: number) => {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(`SCANNED AWBS MANIFEST (${items.length} ITEMS)`, margin, currentY);

    const tableHeaderY = currentY + 3.5;
    doc.setFillColor(30, 41, 59); // slate-800
    doc.rect(margin, tableHeaderY, contentWidth, 7, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.text('#', margin + 3, tableHeaderY + 4.8);
    doc.text('AWB / Tracking Number', margin + 14, tableHeaderY + 4.8);
    doc.text('QC Condition', margin + 75, tableHeaderY + 4.8);
    doc.text('Scan Timestamp', margin + 115, tableHeaderY + 4.8);
    doc.text('Scanned By', margin + 155, tableHeaderY + 4.8);

    return tableHeaderY + 7;
  };

  y = renderTableHeader(y);

  // Scanned items table rows
  items.forEach((item, index) => {
    if (y > pageHeight - 55) {
      doc.addPage();
      drawHeader();
      y = 36;
      y = renderTableHeader(y);
    }

    doc.setFillColor(index % 2 === 0 ? 255 : 248, index % 2 === 0 ? 255 : 250, index % 2 === 0 ? 255 : 252);
    doc.rect(margin, y, contentWidth, 6.5, 'F');
    doc.setDrawColor(241, 245, 249);
    doc.line(margin, y + 6.5, margin + contentWidth, y + 6.5);

    doc.setTextColor(51, 65, 85);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');

    // Index
    doc.text(`${index + 1}`, margin + 3, y + 4.3);

    // AWB
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(item.trackingNumber, margin + 14, y + 4.3);

    // QC Condition
    doc.setFont('helvetica', 'bold');
    if (item.remark === 'Good') {
      doc.setTextColor(22, 101, 52);
    } else if (item.remark === 'Damage' || item.remark === 'Missing Product') {
      doc.setTextColor(185, 28, 28);
    } else {
      doc.setTextColor(180, 83, 9);
    }
    doc.text(item.remark, margin + 75, y + 4.3);

    // Scan Timestamp
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(formatDate(item.scannedAt), margin + 115, y + 4.3);

    // Scanned By Operator
    doc.setTextColor(51, 65, 85);
    doc.text(item.scannedByName || 'Staff', margin + 155, y + 4.3);

    y += 6.5;
  });

  // Handover Signature Block
  if (y > pageHeight - 50) {
    doc.addPage();
    drawHeader();
    y = 38;
  } else {
    y += 8;
  }

  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, y, contentWidth, 34, 2, 2, 'S');

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('COURIER HANDOVER & WAREHOUSE ACKNOWLEDGEMENT SIGN-OFF', margin + 4, y + 6);

  // Left Sign Box (Driver)
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Courier Driver / Rep:', margin + 4, y + 13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(batch.driverName || '__________________________', margin + 35, y + 13);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Driver Contact / Phone:', margin + 4, y + 19);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(batch.driverMobile || '__________________________', margin + 35, y + 19);

  doc.setDrawColor(203, 213, 225);
  doc.line(margin + 4, y + 27, margin + 75, y + 27);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('Driver Signature & Handover Stamp', margin + 4, y + 30.5);

  // Right Sign Box (Supervisor)
  const signRightX = margin + (contentWidth / 2) + 4;
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text('Warehouse Supervisor:', signRightX, y + 13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(batch.supervisorSigner || batch.createdByName || 'Authorized Supervisor', signRightX + 35, y + 13);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Handover Date & Time:', signRightX, y + 19);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(batch.closedAt ? formatDate(batch.closedAt) : formatDate(new Date()), signRightX + 35, y + 19);

  doc.setDrawColor(203, 213, 225);
  doc.line(signRightX, y + 27, signRightX + 75, y + 27);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('Warehouse Inward Stamp & Sign-off', signRightX, y + 30.5);

  // Add Page Numbers to all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Page ${i} of ${totalPages}  |  Batch: ${batch.batchNumber}  |  Emiza WOP System  |  Generated on ${formatDate(new Date())}`,
      pageWidth / 2,
      pageHeight - 5,
      { align: 'center' }
    );
  }

  // Save PDF with clean filename
  triggerDirectDownload(doc, `${batch.batchNumber}_ReturnManifest.pdf`);
}

// Utility for guaranteed instant direct download without popups/preview blockers
function triggerDirectDownload(doc: jsPDF, filename: string) {
  try {
    doc.save(filename);
  } catch (err) {
    try {
      const blob = doc.output('blob');
      const blobUrl = URL.createObjectURL(blob);
      const downloadAnchor = document.createElement('a');
      downloadAnchor.href = blobUrl;
      downloadAnchor.download = filename;
      downloadAnchor.style.display = 'none';
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      document.body.removeChild(downloadAnchor);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1500);
    } catch (fallbackErr) {
      console.error('Instant direct download error:', fallbackErr);
    }
  }
}

export function generateGatePassPDF(
  entry: InwardGateEntry,
  warehouse?: Warehouse,
  client?: Client,
  courier?: Courier,
  isB2BReturn?: boolean
) {
  const isB2B = isB2BReturn || entry.entryType === 'B2B Return' || entry.gatePassNumber.startsWith('B2B');
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 28, 'F');
  doc.setFillColor(isB2B ? 147 : 37, isB2B ? 51 : 99, isB2B ? 234 : 235);
  doc.rect(0, 28, pageWidth, 1.5, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.text(
    isB2B ? 'EMIZA B2B STORE RETURN GATE ENTRY & HANDOVER PASS' : 'EMIZA INWARD GATE ENTRY & HANDOVER PASS',
    14,
    13
  );

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(203, 213, 225);
  doc.text(
    isB2B
      ? `B2B RETURN WORKFLOW MANIFEST | GATE ENTRY ID: ${entry.gatePassNumber}`
      : `INWARD WORKFLOW MANIFEST | GATE ENTRY ID: ${entry.gatePassNumber}`,
    14,
    21
  );

  let y = 35;

  // Security Box
  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, y, pageWidth - 28, 48, 2, 2, 'FD');

  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(
    isB2B
      ? 'VEHICLE ARRIVAL & SECURITY CHECK-IN (B2B RETURN)'
      : 'VEHICLE ARRIVAL & SECURITY CHECK-IN',
    18,
    y + 7
  );

  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);

  doc.setFont('helvetica', 'bold'); doc.text('Gate Entry ID:', 18, y + 15);
  doc.setFont('helvetica', 'normal'); doc.text(entry.gatePassNumber, 52, y + 15);

  doc.setFont('helvetica', 'bold'); doc.text('Vehicle Number:', 18, y + 22);
  doc.setFont('helvetica', 'normal'); doc.text(entry.vehicleNumber, 52, y + 22);

  doc.setFont('helvetica', 'bold'); doc.text('Driver Name:', 18, y + 29);
  doc.setFont('helvetica', 'normal'); doc.text(entry.driverName, 52, y + 29);

  doc.setFont('helvetica', 'bold'); doc.text('Driver Mobile / DL:', 18, y + 36);
  doc.setFont('helvetica', 'normal'); doc.text(`${entry.driverMobile} | ${entry.driverLicense || 'N/A'}`, 52, y + 36);

  doc.setFont('helvetica', 'bold'); doc.text('Security Check-in:', 18, y + 43);
  doc.setFont('helvetica', 'normal'); doc.text(entry.phase1?.gateEntryDateTime || new Date(entry.entryTime).toLocaleString(), 52, y + 43);

  // Column 2
  doc.setFont('helvetica', 'bold'); doc.text('Warehouse:', 110, y + 15);
  doc.setFont('helvetica', 'normal'); doc.text(warehouse ? warehouse.name : entry.warehouseId, 142, y + 15);

  doc.setFont('helvetica', 'bold'); doc.text(isB2B ? 'B2B Client / Store:' : 'Account (Client):', 110, y + 22);
  doc.setFont('helvetica', 'normal'); doc.text(client ? client.name : entry.clientId, 142, y + 22);

  doc.setFont('helvetica', 'bold'); doc.text('Courier Partner:', 110, y + 29);
  doc.setFont('helvetica', 'normal'); doc.text(entry.courierPartner || courier?.name || entry.courierId || 'Courier', 142, y + 29);

  doc.setFont('helvetica', 'bold'); doc.text('Aligned Dock:', 110, y + 36);
  doc.setFont('helvetica', 'bold'); doc.setTextColor(37, 99, 235);
  doc.text(entry.dockNumber || 'Dock 01', 142, y + 36);

  doc.setFont('helvetica', 'bold'); doc.setTextColor(71, 85, 105); doc.text(isB2B ? 'Debit Notes/Inv:' : 'Invoice Count:', 110, y + 43);
  doc.setFont('helvetica', 'normal'); doc.text(`${entry.phase1?.invoiceCount || 1} Invoices Declared`, 142, y + 43);

  y += 54;

  // Dock QC Box
  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(254, 252, 232);
  doc.roundedRect(14, y, pageWidth - 28, 48, 2, 2, 'FD');

  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(
    isB2B
      ? 'B2B UNLOADING & DOCK QC SUMMARY'
      : 'UNLOADING & DOCK QC SUMMARY',
    18,
    y + 7
  );

  const phase2 = entry.phase2;
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);

  doc.setFont('helvetica', 'bold'); doc.text('Unloading Status:', 18, y + 15);
  doc.setFont('helvetica', 'normal'); doc.text(phase2 ? 'QC Completed' : 'Pending Dock QC', 52, y + 15);

  doc.setFont('helvetica', 'bold'); doc.text(isB2B ? 'Total Dockets / DN:' : 'Total Dockets:', 18, y + 22);
  doc.setFont('helvetica', 'normal'); doc.text(`${phase2?.totalDocketsCount || (entry.expectedBoxCount ? 1 : 0)} Dockets`, 52, y + 22);

  doc.setFont('helvetica', 'bold'); doc.text('Total Invoices:', 18, y + 29);
  doc.setFont('helvetica', 'normal'); doc.text(`${phase2?.totalInvoicesCount || 1} Invoices Verified`, 52, y + 29);

  doc.setFont('helvetica', 'bold'); doc.text(isB2B ? 'Total Cartons (QC):' : 'Total Boxes (QC):', 18, y + 36);
  doc.setFont('helvetica', 'bold'); doc.setTextColor(16, 185, 129);
  doc.text(`${phase2?.totalBoxesCount || entry.expectedBoxCount} Boxes`, 52, y + 36);

  doc.setFont('helvetica', 'bold'); doc.setTextColor(71, 85, 105); doc.text('Dock Supervisor:', 18, y + 43);
  doc.setFont('helvetica', 'normal'); doc.text(phase2?.unloadingInchargeName || 'Unassigned', 52, y + 43);

  // Column 2 - QC Conditions
  doc.setFont('helvetica', 'bold'); doc.text('Good / Intact:', 110, y + 15);
  doc.setFont('helvetica', 'normal'); doc.setTextColor(16, 185, 129);
  doc.text(`${phase2?.goodCount || 0} Boxes`, 142, y + 15);

  doc.setFont('helvetica', 'bold'); doc.setTextColor(71, 85, 105); doc.text('Damage Boxes:', 110, y + 22);
  doc.setFont('helvetica', 'normal'); doc.setTextColor(225, 29, 72);
  doc.text(`${phase2?.damageCount || 0} Boxes`, 142, y + 22);

  doc.setFont('helvetica', 'bold'); doc.setTextColor(71, 85, 105); doc.text('Open Boxes:', 110, y + 29);
  doc.setFont('helvetica', 'normal'); doc.setTextColor(217, 119, 6);
  doc.text(`${phase2?.openBoxesCount || 0} Boxes`, 142, y + 29);

  doc.setFont('helvetica', 'bold'); doc.setTextColor(71, 85, 105); doc.text('Missing / Other:', 110, y + 36);
  doc.setFont('helvetica', 'normal'); doc.setTextColor(147, 51, 234);
  doc.text(`${(phase2?.missingBoxesCount || 0) + (phase2?.otherCount || 0)} Boxes`, 142, y + 36);

  y += 54;

  // Handover Box
  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(240, 253, 244);
  doc.roundedRect(14, y, pageWidth - 28, 42, 2, 2, 'FD');

  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(
    isB2B
      ? 'B2B HANDOVER & CUSTODY ACCEPTANCE'
      : 'HANDOVER & CUSTODY ACCEPTANCE',
    18,
    y + 7
  );

  const phase3 = entry.phase3;
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);

  doc.setFont('helvetica', 'bold'); doc.text(isB2B ? 'B2B Account Lead:' : 'Account Incharge:', 18, y + 15);
  doc.setFont('helvetica', 'normal'); doc.text(phase3?.accountInchargeName || 'Pending Sign-off', 52, y + 15);

  doc.setFont('helvetica', 'bold'); doc.text('Confirmed Boxes:', 18, y + 22);
  doc.setFont('helvetica', 'bold'); doc.setTextColor(16, 185, 129);
  doc.text(`${phase3?.receivedBoxesConfirmed || 0} Boxes Received`, 52, y + 22);

  doc.setFont('helvetica', 'bold'); doc.setTextColor(71, 85, 105); doc.text('Variance / Diff:', 18, y + 29);
  doc.setFont('helvetica', 'normal'); doc.text(`${phase3 ? (phase3.differenceCount === 0 ? '0 (Exact Match)' : `${phase3.differenceCount} Boxes`) : '-'}`, 52, y + 29);

  doc.setFont('helvetica', 'bold'); doc.text('Completed At:', 110, y + 15);
  doc.setFont('helvetica', 'normal'); doc.text(phase3?.completedAt ? new Date(phase3.completedAt).toLocaleString() : 'Pending', 142, y + 15);

  doc.setFont('helvetica', 'bold'); doc.text('Condition Confirmed:', 110, y + 22);
  doc.setFont('helvetica', 'normal'); doc.text(phase3?.conditionConfirmed ? 'Yes (Accepted)' : 'Pending', 142, y + 22);

  if (phase3?.shortageComment) {
    doc.setFont('helvetica', 'bold'); doc.setTextColor(225, 29, 72); doc.text('Shortage Reason:', 18, y + 36);
    doc.setFont('helvetica', 'normal'); doc.text(phase3.shortageComment.slice(0, 75), 52, y + 36);
  }

  y += 48;

  // Signatures Area
  doc.setDrawColor(148, 163, 184);
  doc.roundedRect(14, y, pageWidth - 28, 26, 2, 2, 'S');

  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);
  doc.text(`Security Officer: ${entry.createdByName || 'Security Officer'}`, 18, y + 10);
  doc.text(`Unloading QC: ${phase2?.unloadingInchargeName || 'Dock Incharge'}`, 110, y + 10);
  doc.text(`Driver: ${entry.driverName}`, 18, y + 20);
  doc.text(`Account Sign-off: ${phase3?.signerName || 'Account Lead'}`, 110, y + 20);

  const pdfName = isB2B
    ? `${entry.gatePassNumber}_B2B_Return_GatePass.pdf`
    : `${entry.gatePassNumber}_GatePass.pdf`;

  triggerDirectDownload(doc, pdfName);
}

export function generateWarehouseBatchesSummaryPDF(
  batches: ReturnBatch[],
  warehouse: Warehouse,
  clients: Client[],
  couriers: Courier[]
) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 12;
  const contentWidth = pageWidth - margin * 2;

  const formatDate = (dateStr?: string | number | Date) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return String(dateStr);
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) +
        ', ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    } catch {
      return String(dateStr);
    }
  };

  const drawHeader = () => {
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageWidth, 28, 'F');
    doc.setFillColor(99, 102, 241);
    doc.rect(0, 28, pageWidth, 1.5, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(15);
    doc.setFont('helvetica', 'bold');
    doc.text('EMIZA WAREHOUSE OPERATIONS', margin, 12);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(203, 213, 225);
    doc.text(`WAREHOUSE BATCHES AUDIT REPORT - ${warehouse.name.toUpperCase()} (${warehouse.code})`, margin, 19);
  };

  drawHeader();

  let y = 36;

  // Stats Box
  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin, y, contentWidth, 18, 2, 2, 'FD');

  const totalScanned = batches.reduce((sum, b) => sum + b.totalScanned, 0);
  const openCount = batches.filter(b => b.status === 'Open').length;
  const closedCount = batches.filter(b => b.status === 'Closed').length;

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('Total Batches:', margin + 4, y + 7);
  doc.setTextColor(15, 23, 42);
  doc.text(`${batches.length} (${openCount} Open, ${closedCount} Closed)`, margin + 27, y + 7);

  doc.setTextColor(71, 85, 105);
  doc.text('Total Scanned AWBs:', margin + 4, y + 13);
  doc.setTextColor(16, 185, 129);
  doc.text(`${totalScanned} Parcels`, margin + 37, y + 13);

  doc.setTextColor(71, 85, 105);
  doc.text('Facility Location:', margin + 95, y + 7);
  doc.setTextColor(15, 23, 42);
  doc.text(warehouse.city || warehouse.name, margin + 125, y + 7);

  doc.setTextColor(71, 85, 105);
  doc.text('Report Generated:', margin + 95, y + 13);
  doc.setTextColor(15, 23, 42);
  doc.text(formatDate(new Date()), margin + 125, y + 13);

  y += 24;

  const renderTableHeader = (currentY: number) => {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('BATCH SUMMARY LIST', margin, currentY);

    const tblY = currentY + 3.5;
    doc.setFillColor(30, 41, 59);
    doc.rect(margin, tblY, contentWidth, 7, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.text('#', margin + 3, tblY + 4.8);
    doc.text('Batch Number', margin + 12, tblY + 4.8);
    doc.text('Client', margin + 48, tblY + 4.8);
    doc.text('Courier', margin + 88, tblY + 4.8);
    doc.text('Status', margin + 122, tblY + 4.8);
    doc.text('Scanned', margin + 140, tblY + 4.8);
    doc.text('Created Date', margin + 158, tblY + 4.8);

    return tblY + 7;
  };

  y = renderTableHeader(y);

  batches.forEach((b, index) => {
    if (y > pageHeight - 20) {
      doc.addPage();
      drawHeader();
      y = 36;
      y = renderTableHeader(y);
    }

    const client = clients.find(c => c.id === b.clientId);
    const courier = couriers.find(cr => cr.id === b.courierId);

    doc.setFillColor(index % 2 === 0 ? 255 : 248, index % 2 === 0 ? 255 : 250, index % 2 === 0 ? 255 : 252);
    doc.rect(margin, y, contentWidth, 6.5, 'F');
    doc.setDrawColor(241, 245, 249);
    doc.line(margin, y + 6.5, margin + contentWidth, y + 6.5);

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    doc.text(`${index + 1}`, margin + 3, y + 4.3);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(99, 102, 241);
    doc.text(b.batchNumber, margin + 12, y + 4.3);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text((client?.name || b.clientId).slice(0, 20), margin + 48, y + 4.3);
    doc.text((courier?.name || b.courierId).slice(0, 18), margin + 88, y + 4.3);

    doc.setFont('helvetica', 'bold');
    if (b.status === 'Closed') {
      doc.setTextColor(16, 185, 129);
    } else {
      doc.setTextColor(217, 119, 6);
    }
    doc.text(b.status, margin + 122, y + 4.3);

    doc.setTextColor(15, 23, 42);
    doc.text(`${b.totalScanned}`, margin + 140, y + 4.3);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(formatDate(b.createdAt).split(',')[0], margin + 158, y + 4.3);

    y += 6.5;
  });

  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Page ${i} of ${totalPages}  |  Warehouse: ${warehouse.code}  |  Emiza WOP System  |  Generated on ${formatDate(new Date())}`,
      pageWidth / 2,
      pageHeight - 5,
      { align: 'center' }
    );
  }

  triggerDirectDownload(doc, `${warehouse.code}_Batches_Summary.pdf`);
}
