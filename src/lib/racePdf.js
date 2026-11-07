import { jsPDF } from 'jspdf'
import { autoTable } from 'jspdf-autotable'
import { normalizeRaceRows } from './raceIdentity.js'

const INK = [17, 35, 63]
const BLUE = [0, 137, 198]
const PALE_BLUE = [235, 246, 252]
const MUTED = [97, 116, 138]

function finite(value) {
  return value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value))
    ? Number(value) : null
}

function lapTime(value) {
  const raw = finite(value)
  if (raw === null || raw < 0) return '-'
  const ms = Math.round(raw)
  return `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}.${String(ms % 1000).padStart(3, '0')}`
}

function percent(value) {
  const number = finite(value)
  return number === null ? '-' : `${number.toFixed(1)}%`
}

function speed(value) {
  const number = finite(value)
  return number === null ? '-' : `${number.toFixed(2)} km/h`
}

function mean(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null
}

function reportRows(race, rows) {
  return normalizeRaceRows({ ...race, results: rows || race.results }).map((row, index) => {
    const laps = row.laps.map(finite).filter((value) => value !== null && value > 0)
    const sorted = [...laps].sort((a, b) => a - b)
    const average = mean(laps)
    const deviation = average ? Math.sqrt(mean(laps.map((lap) => (lap - average) ** 2))) : null
    const consecutive = laps.slice(2).map((_, lap) => mean(laps.slice(lap, lap + 3)))
    return {
      ...row,
      name: row.name || row.nick || `Driver ${index + 1}`,
      laps,
      total_ms: finite(row.total_ms) ?? (laps.length ? laps.reduce((sum, lap) => sum + lap, 0) : null),
      best_ms: finite(row.best_ms) ?? sorted[0] ?? null,
      top3_ms: finite(row.top3_ms) ?? (sorted.length >= 3 ? mean(sorted.slice(0, 3)) : null),
      consecutive_ms: finite(row.consecutive_ms ?? row.top3_consecutive_ms) ?? (consecutive.length ? Math.min(...consecutive) : null),
      p80_ms: finite(row.p80_ms) ?? mean(sorted.slice(0, Math.ceil(sorted.length * 0.8))),
      consistency: finite(row.consistency) ?? (average ? Math.max(0, 1 - deviation / average) * 100 : null),
      top_speed_kmh: finite(row.top_speed_kmh ?? row.speed_kmh ?? row.topSpeedKmh),
    }
  })
}

function dateLabel(value, language) {
  if (!value) return ''
  const date = new Date(typeof value === 'number' && value < 1e12 ? value * 1000 : value)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString(language === 'id' ? 'id-ID' : 'en-US')
}

function tableOptions(doc) {
  return {
    margin: { top: 39, right: 12, bottom: 15, left: 12 },
    tableWidth: doc.internal.pageSize.getWidth() - 24,
    theme: 'grid',
    showHead: 'everyPage',
    rowPageBreak: 'avoid',
    styles: { font: 'helvetica', fontSize: 7.5, cellPadding: 2.3, overflow: 'linebreak', textColor: INK, lineColor: [222, 232, 240], lineWidth: 0.1 },
    headStyles: { fillColor: PALE_BLUE, textColor: BLUE, fontStyle: 'bold', fontSize: 7 },
    alternateRowStyles: { fillColor: [248, 251, 253] },
  }
}

