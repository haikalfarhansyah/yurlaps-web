const num = (value) => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)) ? Number(value) : null

export function chartSeries(rows, race) {
  const config = race?.cfg || race?.session_data?.configuration || {}
  const grid = config.start_mode === 'grid' && config.rank === 'position'
  const crossings = rows.map((row) => (row.passings || []).filter((passing) => passing && !passing.origin && passing.accepted !== false && passing.diterima !== false && passing.lap_ms != null && passing.decoder_timecode != null).map((passing) => num(passing.decoder_timecode)))
  const sharedClock = grid && rows.every((row, index) => crossings[index].length === row.laps.length && crossings[index].every((value) => value !== null))
  const times = rows.map((row, index) => row.laps.map((_, lapIndex) => sharedClock
    ? crossings[index][lapIndex]
    : row.laps.slice(0, lapIndex + 1).reduce((sum, value) => sum + value, 0)))
  const positions = rows.map(() => [])
  const gaps = rows.map(() => [])
  const maxLap = Math.max(0, ...rows.map((row) => row.laps.length))
  for (let lap = 0; lap < maxLap; lap += 1) {
    const order = times.map((row, index) => row[lap] == null ? null : { index, time: row[lap] }).filter(Boolean).sort((a, b) => a.time - b.time)
    order.forEach((entry, position) => { positions[entry.index][lap] = position + 1; gaps[entry.index][lap] = (entry.time - order[0].time) / 1000 })
  }
  return { positions, gaps, maxLap, sharedClock }
}

