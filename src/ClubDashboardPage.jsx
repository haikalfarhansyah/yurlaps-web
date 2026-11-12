import { useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  Building2,
  Check,
  Copy,
  Download,
  Flag,
  KeyRound,
  Loader2,
  LogOut,
  MapPin,
  RefreshCw,
  Settings,
  Shield,
  Trash2,
  Trophy,
  Users,
  X,
} from 'lucide-react'
import { openRacePdfReport } from './lib/racePdf'
import RaceResultView from './RaceResultView'
import ClubEventsPage from './ClubEventsPage'
import { isRaceRecordEligible, normalizeRace } from './lib/raceIdentity'
import {
  clubError,
  fetchClub,
  fetchClubMembers,
  fetchClubRaces,
  fetchClubTracks,
  fetchClubsByIds,
  fetchMyMemberships,
  leaveClub,
  hasPermission,
  regenerateJoinCode,
  removeClubMember,
  resolveRolePermissions,
  reviewJoinRequest,
  updateClubProfile,
  updateClubSettings,
  updateMemberRole,
} from './lib/clubs'

const copy = {
  en: {
    kicker: 'Club dashboard',
    back: 'Community',
    signOut: 'Sign out',
    switchClub: 'Switch club',
    tabs: {
      home: 'Home',
      race: 'Race',
      event: 'Event',
      member: 'Member',
      track: 'Track',
      setting: 'Setting',
    },
    roles: {
      leader: 'Leader',
      co_leader: 'Co-leader',
      officer: 'Officer',
      member: 'Member',
    },
    loading: 'Loading club...',
    noClub: 'You are not in a club yet.',
    noClubHint: 'Create a club or join one from the community page.',
    explore: 'Explore community',
    pendingClub: 'Waiting for approval',
    pendingHint: 'Your join request is being reviewed by the club leader or officers.',
    notMember: 'You do not have access to this club.',
    homeTitle: 'Club identity',
    homeSubtitle: 'The public identity of your club inside YurLaps.',
    name: 'Club name',
    description: 'Description',
    address: 'Address',
    members: 'members',
    tracks: 'tracks',
    save: 'Save changes',
    saving: 'Saving...',
    saved: 'Club identity saved.',
    noDescription: 'No description yet.',
    noAddress: 'No address yet.',
    raceTitle: 'Race results',
    raceSubtitle: 'Saved desktop race results appear here after synchronization.',
    raceEmpty: 'No race results yet.',
    raceEmptyHint: 'Race data from the YurLaps app and web will be integrated here.',
    filterTrack: 'Filter by track', filterFrom: 'From', filterTo: 'To', newest: 'Newest', oldest: 'Oldest',
    records: 'Race best laps', archived: 'Archived', appOnlyTrack: 'Tracks are created, edited, and archived from the YurLaps Windows app.',
    lapMatrix: 'Lap times', positionChart: 'Position progression', gapChart: 'Gap to leader', distribution: 'Lap time distribution',
    driver: 'Driver', pos: 'POS', change: 'CHG', gap: 'GAP', laps: 'LAPS', total: 'TOTAL', bestLap: 'BEST LAP', top3: 'TOP3 AVG', top3Consecutive: 'TOP3 CONSECUTIVE', p80: 'P80 AVG', consistency: 'CONSISTENCY', topSpeed: 'TOP SPEED', median: 'Median',
    raceDate: 'Race date',
    trackName: 'Track',
    location: 'Location',
    entries: 'entries',
    viewResults: 'View results',
    exportCsv: 'Export CSV', exportPdf: 'Export PDF',
    close: 'Close',
    results: 'Results',
    noResults: 'No result rows for this race.',
    memberTitle: 'Members',
    memberSubtitle: 'Drivers, roles, and the transponders they race with.',
    pendingTitle: 'Join requests',
    approve: 'Approve',
    reject: 'Reject',
    role: 'Role',
    remove: 'Remove',
    removeConfirm: 'Remove this member from the club?',
    transponders: 'Transponders',
    noTransponders: 'No transponders yet.',
    noMembers: 'No active members yet.',
    trackTitle: 'Tracks',
    trackSubtitle: 'Read-only track catalog. Track changes are managed from the YurLaps Windows app.',
    addTrack: 'Add track',
    trackFormName: 'Track name',
    trackFormAddress: 'Track address',
    add: 'Add',
    adding: 'Adding...',
    trackEmpty: 'No tracks yet.',
    deleteTrackConfirm: 'Delete this track?',
    settingTitle: 'Club settings',
    settingSubtitle: 'Privacy, join method, and permissions for co-leaders and officers.',
    visibility: 'Privacy',
    visibilityPublic: 'Public — shown in the community list',
    visibilityPrivate: 'Private — join with the 8-digit code',
    joinMethod: 'Apply method',
    joinOpen: 'Open — members join instantly',
    joinApproval: 'Approval — leader or officers approve requests',
    joinCode: 'Join code',
    joinCodeHint: 'Share this 8-digit code with drivers you want to invite.',
    copy: 'Copy',
    copied: 'Copied',
    regenerate: 'Regenerate',
    regenerating: 'Regenerating...',
    permissionsTitle: 'Role permissions',
    permissionsHint: 'The leader always has every permission. These toggles only affect co-leaders and officers.',
    permissionLabels: {
      edit_club: 'Edit club identity',
      manage_members: 'Manage members and roles',
      review_applications: 'Review join requests',
      manage_tracks: 'Manage tracks',
      manage_races: 'Manage race results',
    },
    settingSaved: 'Club settings saved.',
    formRequired: 'Fill in all required fields.',
    trackRequired: 'Enter the track name.',
    forbidden: 'Only the leader can open club settings.',
  },
  id: {
    kicker: 'Dashboard club',
    back: 'Community',
    signOut: 'Keluar',
    switchClub: 'Ganti club',
    tabs: {
      home: 'Home',
      race: 'Race',
      event: 'Event',
      member: 'Member',
      track: 'Track',
      setting: 'Setting',
    },
    roles: {
      leader: 'Leader',
      co_leader: 'Co-leader',
      officer: 'Officer',
      member: 'Member',
    },
    loading: 'Memuat club...',
    noClub: 'Kamu belum tergabung di club mana pun.',
    noClubHint: 'Buat club atau join salah satu club dari halaman community.',
    explore: 'Jelajahi community',
    pendingClub: 'Menunggu approval',
    pendingHint: 'Permintaan join kamu sedang ditinjau oleh leader atau officer club.',
    notMember: 'Kamu tidak punya akses ke club ini.',
    homeTitle: 'Identitas club',
    homeSubtitle: 'Identitas publik club kamu di dalam YurLaps.',
    name: 'Nama club',
    description: 'Deskripsi',
    address: 'Alamat',
    members: 'member',
    tracks: 'track',
    save: 'Simpan perubahan',
    saving: 'Menyimpan...',
    saved: 'Identitas club berhasil disimpan.',
    noDescription: 'Belum ada deskripsi.',
    noAddress: 'Belum ada alamat.',
    raceTitle: 'Hasil race',
    raceSubtitle: 'Hasil race tersimpan dari aplikasi YurLaps muncul di sini setelah sinkronisasi.',
    raceEmpty: 'Belum ada hasil race.',
    raceEmptyHint: 'Simpan race di aplikasi YurLaps menggunakan akun leader club ini.',
    filterTrack: 'Filter track', filterFrom: 'Dari', filterTo: 'Sampai', newest: 'Terbaru', oldest: 'Terlama',
    records: 'Best lap race', archived: 'Diarsipkan', appOnlyTrack: 'Track dibuat, diubah, dan diarsipkan dari aplikasi YurLaps Windows.',
    lapMatrix: 'Waktu lap', positionChart: 'Pergerakan posisi', gapChart: 'Gap ke leader', distribution: 'Distribusi waktu lap',
    driver: 'Pembalap', pos: 'POS', change: 'CHG', gap: 'GAP', laps: 'LAP', total: 'TOTAL', bestLap: 'BEST LAP', top3: 'RATA2 TOP3', top3Consecutive: 'TOP3 BERURUTAN', p80: 'RATA2 P80', consistency: 'KONSISTENSI', topSpeed: 'TOP SPEED', median: 'Median',
    raceDate: 'Tanggal race',
    trackName: 'Track',
    location: 'Lokasi',
    entries: 'entri',
    viewResults: 'Lihat hasil',
    exportCsv: 'Export CSV', exportPdf: 'Export PDF',
    close: 'Tutup',
    results: 'Hasil',
    noResults: 'Belum ada baris hasil untuk race ini.',
    memberTitle: 'Member',
    memberSubtitle: 'Driver, role, dan transponder yang mereka gunakan.',
    pendingTitle: 'Permintaan join',
    approve: 'Setujui',
    reject: 'Tolak',
    role: 'Role',
    remove: 'Hapus',
    removeConfirm: 'Hapus member ini dari club?',
    transponders: 'Transponder',
    noTransponders: 'Belum ada transponder.',
    noMembers: 'Belum ada member aktif.',
    trackTitle: 'Track',
    trackSubtitle: 'Katalog track hanya untuk dilihat. Perubahan track dilakukan dari aplikasi YurLaps Windows.',
    addTrack: 'Tambah track',
    trackFormName: 'Nama track',
    trackFormAddress: 'Alamat track',
    add: 'Tambah',
    adding: 'Menambahkan...',
    trackEmpty: 'Belum ada track.',
    deleteTrackConfirm: 'Hapus track ini?',
    settingTitle: 'Setting club',
    settingSubtitle: 'Privasi, metode join, dan permission untuk co-leader dan officer.',
    visibility: 'Privasi',
    visibilityPublic: 'Publik — tampil di daftar community',
    visibilityPrivate: 'Privat — join dengan kode 8 digit',
    joinMethod: 'Metode join',
    joinOpen: 'Langsung — member langsung masuk',
    joinApproval: 'Approval — leader atau officer menyetujui',
    joinCode: 'Kode join',
    joinCodeHint: 'Bagikan kode 8 digit ini ke driver yang ingin kamu undang.',
    copy: 'Salin',
    copied: 'Tersalin',
    regenerate: 'Buat ulang',
    regenerating: 'Membuat ulang...',
    permissionsTitle: 'Permission role',
    permissionsHint: 'Leader selalu punya semua permission. Toggle ini hanya memengaruhi co-leader dan officer.',
    permissionLabels: {
      edit_club: 'Edit identitas club',
      manage_members: 'Kelola member dan role',
      review_applications: 'Tinjau permintaan join',
      manage_tracks: 'Kelola track',
      manage_races: 'Kelola hasil race',
    },
    settingSaved: 'Setting club berhasil disimpan.',
    formRequired: 'Isi semua kolom yang wajib.',
    trackRequired: 'Isi nama track.',
    forbidden: 'Hanya leader yang dapat membuka setting club.',
  },
}