/** Render data independently of the scrolling modal, including every lap. */
export function createRacePdf({ race, rows, language = 'id' } = {}) {
  if (!race) throw new Error('Race data is required')
  const data = reportRows(race, rows)
  if (!data.length) throw new Error('Race results are empty')
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true })
  const title = String(race.name || race.title || 'YurLaps race')
  doc.setProperties({ title: `${title} - race results`, subject: 'Race leaderboard and lap detail', creator: 'YurLaps' })
  const sections = new Map([[1, 'Leaderboard']])

  autoTable(doc, {
    ...tableOptions(doc),
    startY: 39,
    head: [['Pos', 'Driver', 'Laps', 'Total time', 'Best lap', 'Top 3 avg', 'Top 3 cons.', 'P80 avg', 'Consistency', 'Top speed']],
    body: data.map((row) => [row.pos, `${row.name}${row.transponder != null ? `\nTP ${row.transponder}` : ''}`, row.n_lap, lapTime(row.total_ms), lapTime(row.best_ms), lapTime(row.top3_ms), lapTime(row.consecutive_ms), lapTime(row.p80_ms), percent(row.consistency), speed(row.top_speed_kmh)]),
    columnStyles: { 0: { cellWidth: 11, halign: 'center' }, 1: { cellWidth: 47 }, 2: { cellWidth: 12, halign: 'center' }, 4: { textColor: BLUE, fontStyle: 'bold' } },
    didParseCell(cell) {
      if (cell.section === 'body' && cell.column.index === 0 && cell.row.index < 3) {
        cell.cell.styles.fillColor = [[255, 242, 203], [231, 236, 241], [249, 226, 207]][cell.row.index]
        cell.cell.styles.fontStyle = 'bold'
      }
    },
  })

  const maxLaps = Math.max(0, ...data.map((row) => row.laps.length))
  const lapsPerTable = 10
  for (let first = 0; first < maxLaps; first += lapsPerTable) {
    const count = Math.min(lapsPerTable, maxLaps - first)
    doc.addPage()
    sections.set(doc.getNumberOfPages(), `Lap detail - ${first + 1} to ${first + count}`)
    autoTable(doc, {
      ...tableOptions(doc),
      startY: 39,
      head: [['Driver', ...Array.from({ length: count }, (_, index) => `Lap ${first + index + 1}`)]],
      body: data.map((row) => [row.name, ...Array.from({ length: count }, (_, index) => lapTime(row.laps[first + index]))]),
      columnStyles: { 0: { cellWidth: 47, fontStyle: 'bold' } },
      didParseCell(cell) {
        if (cell.section === 'body' && cell.column.index > 0) {
          const row = data[cell.row.index]
          if (row.laps[first + cell.column.index - 1] === row.best_ms) {
            cell.cell.styles.textColor = BLUE
            cell.cell.styles.fontStyle = 'bold'
          }
        }
      },
    })
  }

  const pageCount = doc.getNumberOfPages()
  const metadata = [race.track_name || race.track, dateLabel(race.race_date || race.started_at, language), `${data.length} drivers`].filter(Boolean).join('  |  ')
  let section = 'Leaderboard'
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page)
    section = sections.get(page) || section
    doc.setFont('helvetica', 'bold').setFontSize(16).setTextColor(...INK)
    doc.text(doc.splitTextToSize(title, 250).slice(0, 1), 12, 15)
    doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(...MUTED)
    doc.text(doc.splitTextToSize(metadata, 270).slice(0, 1), 12, 22)
    doc.setDrawColor(...BLUE).setLineWidth(0.7).line(12, 27, 285, 27)
    doc.setFont('helvetica', 'bold').setFontSize(9).setTextColor(...BLUE).text(section, 12, 34)
    doc.setFont('helvetica', 'normal').setFontSize(7).setTextColor(...MUTED)
    doc.text('YurLaps - Race report', 12, 202)
    doc.text(`${page} / ${pageCount}`, 285, 202, { align: 'right' })
  }
  return doc
}

/** Direct .pdf download; no browser print dialog or popup is required. */
export function openRacePdfReport(options = {}) {
  if (!options.race) return false
  const doc = createRacePdf(options)
  const title = String(options.race.name || options.race.title || 'yurlaps-race')
  const filename = `${title.replace(/[\\/:*?"<>|]/g, '-').trim() || 'yurlaps-race'}-results.pdf`
  doc.save(filename)
  return true
}
