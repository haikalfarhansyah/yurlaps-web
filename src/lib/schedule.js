// Helper jadwal event untuk website: barisan sesi, jam mulai, dan ringkasan.

export const SCHEDULE_KINDS = {
  qualifying: 'Kualifikasi', heat: 'Heat', main: 'Main', final: 'Final', practice: 'Practice',
}

export const SCHEDULE_STATUS = {
  planned: 'Terjadwal', live: 'Berjalan', saved: 'Selesai',
}

export function scheduleRows(document) {
  const rows = document?.schedule
  return Array.isArray(rows) ? rows : []
}

export function scheduleClock(ms, language = 'id') {
  if (ms == null || !Number.isFinite(Number(ms))) return '—'
  const date = new Date(Number(ms))
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleTimeString(language === 'id' ? 'id-ID' : 'en-US', { hour: '2-digit', minute: '2-digit' })
}

export function scheduleDuration(ms) {
  const value = Number(ms)
  if (!Number.isFinite(value) || value <= 0) return '—'
  return `${Math.round(value / 60000)} mnt`
}

export function scheduleDrivers(row) {
  const drivers = Array.isArray(row?.drivers) ? row.drivers : []
  return drivers.map((driver) => driver?.nick || driver?.name).filter(Boolean).join(', ')
}

export function scheduleSummary(rows) {
  const list = Array.isArray(rows) ? rows : []
  const starts = list.map((row) => Number(row?.start_ms)).filter((value) => Number.isFinite(value) && value > 0)
  const last = list.length ? list[list.length - 1] : null
  const lastStart = Number(last?.start_ms)
  const end = Number.isFinite(lastStart) && lastStart > 0 ? lastStart + Number(last?.duration_ms || 0) : null
  return {
    sessions: list.length,
    saved: list.filter((row) => row?.status === 'saved').length,
    live: list.filter((row) => row?.status === 'live').length,
    start: starts.length ? Math.min(...starts) : null,
    end,
  }
}

export function scheduleOrderLabel(document) {
  return document?.schedule_scheme?.type === 'rounds'
    ? 'Per ronde (semua kelas bersama)'
    : 'Satu per satu (kelas demi kelas)'
}