const PERMISSION_KEYS = [
  'edit_club',
  'manage_members',
  'review_applications',
  'manage_tracks',
  'manage_races',
]

const roleOrder = { leader: 0, co_leader: 1, officer: 2, member: 3 }
const roleBadge = {
  leader: 'bg-ocean/10 text-ocean',
  co_leader: 'bg-violet-50 text-violet-600',
  officer: 'bg-amber-50 text-amber-600',
  member: 'bg-slate-100 text-slate-500',
}

const inputClass =
  'w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm text-ink outline-none transition placeholder:text-slate-400 focus:border-ocean focus:bg-white focus:ring-4 focus:ring-blue-100'
const labelClass = 'mb-2 block text-sm font-bold text-ink'

function initialsOf(name) {
  const parts = (name || 'C').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'C'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
}

function formatDate(value, language) {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleDateString(language === 'id' ? 'id-ID' : 'en-US', {
      dateStyle: 'medium',
    })
  } catch {
    return String(value)
  }
}

function exportRacePdf(race) {
  if (!race) return
  openRacePdfReport({
    race,
    rows: raceReportRows(race),
    language: 'id',
  })
}

function formatLap(ms) {
  if (ms === null || ms === undefined || !Number.isFinite(Number(ms))) return '—'
  const value = Number(ms)
  return `${Math.floor(value / 60000)}:${String(Math.floor(value / 1000) % 60).padStart(2, '0')}.${String(Math.round(value % 1000)).padStart(3, '0')}`
}

