import { useEffect, useState } from 'react'
import {
  ArrowLeft,
  Check,
  KeyRound,
  Loader2,
  LockKeyhole,
  MapPin,
  Plus,
  Users,
  X,
} from 'lucide-react'
import {
  clubError,
  createClub,
  fetchMyMemberships,
  joinClub,
  joinClubByCode,
  listPublicClubs,
} from './lib/clubs'

const copy = {
  en: {
    kicker: 'YurLaps Community',
    title: 'Find your club. Race together.',
    subtitle:
      'Browse public clubs, join with a code, or create your own community for your track and drivers.',
    back: 'Back to site',
    create: 'Create club',
    createTitle: 'Create a club',
    createSubtitle: 'Set up your community. You become the leader automatically.',
    name: 'Club name',
    namePlaceholder: 'Example: Bandung RC Racing',
    description: 'Description',
    descriptionPlaceholder: 'What is your club about?',
    address: 'Address',
    addressPlaceholder: 'City or track address',
    visibility: 'Visibility',
    visibilityPublic: 'Public — shown in the community list',
    visibilityPrivate: 'Private — join with an 8-digit code',
    joinMethod: 'Apply method',
    joinOpen: 'Open — members join instantly',
    joinApproval: 'Approval — leader or officers approve requests',
    cancel: 'Cancel',
    creating: 'Creating...',
    createSubmit: 'Create club',
    nameRequired: 'Please enter a club name.',
    codeTitle: 'Join a private club',
    codeSubtitle: 'Enter the 8-digit code shared by the club leader.',
    codePlaceholder: '12345678',
    joinWithCode: 'Join with code',
    joining: 'Joining...',
    clubs: 'Public clubs',
    clubCount: 'clubs',
    noClubs: 'No public clubs yet. Be the first to create one.',
    noDescription: 'No description yet.',
    noAddress: 'No address yet.',
    members: 'members',
    openJoin: 'Open join',
    approvalJoin: 'Approval required',
    join: 'Join club',
    requestJoin: 'Request to join',
    openClub: 'Open club',
    pending: 'Pending approval',
    requestSent: 'Your request was sent. A leader or officer will review it.',
    codeFormat: 'Enter the 8-digit join code.',
    joined: 'You joined the club.',
    createRequiresLogin: 'Log in to create a club.',
    joinRequiresLogin: 'Log in to join this club.',
    loading: 'Loading community...',
    loginToCreate: 'Log in to create a club',
    emptyAction: 'Create the first club',
  },
  id: {
    kicker: 'Community YurLaps',
    title: 'Temukan club-mu. Balapan bersama.',
    subtitle:
      'Jelajahi club publik, join dengan kode, atau buat community sendiri untuk lintasan dan driver kamu.',
    back: 'Kembali ke situs',
    create: 'Buat club',
    createTitle: 'Buat club',
    createSubtitle: 'Siapkan community kamu. Kamu otomatis menjadi leader.',
    name: 'Nama club',
    namePlaceholder: 'Contoh: Bandung RC Racing',
    description: 'Deskripsi',
    descriptionPlaceholder: 'Club kamu tentang apa?',
    address: 'Alamat',
    addressPlaceholder: 'Kota atau alamat lintasan',
    visibility: 'Visibilitas',
    visibilityPublic: 'Publik — tampil di daftar community',
    visibilityPrivate: 'Privat — join dengan kode 8 digit',
    joinMethod: 'Metode join',
    joinOpen: 'Langsung — member langsung masuk',
    joinApproval: 'Approval — leader atau officer menyetujui',
    cancel: 'Batal',
    creating: 'Membuat...',
    createSubmit: 'Buat club',
    nameRequired: 'Silakan isi nama club.',
    codeTitle: 'Join club privat',
    codeSubtitle: 'Masukkan kode 8 digit yang dibagikan leader club.',
    codePlaceholder: '12345678',
    joinWithCode: 'Join dengan kode',
    joining: 'Bergabung...',
    clubs: 'Club publik',
    clubCount: 'club',
    noClubs: 'Belum ada club publik. Jadilah yang pertama membuatnya.',
    noDescription: 'Belum ada deskripsi.',
    noAddress: 'Belum ada alamat.',
    members: 'member',
    openJoin: 'Join langsung',
    approvalJoin: 'Perlu approval',
    join: 'Join club',
    requestJoin: 'Minta join',
    openClub: 'Buka club',
    pending: 'Menunggu approval',
    requestSent: 'Permintaan kamu terkirim. Leader atau officer akan meninjaunya.',
    codeFormat: 'Masukkan kode join 8 digit.',
    joined: 'Kamu berhasil join club.',
    createRequiresLogin: 'Login untuk membuat club.',
    joinRequiresLogin: 'Login untuk join club ini.',
    loading: 'Memuat community...',
    loginToCreate: 'Login untuk membuat club',
    emptyAction: 'Buat club pertama',
  },
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

export default function CommunityPage({ session, language, onBack, onRequireLogin, onOpenClub }) {
  const text = copy[language] || copy.en
  const [clubs, setClubs] = useState([])
  const [memberships, setMemberships] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [joiningCode, setJoiningCode] = useState(false)
  const [joiningId, setJoiningId] = useState('')
  const [codeError, setCodeError] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [form, setForm] = useState({
    name: '',
    description: '',
    address: '',
    visibility: 'public',
    join_method: 'open',
  })

  const loadCommunity = async () => {
    setLoading(true)
    setError('')
    try {
      const [clubRows, membershipRows] = await Promise.all([
        listPublicClubs(),
        session ? fetchMyMemberships(session.user.id) : Promise.resolve([]),
      ])
      setClubs(clubRows)
      setMemberships(
        Object.fromEntries(membershipRows.map((membership) => [membership.club_id, membership])),
      )
    } catch (loadError) {
      setError(clubError(loadError, language))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCommunity()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id])

  const openCreate = () => {
    if (!session) {
      onRequireLogin()
      return
    }
    setCreateError('')
    setCreateOpen(true)
  }

  const handleJoin = async (club) => {
    if (!session) {
      onRequireLogin()
      return
    }
    setJoiningId(club.id)
    setError('')
    setMessage('')
    try {
      const status = await joinClub(club.id)
      if (status === 'active') {
        onOpenClub(club.id)
        return
      }
      setMemberships((current) => ({
        ...current,
        [club.id]: { club_id: club.id, role: 'member', status: 'pending' },
      }))
      setMessage(text.requestSent)
    } catch (joinError) {
      setError(clubError(joinError, language))
    } finally {
      setJoiningId('')
    }
  }

  const handleCodeJoin = async (event) => {
    event.preventDefault()
    if (!session) {
      onRequireLogin()
      return
    }
    const code = joinCode.trim()
    if (!/^\d{8}$/.test(code)) {
      setCodeError(text.codeFormat)
      return
    }
    setJoiningCode(true)
    setCodeError('')
    setMessage('')
    try {
      const result = await joinClubByCode(code)
      if (!result) {
        setCodeError(text.codeFormat)
        return
      }
      setJoinCode('')
      if (result.status === 'active') {
        onOpenClub(result.club_id)
        return
      }
      setMessage(text.requestSent)
      await loadCommunity()
    } catch (joinError) {
      setCodeError(clubError(joinError, language))
    } finally {
      setJoiningCode(false)
    }
  }

  const handleCreate = async (event) => {
    event.preventDefault()
    if (!session) {
      onRequireLogin()
      return
    }
    if (!form.name.trim()) {
      setCreateError(text.nameRequired)
      return
    }
    setCreating(true)
    setCreateError('')
    try {
      const clubId = await createClub(session.user, form)
      setCreateOpen(false)
      onOpenClub(clubId)
    } catch (createClubError) {
      setCreateError(clubError(createClubError, language))
    } finally {
      setCreating(false)
    }
  }

  const renderAction = (club) => {
    const membership = memberships[club.id]
    if (membership?.status === 'active') {
      return (
        <button
          type="button"
          onClick={() => onOpenClub(club.id)}
          className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-700 transition hover:bg-emerald-100"
        >
          <Check size={14} /> {text.openClub}
        </button>
      )
    }
    if (membership?.status === 'pending') {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-4 py-2 text-xs font-bold text-amber-700">
          <LockKeyhole size={14} /> {text.pending}
        </span>
      )
    }
    return (
      <button
        type="button"
        onClick={() => handleJoin(club)}
        disabled={joiningId === club.id}
        className="inline-flex items-center gap-1.5 rounded-full bg-ocean px-4 py-2 text-xs font-bold text-white transition hover:bg-[#1855db] disabled:cursor-wait disabled:opacity-60"
      >
        {joiningId === club.id ? (
          <Loader2 size={14} className="animate-spin" />
        ) : (
          <Plus size={14} />
        )}
        {club.join_method === 'approval' ? text.requestJoin : text.join}
      </button>
    )
  }

  return (
    <main className="relative min-h-[calc(100vh-5rem)] overflow-hidden px-5 py-10 sm:px-8 sm:py-14">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(74,164,255,0.18),transparent_38%),linear-gradient(180deg,#f8fbff_0%,#ffffff_100%)]" />
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
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-full bg-ocean px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#1855db]"
          >
            <Plus size={16} /> {text.create}
          </button>
        </div>

        <div className="mt-6">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-ocean">{text.kicker}</p>
          <h1 className="mt-3 max-w-2xl font-display text-4xl font-extrabold leading-[0.98] tracking-[-0.07em] text-ink sm:text-5xl">
            {text.title}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-500">{text.subtitle}</p>
        </div>

        <form
          onSubmit={handleCodeJoin}
          className="mt-8 rounded-[2rem] border border-blue-100 bg-white p-6 shadow-card sm:p-7"
        >
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-mist text-ocean">
              <KeyRound size={21} />
            </span>
            <div>
              <h2 className="font-display text-xl font-extrabold tracking-[-0.04em] text-ink">
                {text.codeTitle}
              </h2>
              <p className="mt-1 text-sm text-slate-500">{text.codeSubtitle}</p>
            </div>
          </div>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              inputMode="numeric"
              maxLength={8}
              value={joinCode}
              onChange={(event) => setJoinCode(event.target.value.replace(/\D/g, ''))}
              placeholder={text.codePlaceholder}
              className={`${inputClass} max-w-xs text-center font-mono text-lg font-bold tracking-[0.3em]`}
            />
            <button
              type="submit"
              disabled={joiningCode}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-ink px-5 py-3.5 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-wait disabled:opacity-60"
            >
              {joiningCode && <Loader2 size={16} className="animate-spin" />}
              {joiningCode ? text.joining : text.joinWithCode}
            </button>
          </div>
          {codeError && (
            <p className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
              {codeError}
            </p>
          )}
        </form>

        {error && (
          <p className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
            {error}
          </p>
        )}
        {message && (
          <p className="mt-5 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
            {message}
          </p>
        )}

        <div className="mt-10 flex items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl font-extrabold tracking-[-0.05em] text-ink">
              {text.clubs}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {clubs.length} {text.clubCount}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="mt-6 flex items-center justify-center gap-2 rounded-[2rem] border border-dashed border-slate-200 py-16 text-sm font-semibold text-slate-500">
            <Loader2 size={18} className="animate-spin" /> {text.loading}
          </div>
        ) : clubs.length === 0 ? (
          <div className="mt-6 grid place-items-center gap-3 rounded-[2rem] border border-dashed border-slate-200 py-16 text-center">
            <Users size={28} className="text-slate-300" />
            <p className="max-w-sm text-sm font-semibold text-slate-500">{text.noClubs}</p>
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-2 rounded-full bg-ocean px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#1855db]"
            >
              <Plus size={16} /> {text.emptyAction}
            </button>
          </div>
        ) : (
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            {clubs.map((club) => (
              <article
                key={club.id}
                className="flex flex-col rounded-[2rem] border border-blue-100 bg-white p-6 shadow-card"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-2xl bg-mist font-display text-lg font-extrabold text-ocean">
                    {club.avatar_url ? <img src={club.avatar_url} alt={club.name} className="h-full w-full object-cover" /> : initialsOf(club.name)}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-ocean">
                    <Users size={12} /> {club.member_count} {text.members}
                  </span>
                </div>
                <h3 className="mt-4 font-display text-2xl font-extrabold tracking-[-0.05em] text-ink">
                  {club.name}
                </h3>
                <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-500">
                  {club.description || text.noDescription}
                </p>
                <p className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                  <MapPin size={14} /> {club.address || text.noAddress}
                </p>
                <div className="mt-auto flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                    <LockKeyhole size={14} />
                    {club.join_method === 'approval' ? text.approvalJoin : text.openJoin}
                  </span>
                  {renderAction(club)}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {createOpen && (
        <div
          className="fixed inset-0 z-[95] grid place-items-center overflow-y-auto bg-slate-950/45 px-5 py-8 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-club-title"
        >
          <div className="relative w-full max-w-lg rounded-[2rem] bg-white p-7 shadow-2xl sm:p-9">
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              className="absolute right-4 top-4 rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-ink"
              aria-label={text.cancel}
            >
              <X size={19} />
            </button>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-ocean">{text.kicker}</p>
            <h2
              id="create-club-title"
              className="mt-2 font-display text-3xl font-extrabold tracking-[-0.06em] text-ink"
            >
              {text.createTitle}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">{text.createSubtitle}</p>

            <form onSubmit={handleCreate} className="mt-6 space-y-4">
              <label className="block">
                <span className={labelClass}>{text.name}</span>
                <input
                  type="text"
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder={text.namePlaceholder}
                  className={inputClass}
                />
              </label>
              <label className="block">
                <span className={labelClass}>{text.description}</span>
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, description: event.target.value }))
                  }
                  placeholder={text.descriptionPlaceholder}
                  className={`${inputClass} resize-none`}
                />
              </label>
              <label className="block">
                <span className={labelClass}>{text.address}</span>
                <input
                  type="text"
                  value={form.address}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, address: event.target.value }))
                  }
                  placeholder={text.addressPlaceholder}
                  className={inputClass}
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className={labelClass}>{text.visibility}</span>
                  <select
                    value={form.visibility}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, visibility: event.target.value }))
                    }
                    className={inputClass}
                  >
                    <option value="public">{text.visibilityPublic}</option>
                    <option value="private">{text.visibilityPrivate}</option>
                  </select>
                </label>
                <label className="block">
                  <span className={labelClass}>{text.joinMethod}</span>
                  <select
                    value={form.join_method}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, join_method: event.target.value }))
                    }
                    className={inputClass}
                  >
                    <option value="open">{text.joinOpen}</option>
                    <option value="approval">{text.joinApproval}</option>
                  </select>
                </label>
              </div>

              {createError && (
                <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
                  {createError}
                </p>
              )}

              <div className="flex flex-col gap-2 pt-2 sm:flex-row">
                <button
                  type="submit"
                  disabled={creating}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-ocean px-5 py-3.5 text-sm font-bold text-white transition hover:bg-[#1855db] disabled:cursor-wait disabled:opacity-60"
                >
                  {creating && <Loader2 size={16} className="animate-spin" />}
                  {creating ? text.creating : text.createSubmit}
                </button>
                <button
                  type="button"
                  onClick={() => setCreateOpen(false)}
                  className="rounded-2xl border border-slate-200 px-5 py-3.5 text-sm font-bold text-slate-600 transition hover:bg-slate-50"
                >
                  {text.cancel}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  )
}
