import { useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  Activity,
  CalendarDays,
  Camera,
  Check,
  ChevronRight,
  Eye,
  EyeOff,
  Flag,
  Filter,
  Gauge,
  Loader2,
  LogOut,
  Plus,
  Radio,
  Trash2,
  UserRound,
  Volume2,
} from 'lucide-react'
import {
  addTransponder,
  deleteTransponder,
  fetchProfile,
  fetchTransponders,
  getFriendlyError,
  saveProfile,
  updateAvatar,
  uploadAvatar,
} from './lib/account'
import { fetchPersonalRaces, fetchPracticeSessions, updatePracticeVisibility } from './lib/clubs'

const RC_CLASSES = [
  '1/10 Touring',
  '1/10 Buggy 2WD',
  '1/10 Buggy 4WD',
  '1/10 Short Course',
  '1/8 Buggy',
  '1/8 Truggy',
  '1/12 Pan Car',
  'Mini-Z',
  'Drift',
  'Crawler',
  'Monster Truck',
]

const RC_BRANDS = [
  'Traxxas',
  'Tamiya',
  'Kyosho',
  'Losi',
  'Team Associated',
  'TLR',
  'HPI',
  'ARRMA',
  'MST',
  'Yokomo',
  'Xray',
  'Serpent',
]

const copy = {
  en: {
    kicker: 'YurLaps Account',
    title: 'Personal dashboard',
    back: 'Back to site',
    signOut: 'Sign out',
    verified: 'Verified',
    accountTitle: 'Account settings',
    accountSubtitle: 'Update how your name appears in races and TTS announcements.',
    photo: 'Profile photo',
    photoHint: 'JPG, PNG, or WEBP. Maximum 2 MB.',
    changePhoto: 'Change photo',
    uploading: 'Uploading...',
    photoAlt: 'Profile photo',
    fullName: 'Full name',
    nickname: 'Nickname',
    ttsName: 'TTS driver name',
    ttsHint: 'This name is spoken during race announcements.',
    testTts: 'Test TTS',
    save: 'Save changes',
    saving: 'Saving...',
    saved: 'Account settings saved.',
    photoTypeError: 'Please choose an image file.',
    photoSizeError: 'The image is too large. Maximum size is 2 MB.',
    transponderTitle: 'My transponders',
    transponderSubtitle: 'Add the transponders you use for racing.',
    transponderId: 'Transponder ID',
    transponderIdHint: 'Example: 1234567',
    rcClass: 'RC class',
    rcBrand: 'RC brand',
    addTransponder: 'Add transponder',
    adding: 'Adding...',
    formRequired: 'Fill in the transponder ID, RC class, and RC brand.',
    duplicateTransponder: 'This transponder ID is already registered.',
    empty: 'No transponders yet. Add your first one above.',
    delete: 'Delete transponder',
    loading: 'Loading your account...',
    activityTitle: 'My activity', activitySubtitle: 'Your own race participation and practice laps, kept separate from club administration.', practice: 'Practice', race: 'Race', private: 'Private', public: 'Public', all: 'All activity', filterTrack: 'Track', from: 'From', to: 'To', viewLog: 'View lap log', noActivity: 'No personal activity yet.', laps: 'laps', bestLap: 'Best lap', totalLaps: 'Total laps', session: 'session', visibility: 'Visibility',
  },
  id: {
    kicker: 'Akun YurLaps',
    title: 'Dashboard personal',
    back: 'Kembali ke situs',
    signOut: 'Keluar',
    verified: 'Terverifikasi',
    accountTitle: 'Pengaturan akun',
    accountSubtitle: 'Perbarui nama yang tampil di balapan dan pengumuman TTS.',
    photo: 'Foto profil',
    photoHint: 'JPG, PNG, atau WEBP. Maksimal 2 MB.',
    changePhoto: 'Ganti foto',
    uploading: 'Mengunggah...',
    photoAlt: 'Foto profil',
    fullName: 'Nama lengkap',
    nickname: 'Nick',
    ttsName: 'Nama TTS driver',
    ttsHint: 'Nama ini diucapkan saat pengumuman balapan.',
    testTts: 'Coba TTS',
    save: 'Simpan perubahan',
    saving: 'Menyimpan...',
    saved: 'Pengaturan akun berhasil disimpan.',
    photoTypeError: 'Pilih file gambar.',
    photoSizeError: 'Ukuran gambar terlalu besar. Maksimal 2 MB.',
    transponderTitle: 'Transponder saya',
    transponderSubtitle: 'Tambahkan transponder yang kamu pakai untuk balapan.',
    transponderId: 'ID transponder',
    transponderIdHint: 'Contoh: 1234567',
    rcClass: 'Class RC',
    rcBrand: 'Merk RC',
    addTransponder: 'Tambah transponder',
    adding: 'Menambahkan...',
    formRequired: 'Isi ID transponder, class RC, dan merk RC.',
    duplicateTransponder: 'ID transponder ini sudah terdaftar.',
    empty: 'Belum ada transponder. Tambahkan yang pertama di atas.',
    delete: 'Hapus transponder',
    loading: 'Memuat akun kamu...',
    activityTitle: 'Aktivitas saya', activitySubtitle: 'Partisipasi race dan lap practice milikmu, terpisah dari administrasi community.', practice: 'Practice', race: 'Race', private: 'Private', public: 'Public', all: 'Semua aktivitas', filterTrack: 'Track', from: 'Dari', to: 'Sampai', viewLog: 'Lihat log lap', noActivity: 'Belum ada aktivitas personal.', laps: 'lap', bestLap: 'Best lap', totalLaps: 'Total lap', session: 'sesi', visibility: 'Visibilitas',
  },
}