function raceReportRows(race) {
  const config = race?.cfg || race?.session_data?.configuration || race?.sessionData?.configuration || {}
  const gridPosition = config.start_mode === 'grid' && config.rank === 'position'
  const rows = (Array.isArray(race?.results) ? race.results : []).map((row, index) => {
    const laps = (Array.isArray(row.laps) ? row.laps : (Array.isArray(row.laps_ms) ? row.laps_ms : [])).map(Number).filter(Number.isFinite)
    const ordered = [...laps].sort((a, b) => a - b)
    const mean = laps.length ? laps.reduce((sum, value) => sum + value, 0) / laps.length : null
    const variance = mean ? laps.reduce((sum, value) => sum + (value - mean) ** 2, 0) / laps.length : 0
    const sigma = Math.sqrt(variance)
    return {
      ...row,
      pos: row.pos || index + 1,
      laps,
      n_lap: row.n_lap ?? laps.length,
      best_ms: row.best_ms ?? (ordered[0] ?? null),
      total_ms: row.total_ms ?? (laps.length ? laps.reduce((sum, value) => sum + value, 0) : null),
      top3_ms: row.top3_ms ?? (ordered.length >= 3 ? ordered.slice(0, 3).reduce((sum, value) => sum + value, 0) / 3 : null),
      consecutive_ms: row.consecutive_ms ?? row.top3_consecutive_ms ?? (() => {
        if (laps.length < 3) return null
        let best = Infinity
        for (let start = 0; start <= laps.length - 3; start += 1) {
          best = Math.min(best, (laps[start] + laps[start + 1] + laps[start + 2]) / 3)
        }
        return Number.isFinite(best) ? best : null
      })(),
      top_speed_kmh: row.top_speed_kmh ?? row.speed_kmh ?? row.topSpeedKmh ?? null,
      p80_ms: row.p80_ms ?? (ordered.length ? ordered.slice(0, Math.max(1, Math.ceil(ordered.length * 0.8))).reduce((sum, value) => sum + value, 0) / Math.max(1, Math.ceil(ordered.length * 0.8)) : null),
      consistency: row.consistency ?? (mean ? Math.max(0, 1 - sigma / mean) * 100 : null),
      passings: Array.isArray(row.passings) ? row.passings : [],
    }
  })
  const maxLaps = Math.max(0, ...rows.map((row) => row.laps.length))
  rows.forEach((row) => { row.positions = []; row.gaps = [] })
  for (let lap = 0; lap < maxLaps; lap += 1) {
    const cumulative = rows.map((row, index) => ({ index, value: row.laps.slice(0, lap + 1).reduce((sum, value) => sum + value, 0) })).filter((item) => rows[item.index].laps.length > lap).sort((a, b) => a.value - b.value)
    const leader = cumulative[0]?.value || 0
    cumulative.forEach((item, position) => {
      rows[item.index].positions[lap] = position + 1
      rows[item.index].gaps[lap] = (item.value - leader) / 1000
    })
    if (gridPosition) {
      const passingTimes = rows.map((row, index) => {
        const passing = row.passings.filter((entry) => entry && entry.origin !== true && entry.accepted !== false && entry.diterima !== false && entry.lap_ms != null && entry.decoder_timecode != null)[lap]
        return passing ? { index, timestamp: Number(passing.decoder_timecode) } : null
      }).filter(Boolean).sort((a, b) => a.timestamp - b.timestamp)
      passingTimes.forEach((entry, position) => { rows[entry.index].positions[lap] = position + 1 })
    }
  }
  const leader = rows[0]
  rows.forEach((row) => {
    if (row.gap_leader == null && leader && row !== leader && row.n_lap && leader.n_lap) {
      row.gap_leader = row.n_lap === leader.n_lap
        ? { ms: (row.total_ms || 0) - (leader.total_ms || 0) }
        : { laps: leader.n_lap - row.n_lap }
    }
  })
  return rows
}

