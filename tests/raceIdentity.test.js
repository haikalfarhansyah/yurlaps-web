import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeRace, raceRowBelongsTo } from '../src/lib/raceIdentity.js'

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

