// Race rows are immutable snapshots.  A transponder can move to another
// driver later, so personal history must match account IDs saved in the race
// payload rather than looking up today's transponder owner.

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function sessionDrivers(race) {
  const session = asObject(race?.session_data || race?.sessionData)
  return Array.isArray(session.drivers) ? session.drivers : []
}

function accountIds(row) {
  return [row?.user_id, row?.driver_id, row?.userId, row?.member_user_id, row?.account_id, row?.member_id]
    .filter(Boolean).map(String)
}

function rowSnapshot(row, race, index) {
  const drivers = sessionDrivers(race)
  const uid = row?.uid || row?.driver_uid || row?.driverId
  const ids = accountIds(row)
  if (ids.length) {
    const matches = drivers.filter((driver) => accountIds(driver).some((id) => ids.includes(id)))
    return matches.length === 1 ? matches[0] : {}
  }
  if (uid) {
    const match = drivers.find((driver) => [driver.uid, driver.driver_uid, driver.driverId].filter(Boolean).map(String).includes(String(uid)))
    return match || {}
  }
  const position = row?.pos ?? row?.position
  if (position != null) {
    const matches = drivers.filter((driver) => Number(driver.pos ?? driver.position) === Number(position))
    if (matches.length === 1) return matches[0]
  }
  // Older desktop payloads keep results and session drivers in the same
  // order. Only use that pairing when neither entry has a position or UID.
  const candidate = drivers[index]
  if (!uid && position == null && candidate && candidate.pos == null && candidate.position == null
      && drivers.length === race?.results?.length) return candidate
  return {}
}

export function normalizeRaceRow(row, race, index = 0) {
  const source = asObject(row)
  const snapshot = rowSnapshot(source, race, index)
  const laps = Array.isArray(source.laps)
    ? source.laps
    : (Array.isArray(source.laps_ms) ? source.laps_ms : (Array.isArray(source.lap_times) ? source.lap_times : []))
  const accountId = source.user_id || source.driver_id || source.userId || source.member_user_id || source.account_id || source.member_id
    || snapshot.user_id || snapshot.driver_id || snapshot.userId || snapshot.member_id || snapshot.account_id || null
  return {
    ...source,
    laps,
    // Uploads from the desktop historically used driver/nickname/position.
    // Normalize those aliases once so every report renders the same snapshot.
    name: source.name || source.driver_name || source.driver || snapshot.name || snapshot.driver || '',
    nick: source.nick || source.nickname || snapshot.nick || snapshot.nickname || '',
    pos: source.pos ?? source.position ?? snapshot.pos ?? snapshot.position ?? index + 1,
    n_lap: source.n_lap ?? source.total_laps ?? source.lap_count ?? laps.length,
    total_ms: source.total_ms ?? source.total_time_ms ?? null,
    user_id: accountId,
    driver_id: source.driver_id || source.driverId || source.member_id || snapshot.driver_id || snapshot.member_id || null,
    transponder: source.transponder ?? source.transponder_id ?? snapshot.transponder ?? null,
  }
}

export function normalizeRace(race) {
  if (!race) return race
  const results = Array.isArray(race.results)
    ? race.results.map((row, index) => normalizeRaceRow(row, race, index))
    : []
  return { ...race, results }
}

export function normalizeRaceRows(race) {
  return Array.isArray(race?.results)
    ? race.results.map((row, index) => normalizeRaceRow(row, race, index))
    : []
}

export function raceRowBelongsTo(row, userId) {
  if (!row || !userId) return false
  const target = String(userId)
  return accountIds(row).includes(target)
}

