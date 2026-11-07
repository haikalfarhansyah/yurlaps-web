import test from 'node:test'
import assert from 'node:assert/strict'
import { isRaceRecordEligible, normalizeRace, raceRowBelongsTo } from '../src/lib/raceIdentity.js'

test('normalizes desktop driver aliases and keeps account identity', () => {
  const userId = '11111111-1111-4111-8111-111111111111'
  const race = normalizeRace({
    results: [{ position: 1, driver: 'Sari', nickname: 'Sar', transponder: 7, total_laps: 3 }],
    session_data: { drivers: [{ position: 1, member_id: userId, name: 'Sari' }] },
  })
  assert.equal(race.results[0].name, 'Sari')
  assert.equal(race.results[0].nick, 'Sar')
  assert.equal(race.results[0].pos, 1)
  assert.equal(race.results[0].n_lap, 3)
  assert.equal(race.results[0].user_id, userId)
  assert.equal(raceRowBelongsTo(race.results[0], userId), true)
})

test('does not identify a personal race from a current transponder owner', () => {
  const race = normalizeRace({
    results: [{ driver: 'Old owner', transponder: 7 }],
    session_data: { drivers: [{ pos: 3, transponder: 7, member_id: 'new-owner' }] },
  })
  assert.equal(raceRowBelongsTo(race.results[0], '11111111-1111-4111-8111-111111111111'), false)
  assert.equal(raceRowBelongsTo(race.results[0], 'new-owner'), false)
})

test('exact driver and account IDs win over conflicting positions in reordered snapshots', () => {
  const race = normalizeRace({
    results: [
      { uid: 'driver-b', position: 1, laps_ms: [2000, 2100] },
      { user_id: 'account-a', position: 2 },
    ],
    session_data: { drivers: [
      { uid: 'driver-a', pos: 1, member_id: 'account-a', name: 'Alice' },
      { uid: 'driver-b', pos: 2, member_id: 'account-b', name: 'Budi' },
    ] },
  })
  assert.equal(race.results[0].name, 'Budi')
  assert.equal(race.results[0].user_id, 'account-b')
  assert.deepEqual(race.results[0].laps, [2000, 2100])
  assert.equal(race.results[1].name, 'Alice')
  assert.equal(race.results[1].user_id, 'account-a')
})

test('unmatched explicit account identity is never replaced by a positional match', () => {
  const race = normalizeRace({
    results: [{ user_id: 'original-owner', position: 1, name: 'Original name' }],
    session_data: { drivers: [{ pos: 1, member_id: 'other-owner', nick: 'Other name' }] },
  })
  assert.equal(race.results[0].name, 'Original name')
  assert.equal(race.results[0].nick, '')
  assert.equal(raceRowBelongsTo(race.results[0], 'other-owner'), false)
})

test('fills missing lap and passing data from the same immutable driver snapshot', () => {
  const race = normalizeRace({
    results: [{ uid: 'car-b', user_id: 'account', name: 'Driver 1', position: 1 }],
    session_data: { track_id: 'track-a', timing_interrupted: true, drivers: [
      { uid: 'car-a', user_id: 'account', name: 'Different car', laps: [8000] },
      { uid: 'car-b', user_id: 'account', name: 'Original name', laps: [10000],
        total_ms: 10000, passings: [{ lap_ms: 10000, rssi: -20, speed_kmh: 20 }] },
    ] },
  })
  assert.equal(race.results[0].name, 'Original name')
  assert.deepEqual(race.results[0].laps, [10000])
  assert.equal(race.results[0].total_ms, 10000)
  assert.equal(race.results[0].passings[0].rssi, -20)
  assert.equal(race.track_id, 'track-a')
  assert.equal(isRaceRecordEligible(race), false)
})

test('practice and interrupted results never enter track records', () => {
  assert.equal(isRaceRecordEligible({ session_data: { timing_interrupted: 'true' } }), false)
  assert.equal(isRaceRecordEligible({ type: 'practice' }), false)
  assert.equal(isRaceRecordEligible({ session_data: { timing_interrupted: false } }), true)
})

test('legacy session-only result has its original participant identity', () => {
  const race = normalizeRace({ session_data: { drivers: [{ member_id: 'original', name: 'Irul', laps_ms: [10000] }] } })
  assert.equal(race.results.length, 1)
  assert.equal(raceRowBelongsTo(race.results[0], 'original'), true)
  assert.deepEqual(race.results[0].laps, [10000])
})

