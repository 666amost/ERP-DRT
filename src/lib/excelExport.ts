import * as XLSX from 'xlsx';

export interface ExcelColumn {
  header: string;
  key: string;
  width?: number;
  type?: 'text' | 'number' | 'currency' | 'date';
  align?: 'left' | 'center' | 'right';
}

export interface ExcelExportOptions {
  filename: string;
  sheetName?: string;
  title?: string | undefined;
  subtitle?: string | undefined;
  columns: ExcelColumn[];
  data: Record<string, unknown>[];
  totals?: Record<string, number | string>;
  companyName?: string;
}

export function exportToExcel(options: ExcelExportOptions): void {
  const {
    filename,
    sheetName = 'Report',
    title,
    subtitle,
    columns,
    data,
    totals,
    companyName = 'PT. SUMBER TRANS EXPRESS'
  } = options;

  const wb = XLSX.utils.book_new();
  const wsData: (string | number | null)[][] = [];
  
  let currentRow = 0;

  if (companyName) {
    wsData.push([companyName]);
    currentRow++;
  }

  if (title) {
    wsData.push([title]);
    currentRow++;
  }

  if (subtitle) {
    wsData.push([subtitle]);
    currentRow++;
  }

  if (currentRow > 0) {
    wsData.push([]);
    currentRow++;
  }

  const headerRow = columns.map(col => col.header);
  wsData.push(headerRow);
  const headerRowIndex = currentRow;
  currentRow++;

  data.forEach((row) => {
    const rowData = columns.map(col => {
      const value = row[col.key];
      if (value === null || value === undefined) return '';
      if (col.type === 'currency' && typeof value === 'number') {
        return value;
      }
      if (col.type === 'number' && typeof value === 'number') {
        return value;
      }
      return String(value);
    });
    wsData.push(rowData);
    currentRow++;
  });

  if (totals) {
    const firstColKey = columns[0]?.key ?? '';
    const totalRow: (string | number | null)[] = columns.map(col => {
      const totalValue = totals[col.key];
      if (totalValue !== undefined) {
        return totalValue;
      }
      if (col.key === firstColKey || col.key === 'label') {
        return 'Total:';
      }
      return '';
    });
    wsData.push(totalRow);
    currentRow++;
  }

  const ws = XLSX.utils.aoa_to_sheet(wsData);

  const colWidths = columns.map(col => ({ wch: col.width || 15 }));
  ws['!cols'] = colWidths;

  if (companyName || title) {
    const mergeEnd = columns.length - 1;
    ws['!merges'] = ws['!merges'] || [];
    
    let mergeRow = 0;
    if (companyName) {
      ws['!merges'].push({ s: { r: mergeRow, c: 0 }, e: { r: mergeRow, c: mergeEnd } });
      mergeRow++;
    }
    if (title) {
      ws['!merges'].push({ s: { r: mergeRow, c: 0 }, e: { r: mergeRow, c: mergeEnd } });
      mergeRow++;
    }
    if (subtitle) {
      ws['!merges'].push({ s: { r: mergeRow, c: 0 }, e: { r: mergeRow, c: mergeEnd } });
    }
  }

  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  
  for (let R = headerRowIndex + 1; R <= range.e.r; R++) {
    columns.forEach((col, C) => {
      const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
      const cell = ws[cellRef];
      if (cell && typeof cell.v === 'number') {
        if (col.type === 'currency') {
          cell.z = '#,##0';
        } else if (col.type === 'number') {
          cell.z = '#,##0';
        }
      }
    });
  }

  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  XLSX.writeFile(wb, `${filename}.xlsx`);
}

export function exportSimpleExcel(
  data: Record<string, unknown>[],
  columns: { header: string; key: string; width?: number }[],
  filename: string,
  title?: string
): void {
  exportToExcel({
    filename,
    title,
    columns: columns.map(c => ({ ...c, type: 'text' as const })),
    data
  });
}
