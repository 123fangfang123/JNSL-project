export interface MappingResult {
  rows: Record<string, unknown>[]
  unmappedColumns: string[]
}

export function applyColumnMap(
  rawRows: Record<string, unknown>[],
  columnMap: Record<string, string | string[]>
): MappingResult {
  const unmappedSet = new Set<string>()

  const rows = rawRows.map((raw) => {
    const mapped: Record<string, unknown> = {}
    for (const [sourceKey, value] of Object.entries(raw)) {
      const dbKey = columnMap[sourceKey]
      if (dbKey) {
        // Support array mapping: one Excel column -> multiple DB fields
        if (Array.isArray(dbKey)) {
          dbKey.forEach(f => { mapped[f] = value })
        } else {
          mapped[dbKey] = value
        }
      } else {
        unmappedSet.add(sourceKey)
      }
    }
    return mapped
  })

  return { rows, unmappedColumns: Array.from(unmappedSet) }
}

export function detectMappedColumns(
  rawHeaders: string[],
  columnMap: Record<string, string | string[]>
): { mapped: Array<{ source: string; db: string }>; unmapped: string[] } {
  const mapped: Array<{ source: string; db: string }> = []
  const unmapped: string[] = []
  for (const header of rawHeaders) {
    const dbKey = columnMap[header]
    if (dbKey) {
      // Support array mapping: show as multiple mappings
      if (Array.isArray(dbKey)) {
        dbKey.forEach(f => mapped.push({ source: header, db: f }))
      } else {
        mapped.push({ source: header, db: dbKey })
      }
    } else {
      unmapped.push(header)
    }
  }
  return { mapped, unmapped }
}