import { useEffect, useMemo, useState } from 'react'
import { cellAddress, columnLabel, isCellInRange, rangeAddress } from '../utils'

interface Coordinate {
  row: number
  column: number
}

interface ParsedRange {
  start: Coordinate
  end: Coordinate
}

function columnIndex(label: string): number {
  return label.split('').reduce((total, character) => total * 26 + character.charCodeAt(0) - 64, 0) - 1
}

function parseRange(value: string): ParsedRange | null {
  const match = /^([A-Z]+)(\d+):([A-Z]+)(\d+)$/i.exec(value.trim())
  if (!match) return null
  return {
    start: { row: Number(match[2]) - 1, column: columnIndex(match[1].toUpperCase()) },
    end: { row: Number(match[4]) - 1, column: columnIndex(match[3].toUpperCase()) },
  }
}

interface ExcelGridProps {
  cells: string[][]
  zoom: number
  mergedRanges?: string[]
  candidateRanges?: string[]
  activeRange?: string
  onRangeSelected: (range: string) => void
}

export function ExcelGrid({
  cells,
  zoom,
  mergedRanges = [],
  candidateRanges = [],
  activeRange,
  onRangeSelected,
}: ExcelGridProps) {
  const [dragging, setDragging] = useState(false)
  const [selection, setSelection] = useState<{ start: Coordinate; end: Coordinate } | null>(null)
  const columnCount = Math.max(1, ...cells.map((row) => row.length))
  const parsedCandidates = useMemo(() => candidateRanges.map(parseRange).filter(Boolean) as ParsedRange[], [candidateRanges])
  const parsedMerged = useMemo(() => mergedRanges.map((range) => ({ range, parsed: parseRange(range) })).filter((item) => item.parsed), [mergedRanges])

  useEffect(() => {
    if (!activeRange) return
    const parsed = parseRange(activeRange)
    if (parsed) setSelection(parsed)
  }, [activeRange])

  useEffect(() => {
    if (!dragging) return
    function finish() {
      setDragging(false)
      if (selection) onRangeSelected(rangeAddress(selection.start, selection.end))
    }
    window.addEventListener('pointerup', finish)
    return () => window.removeEventListener('pointerup', finish)
  }, [dragging, onRangeSelected, selection])

  function startSelection(coordinate: Coordinate) {
    setDragging(true)
    setSelection({ start: coordinate, end: coordinate })
  }

  function extendSelection(coordinate: Coordinate) {
    if (!dragging) return
    setSelection((current) => (current ? { ...current, end: coordinate } : null))
  }

  return (
    <div className="excel-grid-scroller">
      <div
        className="excel-grid"
        style={{
          gridTemplateColumns: `${44 * zoom}px repeat(${columnCount}, ${112 * zoom}px)`,
          fontSize: `${12 * Math.max(0.88, zoom)}px`,
        }}
      >
        <div className="excel-corner" />
        {Array.from({ length: columnCount }, (_, column) => (
          <div className="excel-column-header" key={`header-${column}`}>{columnLabel(column)}</div>
        ))}
        {cells.map((row, rowIndex) => (
          <div className="excel-row-contents" key={`row-${rowIndex}`}>
            <div className="excel-row-header">{rowIndex + 1}</div>
            {Array.from({ length: columnCount }, (_, columnIndexValue) => {
              const coordinate = { row: rowIndex, column: columnIndexValue }
              const value = row[columnIndexValue] || ''
              const selected = selection && isCellInRange(coordinate, selection.start, selection.end)
              const candidate = parsedCandidates.some((range) => isCellInRange(coordinate, range.start, range.end))
              const mergedRange = parsedMerged.find((range) => range.parsed && isCellInRange(coordinate, range.parsed.start, range.parsed.end))
              return (
                <div
                  className={`excel-cell ${selected ? 'selected' : ''} ${candidate ? 'candidate' : ''} ${mergedRange ? 'merged-cell' : ''} ${value.startsWith('=') ? 'formula-cell' : ''}`}
                  key={cellAddress(rowIndex, columnIndexValue)}
                  onPointerDown={(event) => { event.preventDefault(); startSelection(coordinate) }}
                  onPointerEnter={() => extendSelection(coordinate)}
                  title={`${cellAddress(rowIndex, columnIndexValue)}${mergedRange ? ` · cellule fusionnée ${mergedRange.range}` : ''}${value.startsWith('=') ? ` · formule ${value}` : ''}`}
                  data-address={cellAddress(rowIndex, columnIndexValue)}
                >
                  <span>{value}</span>
                </div>
              )
            })}
          </div>
        ))}
      </div>
      {selection && <div className="selection-indicator">Plage sélectionnée <strong>{rangeAddress(selection.start, selection.end)}</strong></div>}
    </div>
  )
}
