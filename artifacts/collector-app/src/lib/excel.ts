import * as XLSX from 'xlsx';

/**
 * Export given data as an Excel workbook with multiple sheets.
 * @param sheets - an object where keys are sheet names and values are arrays of row objects.
 * @param fileName - name of the generated file (without extension).
 */
export function exportToExcel(sheets: Record<string, any[]>, fileName: string) {
  const wb = XLSX.utils.book_new();
  Object.entries(sheets).forEach(([name, data]) => {
    const sheetData = Array.isArray(data) && data.length > 0 ? data : [{}];
    const ws = XLSX.utils.json_to_sheet(sheetData);
    XLSX.utils.book_append_sheet(wb, ws, name);
  });
  XLSX.writeFile(wb, `${fileName}.xlsx`);
}
