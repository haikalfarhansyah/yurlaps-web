import { chartSeries } from './raceCharts.js'
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
    margin: { top: 28, right: 12, bottom: 15, left: 12 },
    tableWidth: doc.internal.pageSize.getWidth() - 24,
    theme: 'grid',
    showHead: 'everyPage',
    rowPageBreak: 'avoid',
    styles: { font: 'helvetica', fontSize: 6.2, cellPadding: 1.8, overflow: 'linebreak', textColor: INK, lineColor: [220, 224, 229], lineWidth: 0.1 },
    headStyles: { fillColor: [242, 244, 247], textColor: [83, 97, 116], fontStyle: 'bold', fontSize: 6.2 },
    alternateRowStyles: { fillColor: [250, 250, 250] },
  }
}

function gapLabel(value) {
  if (!value) return '-'
  return value.laps != null ? `${value.laps >= 0 ? '+' : ''}${value.laps}L` : `${value.ms >= 0 ? '+' : ''}${(value.ms / 1000).toFixed(3)}`
}

function drawHeader(doc, race, data, section, page, pages, language) {
  const width = doc.internal.pageSize.getWidth(); const height = doc.internal.pageSize.getHeight()
  doc.setFillColor(247, 248, 250); doc.setDrawColor(220, 224, 229); doc.roundedRect(12, 8, width - 24, 16, 2, 2, 'FD')
  doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(...INK); doc.text(String(race.name || 'Quick Race').slice(0, 85), 16, 15)
  const cfg = race.cfg || {}; const target = `${cfg.value ?? '-'} ${cfg.target === 'laps' ? 'laps' : 'seconds'}`
  const date = dateLabel(race.race_date || race.started_at, language)
  doc.setFont('helvetica', 'normal').setFontSize(6.5).setTextColor(101, 117, 138)
  doc.text(`${race.track_name || 'Track'} | ${(cfg.start_mode || 'grid').toUpperCase()} | ${target} | ${data.length} drivers | ${date}`.slice(0, 150), 16, 20)
  doc.setFont('helvetica', 'bold').setFontSize(8).setTextColor(...BLUE); doc.text(section, 12, 30)
  doc.setFont('helvetica', 'normal').setFontSize(6.5).setTextColor(101, 117, 138)
  doc.text(`YurLaps | Offline results | GO decoder: ${race.start_decoder_ts ?? '-'} ms | ${race.finish_reason || 'Complete'}`.slice(0, 150), 12, height - 8)
  doc.text(`${page} / ${pages}`, width - 12, height - 8, { align: 'right' })
}