const inputClass =
  'w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm text-ink outline-none transition placeholder:text-slate-400 focus:border-ocean focus:bg-white focus:ring-4 focus:ring-blue-100'
const labelClass = 'mb-2 block text-sm font-bold text-ink'

function initialsOf(name, email) {
  const source = (name || email || 'Y').trim()
  const parts = source.split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'Y'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
}

function formatLap(ms) {
  const value = Number(ms)
  if (!Number.isFinite(value) || value <= 0) return '—'
  const minutes = Math.floor(value / 60000)
  const seconds = Math.floor((value % 60000) / 1000)
  const millis = Math.round(value % 1000).toString().padStart(3, '0')
  return `${minutes}:${seconds.toString().padStart(2, '0')}.${millis}`
}

function activityLaps(item) {
  if (item.type === 'practice') {
    const source = item.laps
    if (Array.isArray(source)) {
      return source.flatMap((entry) => {
        if (typeof entry === 'number' || typeof entry === 'string') return [Number(entry)]
        return entry?.lap_ms || entry?.laps || []
      }).map(Number).filter(Number.isFinite)
    }
    return Object.values(source || {}).flat().map(Number).filter(Number.isFinite)
  }
  const rows = item.personal_results || item.results || []
  return rows.flatMap((row) => Array.isArray(row.laps) ? row.laps : (Array.isArray(row.laps_ms) ? row.laps_ms : (Array.isArray(row.lap_times) ? row.lap_times : []))).map(Number).filter(Number.isFinite)
}

