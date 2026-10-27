import { NextRequest, NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { Readable } from 'stream'

type CellVal = ExcelJS.CellValue

function serializeCell(value: CellVal): unknown {
  if (value == null) return null
  if (value instanceof Date) return value.toISOString().split('T')[0]
  if (typeof value === 'object') {
    if ('richText' in value) {
      // RichText
      return (value as ExcelJS.CellRichTextValue).richText.map((r) => r.text).join('')
    }
    if ('hyperlink' in value) {
      return (value as ExcelJS.CellHyperlinkValue).text ?? null
    }
    if ('error' in value) return null
    if ('result' in value) {
      return serializeCell((value as ExcelJS.CellFormulaValue).result as CellVal)
    }
    if ('sharedFormula' in value) {
      return serializeCell((value as ExcelJS.CellSharedFormulaValue).result as CellVal)
    }
    return null
  }
  return value
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())

    // Build a Node.js Readable from the buffer for the streaming reader
    const readable = new Readable()
    readable.push(buffer)
    readable.push(null)

    const workbookReader = new ExcelJS.stream.xlsx.WorkbookReader(readable, {})

    let headers: string[] = []
    const rows: Record<string, unknown>[] = []
    let firstSheetSeen = false

    for await (const worksheetReader of workbookReader) {
      // Only process the first sheet encountered
      const isTarget = !firstSheetSeen
      firstSheetSeen = true

      for await (const row of worksheetReader) {
        if (!isTarget) continue

        if (row.number === 1) {
          // Header row
          row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
            const val = String(serializeCell(cell.value) ?? '').trim()
            headers[colNumber - 1] = val || `col${colNumber}`
          })
        } else {
          const rowObj: Record<string, unknown> = {}
          row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
            const header = headers[colNumber - 1]
            if (header) rowObj[header] = serializeCell(cell.value)
          })
          // Skip entirely empty rows
          const hasData = Object.values(rowObj).some((v) => v != null && v !== '')
          if (hasData) rows.push(rowObj)
        }
      }
    }

    if (rows.length === 0) return NextResponse.json({ error: 'File is empty or no data found' }, { status: 400 })

    return NextResponse.json({ rows })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