/** Render data independently of the scrolling modal, including every lap. */
export function createRacePdf({ race, rows, language = 'id' } = {}) {
  if (!race) throw new Error('Race data is required')
  const data = reportRows(race, rows)
  if (!data.length) throw new Error('Race results are empty')
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true })
  const title = String(race.name || race.title || 'YurLaps race')
  doc.setProperties({ title: `${title} - race results`, subject: 'Race leaderboard and lap detail', creator: 'YurLaps' })
  const sections = new Map([[1, 'RESULTS']])

  autoTable(doc, {
    ...tableOptions(doc),
    startY: 35,
    head: [['POS', 'CHG', 'DRIVER', 'GAP SUM', 'GAP DELTA', 'LAPS', 'TOTAL', 'BEST LAP', 'TOP3 AVG', 'TOP3 CONSEC', 'P80 AVG', 'CONSISTENCY', 'KM/H']],
    body: data.map((row) => [row.pos, `${row.change == null ? 0 : row.change >= 0 ? '+' : ''}${row.change == null ? 0 : row.change}`, `${row.no || row.pos} · ${row.name}${['DNS', 'DNF'].includes(String(row.result_status || '').toUpperCase()) ? ` ${String(row.result_status).toUpperCase()}` : ''}${row.transponder != null ? `\nTP ${row.transponder}` : ''}`, gapLabel(row.gap_leader), gapLabel(row.gap_previous), row.n_lap, lapTime(row.total_ms), lapTime(row.best_ms), lapTime(row.top3_ms), lapTime(row.consecutive_ms), lapTime(row.p80_ms), percent(row.consistency), speed(row.top_speed_kmh)]),
    columnStyles: { 0: { cellWidth: 10, halign: 'center' }, 1: { cellWidth: 12, halign: 'center' }, 2: { cellWidth: 43 }, 3: { cellWidth: 22 }, 4: { cellWidth: 22 }, 5: { cellWidth: 12, halign: 'center' }, 7: { textColor: BLUE, fontStyle: 'bold' } },
    didParseCell(cell) {
      if (cell.section === 'body' && cell.column.index === 0 && cell.row.index < 3) {
        cell.cell.styles.fillColor = [[255, 242, 203], [231, 236, 241], [249, 226, 207]][cell.row.index]
        cell.cell.styles.fontStyle = 'bold'
      }
    },
  })

  const maxLaps = Math.max(0, ...data.map((row) => row.laps.length))
  if (maxLaps) {
    const groups = []
    for (let start = 0; start < data.length; start += 9) groups.push(data.slice(start, start + 9))
    groups.forEach((group, groupIndex) => {
      if (groupIndex) { doc.addPage(); sections.set(doc.getNumberOfPages(), 'LAP TIMES') }
      const startY = groupIndex ? 35 : doc.lastAutoTable.finalY + 8
      autoTable(doc, { ...tableOptions(doc), startY,
        head: [['LAP', ...group.map((row) => `${row.no || row.pos} ${row.name}`)]],
        body: Array.from({ length: Math.max(...group.map((row) => row.laps.length), 0) }, (_, lap) => [lap + 1, ...group.map((row) => lapTime(row.laps[lap]))]),
        columnStyles: { 0: { cellWidth: 12, fontStyle: 'bold' } },
      })
    })
  }

  // Keep the same report sections as the Windows exporter: progression and
  // lap distribution follow the lap matrix instead of being omitted online.
  const drawProgress = (kind) => {
    doc.addPage(); sections.set(doc.getNumberOfPages(), kind === 'position' ? 'POSITION PROGRESSION' : 'GAP TO LEADER (SECONDS)')
    const series = chartSeries(data, race)
    const values = kind === 'position' ? series.positions : series.gaps
    const maxValue = kind === 'position' ? Math.max(1, data.length) : Math.max(1, ...series.gaps.flat().filter(Number.isFinite))
    const left = 24, top = 56, width = 232, height = 108
    const x = (lap) => left + (lap - 1) / Math.max(1, series.maxLap - 1) * width
    const y = (value) => kind === 'position' ? top + (value - 1) / Math.max(1, maxValue - 1) * height : top + height - value / maxValue * height
    doc.setFontSize(7).setTextColor(...MUTED)
    for (let i = 0; i < 6; i += 1) {
      const tick = kind === 'position' ? 1 + (maxValue - 1) * i / 5 : maxValue * i / 5
      const yy = y(tick)
      doc.setDrawColor(220, 227, 236); doc.setLineWidth(.2); doc.line(left, yy, left + width, yy)
      doc.text(kind === 'position' ? `P${Math.round(tick)}` : `${tick.toFixed(1)}s`, left - 3, yy + 1, { align: 'right' })
    }
    const palette = [[230,90,67],[73,136,219],[25,165,106],[167,105,220],[218,142,32],[36,169,180],[200,80,139],[122,155,43],[101,117,141]]
    data.forEach((row, index) => {
      const color = palette[index % palette.length], points = values[index]
      doc.setDrawColor(...color); doc.setFillColor(...color); doc.setLineWidth(.55)
      for (let lap = 1; lap < points.length; lap += 1) if (points[lap] != null && points[lap - 1] != null) doc.line(x(lap), y(points[lap - 1]), x(lap + 1), y(points[lap]))
      points.forEach((value, lap) => { if (value != null) doc.circle(x(lap + 1), y(value), .7, 'F') })
      doc.setFontSize(7).setTextColor(...color); doc.text((row.nick || row.name || `Driver ${index + 1}`).slice(0, 20), 259, top + 3 + index * 7)
    })
    doc.setFontSize(8).setTextColor(...MUTED); doc.text('Lap', left + width / 2, top + height + 12, { align: 'center' })
  }
  drawProgress('position'); drawProgress('gap')
  const allLaps = data.flatMap((row) => row.laps)
  for (let start = 0; start < data.length; start += 10) {
    doc.addPage(); sections.set(doc.getNumberOfPages(), start ? 'LAP TIME DISTRIBUTION - CONTINUED' : 'LAP TIME DISTRIBUTION (WITH MEDIANS)')
    const low = Math.min(...allLaps), high = Math.max(...allLaps)
    const scale = (value) => 72 + (value - low) / Math.max(1, high - low) * 195
    doc.setFont('helvetica', 'normal').setFontSize(7).setTextColor(...MUTED)
    doc.text('Light: minimum to maximum. Dark: 25th to 75th percentile. Mark: median.', 12, 42)
    for (let i = 0; i < 6; i += 1) {
      const tick = low + (high - low) * i / 5
      doc.setDrawColor(220, 227, 236); doc.setLineDashPattern([1, 2], 0); doc.line(scale(tick), 50, scale(tick), 188)
      doc.setLineDashPattern([], 0); doc.text(`${(tick / 1000).toFixed(2)}s`, scale(tick), 194, { align: 'center' })
    }
    data.slice(start, start + 10).forEach((row, index) => {
      const laps = [...row.laps].sort((a, b) => a - b)
      const yy = 56 + index * 13
      doc.setFontSize(7).setTextColor(...INK); doc.text((row.nick || row.name || `Driver ${start + index + 1}`).slice(0, 24), 12, yy + 2)
      if (!laps.length) return
      const q1 = laps[Math.floor((laps.length - 1) * .25)], q3 = laps[Math.floor((laps.length - 1) * .75)]
      const median = (laps[Math.floor((laps.length - 1) / 2)] + laps[Math.ceil((laps.length - 1) / 2)]) / 2
      doc.setDrawColor(237, 170, 163); doc.setLineWidth(3); doc.line(scale(laps[0]), yy, scale(laps.at(-1)), yy)
      doc.setDrawColor(218, 89, 77); doc.line(scale(q1), yy, scale(q3), yy)
      doc.setDrawColor(...INK); doc.setLineWidth(.7); doc.line(scale(median), yy - 4, scale(median), yy + 4)
    })
  }

  const pageCount = doc.getNumberOfPages()
  for (let page = 1; page <= pageCount; page += 1) { doc.setPage(page); drawHeader(doc, race, data, sections.get(page) || (page === 1 ? 'RESULTS' : 'LAP TIMES'), page, pageCount, language) }
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
