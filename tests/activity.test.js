import test from 'node:test'
import assert from 'node:assert/strict'
import { activityLaps, activityLapDetails, activityMetrics, formatActivityLap } from '../src/lib/activity.js'

test('older practice uploads with lap_ms arrays display all laps', () => {
  const item = { type: 'practice', laps: [{ transponder: 123, lap_ms: [10000, 11000, 9000] }] }
  assert.deepEqual(activityLaps(item), [10000, 11000, 9000])
  const metrics = activityMetrics(item)
  assert.equal(metrics.count, 3)
  assert.equal(metrics.totalMs, 30000)
  assert.equal(metrics.bestMs, 9000)
  assert.equal(metrics.top3Ms, 10000)
  assert.equal(metrics.consecutiveMs, 10000)
  assert.equal(metrics.p80Ms, 10000)
})

test('per-lap decoder details align with accepted laps, skipping the origin', () => {
  const metrics = activityMetrics({ type: 'practice', laps: [{ laps: [10000], passings: [
    { origin: true, at: 100, speed_kmh: 25 },
    { accepted: false, lap_ms: 10, at: 101, speed_kmh: null },
    { origin: false, lap_ms: 10000, at: 110, speed_kmh: 20, rssi: -24.5, hit_count: 8, pass_duration_us: 60000 },
  ] }] })
  assert.equal(metrics.laps[0].timestamp, '1970-01-01T00:01:50.000Z')
  assert.equal(metrics.laps[0].rssi, -24.5)
  assert.equal(metrics.laps[0].speedKmh, 20)
  assert.equal(metrics.laps[0].hitCount, 8)
  assert.equal(metrics.laps[0].durationUs, 60000)
  assert.equal(metrics.topSpeedKmh, 25)
  assert.equal(metrics.consistency, 100)
  assert.equal(metrics.top3Ms, null)
})

test('personal detail only includes saved participant rows and no cross-car consecutive laps', () => {
  const item = { type: 'race', results: [{ laps: [1] }], personal_results: [{ laps: [9000, 10000] }, { laps: [8000] }] }
  assert.deepEqual(activityLaps(item), [9000, 10000, 8000])
  assert.equal(activityMetrics(item).consecutiveMs, null)
})

test('legacy object practice and modern scalar lap records are supported', () => {
  assert.deepEqual(activityLaps({ type: 'practice', laps: { 123: [10000, 11000] } }), [10000, 11000])
  assert.equal(activityLapDetails({ type: 'practice', laps: [{ time_ms: 10000, timestamp: '2026-11-07T10:00:00Z' }] })[0].timestamp, '2026-11-07T10:00:00.000Z')
  assert.deepEqual(activityLaps({ type: 'practice', laps: [null, 0, -1, 'bad', '9000'] }), [9000])
  assert.equal(formatActivityLap(0), '0:00.000')
  assert.equal(formatActivityLap(59999.8), '1:00.000')
  assert.equal(formatActivityLap(null), '—')
})
