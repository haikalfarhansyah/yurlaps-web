import { supabase } from './supabase'

function client() {
  if (!supabase) throw new Error('Supabase belum dikonfigurasi.')
  return supabase
}

export function eventError(error) {
  const code = String(error?.code || '')
  const message = String(error?.message || '')
  if (['PGRST202', '42P01', '42883'].includes(code) || /save_club_event|club_events|list_visible_club_events/i.test(message) && /not found|does not exist|schema cache/i.test(message)) {
    return 'Database Event belum dipasang. Jalankan supabase/migrations/20261112090000_club_events.sql di Supabase SQL Editor, lalu muat ulang halaman.'
  }
  if (code === '42501' || /active club leader required/i.test(message)) return 'Hanya leader club yang sedang login dapat membuat atau mengubah Event.'
  return message || 'Event belum dapat dimuat. Coba lagi.'
}

export async function fetchClubEvents(clubId, { publicView = false } = {}) {
  if (publicView) {
    const { data, error } = await client().rpc('list_visible_club_events', { p_club_id: clubId })
    if (error) throw error
    return data || []
  }
  const { data, error } = await client().from('club_events')
    .select('id,club_id,document,revision,updated_at')
    .eq('club_id', clubId).order('updated_at', { ascending: false })
  if (error) throw error
  return (data || []).map((row) => ({ ...row.document, remote_revision: row.revision }))
}

export async function saveClubEvent(document, baseRevision = 0) {
  const { data, error } = await client().rpc('save_club_event', {
    p_club_id: document.club_id,
    p_event_id: document.id,
    p_base_revision: baseRevision,
    p_document: document,
  })
  if (error) throw error
  if (data?.conflict) throw new Error('Event berubah di perangkat lain. Muat ulang sebelum menyimpan.')
  if (data?.record?.id !== document.id) throw new Error('Server belum mengonfirmasi Event.')
  return { ...data.record.document, remote_revision: data.record.revision }
}

export async function applyClubEvent(eventId, classId, transponder) {
  const { data, error } = await client().rpc('apply_club_event', {
    p_event_id: eventId, p_class_id: classId, p_transponder: String(transponder),
  })
  if (error) throw error
  return data
}

export async function myEventTransponders(userId) {
  if (!userId) return []
  const { data, error } = await client().from('transponders')
    .select('transponder_id,rc_class,rc_brand').eq('user_id', userId)
  if (error) throw error
  return data || []
}

export function newClubEvent({ clubId, name, date, track, format, classes, bestLegs, points }) {
  if (!clubId || !track?.id || !name?.trim() || !classes?.length) throw new Error('Lengkapi nama, track, dan kelas Event.')
  if (new Set(classes.map((item) => item.trim().toLocaleLowerCase())).size !== classes.length) throw new Error('Nama kelas tidak boleh sama.')
  const id = crypto.randomUUID()
  return {
    id, club_id: clubId, name: name.trim(), date,
    track_id: track.id, track_name: track.name, status: 'draft',
    format: format === 'heat_final' ? 'heat_final' : 'qualifying_main',
    best_legs: Math.max(1, Math.min(10, Number(bestLegs) || 1)),
    points_table: points,
    classes: classes.map((value) => ({ id: crypto.randomUUID(), name: value.trim() })),
    entries: [], stages: [], created_at: Date.now() / 1000, revision: 1,
  }
}
