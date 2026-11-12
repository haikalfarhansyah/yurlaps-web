import test from 'node:test'
import assert from 'node:assert/strict'
import { scheduleClock, scheduleDrivers, scheduleDuration, scheduleOrderLabel, scheduleRows, scheduleSummary } from '../src/lib/schedule.js'

test('schedule rows come from the shared event document', () => {
  assert.deepEqual(scheduleRows({ schedule: [{ stage_id: 'a' }] }), [{ stage_id: 'a' }])
  assert.deepEqual(scheduleRows({}), [])
  assert.deepEqual(scheduleRows(null), [])
})

test('clock and duration stay readable when the start time is missing', () => {
  assert.equal(scheduleClock(null), '—')
  assert.equal(scheduleClock('abc'), '—')
  assert.equal(scheduleDuration(0), '—')
  assert.equal(scheduleDuration(120000), '2 mnt')
  assert.equal(scheduleDuration(90000), '2 mnt')
})

test('driver list prefers nick and skips empty names', () => {
  assert.equal(scheduleDrivers({ drivers: [{ nick: 'D0', name: 'Driver 0' }, { name: 'Driver 1' }] }), 'D0, Driver 1')
  assert.equal(scheduleDrivers({}), '')
})

test('summary counts sessions and finds the event window', () => {
  const rows = [
    { start_ms: 1000000, duration_ms: 60000, status: 'saved' },
    { start_ms: 1060000, duration_ms: 60000, status: 'planned' },
  ]
  const summary = scheduleSummary(rows)
  assert.equal(summary.sessions, 2)
  assert.equal(summary.saved, 1)
  assert.equal(summary.live, 0)
  assert.equal(summary.start, 1000000)
  assert.equal(summary.end, 1120000)
})

test('summary stays empty when the event has no clock yet', () => {
  const summary = scheduleSummary([{ start_ms: null, duration_ms: 0, status: 'planned' }])
  assert.equal(summary.sessions, 1)
  assert.equal(summary.start, null)
  assert.equal(summary.end, null)
})

test('order label follows the schedule scheme', () => {
  assert.equal(scheduleOrderLabel({ schedule_scheme: { type: 'rounds' } }), 'Per ronde (semua kelas bersama)')
  assert.equal(scheduleOrderLabel({ schedule_scheme: { type: 'sequential' } }), 'Satu per satu (kelas demi kelas)')
  assert.equal(scheduleOrderLabel({}), 'Satu per satu (kelas demi kelas)')
})
