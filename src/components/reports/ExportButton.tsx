'use client';

import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import { Download, FileSpreadsheet } from 'lucide-react';

export interface ExportColumn<T extends Record<string, string | number | null>> {
  key: keyof T;
  label: string;
}

interface ExportButtonProps<T extends Record<string, string | number | null>> {
  rows: T[];
  columns: ExportColumn<T>[];
  fileName: string;
  format: 'csv' | 'xlsx';
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function toExportRows<T extends Record<string, string | number | null>>(rows: T[], columns: ExportColumn<T>[]) {
  return rows.map((row) =>
    columns.reduce<Record<string, string | number | null>>((result, column) => {
      result[column.label] = row[column.key];
      return result;
    }, {})
  );
}

export function ExportButton<T extends Record<string, string | number | null>>({
  rows,
  columns,
  fileName,
  format,
}: ExportButtonProps<T>) {
  function handleExport() {
    const exportRows = toExportRows(rows, columns);

    if (format === 'csv') {
      const worksheet = XLSX.utils.json_to_sheet(exportRows);
      const csv = XLSX.utils.sheet_to_csv(worksheet);
      downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `${fileName}.csv`);
      return;
    }

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Report');
    XLSX.writeFile(workbook, `${fileName}.xlsx`);
  }

  return (
    <Button type="button" variant="outline" onClick={handleExport} disabled={rows.length === 0}>
      {format === 'xlsx' ? <FileSpreadsheet className="h-4 w-4" /> : <Download className="h-4 w-4" />}
      Export {format.toUpperCase()}
    </Button>
  );
}
