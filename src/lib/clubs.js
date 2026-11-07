import { supabase } from './supabase'
import { getFriendlyError } from './account'
import { normalizeRace, raceRowBelongsTo } from './raceIdentity'

export const PERMISSION_KEYS = [
  'edit_club',
  'manage_members',
  'review_applications',
  'manage_tracks',
  'manage_races',
]

export const DEFAULT_ROLE_PERMISSIONS = {
  co_leader: {
    edit_club: false,
    manage_members: true,
    review_applications: true,
    manage_tracks: true,
    manage_races: true,
  },
  officer: {
    edit_club: false,
    manage_members: false,
    review_applications: true,
    manage_tracks: false,
    manage_races: false,
  },
}

const messages = {
  en: {
    setup:
      'The community feature is not set up yet. Run supabase/community.sql in the Supabase SQL Editor.',
    invalidCode: 'The join code is not valid. Check the 8-digit code and try again.',
    notAuthenticated: 'Please log in to continue.',
    leaderOnly: 'Only the club leader can do that.',
    notAllowed: 'You do not have permission to do that.',
    invalidRole: 'That role is not valid.',
    generic: 'Something went wrong. Please try again.',
  },
  id: {
    setup:
      'Fitur community belum aktif. Jalankan supabase/community.sql di Supabase SQL Editor.',
    invalidCode: 'Kode join tidak valid. Periksa 8 digit kode lalu coba lagi.',
    notAuthenticated: 'Silakan login untuk melanjutkan.',
    leaderOnly: 'Hanya leader club yang dapat melakukan itu.',
    notAllowed: 'Kamu tidak punya izin untuk melakukan itu.',
    invalidRole: 'Role tersebut tidak valid.',
    generic: 'Terjadi kesalahan. Coba lagi.',
  },
}

export function clubError(error, language = 'en') {
  const text = messages[language] || messages.en
  const message = error?.message || ''
  if (/invalid join code/i.test(message)) return text.invalidCode
  if (/not authenticated/i.test(message)) return text.notAuthenticated
  if (/only the leader/i.test(message)) return text.leaderOnly
  if (/not allowed/i.test(message)) return text.notAllowed
  if (/invalid role/i.test(message)) return text.invalidRole
  if (
    error?.code === '42P01' ||
    error?.code === 'PGRST202' ||
    /schema cache|could not find the function|function .* does not exist|relation .* does not exist/i.test(
      message,
    )
  ) {
    return text.setup
  }
  return getFriendlyError(error, language) || text.generic
}

export function resolveRolePermissions(club) {
  return {
    co_leader: {
      ...DEFAULT_ROLE_PERMISSIONS.co_leader,
      ...(club?.role_permissions?.co_leader || {}),
    },
    officer: {
      ...DEFAULT_ROLE_PERMISSIONS.officer,
      ...(club?.role_permissions?.officer || {}),
    },
  }
}

export function hasPermission(club, role, permission) {
  if (!role) return false
  if (role === 'leader') return true
  return resolveRolePermissions(club)[role]?.[permission] === true
}

function requireClient() {
  if (!supabase) throw new Error('Supabase is not configured.')
  return supabase
}

export async function listPublicClubs() {
  const client = requireClient()
  const { data, error } = await client.rpc('list_public_clubs')
  if (error) throw error
  return data || []
}

export async function fetchMyMemberships(userId) {
  const client = requireClient()
  const { data, error } = await client
    .from('club_members')
    .select('club_id, role, status, joined_at')
    .eq('user_id', userId)
    .order('joined_at', { ascending: true })
  if (error) throw error
  return data || []
}

export async function fetchClub(clubId) {
  const client = requireClient()
  const { data, error } = await client.from('clubs').select('*').eq('id', clubId).single()
  if (error) throw error
  return data
}

export async function fetchClubsByIds(clubIds) {
  if (!clubIds.length) return []
  const client = requireClient()
  const { data, error } = await client.from('clubs').select('*').in('id', clubIds)
  if (error) throw error
  return data || []
}

export async function createClub(user, values) {
  const client = requireClient()
  const name = values.name.trim()
  if (!name) throw new Error('Club name is required')
  const { data, error } = await client
    .from('clubs')
    .insert({
      owner_id: user.id,
      name,
      description: values.description.trim(),
      address: values.address.trim(),
      visibility: values.visibility,
      join_method: values.join_method,
    })
    .select('id')
    .single()
  if (error) throw error
  return data.id
}

export async function joinClub(clubId) {
  const client = requireClient()
  const { data, error } = await client.rpc('join_club', {
    p_club_id: clubId,
    p_code: null,
  })
  if (error) throw error
  return data
}

export async function joinClubByCode(code) {
  const client = requireClient()
  const { data, error } = await client.rpc('join_club_by_code', { p_code: code.trim() })
  if (error) throw error
  return data?.[0] || null
}

export async function fetchClubMembers(clubId) {
  const client = requireClient()
  const { data: rows, error } = await client
    .from('club_members')
    .select('user_id, role, status, joined_at')
    .eq('club_id', clubId)
    .order('joined_at', { ascending: true })
  if (error) throw error

  const members = rows || []
  const userIds = [...new Set(members.map((member) => member.user_id))]
  if (!userIds.length) {
    return { members: [], profiles: {}, transponders: {} }
  }

  const [profileResult, transponderResult] = await Promise.all([
    client
      .from('profiles')
      .select('id, full_name, nickname, avatar_url, tts_name')
      .in('id', userIds),
    client
      .from('transponders')
      .select('id, user_id, transponder_id, rc_class, rc_brand')
      .in('user_id', userIds),
  ])
  if (profileResult.error) throw profileResult.error
  if (transponderResult.error) throw transponderResult.error

  const profiles = Object.fromEntries(
    (profileResult.data || []).map((profile) => [profile.id, profile]),
  )
  const transponders = {}
  for (const transponder of transponderResult.data || []) {
    if (!transponders[transponder.user_id]) transponders[transponder.user_id] = []
    transponders[transponder.user_id].push(transponder)
  }

  return { members, profiles, transponders }
}

