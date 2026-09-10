import { ReturnBatch, ScannedReturnItem, Client, Courier } from '../types';

/**
 * Trigger browser download of CSV string
 */
export function downloadCSV(filename: string, csvContent: string) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export all items of a single Return Batch to CSV
 */
export function exportBatchItemsToCSV(
  batch: ReturnBatch,
  items: ScannedReturnItem[],
  clientName?: string,
  courierName?: string
) {
  const headers = [
    'Batch Number',
    'Account / Client Name',
    'Courier Partner',
    'AWB / Tracking Number',
    'QC Condition',
    'Dock Number',
    'Scanned At (ISO)',
    'Scanned At (Local)',
    'Scanned By',
  ];

  const rows = items.map(item => [
    `"${batch.batchNumber || ''}"`,
    `"${(clientName || batch.clientName || '').replace(/"/g, '""')}"`,
    `"${(courierName || batch.courierName || '').replace(/"/g, '""')}"`,
    `"${(item.trackingNumber || '').replace(/"/g, '""')}"`,
    `"${(item.remark || '').replace(/"/g, '""')}"`,
    `"${(batch.dockNumber || '').replace(/"/g, '""')}"`,
    `"${item.scannedAt || ''}"`,
    `"${item.scannedAt ? new Date(item.scannedAt).toLocaleString() : ''}"`,
    `"${(item.scannedByName || '').replace(/"/g, '""')}"`,
  ]);

  const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
  const filename = `Batch_${batch.batchNumber || batch.id}_Items_${new Date().toISOString().slice(0, 10)}.csv`;
  downloadCSV(filename, csvContent);
}

/**
 * Export Date-wise Return Report to CSV
 */
export function exportDateWiseReportToCSV(
  dateRows: Array<{
    date: string;
    totalBatches: number;
    openBatches: number;
    closedBatches: number;
    totalScanned: number;
    goodCount: number;
    damageCount: number;
    otherCount: number;
  }>
) {
  const headers = [
    'Date',
    'Total Batches',
    'Open Batches',
    'Closed Batches',
    'Total Scanned Units',
    'Good Condition (QC Pass)',
    'Damage / Missing Units',
    'Other QC Conditions',
  ];

  const rows = dateRows.map(r => [
    `"${r.date}"`,
    r.totalBatches,
    r.openBatches,
    r.closedBatches,
    r.totalScanned,
    r.goodCount,
    r.damageCount,
    r.otherCount,
  ]);

  const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\r\n');
  const filename = `Returns_DateWise_Report_${new Date().toISOString().slice(0, 10)}.csv`;
  downloadCSV(filename, csvContent);
}

/**
 * Export Account-wise Return Report to CSV
 */
export function exportAccountWiseReportToCSV(
  accountRows: Array<{
    accountName: string;
    accountCode: string;
    totalBatches: number;
    totalScanned: number;
    goodCount: number;
    damageCount: number;
    pendingCount: number;
  }>
) {
  const headers = [
    'Account / Brand Name',
    'Account Code',
    'Total Batches',
    'Total Scanned Units',
    'Good Condition (QC Pass)',
    'Damage / Flagged Units',
    'Pending Units',
  ];

  const rows = accountRows.map(r => [
    `"${r.accountName.replace(/"/g, '""')}"`,
    `"${r.accountCode.replace(/"/g, '""')}"`,
    r.totalBatches,
    r.totalScanned,
    r.goodCount,
    r.damageCount,
    r.pendingCount,
  ]);

  const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\r\n');
  const filename = `Returns_AccountWise_Report_${new Date().toISOString().slice(0, 10)}.csv`;
  downloadCSV(filename, csvContent);
}

/**
 * Export All Batches Summary to CSV
 */
export function exportAllBatchesToCSV(
  batches: ReturnBatch[],
  clients: Client[],
  couriers: Courier[]
) {
  const headers = [
    'Batch Number',
    'Account / Client Name',
    'Courier Partner',
    'Status',
    'Total Scanned',
    'Expected Count',
    'Pending Count',
    'Dock Number',
    'Created At',
    'Closed At',
    'Driver Name',
    'Supervisor Signer',
  ];

  const rows = batches.map(b => {
    const client = clients.find(c => c.id === b.clientId);
    const courier = couriers.find(cr => cr.id === b.courierId);
    const expected = b.expectedCount || 0;
    const scanned = b.totalScanned || 0;
    const pending = Math.max(0, expected - scanned);

    return [
      `"${b.batchNumber}"`,
      `"${(client?.name || b.clientName || '').replace(/"/g, '""')}"`,
      `"${(courier?.name || b.courierName || '').replace(/"/g, '""')}"`,
      `"${b.status}"`,
      scanned,
      expected,
      pending,
      `"${b.dockNumber || ''}"`,
      `"${b.createdAt ? new Date(b.createdAt).toLocaleString() : ''}"`,
      `"${b.closedAt ? new Date(b.closedAt).toLocaleString() : ''}"`,
      `"${(b.driverName || '').replace(/"/g, '""')}"`,
      `"${(b.supervisorSigner || '').replace(/"/g, '""')}"`,
    ];
  });

  const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\r\n');
  const filename = `Warehouse_All_Batches_${new Date().toISOString().slice(0, 10)}.csv`;
  downloadCSV(filename, csvContent);
}
