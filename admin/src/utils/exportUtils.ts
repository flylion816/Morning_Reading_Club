/**
 * 数据导出工具
 * 支持 CSV 和 Excel 格式导出
 */

/**
 * 导出为 CSV 格式
 */
export function exportToCSV(filename: string, headers: string[], rows: (string | number)[][]) {
  const csv = [headers, ...rows]
    .map(row =>
      row
        .map(cell => {
          const str = String(cell);
          // 如果包含逗号、双引号或换行，需要用双引号包围
          if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        })
        .join(',')
    )
    .join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  downloadFile(blob, `${filename}.csv`);
}

/**
 * Export a spreadsheet without parsing uploaded workbooks.
 *
 * Writing only a minimal SpreadsheetML package avoids importing SheetJS,
 * whose npm release is affected by parser advisories. Values are emitted as
 * numeric or inline string cells, never formulas or shared-string records.
 */
export async function exportToExcel(
  filename: string,
  headers: string[],
  rows: (string | number)[][],
  options?: {
    sheetName?: string;
    frozenHeader?: boolean;
    columnWidths?: number[];
    headerBackgroundColor?: string;
    headerTextColor?: string;
  }
) {
  try {
    const { strToU8, zipSync } = await import('fflate');
    const escapeXml = (value: unknown) => String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
    const columnName = (index: number) => {
      let value = index + 1;
      let name = '';
      while (value > 0) {
        const remainder = (value - 1) % 26;
        name = String.fromCharCode(65 + remainder) + name;
        value = Math.floor((value - 1) / 26);
      }
      return name;
    };
    const cell = (value: string | number, ref: string, header = false) => {
      if (typeof value === 'number' && Number.isFinite(value)) {
        return `<c r="${ref}"${header ? ' s="1"' : ''}><v>${value}</v></c>`;
      }
      return `<c r="${ref}" t="inlineStr"${header ? ' s="1"' : ''}><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
    };
    const allRows = [headers, ...rows];
    const sheetRows = allRows.map((row, rowIndex) => {
      const cells = row.map((value, colIndex) => cell(value, `${columnName(colIndex)}${rowIndex + 1}`, rowIndex === 0)).join('');
      return `<row r="${rowIndex + 1}">${cells}</row>`;
    }).join('');
    const widths = (options?.columnWidths || headers.map(header => Math.max(String(header).length + 2, 15)))
      .map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${Math.max(8, width)}" customWidth="1"/>`).join('');
    const freeze = options?.frozenHeader === false ? '' : '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>';
    const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:${columnName(Math.max(headers.length - 1, 0))}${Math.max(allRows.length, 1)}"/>${freeze}<cols>${widths}</cols><sheetData>${sheetRows}</sheetData></worksheet>`;
    const normalizedSheetName = (options?.sheetName || 'Sheet1').replace(/[[:*?/\\]/g, '_').slice(0, 31) || 'Sheet1';
    const sheetName = escapeXml(normalizedSheetName);
    const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${sheetName}" sheetId="1" r:id="rId1"/></sheets></workbook>`;
    const contentTypes = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>';
    const rootRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>';
    const workbookRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>';
    const toArgb = (color: string | undefined, fallback: string) => {
      const hex = (color || fallback).replace(/^#/, '');
      if (/^[a-f0-9]{8}$/i.test(hex)) return hex.toUpperCase();
      if (/^[a-f0-9]{6}$/i.test(hex)) return `FF${hex.toUpperCase()}`;
      return `FF${fallback}`;
    };
    const headerFill = toArgb(options?.headerBackgroundColor, '4472C4');
    const headerFont = toArgb(options?.headerTextColor, 'FFFFFF');
    const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="${headerFont}"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="solid"><fgColor rgb="${headerFill}"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/><xf numFmtId="0" fontId="1" fillId="1" borderId="0" applyFont="1" applyFill="1"/></cellXfs></styleSheet>`;
    const archive = zipSync({
      '[Content_Types].xml': strToU8(contentTypes),
      '_rels/.rels': strToU8(rootRels),
      'xl/workbook.xml': strToU8(workbook),
      'xl/_rels/workbook.xml.rels': strToU8(workbookRels),
      'xl/worksheets/sheet1.xml': strToU8(sheet),
      'xl/styles.xml': strToU8(styles)
    });
    downloadFile(new Blob([archive], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${filename}.xlsx`);
  } catch (error) {
    console.error('Excel 导出失败:', error);
    throw new Error('Excel导出功能不可用，请使用CSV导出', { cause: error });
  }
}

/**
 * 导出为 JSON 格式
 */
export function exportToJSON(filename: string, headers: string[], rows: (string | number)[][]) {
  const jsonData = rows.map(row => {
    const obj: any = {};
    headers.forEach((header, index) => {
      obj[header] = row[index];
    });
    return obj;
  });

  const blob = new Blob([JSON.stringify(jsonData, null, 2)], {
    type: 'application/json;charset=utf-8;'
  });
  downloadFile(blob, `${filename}.json`);
}

/**
 * 生成格式化的表格数据
 */
export interface ExportData {
  headers: string[];
  rows: (string | number)[][];
}

/**
 * 从对象数组生成导出数据
 */
export function generateExportData(
  data: any[],
  fieldMap: { key: string; label: string; formatter?: (_value: any) => string | number }[]
): ExportData {
  const headers = fieldMap.map(f => f.label);
  const rows = data.map(item =>
    fieldMap.map(f => {
      const value = item[f.key];
      return f.formatter ? f.formatter(value) : value || '-';
    })
  );

  return { headers, rows };
}

/**
 * 生成统计报表数据
 */
export interface StatisticsReport {
  title: string;
  generatedAt: string;
  statistics: Record<string, string | number>;
  data: ExportData;
}

export function generateStatisticsReport(
  title: string,
  statistics: Record<string, string | number>,
  exportData: ExportData
): StatisticsReport {
  return {
    title,
    generatedAt: new Date().toLocaleString('zh-CN'),
    statistics,
    data: exportData
  };
}

/**
 * 下载文件
 */
function downloadFile(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * 生成带时间戳的文件名
 */
export function generateFilename(prefix: string): string {
  const timestamp = new Date().getTime();
  const dateStr = new Date().toLocaleDateString('zh-CN').replace(/\//g, '-');
  return `${prefix}-${dateStr}-${timestamp}`;
}