export default function ClubDashboardPage({
  session,
  language,
  clubId,
  onBack,
  onOpenCommunity,
  onSignOut,
  onSelectClub,
}) {
  const text = copy[language] || copy.en
  const user = session?.user

  const [memberships, setMemberships] = useState([])
  const [activeClubId, setActiveClubId] = useState(null)
  const [club, setClub] = useState(null)
  const [role, setRole] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [dataLoading, setDataLoading] = useState(false)
  const [dataError, setDataError] = useState('')
  const [tab, setTab] = useState('home')

  const [members, setMembers] = useState([])
  const [profiles, setProfiles] = useState({})
  const [transponders, setTransponders] = useState({})
  const [tracks, setTracks] = useState([])
  const [races, setRaces] = useState([])
  const [selectedRace, setSelectedRace] = useState(null)
  const raceCloseRef = useRef(null)
  useEffect(() => {
    if (!selectedRace) return undefined
    const previousFocus = document.activeElement
    raceCloseRef.current?.focus()
    const closeOnEscape = (event) => { if (event.key === 'Escape') setSelectedRace(null) }
    document.addEventListener('keydown', closeOnEscape)
    return () => { document.removeEventListener('keydown', closeOnEscape); previousFocus?.focus?.() }
  }, [selectedRace])
  const [raceFilter, setRaceFilter] = useState({ track: '', from: '', to: '', order: 'newest' })

  useEffect(() => {
    if (!activeClubId || !user?.id) return undefined
    let active = true
    let pending = false
    async function refreshResults() {
      if (pending || document.visibilityState === 'hidden') return
      pending = true
      try {
        const rows = await fetchClubRaces(activeClubId)
        if (active) setRaces(rows.map(normalizeRace))
      } catch {
        // Keep the last successful list while disconnected.
      } finally { pending = false }
    }
    const timer = window.setInterval(refreshResults, 15000)
    window.addEventListener('focus', refreshResults)
    window.addEventListener('online', refreshResults)
    return () => {
      active = false
      window.clearInterval(timer)
      window.removeEventListener('focus', refreshResults)
      window.removeEventListener('online', refreshResults)
    }
  }, [activeClubId, user?.id])

  const [profileForm, setProfileForm] = useState({ name: '', description: '', address: '', avatar_url: '' })
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileError, setProfileError] = useState('')
  const [profileSaved, setProfileSaved] = useState(false)

  const [memberBusy, setMemberBusy] = useState('')
  const [memberError, setMemberError] = useState('')

  const [settingsForm, setSettingsForm] = useState({
    visibility: 'public',
    join_method: 'open',
  })
  const [permissions, setPermissions] = useState(resolveRolePermissions(null))
  const [settingsSaving, setSettingsSaving] = useState(false)
  const [settingsError, setSettingsError] = useState('')
  const [settingsSaved, setSettingsSaved] = useState(false)
  const [codeBusy, setCodeBusy] = useState(false)
  const [codeCopied, setCodeCopied] = useState(false)

  useEffect(() => {
    if (!user) return undefined
    let active = true
    setLoading(true)
    setLoadError('')

    const loadMemberships = async () => {
      try {
        const rows = await fetchMyMemberships(user.id)
        const activeRows = rows.filter((membership) => membership.status === 'active')
        if (!activeRows.length) {
          if (active) {
            setMemberships(rows)
            setClub(null)
            setActiveClubId(null)
            setLoading(false)
          }
          return
        }
        const clubRows = await fetchClubsByIds(activeRows.map((membership) => membership.club_id))
        const clubsById = Object.fromEntries(clubRows.map((clubRow) => [clubRow.id, clubRow]))
        const enriched = activeRows
          .filter((membership) => clubsById[membership.club_id])
          .map((membership) => ({ ...membership, club: clubsById[membership.club_id] }))
        if (!active) return
        setMemberships(enriched)
        const preferred =
          clubId && enriched.some((membership) => membership.club_id === clubId)
            ? clubId
            : enriched[0]?.club_id || null
        setActiveClubId(preferred)
        setLoading(false)
      } catch (error) {
        if (active) {
          setLoadError(clubError(error, language))
          setLoading(false)
        }
      }
    }

    loadMemberships()
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, clubId])

  useEffect(() => {
    if (!activeClubId) return
    const membership = memberships.find((item) => item.club_id === activeClubId)
    setRole(membership?.role || null)
    setClub(membership?.club || null)
    setTab('home')
    setProfileSaved(false)
    setSettingsSaved(false)
    setDataError('')

    let active = true
    setDataLoading(true)
    Promise.all([
      fetchClub(activeClubId),
      fetchClubMembers(activeClubId),
      fetchClubTracks(activeClubId),
      fetchClubRaces(activeClubId),
    ])
      .then(([clubRow, memberData, trackRows, raceRows]) => {
        if (!active) return
        setClub(clubRow)
        setMembers(memberData.members)
        setProfiles(memberData.profiles)
        setTransponders(memberData.transponders)
        setTracks(trackRows)
        setRaces(raceRows.map(normalizeRace))
        setProfileForm({
          name: clubRow.name || '',
          description: clubRow.description || '',
          address: clubRow.address || '',
          avatar_url: clubRow.avatar_url || '',
        })
        setSettingsForm({
          visibility: clubRow.visibility || 'public',
          join_method: clubRow.join_method || 'open',
        })
        setPermissions(resolveRolePermissions(clubRow))
      })
      .catch((error) => {
        if (active) setDataError(clubError(error, language))
      })
      .finally(() => {
        if (active) setDataLoading(false)
      })

    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeClubId])

  const chooseClub = (nextClubId) => {
    setActiveClubId(nextClubId)
    if (onSelectClub) onSelectClub(nextClubId)
  }

  const activeMembers = members
    .filter((member) => member.status === 'active')
    .sort((a, b) => (roleOrder[a.role] ?? 9) - (roleOrder[b.role] ?? 9))
  const pendingMembers = members.filter((member) => member.status === 'pending')
  const isLeader = role === 'leader'
  const canEditClub = hasPermission(club, role, 'edit_club')
  const canManageMembers = hasPermission(club, role, 'manage_members')
  const canReview = hasPermission(club, role, 'review_applications')

  const refreshMembers = async () => {
    if (!activeClubId) return
    const memberData = await fetchClubMembers(activeClubId)
    setMembers(memberData.members)
    setProfiles(memberData.profiles)
    setTransponders(memberData.transponders)
  }

  const handleProfileSubmit = async (event) => {
    event.preventDefault()
    if (!activeClubId) return
    if (!profileForm.name.trim()) {
      setProfileError(text.formRequired)
      return
    }
    setProfileSaving(true)
    setProfileError('')
    setProfileSaved(false)
    try {
      const updated = await updateClubProfile(activeClubId, profileForm)
      setClub((current) => ({ ...current, ...updated }))
      setProfileSaved(true)
    } catch (error) {
      setProfileError(clubError(error, language))
    } finally {
      setProfileSaving(false)
    }
  }

  const handleLeaveClub = async () => {
    if (!activeClubId || role === 'leader' || !window.confirm(language === 'id' ? 'Keluar dari club ini?' : 'Leave this club?')) return
    try { await leaveClub(activeClubId); onBack() }
    catch (error) { setDataError(clubError(error, language)) }
  }

  const filteredRaces = races
    .filter((race) => !raceFilter.track || race.track_name === raceFilter.track)
    .filter((race) => !raceFilter.from || String(race.raced_at || '').slice(0, 10) >= raceFilter.from)
    .filter((race) => !raceFilter.to || String(race.raced_at || '').slice(0, 10) <= raceFilter.to)
    .sort((a, b) => raceFilter.order === 'oldest'
      ? new Date(a.raced_at || 0) - new Date(b.raced_at || 0)
      : new Date(b.raced_at || 0) - new Date(a.raced_at || 0))
  const lapRecordsByTrack = races.filter(isRaceRecordEligible).reduce((groups, race) => {
    const trackName = race.track_name || 'Track tanpa nama'
    const rows = Array.isArray(race.results) ? race.results : []
    rows.forEach((row) => {
      const laps = Array.isArray(row.laps) ? row.laps : (Array.isArray(row.laps_ms) ? row.laps_ms : [])
      laps.map(Number).filter((value) => Number.isFinite(value) && value > 0).forEach((lap, lapIndex) => {
        if (!groups[trackName]) groups[trackName] = []
        groups[trackName].push({ lap, driver: row.name || row.nick || 'Driver', race: race.name, date: race.raced_at, lapIndex: lapIndex + 1 })
      })
    })
    return groups
  }, {})
  Object.keys(lapRecordsByTrack).forEach((trackName) => {
    lapRecordsByTrack[trackName].sort((a, b) => a.lap - b.lap)
    let rank = 0
    lapRecordsByTrack[trackName].forEach((entry, index) => {
      if (index === 0 || entry.lap !== lapRecordsByTrack[trackName][index - 1].lap) rank = index + 1
      entry.rank = rank
    })
    lapRecordsByTrack[trackName] = lapRecordsByTrack[trackName].slice(0, 10)
  })

  const handleReview = async (member, approve) => {
    if (!activeClubId) return
    setMemberBusy(`${member.user_id}:review`)
    setMemberError('')
    try {
      await reviewJoinRequest(activeClubId, member.user_id, approve)
      await refreshMembers()
    } catch (error) {
      setMemberError(clubError(error, language))
    } finally {
      setMemberBusy('')
    }
  }

  const handleRoleChange = async (member, nextRole) => {
    if (!activeClubId) return
    setMemberBusy(`${member.user_id}:role`)
    setMemberError('')
    try {
      await updateMemberRole(activeClubId, member.user_id, nextRole)
      await refreshMembers()
    } catch (error) {
      setMemberError(clubError(error, language))
    } finally {
      setMemberBusy('')
    }
  }

  const handleRemoveMember = async (member) => {
    if (!activeClubId || !window.confirm(text.removeConfirm)) return
    setMemberBusy(`${member.user_id}:remove`)
    setMemberError('')
    try {
      await removeClubMember(activeClubId, member.user_id)
      await refreshMembers()
    } catch (error) {
      setMemberError(clubError(error, language))
    } finally {
      setMemberBusy('')
    }
  }

  const handleSettingsSubmit = async (event) => {
    event.preventDefault()
    if (!activeClubId) return
    setSettingsSaving(true)
    setSettingsError('')
    setSettingsSaved(false)
    try {
      await updateClubSettings(activeClubId, {
        visibility: settingsForm.visibility,
        join_method: settingsForm.join_method,
        role_permissions: permissions,
      })
      const updated = await fetchClub(activeClubId)
      setClub(updated)
      setSettingsForm({
        visibility: updated.visibility,
        join_method: updated.join_method,
      })
      setPermissions(resolveRolePermissions(updated))
      setSettingsSaved(true)
    } catch (error) {
      setSettingsError(clubError(error, language))
    } finally {
      setSettingsSaving(false)
    }
  }

  const togglePermission = (roleKey, permission) => {
    setPermissions((current) => ({
      ...current,
      [roleKey]: {
        ...current[roleKey],
        [permission]: !current[roleKey][permission],
      },
    }))
    setSettingsSaved(false)
  }

  const handleCopyCode = async () => {
    if (!club?.join_code) return
    try {
      await navigator.clipboard.writeText(club.join_code)
      setCodeCopied(true)
      window.setTimeout(() => setCodeCopied(false), 2000)
    } catch {
      setCodeCopied(false)
    }
  }

  const handleRegenerateCode = async () => {
    if (!activeClubId) return
    setCodeBusy(true)
    setSettingsError('')
    try {
      const code = await regenerateJoinCode(activeClubId)
      setClub((current) => ({ ...current, join_code: code }))
    } catch (error) {
      setSettingsError(clubError(error, language))
    } finally {
      setCodeBusy(false)
    }
  }

  if (loading) {
    return (
      <main className="grid min-h-[calc(100vh-5rem)] place-items-center px-5">
        <p className="flex items-center gap-2 text-sm font-semibold text-slate-500">
          <Loader2 size={17} className="animate-spin" /> {text.loading}
        </p>
      </main>
    )
  }

  if (loadError) {
    return (
      <main className="mx-auto max-w-3xl px-5 py-14">
        <p className="rounded-2xl bg-amber-50 px-5 py-4 text-sm font-semibold text-amber-700">
          {loadError}
        </p>
        <button
          type="button"
          onClick={onBack}
          className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-ocean"
        >
          <ArrowLeft size={16} /> {text.back}
        </button>
      </main>
    )
  }

  if (!memberships.length || !club) {
    const pending = memberships.find((membership) => membership.status === 'pending')
    return (
      <main className="relative min-h-[calc(100vh-5rem)] overflow-hidden px-5 py-14 sm:px-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(74,164,255,0.18),transparent_38%),linear-gradient(180deg,#f8fbff_0%,#ffffff_100%)]" />
        <div className="relative mx-auto w-full max-w-2xl">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 transition hover:text-ocean"
          >
            <ArrowLeft size={17} /> {text.back}
          </button>
          <div className="mt-6 rounded-[2rem] border border-blue-100 bg-white p-9 text-center shadow-card">
            <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-mist text-ocean">
              {pending ? <Shield size={28} /> : <Users size={28} />}
            </span>
            <h1 className="mt-5 font-display text-3xl font-extrabold tracking-[-0.06em] text-ink">
              {pending ? text.pendingClub : text.noClub}
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              {pending ? text.pendingHint : text.noClubHint}
            </p>
            {!pending && (
              <button
                type="button"
                onClick={onOpenCommunity}
                className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-ocean px-5 py-3.5 text-sm font-bold text-white transition hover:bg-[#1855db]"
              >
                <Users size={17} /> {text.explore}
              </button>
            )}
          </div>
        </div>
      </main>
    )
  }

  const tabs = [
    { id: 'home', label: text.tabs.home, icon: Building2 },
    { id: 'race', label: text.tabs.race, icon: Flag },
    { id: 'event', label: text.tabs.event, icon: Trophy },
    { id: 'member', label: text.tabs.member, icon: Users },
    { id: 'track', label: text.tabs.track, icon: MapPin },
    ...(isLeader ? [{ id: 'setting', label: text.tabs.setting, icon: Settings }] : []),
  ]

  return (
    <main className="relative min-h-[calc(100vh-5rem)] overflow-hidden px-5 py-10 sm:px-8 sm:py-14">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(74,164,255,0.16),transparent_38%),linear-gradient(180deg,#f8fbff_0%,#ffffff_100%)]" />
      <div className="relative mx-auto w-full max-w-5xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 transition hover:text-ocean"
          >
            <ArrowLeft size={17} /> {text.back}
          </button>
          <button
            type="button"
            onClick={onSignOut}
            className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-blue-100 hover:text-ocean"
          >
            <LogOut size={16} /> {text.signOut}
          </button>
          {!isLeader && <button type="button" onClick={handleLeaveClub} className="inline-flex items-center gap-2 rounded-full bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-600 transition hover:bg-rose-100"><LogOut size={16} /> {language === 'id' ? 'Leave club' : 'Leave club'}</button>}
        </div>

        <div className="relative mt-5 overflow-hidden rounded-[2rem] bg-ink px-7 py-8 text-white shadow-[0_24px_80px_rgba(7,88,216,0.18)] sm:px-10">
          <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-ocean/40 blur-3xl" />
          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <span className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-2xl border border-white/20 bg-white/10 font-display text-2xl font-extrabold">
                {club.avatar_url ? <img src={club.avatar_url} alt={club.name} className="h-full w-full object-cover" /> : initialsOf(club.name)}
              </span>
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-blue-300">
                  {text.kicker}
                </p>
                <h1 className="mt-1 truncate font-display text-3xl font-extrabold tracking-[-0.06em] sm:text-4xl">
                  {club.name}
                </h1>
                <p className="mt-1 flex items-center gap-1.5 truncate text-sm text-slate-300">
                  <MapPin size={14} /> {club.address || text.noAddress}
                </p>
              </div>
            </div>
            <div className="flex flex-col items-start gap-2 sm:items-end">
              <span className={`rounded-full px-3.5 py-1.5 text-xs font-bold ${roleBadge[role] || roleBadge.member}`}>
                {text.roles[role] || text.roles.member}
              </span>
              {memberships.length > 1 && (
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                  {text.switchClub}
                  <select
                    value={activeClubId}
                    onChange={(event) => chooseClub(event.target.value)}
                    className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-bold text-white outline-none"
                  >
                    {memberships.map((membership) => (
                      <option key={membership.club_id} value={membership.club_id} className="text-ink">
                        {membership.club.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 flex gap-2 overflow-x-auto pb-1">
          {tabs.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold transition ${
                  tab === item.id
                    ? 'bg-ocean text-white shadow-sm'
                    : 'bg-white text-slate-600 hover:bg-blue-50 hover:text-ocean'
                }`}
              >
                <Icon size={16} /> {item.label}
              </button>
            )
          })}
        </div>

        {dataError && (
          <p className="mt-5 rounded-xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700">
            {dataError}
          </p>
        )}

        {dataLoading ? (
          <div className="mt-6 flex items-center justify-center gap-2 rounded-[2rem] border border-dashed border-slate-200 py-16 text-sm font-semibold text-slate-500">
            <Loader2 size={18} className="animate-spin" /> {text.loading}
          </div>
        ) : tab === 'home' ? (
          <section className="mt-6 rounded-[2rem] border border-blue-100 bg-white p-7 shadow-card sm:p-9">
            <h2 className="font-display text-2xl font-extrabold tracking-[-0.05em] text-ink">
              {text.homeTitle}
            </h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">{text.homeSubtitle}</p>

            {canEditClub ? (
              <form onSubmit={handleProfileSubmit} className="mt-6 space-y-5">
                <div className="grid gap-5 sm:grid-cols-2">
                  <label className="block">
                    <span className={labelClass}>{text.name}</span>
                    <input
                      type="text"
                      value={profileForm.name}
                      onChange={(event) =>
                        setProfileForm((current) => ({ ...current, name: event.target.value }))
                      }
                      className={inputClass}
                    />
                  </label>
                  <label className="block">
                    <span className={labelClass}>{text.address}</span>
                    <input
                      type="text"
                      value={profileForm.address}
                      onChange={(event) =>
                        setProfileForm((current) => ({ ...current, address: event.target.value }))
                      }
                      className={inputClass}
                    />
                  </label>
                </div>
                <label className="block">
                  <span className={labelClass}>{text.description}</span>
                  <textarea
                    rows={4}
                    value={profileForm.description}
                    onChange={(event) =>
                      setProfileForm((current) => ({ ...current, description: event.target.value }))
                    }
                    className={`${inputClass} resize-none`}
                  />
                </label>
                <label className="block">
                  <span className={labelClass}>Club photo URL</span>
                  <input type="url" value={profileForm.avatar_url} onChange={(event) => setProfileForm((current) => ({ ...current, avatar_url: event.target.value }))} placeholder="https://..." className={inputClass} />
                </label>
                {profileError && (
                  <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
                    {profileError}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="submit"
                    disabled={profileSaving}
                    className="inline-flex items-center gap-2 rounded-2xl bg-ocean px-5 py-3.5 text-sm font-bold text-white transition hover:bg-[#1855db] disabled:cursor-wait disabled:opacity-60"
                  >
                    {profileSaving && <Loader2 size={16} className="animate-spin" />}
                    {profileSaving ? text.saving : text.save}
                  </button>
                  {profileSaved && (
                    <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-600">
                      <Check size={16} strokeWidth={3} /> {text.saved}
                    </span>
                  )}
                </div>
              </form>
            ) : (
              <div className="mt-6 space-y-4">
                <p className="text-base leading-8 text-slate-600">
                  {club.description || text.noDescription}
                </p>
                <p className="flex items-center gap-2 text-sm font-semibold text-slate-500">
                  <MapPin size={16} /> {club.address || text.noAddress}
                </p>
              </div>
            )}

            <div className="mt-7 grid grid-cols-2 gap-4 border-t border-slate-100 pt-6">
              <div className="rounded-2xl bg-mist/70 px-4 py-3">
                <p className="font-display text-2xl font-extrabold text-ink">{activeMembers.length}</p>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {text.members}
                </p>
              </div>
              <div className="rounded-2xl bg-mist/70 px-4 py-3">
                <p className="font-display text-2xl font-extrabold text-ink">{tracks.length}</p>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {text.tracks}
                </p>
              </div>
            </div>
          </section>
        ) : tab === 'event' ? (
          <ClubEventsPage clubId={activeClubId} tracks={tracks} races={races} operator={isLeader} userId={user?.id} />
        ) : tab === 'race' ? (
          <section className="mt-6 rounded-[2rem] border border-blue-100 bg-white p-7 shadow-card sm:p-9">
            <h2 className="font-display text-2xl font-extrabold tracking-[-0.05em] text-ink">
              {text.raceTitle}
            </h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">{text.raceSubtitle}</p>

            <div className="mt-6 grid gap-3 rounded-2xl bg-mist/60 p-4 sm:grid-cols-4">
              <select value={raceFilter.track} onChange={(event) => setRaceFilter((current) => ({ ...current, track: event.target.value }))} className={inputClass}>
                <option value="">{text.filterTrack}</option>
                {tracks.map((track) => <option key={track.id} value={track.name}>{track.name}</option>)}
              </select>
              <input type="date" value={raceFilter.from} onChange={(event) => setRaceFilter((current) => ({ ...current, from: event.target.value }))} aria-label={text.filterFrom} className={inputClass} />
              <input type="date" value={raceFilter.to} onChange={(event) => setRaceFilter((current) => ({ ...current, to: event.target.value }))} aria-label={text.filterTo} className={inputClass} />
              <select value={raceFilter.order} onChange={(event) => setRaceFilter((current) => ({ ...current, order: event.target.value }))} className={inputClass}>
                <option value="newest">{text.newest}</option><option value="oldest">{text.oldest}</option>
              </select>
            </div>

            {filteredRaces.length === 0 ? (
              <div className="mt-7 grid place-items-center gap-2 rounded-2xl border border-dashed border-slate-200 py-12 text-center">
                <Flag size={26} className="text-slate-300" />
                <p className="text-sm font-bold text-slate-600">{text.raceEmpty}</p>
                <p className="max-w-sm text-xs text-slate-500">{text.raceEmptyHint}</p>
              </div>
            ) : (
              <ul className="mt-7 divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200">
                {filteredRaces.map((race) => (
                  <li key={race.id} className="flex flex-wrap items-center gap-3 px-4 py-4">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-mist text-ocean">
                      <Flag size={18} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-ink">{race.name}</p>
                      <p className="mt-0.5 truncate text-xs text-slate-500">
                        {formatDate(race.raced_at, language)}
                        {race.track_name ? ` · ${race.track_name}` : ''}
                        {race.location ? ` · ${race.location}` : ''}
                      </p>
                    </div>
                    <span className="text-xs font-semibold text-slate-500">
                      {Array.isArray(race.results) ? race.results.length : 0} {text.entries}
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedRace(race)}
                      className="rounded-full bg-blue-50 px-3.5 py-2 text-xs font-bold text-ocean transition hover:bg-blue-100"
                    >
                      {text.viewResults}
                    </button>
                  </li>
                ))}
              </ul>
            )}

          </section>
        ) : tab === 'member' ? (
          <section className="mt-6 rounded-[2rem] border border-blue-100 bg-white p-7 shadow-card sm:p-9">
            <h2 className="font-display text-2xl font-extrabold tracking-[-0.05em] text-ink">
              {text.memberTitle}
            </h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">{text.memberSubtitle}</p>

            {memberError && (
              <p className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
                {memberError}
              </p>
            )}

            {canReview && pendingMembers.length > 0 && (
              <div className="mt-6 rounded-2xl border border-amber-100 bg-amber-50/60 p-4">
                <h3 className="text-sm font-extrabold uppercase tracking-wide text-amber-700">
                  {text.pendingTitle}
                </h3>
                <ul className="mt-3 space-y-2">
                  {pendingMembers.map((member) => {
                    const profile = profiles[member.user_id]
                    return (
                      <li
                        key={member.user_id}
                        className="flex flex-wrap items-center gap-3 rounded-xl bg-white px-3 py-3"
                      >
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-mist text-xs font-extrabold text-ocean">
                          {initialsOf(profile?.nickname || profile?.full_name)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold text-ink">
                            {profile?.nickname || profile?.full_name || text.roles.member}
                          </p>
                          <p className="text-xs text-slate-500">
                            {formatDate(member.joined_at, language)}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleReview(member, true)}
                            disabled={memberBusy === `${member.user_id}:review`}
                            className="rounded-full bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white transition hover:bg-emerald-700 disabled:opacity-60"
                          >
                            {text.approve}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleReview(member, false)}
                            disabled={memberBusy === `${member.user_id}:review`}
                            className="rounded-full bg-white px-3.5 py-2 text-xs font-bold text-red-600 transition hover:bg-red-50 disabled:opacity-60"
                          >
                            {text.reject}
                          </button>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}

            {activeMembers.length === 0 ? (
              <div className="mt-7 grid place-items-center gap-2 rounded-2xl border border-dashed border-slate-200 py-12 text-center">
                <Users size={26} className="text-slate-300" />
                <p className="text-sm font-semibold text-slate-500">{text.noMembers}</p>
              </div>
            ) : (
              <ul className="mt-7 space-y-3">
                {activeMembers.map((member) => {
                  const profile = profiles[member.user_id]
                  const memberTransponders = transponders[member.user_id] || []
                  const isLeaderRow = member.role === 'leader'
                  return (
                    <li
                      key={member.user_id}
                      className="flex flex-col gap-3 rounded-2xl border border-slate-200 p-4 sm:flex-row sm:items-center"
                    >
                      <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full bg-mist text-xs font-extrabold text-ocean">
                        {profile?.avatar_url ? (
                          <img
                            src={profile.avatar_url}
                            alt={profile?.nickname || profile?.full_name || ''}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          initialsOf(profile?.nickname || profile?.full_name)
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-bold text-ink">
                            {profile?.nickname || profile?.full_name || text.roles.member}
                          </p>
                          <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${roleBadge[member.role]}`}>
                            {text.roles[member.role]}
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-xs text-slate-500">
                          {profile?.full_name}
                          {profile?.full_name && memberTransponders.length ? ' · ' : ''}
                          {memberTransponders.length
                            ? `${memberTransponders.length} ${text.transponders.toLowerCase()}`
                            : text.noTransponders}
                        </p>
                        {memberTransponders.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {memberTransponders.map((transponder) => (
                              <span
                                key={transponder.id}
                                className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-600"
                              >
                                {transponder.transponder_id} · {transponder.rc_class} ·{' '}
                                {transponder.rc_brand}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      {canManageMembers && !isLeaderRow && (
                        <div className="flex items-center gap-2">
                          <select
                            value={member.role}
                            onChange={(event) => handleRoleChange(member, event.target.value)}
                            disabled={memberBusy === `${member.user_id}:role`}
                            className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 outline-none focus:border-ocean"
                          >
                            <option value="co_leader">{text.roles.co_leader}</option>
                            <option value="officer">{text.roles.officer}</option>
                            <option value="member">{text.roles.member}</option>
                          </select>
                          <button
                            type="button"
                            onClick={() => handleRemoveMember(member)}
                            disabled={memberBusy === `${member.user_id}:remove`}
                            aria-label={text.remove}
                            className="rounded-full p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
                          >
                            {memberBusy === `${member.user_id}:remove` ? (
                              <Loader2 size={16} className="animate-spin" />
                            ) : (
                              <Trash2 size={16} />
                            )}
                          </button>
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}

          </section>
        ) : tab === 'track' ? (
          <section className="mt-6 rounded-[2rem] border border-blue-100 bg-white p-7 shadow-card sm:p-9">
            <h2 className="font-display text-2xl font-extrabold tracking-[-0.05em] text-ink">
              {text.trackTitle}
            </h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">{text.trackSubtitle}</p>
            <p className="mt-5 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-semibold text-ocean">{text.appOnlyTrack}</p>

            {tracks.length === 0 ? (
              <div className="mt-7 grid place-items-center gap-2 rounded-2xl border border-dashed border-slate-200 py-12 text-center">
                <MapPin size={26} className="text-slate-300" />
                <p className="text-sm font-semibold text-slate-500">{text.trackEmpty}</p>
              </div>
            ) : (
              <ul className="mt-7 divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200">
                {tracks.map((track) => (
                  <li key={track.id} className="flex items-center gap-3 px-4 py-4">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-mist text-ocean">
                      <MapPin size={18} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-ink">{track.name}</p>
                      <p className="mt-0.5 truncate text-xs text-slate-500">
                        {track.address || text.noAddress}
                      </p>
                    </div>
                    {track.deleted_at && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase text-slate-500">{text.archived}</span>}
                  </li>
                ))}
              </ul>
            )}
            {Object.keys(lapRecordsByTrack).length > 0 && <div className="mt-8"><div className="flex items-end justify-between gap-3"><div><h3 className="font-display text-xl font-extrabold tracking-[-0.04em] text-ink">{text.records}</h3><p className="mt-1 text-xs text-slate-500">Race only · practice tidak dihitung</p></div><Trophy size={19} className="text-amber-500" /></div><div className="mt-4 grid gap-4 lg:grid-cols-2">{Object.entries(lapRecordsByTrack).map(([trackName, records]) => <div key={trackName} className="overflow-hidden rounded-2xl border border-slate-200"><div className="border-b border-slate-100 bg-slate-50 px-4 py-3 font-bold text-ink">{trackName}</div><div className="divide-y divide-slate-100">{records.map((record, index) => <div key={`${trackName}-${record.driver}-${record.lap}-${index}`} className="flex items-center gap-3 px-4 py-2.5 text-xs"><span className={`grid h-7 w-7 place-items-center rounded-full font-extrabold ${record.rank === 1 ? 'bg-amber-100 text-amber-700' : record.rank === 2 ? 'bg-slate-200 text-slate-600' : record.rank === 3 ? 'bg-orange-100 text-orange-700' : 'bg-mist text-ocean'}`}>{record.rank}</span><div className="min-w-0 flex-1"><p className="truncate font-bold text-ink">{record.driver}</p><p className="text-[10px] text-slate-400">{formatDate(record.date, language)}</p></div><span className="font-mono font-extrabold text-ocean">{formatLap(record.lap)}</span></div>)}</div></div>)}</div></div>}
          </section>
        ) : tab === 'setting' ? (
          isLeader ? (
            <section className="mt-6 rounded-[2rem] border border-blue-100 bg-white p-7 shadow-card sm:p-9">
              <h2 className="font-display text-2xl font-extrabold tracking-[-0.05em] text-ink">
                {text.settingTitle}
              </h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">{text.settingSubtitle}</p>

              <form onSubmit={handleSettingsSubmit} className="mt-6 space-y-5">
                <div className="grid gap-5 sm:grid-cols-2">
                  <label className="block">
                    <span className={labelClass}>{text.visibility}</span>
                    <select
                      value={settingsForm.visibility}
                      onChange={(event) => {
                        setSettingsForm((current) => ({ ...current, visibility: event.target.value }))
                        setSettingsSaved(false)
                      }}
                      className={inputClass}
                    >
                      <option value="public">{text.visibilityPublic}</option>
                      <option value="private">{text.visibilityPrivate}</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className={labelClass}>{text.joinMethod}</span>
                    <select
                      value={settingsForm.join_method}
                      onChange={(event) => {
                        setSettingsForm((current) => ({
                          ...current,
                          join_method: event.target.value,
                        }))
                        setSettingsSaved(false)
                      }}
                      className={inputClass}
                    >
                      <option value="open">{text.joinOpen}</option>
                      <option value="approval">{text.joinApproval}</option>
                    </select>
                  </label>
                </div>

                {club.visibility === 'private' && (
                  <div className="rounded-2xl bg-mist/70 p-4">
                    <div className="flex items-center gap-2">
                      <KeyRound size={17} className="text-ocean" />
                      <p className="text-sm font-bold text-ink">{text.joinCode}</p>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{text.joinCodeHint}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className="rounded-xl bg-white px-4 py-2 font-mono text-lg font-bold tracking-[0.25em] text-ink">
                        {club.join_code}
                      </span>
                      <button
                        type="button"
                        onClick={handleCopyCode}
                        className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-2 text-xs font-bold text-ocean shadow-sm transition hover:bg-blue-50"
                      >
                        {codeCopied ? <Check size={14} /> : <Copy size={14} />}
                        {codeCopied ? text.copied : text.copy}
                      </button>
                      <button
                        type="button"
                        onClick={handleRegenerateCode}
                        disabled={codeBusy}
                        className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-2 text-xs font-bold text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
                      >
                        {codeBusy ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <RefreshCw size={14} />
                        )}
                        {codeBusy ? text.regenerating : text.regenerate}
                      </button>
                    </div>
                  </div>
                )}

                <div className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex items-center gap-2">
                    <Shield size={17} className="text-ocean" />
                    <p className="text-sm font-bold text-ink">{text.permissionsTitle}</p>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{text.permissionsHint}</p>
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full min-w-[28rem] text-left text-sm">
                      <thead>
                        <tr className="text-xs uppercase tracking-wide text-slate-400">
                          <th className="pb-2 font-bold">{text.permissionsTitle}</th>
                          <th className="pb-2 text-center font-bold">{text.roles.co_leader}</th>
                          <th className="pb-2 text-center font-bold">{text.roles.officer}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {PERMISSION_KEYS.map((permission) => (
                          <tr key={permission}>
                            <td className="py-2.5 pr-3 font-semibold text-slate-600">
                              {text.permissionLabels[permission]}
                            </td>
                            {['co_leader', 'officer'].map((roleKey) => (
                              <td key={roleKey} className="py-2.5 text-center">
                                <input
                                  type="checkbox"
                                  checked={permissions[roleKey][permission] === true}
                                  onChange={() => togglePermission(roleKey, permission)}
                                  className="h-4 w-4 rounded border-slate-300 text-ocean focus:ring-ocean"
                                />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {settingsError && (
                  <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
                    {settingsError}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="submit"
                    disabled={settingsSaving}
                    className="inline-flex items-center gap-2 rounded-2xl bg-ocean px-5 py-3.5 text-sm font-bold text-white transition hover:bg-[#1855db] disabled:cursor-wait disabled:opacity-60"
                  >
                    {settingsSaving && <Loader2 size={16} className="animate-spin" />}
                    {settingsSaving ? text.saving : text.save}
                  </button>
                  {settingsSaved && (
                    <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-600">
                      <Check size={16} strokeWidth={3} /> {text.settingSaved}
                    </span>
                  )}
                </div>
              </form>
            </section>
          ) : (
            <p className="mt-6 rounded-2xl bg-amber-50 px-5 py-4 text-sm font-semibold text-amber-700">
              {text.forbidden}
            </p>
          )
        ) : null}
      </div>

      {selectedRace && (
        <div
          className="fixed inset-0 z-[95] grid place-items-center overflow-y-auto bg-slate-950/45 px-5 py-8 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="race-detail-title"
        >
          <div className="relative my-auto w-full max-w-5xl rounded-[2rem] bg-white p-5 shadow-2xl sm:p-9">
            <button
              type="button"
              ref={raceCloseRef}
              onClick={() => setSelectedRace(null)}
              className="absolute right-4 top-4 rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-ink"
              aria-label={text.close}
            >
              <X size={19} />
            </button>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-ocean">{text.raceTitle}</p>
            <h2
              id="race-detail-title"
              className="mt-2 pr-8 font-display text-3xl font-extrabold tracking-[-0.06em] text-ink"
            >
              {selectedRace.name}
            </h2>
            <div className="mt-4 grid gap-3 rounded-2xl bg-mist/60 p-4 text-sm sm:grid-cols-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                  {text.raceDate}
                </p>
                <p className="mt-1 font-semibold text-ink">
                  {formatDate(selectedRace.raced_at, language)}
                </p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                  {text.trackName}
                </p>
                <p className="mt-1 font-semibold text-ink">
                  {selectedRace.track_name || text.noAddress}
                </p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                  {text.location}
                </p>
                <p className="mt-1 font-semibold text-ink">
                  {selectedRace.location || text.noAddress}
                </p>
              </div>
            </div>

            <RaceResultView key={selectedRace.id} race={selectedRace} language={language} />

            <div className="mt-6 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => exportRacePdf(selectedRace)}
                disabled={!Array.isArray(selectedRace.results) || selectedRace.results.length === 0}
                className="inline-flex items-center gap-2 rounded-2xl border border-ocean/20 bg-blue-50 px-5 py-3 text-sm font-bold text-ocean transition hover:bg-blue-100 disabled:opacity-50"
              >
                <Flag size={16} /> {text.exportPdf}
              </button>
              <button
                type="button"
                onClick={() => setSelectedRace(null)}
                className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-600 transition hover:bg-slate-50"
              >
                {text.close}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
