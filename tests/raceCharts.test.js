import test from 'node:test'
import assert from 'node:assert/strict'
import { chartSeries } from '../src/lib/raceCharts.js'

test('position and gap follow each completed lap rather than final rank', () => {
  const rows = [
    { name: 'A', laps: [30000, 25000], passings: [] },
    { name: 'B', laps: [28000, 30000], passings: [] },
  ]
  const chart = chartSeries(rows, { cfg: { rank: 'result' } })
  assert.deepEqual(chart.positions, [[2, 1], [1, 2]])
  assert.deepEqual(chart.gaps, [[2, 0], [0, 3]])
})

test('grid position uses shared decoder time when all crossings exist', () => {
  const rows = [
    { laps: [30000], passings: [{ lap_ms: 30000, decoder_timecode: 150000 }] },
    { laps: [28000], passings: [{ lap_ms: 28000, decoder_timecode: 151000 }] },
  ]
  const chart = chartSeries(rows, { cfg: { start_mode: 'grid', rank: 'position' } })
  assert.equal(chart.sharedClock, true)
  assert.deepEqual(chart.positions, [[1], [2]])
  assert.deepEqual(chart.gaps, [[0], [1]])
})
