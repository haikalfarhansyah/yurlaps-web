import { useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  Camera,
  Check,
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
import { fetchPracticeSessions, updatePracticeVisibility } from './lib/clubs'
import { supabase } from './lib/supabase'

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
    activityTitle: 'My activity', activitySubtitle: 'Race and practice history linked to this account.', practice: 'Practice', race: 'Race', private: 'Private', public: 'Public',
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
    activityTitle: 'Aktivitas saya', activitySubtitle: 'Riwayat race dan practice yang tertaut ke akun ini.', practice: 'Practice', race: 'Race', private: 'Private', public: 'Public',
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

  useEffect(() => {
    if (!user) return undefined
    let active = true
    setLoading(true)
    setTransLoading(true)
    setLoadError('')
    setTransError('')

    Promise.allSettled([fetchProfile(user), fetchTransponders(user.id), fetchPracticeSessions(user.id), supabase?.from('races').select('id,name,track_name,raced_at').eq('created_by', user.id).order('raced_at', { ascending: false }).limit(20)]).then((results) => {
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
      if (results[3]?.status === 'fulfilled' && !results[3].value.error) setRaceSessions(results[3].value.data || [])

      setLoading(false)
      setTransLoading(false)
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
          <h2 className="font-display text-2xl font-extrabold tracking-[-0.05em] text-ink">{text.activityTitle}</h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">{text.activitySubtitle}</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-mist/60 p-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-400">{text.race}</p><p className="mt-1 font-display text-3xl font-extrabold text-ink">{raceSessions.length}</p><div className="mt-2 space-y-1">{raceSessions.slice(0, 4).map((row) => <p key={row.id} className="truncate text-xs font-semibold text-slate-600">{row.name} · {row.track_name || '—'}</p>)}</div></div>
            <div className="rounded-2xl bg-mist/60 p-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-400">{text.practice}</p><p className="mt-1 font-display text-3xl font-extrabold text-ink">{practiceSessions.length}</p><div className="mt-2 space-y-2">{practiceSessions.slice(0, 4).map((row) => <div key={row.id} className="flex items-center justify-between gap-2"><span className="truncate text-xs font-semibold text-slate-600">{row.track_name || '—'}</span><button type="button" onClick={() => togglePractice(row)} className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-ocean">{row.visibility === 'public' ? text.public : text.private}</button></div>)}</div></div>
          </div>
        </section>

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