export async function updateClubProfile(clubId, values) {
  const client = requireClient()
  const { error } = await client.rpc('update_club_profile', {
    p_club_id: clubId,
    p_name: values.name,
    p_description: values.description,
    p_address: values.address,
  })
  if (error) throw error
  if (values.avatar_url !== undefined) {
    const { error: avatarError } = await client.from('clubs').update({ avatar_url: values.avatar_url || null }).eq('id', clubId)
    if (avatarError) throw avatarError
  }
  return fetchClub(clubId)
}

export async function updateClubSettings(clubId, values) {
  const client = requireClient()
  const { error } = await client.rpc('update_club_settings', {
    p_club_id: clubId,
    p_visibility: values.visibility,
    p_join_method: values.join_method,
    p_role_permissions: values.role_permissions,
  })
  if (error) throw error
}

export async function regenerateJoinCode(clubId) {
  const client = requireClient()
  const { data, error } = await client.rpc('regenerate_join_code', { p_club_id: clubId })
  if (error) throw error
  return data
}

export async function reviewJoinRequest(clubId, userId, approve) {
  const client = requireClient()
  const { error } = await client.rpc('review_join_request', {
    p_club_id: clubId,
    p_user_id: userId,
    p_approve: approve,
  })
  if (error) throw error
}

export async function updateMemberRole(clubId, userId, role) {
  const client = requireClient()
  const { error } = await client.rpc('update_member_role', {
    p_club_id: clubId,
    p_user_id: userId,
    p_role: role,
  })
  if (error) throw error
}

export async function removeClubMember(clubId, userId) {
  const client = requireClient()
  const { error } = await client.rpc('remove_club_member', {
    p_club_id: clubId,
    p_user_id: userId,
  })
  if (error) throw error
}

export async function fetchClubTracks(clubId) {
  const client = requireClient()
  const { data, error } = await client
    .from('club_tracks')
    .select('*')
    .eq('club_id', clubId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data || []
}

export async function fetchPracticeSessions(userId, { clubId } = {}) {
  const client = requireClient()
  const sessions = []
  for (let offset = 0; ; offset += 500) {
    let query = client.from('practice_sessions').select('*').order('started_at', { ascending: false }).order('id').range(offset, offset + 499)
    if (userId) query = query.eq('user_id', userId)
    if (clubId) query = query.eq('club_id', clubId)
    const { data, error } = await query
    if (error) throw error
    sessions.push(...(data || []))
    if (!data || data.length < 500) return sessions
  }
}

// Build a driver-centric race history from club race snapshots. Race rows are
// uploaded by the club leader, so filtering only by created_by would hide a
// member's own participation.
export async function fetchPersonalRaces(userId) {
  const client = requireClient()
  if (!userId) return []
  const races = []
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await client.rpc('list_personal_races', { p_limit: 500, p_offset: offset })
    if (error) throw error
    races.push(...(data || []))
    if (!data || data.length < 500) break
  }
  return races.map((rawRace) => {
    const race = normalizeRace(rawRace)
    const rows = Array.isArray(race.results) ? race.results : []
    // Race rows contain immutable account/member identity snapshots. Do not
    // match today's transponder owner: a transponder may change hands later.
    const personalResults = rows.filter((row) => raceRowBelongsTo(row, userId))
    if (!personalResults.length) return null
    return { ...race, personal_results: personalResults }
  }).filter(Boolean).sort((a, b) => new Date(b.raced_at || 0) - new Date(a.raced_at || 0))
}

export async function updatePracticeVisibility(id, visibility) {
  const client = requireClient()
  const { data, error } = await client.from('practice_sessions').update({ visibility }).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function addClubTrack(clubId, userId, values) {
  const client = requireClient()
  const { data, error } = await client
    .from('club_tracks')
    .insert({
      club_id: clubId,
      name: values.name.trim(),
      address: values.address.trim(),
      created_by: userId,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteClubTrack(trackId) {
  const client = requireClient()
  const { error } = await client.from('club_tracks').update({ deleted_at: new Date().toISOString() }).eq('id', trackId)
  if (error) throw error
}

export async function fetchClubRaces(clubId) {
  const client = requireClient()
  const { data, error } = await client
    .from('races')
    .select('*')
    .eq('club_id', clubId)
    .order('raced_at', { ascending: false })
  if (error) throw error
  return (data || []).map(normalizeRace)
}

// Public club pages use the anonymous Supabase client. The RLS migration
// limits these reads to non-archived tracks and races belonging to public clubs.
export async function fetchPublicClubData(clubId) {
  const client = requireClient()
  const [clubResult, trackResult, raceResult] = await Promise.all([
    client.rpc('list_public_clubs'),
    client.from('club_tracks').select('*').eq('club_id', clubId).is('deleted_at', null).order('name'),
    client.from('races').select('*').eq('club_id', clubId).order('raced_at', { ascending: false }),
  ])
  if (clubResult.error) throw clubResult.error
  if (trackResult.error) throw trackResult.error
  if (raceResult.error) throw raceResult.error
  const club = (clubResult.data || []).find((item) => item.id === clubId)
  if (!club) return null
  return {
    club,
    tracks: trackResult.data || [],
    races: (raceResult.data || []).map(normalizeRace),
  }
}
