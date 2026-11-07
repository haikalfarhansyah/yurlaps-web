function finite(value) {
  return value == null || value === '' || typeof value === 'boolean' || !Number.isFinite(Number(value)) ? null : Number(value)
}

export function formatActivityLap(ms) {
  const number = finite(ms)
  if (number == null || number < 0) return '—'
  const value = Math.round(number)
  return `${Math.floor(value / 60000)}:${String(Math.floor(value / 1000) % 60).padStart(2, '0')}.${String(value % 1000).padStart(3, '0')}`
}

function timestampOf(value) {
  if (value == null || value === '') return null
  const number = finite(value)
  const parsed = new Date(number == null ? value : number < 1e12 ? number * 1000 : number)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

function lapValue(value) {
  return finite(value && typeof value === 'object' ? value.timeMs ?? value.time_ms ?? value.lap_ms : value)
}

function lapArray(row) {
  return [row?.laps, row?.laps_ms, row?.lap_times, row?.lap_ms].find(Array.isArray)
}

function rowLaps(row, groupId) {
  if (row == null) return []
  if (typeof row !== 'object') {
    const value = lapValue(row)
    return value != null && value > 0 ? [{ timeMs: value, groupId }] : []
  }
  const passings = (Array.isArray(row.passings) ? row.passings : [])
    .filter((p) => !p.origin && p.accepted !== false && p.diterima !== false && lapValue(p) > 0)
  const values = lapArray(row) || (lapValue(row) != null ? [row] : passings)
  return values.map((value, index) => {
    const detail = { ...(passings[index] || {}), ...(typeof value === 'object' ? value : {}) }
    return { ...detail, timeMs: lapValue(value), groupId,
      timestamp: timestampOf(detail.timestamp ?? detail.at),
      speedKmh: finite(detail.speedKmh ?? detail.speed_kmh ?? detail.top_speed_kmh),
      rssi: finite(detail.rssi), hitCount: finite(detail.hit_count ?? detail.hitCount ?? detail.hits),
      durationUs: finite(detail.pass_duration_us ?? detail.dur_us ?? detail.durationUs) }
  }).filter((lap) => lap.timeMs != null && lap.timeMs > 0)
}

function activityRows(item) {
  if (item.type !== 'practice') return item.personal_results || item.results || []
  if (Array.isArray(item.laps)) return item.laps
  return Object.values(item.laps || {}).map((laps) => ({ laps }))
}

export function activityLapDetails(item) {
  const rows = activityRows(item)
  // Flat lap lists are one driver; structured rows can contain several cars.
  const flat = rows.every((row) => typeof row !== 'object' || (!lapArray(row) && !Array.isArray(row?.passings)))
  return rows.flatMap((row, index) => rowLaps(row, flat ? 0 : index))
}

export function activityLaps(item) {
  return activityLapDetails(item).map((lap) => lap.timeMs)
}

export function activityMetrics(item) {
  const laps = activityLapDetails(item)
  const times = laps.map((lap) => lap.timeMs)
  const sorted = [...times].sort((a, b) => a - b)
  const totalMs = times.length ? times.reduce((sum, value) => sum + value, 0) : null
  const mean = times.length ? totalMs / times.length : null
  const sigma = mean == null ? null : Math.sqrt(times.reduce((sum, value) => sum + (value - mean) ** 2, 0) / times.length)
  const consecutive = laps.slice(2).flatMap((lap, index) => laps[index].groupId === lap.groupId
    ? [(times[index] + times[index + 1] + lap.timeMs) / 3] : [])
  const p80Count = Math.ceil(sorted.length * 0.8)
  const rows = activityRows(item)
  const speeds = [...laps.map((lap) => lap.speedKmh), item.summary?.top_speed_kmh,
    ...rows.flatMap((row) => [row?.top_speed_kmh, ...(row?.passings || []).map((p) => p.speed_kmh)])]
    .map(finite).filter((value) => value != null && value > 0)
  return { laps, count: times.length, totalMs, bestMs: sorted[0] ?? null,
    top3Ms: sorted.length >= 3 ? (sorted[0] + sorted[1] + sorted[2]) / 3 : null,
    consecutiveMs: consecutive.length ? Math.min(...consecutive) : null,
    p80Ms: sorted.length ? sorted.slice(0, p80Count).reduce((sum, value) => sum + value, 0) / p80Count : null,
    consistency: mean ? Math.max(0, 1 - sigma / mean) * 100 : null,
    topSpeedKmh: speeds.length ? Math.max(...speeds) : null }
}
