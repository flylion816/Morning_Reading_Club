/**
 * 数据导出工具
 * 支持 CSV 和 Excel 格式导出
 */

/**
 * 导出为 CSV 格式
 */
export function exportToCSV(
  filename: string,
  headers: string[],
  rows: (string | number)[][]
) {
  const csv = [headers, ...rows].map(row =>
    row.map(cell => {
      const str = String(cell)
      // 如果包含逗号、双引号或换行，需要用双引号包围
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`
      }
      return str
    }).join(',')
  ).join('\n')

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  downloadFile(blob, `${filename}.csv`)
}

/**
 * 导出为 Excel 格式
 * 注意：需要安装 xlsx 库
 */
export async function exportToExcel(
  filename: string,
  headers: string[],
  rows: (string | number)[][],
  options?: {
    sheetName?: string
    frozenHeader?: boolean
    columnWidths?: number[]
    headerBackgroundColor?: string
    headerTextColor?: string
  }
) {
  try {
    // 动态导入 xlsx 库
    const XLSX = await import('xlsx')

    // 创建工作簿
    const ws_data = [headers, ...rows]
    const ws = XLSX.utils.aoa_to_sheet(ws_data)

    // 设置列宽
    if (options?.columnWidths) {
      ws['!cols'] = options.columnWidths.map(width => ({ wch: width }))
    } else {
      // 自动计算列宽
      ws['!cols'] = headers.map((header) => ({
        wch: Math.max(header.length + 2, 15)
      }))
    }

    // 设置冻结行（冻结表头）
    if (options?.frozenHeader !== false) {
      ws['!freeze'] = { xSplit: 0, ySplit: 1 }
    }

    // 为表头设置样式
    const headerStyle = {
      fill: { fgColor: { rgb: options?.headerBackgroundColor || 'FF4472C4' } },
      font: { bold: true, color: { rgb: options?.headerTextColor || 'FFFFFFFF' } },
      alignment: { horizontal: 'center', vertical: 'center' }
    }

    // 应用表头样式
    for (let i = 0; i < headers.length; i++) {
      const cellAddress = XLSX.utils.encode_col(i) + '1'
      if (ws[cellAddress]) {
        ws[cellAddress].s = headerStyle
      }
    }

    // 创建工作簿
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, options?.sheetName || 'Sheet1')

    // 导出文件
    XLSX.writeFile(wb, `${filename}.xlsx`)
  } catch (error) {
    console.error('Excel 导出失败，请确保已安装 xlsx 库:', error)
    throw new Error('Excel导出功能不可用，请使用CSV导出')
  }
}

/**
 * 导出为 JSON 格式
 */
export function exportToJSON(
  filename: string,
  headers: string[],
  rows: (string | number)[][]
) {
  const jsonData = rows.map(row => {
    const obj: any = {}
    headers.forEach((header, index) => {
      obj[header] = row[index]
    })
    return obj
  })

  const blob = new Blob([JSON.stringify(jsonData, null, 2)], {
    type: 'application/json;charset=utf-8;'
  })
  downloadFile(blob, `${filename}.json`)
}

/**
 * 生成格式化的表格数据
 */
export interface ExportData {
  headers: string[]
  rows: (string | number)[][]
}

/**
 * 从对象数组生成导出数据
 */
export function generateExportData(
  data: any[],
  fieldMap: { key: string; label: string; formatter?: (value: any) => string | number }[]
): ExportData {
  const headers = fieldMap.map(f => f.label)
  const rows = data.map(item =>
    fieldMap.map(f => {
      const value = item[f.key]
      return f.formatter ? f.formatter(value) : value || '-'
    })
  )

  return { headers, rows }
}

/**
 * 生成统计报表数据
 */
export interface StatisticsReport {
  title: string
  generatedAt: string
  statistics: Record<string, string | number>
  data: ExportData
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
  }
}

/**
 * 下载文件
 */
function downloadFile(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * 生成带时间戳的文件名
 */
export function generateFilename(prefix: string): string {
  const timestamp = new Date().getTime()
  const dateStr = new Date().toLocaleDateString('zh-CN').replace(/\//g, '-')
  return `${prefix}-${dateStr}-${timestamp}`
}