export default function DashboardPage({ session, language, onBack, onSignOut }) {
  const text = copy[language] || copy.en
  const user = session?.user
  const fileInputRef = useRef(null)

  const [profile, setProfile] = useState({
    full_name: '',
    nickname: '',
    tts_name: '',
    avatar_url: '',
  })
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saved, setSaved] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [transponders, setTransponders] = useState([])
  const [transLoading, setTransLoading] = useState(true)
  const [transError, setTransError] = useState('')
  const [form, setForm] = useState({ transponder_id: '', rc_class: '', rc_brand: '' })
  const [adding, setAdding] = useState(false)
  const [formError, setFormError] = useState('')
  const [deletingId, setDeletingId] = useState('')
  const [practiceSessions, setPracticeSessions] = useState([])
  const [raceSessions, setRaceSessions] = useState([])
  const [activityFilter, setActivityFilter] = useState({ type: 'all', track: '', from: '', to: '' })
  const [selectedActivity, setSelectedActivity] = useState(null)
  const [activityLoading, setActivityLoading] = useState(true)

  useEffect(() => {
    if (!user) return undefined
    let active = true
    setLoading(true)
    setTransLoading(true)
    setLoadError('')
    setTransError('')

    setActivityLoading(true)
    Promise.allSettled([fetchProfile(user), fetchTransponders(user.id), fetchPracticeSessions(user.id), fetchPersonalRaces(user.id)]).then((results) => {
      if (!active) return
      const [profileResult, transponderResult] = results

      if (profileResult.status === 'fulfilled') {
        setProfile({
          full_name: profileResult.value.full_name || '',
          nickname: profileResult.value.nickname || '',
          tts_name: profileResult.value.tts_name || '',
          avatar_url: profileResult.value.avatar_url || '',
        })
      } else {
        setLoadError(getFriendlyError(profileResult.reason, language))
        setProfile({
          full_name: user.user_metadata?.full_name || '',
          nickname: user.user_metadata?.nickname || '',
          tts_name: user.user_metadata?.tts_name || '',
          avatar_url: '',
        })
      }

      if (transponderResult.status === 'fulfilled') {
        setTransponders(transponderResult.value)
      } else {
        setTransError(getFriendlyError(transponderResult.reason, language))
      }
      if (results[2]?.status === 'fulfilled') setPracticeSessions(results[2].value)
      if (results[3]?.status === 'fulfilled') setRaceSessions(results[3].value || [])

      setLoading(false)
      setTransLoading(false)
      setActivityLoading(false)
    })

    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  const updateField = (key) => (event) => {
    setProfile((current) => ({ ...current, [key]: event.target.value }))
    setSaved(false)
  }

  const handleProfileSubmit = async (event) => {
    event.preventDefault()
    if (!user) return
    setSaving(true)
    setSaveError('')
    setSaved(false)
    try {
      const next = await saveProfile(user, profile)
      setProfile((current) => ({ ...current, ...next }))
      setSaved(true)
    } catch (error) {
      setSaveError(getFriendlyError(error, language))
    } finally {
      setSaving(false)
    }
  }

  const handleAvatarChange = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !user) return
    if (!file.type.startsWith('image/')) {
      setUploadError(text.photoTypeError)
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      setUploadError(text.photoSizeError)
      return
    }
    setUploading(true)
    setUploadError('')
    try {
      const url = await uploadAvatar(user, file)
      const next = await updateAvatar(user, url)
      setProfile((current) => ({ ...current, avatar_url: next.avatar_url || url }))
    } catch (error) {
      setUploadError(getFriendlyError(error, language))
    } finally {
      setUploading(false)
    }
  }

  const handleAddTransponder = async (event) => {
    event.preventDefault()
    if (!user) return
    const values = {
      transponder_id: form.transponder_id.trim().toUpperCase(),
      rc_class: form.rc_class.trim(),
      rc_brand: form.rc_brand.trim(),
    }
    if (!values.transponder_id || !values.rc_class || !values.rc_brand) {
      setFormError(text.formRequired)
      return
    }
    setAdding(true)
    setFormError('')
    try {
      const created = await addTransponder(user.id, values)
      setTransponders((current) => [created, ...current])
      setForm({ transponder_id: '', rc_class: '', rc_brand: '' })
    } catch (error) {
      setFormError(
        error?.code === '23505'
          ? text.duplicateTransponder
          : getFriendlyError(error, language),
      )
    } finally {
      setAdding(false)
    }
  }

  const handleDeleteTransponder = async (id) => {
    setDeletingId(id)
    setTransError('')
    try {
      await deleteTransponder(id)
      setTransponders((current) => current.filter((item) => item.id !== id))
    } catch (error) {
      setTransError(getFriendlyError(error, language))
    } finally {
      setDeletingId('')
    }
  }

  const speakTtsName = () => {
    const name = profile.tts_name.trim() || profile.nickname.trim() || profile.full_name.trim()
    if (!name || typeof window === 'undefined' || !window.speechSynthesis) return
    window.speechSynthesis.cancel()
    const utterance = new window.SpeechSynthesisUtterance(name)
    utterance.lang = language === 'id' ? 'id-ID' : 'en-US'
    window.speechSynthesis.speak(utterance)
  }

  const displayName =
    profile.nickname.trim() || profile.full_name.trim() || (user?.email || '').split('@')[0]

  const togglePractice = async (item) => {
    const next = item.visibility === 'public' ? 'private' : 'public'
    try {
      const updated = await updatePracticeVisibility(item.id, next)
      setPracticeSessions((current) => current.map((row) => row.id === item.id ? updated : row))
    } catch (error) {
      setLoadError(getFriendlyError(error, language))
    }
  }

  const activities = [
    ...raceSessions.map((item) => ({ ...item, type: 'race', activityAt: item.raced_at })),
    ...practiceSessions.map((item) => ({ ...item, type: 'practice', activityAt: item.started_at })),
  ]
  const trackOptions = [...new Set(activities.map((item) => item.track_name).filter(Boolean))].sort()
  const filteredActivities = activities
    .filter((item) => activityFilter.type === 'all' || item.type === activityFilter.type)
    .filter((item) => !activityFilter.track || item.track_name === activityFilter.track)
    .filter((item) => !activityFilter.from || String(item.activityAt || '').slice(0, 10) >= activityFilter.from)
    .filter((item) => !activityFilter.to || String(item.activityAt || '').slice(0, 10) <= activityFilter.to)
    .sort((a, b) => new Date(b.activityAt || 0) - new Date(a.activityAt || 0))
  const allActivityLaps = activities.flatMap(activityLaps)
  const personalBest = allActivityLaps.length ? Math.min(...allActivityLaps) : null

  return (
    <main className="relative min-h-[calc(100vh-5rem)] overflow-hidden px-5 py-10 sm:px-8 sm:py-14">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(74,164,255,0.18),transparent_38%),linear-gradient(180deg,#f8fbff_0%,#ffffff_100%)]" />
      <div className="relative mx-auto w-full max-w-5xl">
        <div className="flex items-center justify-between gap-3">
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
        </div>

        <div className="relative mt-5 overflow-hidden rounded-[2rem] bg-ink px-7 py-8 text-white shadow-[0_24px_80px_rgba(7,88,216,0.18)] sm:px-10">
          <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-ocean/40 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-sky-400/20 blur-3xl" />
          <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-full border-2 border-white/25 bg-white/10 font-display text-2xl font-extrabold">
                {profile.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={text.photoAlt}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  initialsOf(profile.full_name || profile.nickname, user?.email)
                )}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-blue-300">
                  {text.kicker}
                </p>
                <h1 className="mt-1 truncate font-display text-3xl font-extrabold tracking-[-0.06em] sm:text-4xl">
                  {displayName}
                </h1>
                <p className="truncate text-sm text-slate-300">{user?.email}</p>
              </div>
            </div>
            <span className="inline-flex w-fit items-center gap-2 rounded-full bg-emerald-400/15 px-3.5 py-2 text-xs font-bold text-emerald-300">
              <Check size={14} strokeWidth={3} /> {text.verified}
            </span>
          </div>
        </div>

        <section className="mt-6 rounded-[2rem] border border-blue-100 bg-white p-7 shadow-card sm:p-9">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-mist text-ocean">
              <UserRound size={21} />
            </span>
            <div>
              <h2 className="font-display text-2xl font-extrabold tracking-[-0.05em] text-ink">
                {text.accountTitle}
              </h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">{text.accountSubtitle}</p>
            </div>
          </div>

          {loadError && (
            <p className="mt-5 rounded-xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700">
              {loadError}
            </p>
          )}

          <form onSubmit={handleProfileSubmit} className="mt-6 space-y-5">
            <div className="flex flex-col gap-4 rounded-2xl bg-mist/70 p-4 sm:flex-row sm:items-center">
              <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-full bg-white font-display text-lg font-extrabold text-ocean shadow-sm">
                {profile.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={text.photoAlt}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  initialsOf(profile.full_name || profile.nickname, user?.email)
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-ink">{text.photo}</p>
                <p className="mt-0.5 text-xs text-slate-500">{text.photoHint}</p>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading || loading}
                  className="mt-2 inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-2 text-xs font-bold text-ocean shadow-sm transition hover:bg-blue-50 disabled:cursor-wait disabled:opacity-60"
                >
                  {uploading ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Camera size={14} />
                  )}
                  {uploading ? text.uploading : text.changePhoto}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarChange}
                />
              </div>
            </div>

            {uploadError && (
              <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
                {uploadError}
              </p>
            )}

            <div className="grid gap-5 sm:grid-cols-2">
              <label className="block">
                <span className={labelClass}>{text.fullName}</span>
                <input
                  type="text"
                  value={profile.full_name}
                  onChange={updateField('full_name')}
                  placeholder="Budi Santoso"
                  autoComplete="name"
                  disabled={loading}
                  className={inputClass}
                />
              </label>
              <label className="block">
                <span className={labelClass}>{text.nickname}</span>
                <input
                  type="text"
                  value={profile.nickname}
                  onChange={updateField('nickname')}
                  placeholder="Budi"
                  disabled={loading}
                  className={inputClass}
                />
              </label>
            </div>

            <div>
              <label className="block">
                <span className={labelClass}>{text.ttsName}</span>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={profile.tts_name}
                    onChange={updateField('tts_name')}
                    placeholder="Budi Santoso"
                    disabled={loading}
                    className={inputClass}
                  />
                  <button
                    type="button"
                    onClick={speakTtsName}
                    className="inline-flex shrink-0 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-600 transition hover:border-ocean hover:text-ocean"
                  >
                    <Volume2 size={15} /> {text.testTts}
                  </button>
                </div>
              </label>
              <p className="mt-2 text-xs text-slate-500">{text.ttsHint}</p>
            </div>

            {saveError && (
              <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
                {saveError}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={saving || loading}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-ocean px-5 py-3.5 text-sm font-bold text-white transition hover:bg-[#1855db] disabled:cursor-wait disabled:opacity-60"
              >
                {saving && <Loader2 size={16} className="animate-spin" />}
                {saving ? text.saving : text.save}
              </button>
              {saved && (
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-600">
                  <Check size={16} strokeWidth={3} /> {text.saved}
                </span>
              )}
            </div>
          </form>
        </section>

        <section className="mt-6 rounded-[2rem] border border-blue-100 bg-white p-7 shadow-card sm:p-9">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-mist text-ocean"><Activity size={21} /></span>
              <div><h2 className="font-display text-2xl font-extrabold tracking-[-0.05em] text-ink">{text.activityTitle}</h2><p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">{text.activitySubtitle}</p></div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-2xl bg-blue-50 px-3 py-2"><p className="text-[10px] font-bold uppercase tracking-wide text-ocean">{text.race}</p><p className="font-display text-xl font-extrabold text-ink">{raceSessions.length}</p></div>
              <div className="rounded-2xl bg-amber-50 px-3 py-2"><p className="text-[10px] font-bold uppercase tracking-wide text-amber-700">{text.practice}</p><p className="font-display text-xl font-extrabold text-ink">{practiceSessions.length}</p></div>
              <div className="rounded-2xl bg-emerald-50 px-3 py-2"><p className="text-[10px] font-bold uppercase tracking-wide text-emerald-700">{text.bestLap}</p><p className="font-mono text-sm font-extrabold text-ink">{formatLap(personalBest)}</p></div>
            </div>
          </div>

          <div className="mt-6 grid gap-3 rounded-2xl bg-mist/60 p-4 sm:grid-cols-4">
            <label className="relative sm:col-span-1"><span className="sr-only">{text.all}</span><Filter size={15} className="pointer-events-none absolute left-3 top-4 text-slate-400" /><select value={activityFilter.type} onChange={(event) => setActivityFilter((current) => ({ ...current, type: event.target.value }))} className={`${inputClass} pl-9`}><option value="all">{text.all}</option><option value="race">{text.race}</option><option value="practice">{text.practice}</option></select></label>
            <select value={activityFilter.track} onChange={(event) => setActivityFilter((current) => ({ ...current, track: event.target.value }))} className={inputClass}><option value="">{text.filterTrack}</option>{trackOptions.map((track) => <option key={track} value={track}>{track}</option>)}</select>
            <label className="relative"><CalendarDays size={15} className="pointer-events-none absolute left-3 top-4 text-slate-400" /><input type="date" aria-label={text.from} value={activityFilter.from} onChange={(event) => setActivityFilter((current) => ({ ...current, from: event.target.value }))} className={`${inputClass} pl-9`} /></label>
            <label className="relative"><CalendarDays size={15} className="pointer-events-none absolute left-3 top-4 text-slate-400" /><input type="date" aria-label={text.to} value={activityFilter.to} onChange={(event) => setActivityFilter((current) => ({ ...current, to: event.target.value }))} className={`${inputClass} pl-9`} /></label>
          </div>

          {activityLoading ? <div className="mt-6 flex items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200 py-12 text-sm font-semibold text-slate-500"><Loader2 size={17} className="animate-spin" /> {text.loading}</div> : filteredActivities.length === 0 ? <div className="mt-6 grid place-items-center rounded-2xl border border-dashed border-slate-200 py-12 text-center"><Gauge size={25} className="text-slate-300" /><p className="mt-2 text-sm font-semibold text-slate-500">{text.noActivity}</p></div> : <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200"><ul className="divide-y divide-slate-100">{filteredActivities.map((item) => { const laps = activityLaps(item); const best = laps.length ? Math.min(...laps) : null; return <li key={`${item.type}-${item.id}`} className="flex flex-wrap items-center gap-3 px-4 py-4 transition hover:bg-slate-50"><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${item.type === 'race' ? 'bg-blue-50 text-ocean' : 'bg-amber-50 text-amber-700'}`}>{item.type === 'race' ? <Flag size={18} /> : <Gauge size={18} />}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="truncate text-sm font-bold text-ink">{item.name || item.track_name || text.practice}</p><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${item.type === 'race' ? 'bg-blue-50 text-ocean' : 'bg-amber-50 text-amber-700'}`}>{item.type === 'race' ? text.race : text.practice}</span></div><p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500"><CalendarDays size={13} /> {item.track_name || '—'} · {item.activityAt ? new Date(item.activityAt).toLocaleDateString(language === 'id' ? 'id-ID' : 'en-US', { dateStyle: 'medium' }) : '—'}</p></div><div className="hidden text-right sm:block"><p className="text-xs font-bold text-ink">{laps.length} {text.laps}</p><p className="font-mono text-xs text-slate-500">{formatLap(best)}</p></div>{item.type === 'practice' && <button type="button" onClick={() => togglePractice(item)} className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-2 text-[10px] font-bold text-slate-600 hover:bg-blue-50 hover:text-ocean">{item.visibility === 'public' ? <Eye size={13} /> : <EyeOff size={13} />}{item.visibility === 'public' ? text.public : text.private}</button>}<button type="button" onClick={() => setSelectedActivity(item)} className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-3.5 py-2 text-xs font-bold text-ocean hover:bg-blue-100">{text.viewLog}<ChevronRight size={14} /></button></li> })}</ul></div>}
        </section>

        {selectedActivity && <div className="fixed inset-0 z-[95] grid place-items-center overflow-y-auto bg-slate-950/45 px-5 py-8 backdrop-blur-sm" role="dialog" aria-modal="true"><div className="relative my-auto w-full max-w-2xl rounded-[2rem] bg-white p-7 shadow-2xl sm:p-9"><button type="button" onClick={() => setSelectedActivity(null)} className="absolute right-5 top-5 rounded-full p-2 text-slate-400 hover:bg-slate-100" aria-label="Close">×</button><p className="text-xs font-bold uppercase tracking-[0.2em] text-ocean">{selectedActivity.type === 'race' ? text.race : text.practice}</p><h2 className="mt-2 pr-8 font-display text-3xl font-extrabold tracking-[-0.06em] text-ink">{selectedActivity.name || selectedActivity.track_name || text.practice}</h2><p className="mt-2 text-sm text-slate-500">{selectedActivity.track_name || '—'} · {selectedActivity.activityAt ? new Date(selectedActivity.activityAt).toLocaleString(language === 'id' ? 'id-ID' : 'en-US') : '—'}</p><div className="mt-6 grid grid-cols-3 gap-3"><div className="rounded-2xl bg-mist p-3"><p className="text-[10px] font-bold uppercase text-slate-400">{text.totalLaps}</p><p className="mt-1 font-display text-2xl font-extrabold text-ink">{activityLaps(selectedActivity).length}</p></div><div className="rounded-2xl bg-mist p-3"><p className="text-[10px] font-bold uppercase text-slate-400">{text.bestLap}</p><p className="mt-1 font-mono text-lg font-extrabold text-ink">{formatLap(Math.min(...(activityLaps(selectedActivity).length ? activityLaps(selectedActivity) : [0])))}</p></div><div className="rounded-2xl bg-mist p-3"><p className="text-[10px] font-bold uppercase text-slate-400">{text.visibility}</p><p className="mt-1 text-sm font-extrabold text-ink">{selectedActivity.type === 'practice' ? (selectedActivity.visibility === 'public' ? text.public : text.private) : text.public}</p></div></div><div className="mt-6 max-h-72 overflow-auto rounded-2xl border border-slate-200"><table className="w-full text-left text-sm"><thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-wide text-slate-400"><tr><th className="px-4 py-3">#</th><th className="px-4 py-3">{text.laps}</th><th className="px-4 py-3">{text.bestLap}</th></tr></thead><tbody className="divide-y divide-slate-100">{activityLaps(selectedActivity).map((lap, index) => <tr key={`${selectedActivity.id}-${index}`}><td className="px-4 py-2 font-bold text-slate-400">{index + 1}</td><td className="px-4 py-2 font-mono text-ink">{formatLap(lap)}</td><td className="px-4 py-2 text-slate-500">{lap === Math.min(...activityLaps(selectedActivity)) ? 'Best' : '—'}</td></tr>)}</tbody></table></div></div></div>}

        <section className="mt-6 rounded-[2rem] border border-blue-100 bg-white p-7 shadow-card sm:p-9">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-mist text-ocean">
              <Radio size={21} />
            </span>
            <div>
              <h2 className="font-display text-2xl font-extrabold tracking-[-0.05em] text-ink">
                {text.transponderTitle}
              </h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                {text.transponderSubtitle}
              </p>
            </div>
          </div>

          <form onSubmit={handleAddTransponder} className="mt-6">
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto] lg:items-end">
              <label className="block">
                <span className={labelClass}>{text.transponderId}</span>
                <input
                  type="text"
                  value={form.transponder_id}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, transponder_id: event.target.value }))
                  }
                  placeholder={text.transponderIdHint}
                  inputMode="numeric"
                  maxLength={16}
                  className={`${inputClass} font-mono tracking-wider uppercase`}
                />
              </label>
              <label className="block">
                <span className={labelClass}>{text.rcClass}</span>
                <input
                  type="text"
                  list="rc-class-options"
                  value={form.rc_class}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, rc_class: event.target.value }))
                  }
                  placeholder="1/10 Touring"
                  className={inputClass}
                />
              </label>
              <label className="block">
                <span className={labelClass}>{text.rcBrand}</span>
                <input
                  type="text"
                  list="rc-brand-options"
                  value={form.rc_brand}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, rc_brand: event.target.value }))
                  }
                  placeholder="Tamiya"
                  className={inputClass}
                />
              </label>
              <button
                type="submit"
                disabled={adding}
                className="inline-flex h-[50px] items-center justify-center gap-2 rounded-2xl bg-ocean px-5 text-sm font-bold text-white transition hover:bg-[#1855db] disabled:cursor-wait disabled:opacity-60"
              >
                {adding ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Plus size={16} />
                )}
                {adding ? text.adding : text.addTransponder}
              </button>
            </div>

            <datalist id="rc-class-options">
              {RC_CLASSES.map((value) => (
                <option key={value} value={value} />
              ))}
            </datalist>
            <datalist id="rc-brand-options">
              {RC_BRANDS.map((value) => (
                <option key={value} value={value} />
              ))}
            </datalist>

            {formError && (
              <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
                {formError}
              </p>
            )}
          </form>

          {transLoading ? (
            <div className="mt-7 flex items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200 py-10 text-sm font-semibold text-slate-500">
              <Loader2 size={17} className="animate-spin" /> {text.loading}
            </div>
          ) : transError ? (
            <p className="mt-7 rounded-xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700">
              {transError}
            </p>
          ) : transponders.length === 0 ? (
            <div className="mt-7 grid place-items-center gap-2 rounded-2xl border border-dashed border-slate-200 py-10 text-center">
              <Radio size={24} className="text-slate-300" />
              <p className="text-sm font-semibold text-slate-500">{text.empty}</p>
            </div>
          ) : (
            <ul className="mt-7 divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200">
              {transponders.map((item) => (
                <li key={item.id} className="flex items-center gap-3 px-4 py-4">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-mist text-ocean">
                    <Radio size={18} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-sm font-bold tracking-wider text-ink">
                      {item.transponder_id}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-slate-500">
                      {item.rc_class} · {item.rc_brand}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteTransponder(item.id)}
                    disabled={deletingId === item.id}
                    aria-label={text.delete}
                    className="rounded-full p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-500 disabled:cursor-wait disabled:opacity-50"
                  >
                    {deletingId === item.id ? (
                      <Loader2 size={17} className="animate-spin" />
                    ) : (
                      <Trash2 size={17} />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  )
}
