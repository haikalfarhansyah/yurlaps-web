import { useEffect, useState } from 'react'
import { Flag, Plus, RefreshCw } from 'lucide-react'
import RaceResultView from './RaceResultView'
import { applyClubEvent, eventError, fetchClubEvents, myEventTransponders, newClubEvent, saveClubEvent } from './lib/events'
import { openRacePdfReport } from './lib/racePdf'
import { normalizeRaceRows } from './lib/raceIdentity'

const statuses = { draft: 'Draft', registration: 'Pendaftaran', running: 'Berjalan', completed: 'Selesai' }
const kinds = { qualifying: 'Kualifikasi', heat: 'Heat', main: 'Main', final: 'Final', practice: 'Practice' }
const input = 'min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-ink'

function stageRace(stage, races) {
  return races.find((race) => race.source_race_id === stage.race_id || race.id === stage.race_id) || null
}

function EventDetails({ event, races, operator, onChange, busy }) {
  const [selectedStage, setSelectedStage] = useState(null)
  const [stageDraft, setStageDraft] = useState({ class_id: '', name: '', kind: 'qualifying', group: 'Semua', target: 'time', value: 300, rank: 'best', entryIds: [] })
  const [message, setMessage] = useState('')
  const selected = event.stages.find((stage) => stage.id === selectedStage) || null
  const race = selected ? stageRace(selected, races) : null
  const className = (id) => event.classes.find((item) => item.id === id)?.name || 'Kelas'
  const save = async (change) => {
    try { setMessage(''); await onChange(change) } catch (error) { setMessage(error.message) }
  }
  const addStage = (formEvent) => {
    formEvent.preventDefault()
    const klass = stageDraft.class_id || event.classes[0]?.id
    const value = Number(stageDraft.value)
    if (!klass || !stageDraft.name.trim() || !Number.isInteger(value) || value <= 0) return setMessage('Isi kelas, nama sesi, dan target yang valid.')
    if (stageDraft.group.trim() !== 'Semua' && !stageDraft.entryIds.length) return setMessage('Pilih peserta untuk grup ini.')
    const cfg = {
      name: stageDraft.name.trim(), target: stageDraft.target, value,
      target_time_ms: stageDraft.target === 'time' ? value * 1000 : null,
      rank: stageDraft.rank, start_mode: stageDraft.rank === 'position' ? 'grid' : 'staggered',
      cd: 5, sound: true, countdown_step_ms: 1500, random_delay_max: 2,
      finish_current_lap: stageDraft.target === 'time', stagger_mode: 'manual', stagger_gap_ms: 10000,
    }
    save((current) => ({ ...current, stages: [...current.stages, {
      id: crypto.randomUUID(), class_id: klass, kind: stageDraft.kind,
      name: stageDraft.name.trim(), group: stageDraft.group.trim() || 'Semua',
      cfg, status: 'planned', race_id: null, entry_ids: stageDraft.entryIds, sequence: current.stages.length + 1,
    }] }))
    setStageDraft((old) => ({ ...old, name: '' }))
  }
  return <div className="space-y-5">
    <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3"><div>
        <p className="text-xs font-bold text-ocean">{statuses[event.status] || event.status} · {event.date || 'Tanggal belum diisi'}</p>
        <h3 className="mt-1 text-xl font-extrabold text-ink">{event.name}</h3>
        <p className="mt-1 text-sm text-slate-600">{event.track_name} · {event.classes.map((item) => item.name).join(', ')}</p>
      </div>{operator && <div className="flex gap-2">{event.status === 'draft' && <button disabled={busy} onClick={() => save((current) => ({ ...current, status: 'registration' }))} className="min-h-11 rounded-xl bg-ocean px-4 text-sm font-bold text-white disabled:opacity-50">Buka pendaftaran</button>}{event.status === 'registration' && <button disabled={busy} onClick={() => save((current) => ({ ...current, status: 'running' }))} className="min-h-11 rounded-xl bg-ocean px-4 text-sm font-bold text-white disabled:opacity-50">Mulai event</button>}{event.status === 'running' && <button disabled={busy} onClick={() => save((current) => ({ ...current, status: 'completed' }))} className="min-h-11 rounded-xl border border-slate-300 px-4 text-sm font-bold text-ink disabled:opacity-50">Tutup event</button>}</div>}</div>
    </div>
    {message && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{message}</p>}
    {!!event.published_standings?.length && <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6"><h4 className="font-bold text-ink">Klasemen Event</h4><p className="mt-1 text-xs text-slate-500">{event.best_legs || 1} leg terbaik dihitung dari Main/Final.</p>{event.published_standings.map((group) => <div key={`${group.class_id}:${group.group}`} className="mt-4 overflow-x-auto"><h5 className="mb-2 text-sm font-bold text-ink">{className(group.class_id)} · {group.group}</h5><table className="w-full min-w-[400px] text-left text-sm"><thead className="border-b border-slate-200 text-xs text-slate-500"><tr><th className="py-2">Pos</th><th>Pembalap</th><th className="text-right">Poin</th></tr></thead><tbody>{group.drivers.map((driver) => <tr key={driver.entry_id || `${group.class_id}:${group.group}:${driver.position}`} className="border-b border-slate-100"><td className="py-2">{driver.position}</td><td>{driver.nick || driver.name}</td><td className="text-right font-bold text-ocean">{driver.points}</td></tr>)}</tbody></table></div>)}</div>}
    <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6"><h4 className="font-bold text-ink">Peserta per kelas</h4>
      {event.classes.map((klass) => <div key={klass.id} className="mt-4"><h5 className="border-b border-slate-100 pb-2 text-sm font-bold text-ink">{klass.name}</h5>
        {(event.entries || []).filter((entry) => entry.class_id === klass.id).map((entry) => <div key={entry.id} className="flex flex-wrap items-center gap-2 border-b border-slate-100 py-3 text-sm"><span className="min-w-0 flex-1"><b className="text-ink">{entry.nick || entry.name}</b><small className="ml-2 text-slate-500">{entry.transponder ? `TP ${entry.transponder} · ` : ''}{entry.car_brand || 'Mobil'}</small></span><span className="text-xs text-slate-600">{entry.approved ? entry.checked_in ? 'Hadir' : 'Disetujui' : 'Menunggu persetujuan'}</span>{operator && !entry.approved && <button disabled={busy} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-ink" onClick={() => save((current) => ({ ...current, entries: current.entries.map((item) => item.id === entry.id ? { ...item, approved: true } : item) }))}>Setujui</button>}{operator && entry.approved && <button disabled={busy} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-ink" onClick={() => save((current) => ({ ...current, entries: current.entries.map((item) => item.id === entry.id ? { ...item, checked_in: !item.checked_in } : item) }))}>{entry.checked_in ? 'Batalkan hadir' : 'Check-in'}</button>}</div>)}
        {!event.entries.some((entry) => entry.class_id === klass.id) && <p className="py-3 text-sm text-slate-500">Belum ada peserta.</p>}
      </div>)}
    </div>
    <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6"><h4 className="font-bold text-ink">Jadwal dan hasil sesi</h4>
      <div className="mt-3 divide-y divide-slate-100">{event.stages.map((stage) => <button key={stage.id} type="button" onClick={() => setSelectedStage(stage.id)} className={`flex min-h-14 w-full items-center gap-3 py-2 text-left text-sm hover:text-ocean ${selectedStage === stage.id ? 'text-ocean' : 'text-ink'}`}><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-xs font-bold">{stage.sequence}</span><span className="min-w-0 flex-1"><b className="block truncate">{stage.name}</b><small className="text-slate-500">{className(stage.class_id)} · {kinds[stage.kind] || stage.kind} · {stage.group}</small></span><span className="text-xs font-semibold text-slate-500">{stage.status === 'saved' ? 'Hasil' : stage.status === 'live' ? 'Live' : 'Terjadwal'}</span></button>)}</div>
      {!event.stages.length && <p className="mt-3 text-sm text-slate-500">Belum ada sesi terjadwal.</p>}
      {selected && <div className="mt-5 border-t border-slate-200 pt-5"><h5 className="font-bold text-ink">{selected.name}</h5>{race ? <><div className="mt-4"><RaceResultView race={race} /></div><button type="button" onClick={() => openRacePdfReport({ race, rows: normalizeRaceRows(race), language: 'id' })} className="mt-4 min-h-11 rounded-xl bg-ocean px-4 text-sm font-bold text-white">Download PDF</button></> : <p className="mt-2 text-sm text-slate-500">Hasil muncul setelah sesi dijalankan dan disinkronkan dari aplikasi.</p>}</div>}
      {operator && event.status !== 'completed' && <form onSubmit={addStage} className="mt-5 grid gap-3 border-t border-slate-200 pt-5 sm:grid-cols-2"><h5 className="sm:col-span-2 font-bold text-ink">Tambahkan sesi</h5><label className="text-xs font-semibold text-slate-600">Kelas<select className={input} value={stageDraft.class_id} onChange={(e) => setStageDraft({ ...stageDraft, class_id: e.target.value, entryIds: [] })}><option value="">{event.classes[0]?.name || 'Pilih kelas'}</option>{event.classes.map((klass) => <option key={klass.id} value={klass.id}>{klass.name}</option>)}</select></label><label className="text-xs font-semibold text-slate-600">Jenis sesi<select className={input} value={stageDraft.kind} onChange={(e) => setStageDraft({ ...stageDraft, kind: e.target.value })}>{Object.entries(kinds).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label><label className="text-xs font-semibold text-slate-600">Nama sesi<input required className={input} value={stageDraft.name} onChange={(e) => setStageDraft({ ...stageDraft, name: e.target.value })} placeholder="Contoh: Kualifikasi R1" /></label><label className="text-xs font-semibold text-slate-600">Grup<input className={input} value={stageDraft.group} onChange={(e) => setStageDraft({ ...stageDraft, group: e.target.value })} /></label><label className="text-xs font-semibold text-slate-600">Target<select className={input} value={stageDraft.target} onChange={(e) => setStageDraft({ ...stageDraft, target: e.target.value })}><option value="time">Detik</option><option value="laps">Lap</option></select></label><label className="text-xs font-semibold text-slate-600">Jumlah<input required min="1" type="number" className={input} value={stageDraft.value} onChange={(e) => setStageDraft({ ...stageDraft, value: e.target.value })} /></label><label className="text-xs font-semibold text-slate-600">Penilaian<select className={input} value={stageDraft.rank} onChange={(e) => setStageDraft({ ...stageDraft, rank: e.target.value })}><option value="best">Best lap</option><option value="result">Lap dan waktu</option><option value="position">Posisi lintasan</option><option value="top3">Top 3 average</option><option value="consecutive">Top 3 consecutive</option></select></label><div className="sm:col-span-2"><p className="text-xs font-semibold text-slate-600">Peserta sesi (kosong berarti semua peserta kelas)</p><div className="mt-2 flex flex-wrap gap-3">{event.entries.filter((entry) => entry.class_id === (stageDraft.class_id || event.classes[0]?.id)).map((entry) => <label key={entry.id} className="flex items-center gap-1.5 text-xs text-ink"><input type="checkbox" checked={stageDraft.entryIds.includes(entry.id)} onChange={(e) => setStageDraft((current) => ({ ...current, entryIds: e.target.checked ? [...current.entryIds, entry.id] : current.entryIds.filter((id) => id !== entry.id) }))} />{entry.nick || entry.name}</label>)}</div></div><button type="submit" disabled={busy} className="min-h-11 self-end rounded-xl border border-ocean px-4 text-sm font-bold text-ocean disabled:opacity-50">Tambah sesi</button></form>}
    </div>
  </div>
}

export default function ClubEventsPage({ clubId, tracks = [], races = [], operator = false, userId = null, publicView = false }) {
  const [events, setEvents] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [view, setView] = useState('active')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [cars, setCars] = useState([])
  const [form, setForm] = useState({ name: '', date: '', trackId: '', format: 'qualifying_main', classes: '', bestLegs: 1, points: '25,18,15,12,10,8,6,4,2,1' })
  const [application, setApplication] = useState({ classId: '', transponder: '' })
  const refresh = async () => {
    try { const rows = await fetchClubEvents(clubId, { publicView: publicView || !operator }); setEvents(rows); setError(''); setSelectedId((id) => rows.some((row) => row.id === id) ? id : rows.find((row) => row.status !== 'completed')?.id || rows[0]?.id || null) }
    catch (cause) { setError(eventError(cause)) }
    finally { setLoading(false) }
  }
  useEffect(() => { setLoading(true); setSelectedId(null); refresh(); const timer = window.setInterval(refresh, 20000); return () => window.clearInterval(timer) }, [clubId, publicView])
  useEffect(() => { myEventTransponders(userId).then(setCars).catch(() => setCars([])) }, [userId])
  const selected = events.find((event) => event.id === selectedId) || null
  const save = async (transform) => {
    if (!selected) return
    setBusy(true)
    try {
      const changed = transform(selected)
      const next = { ...changed, revision: (selected.revision || 0) + 1, updated_at: Date.now() / 1000 }
      await saveClubEvent(next, selected.remote_revision)
      await refresh()
    } catch (cause) { setError(eventError(cause)); throw cause }
    finally { setBusy(false) }
  }
  const create = async (event) => {
    event.preventDefault(); setBusy(true)
    try {
      const klasses = form.classes.split(',').map((item) => item.trim()).filter(Boolean)
      const points = form.points.split(',').map((item) => Number(item.trim()))
      if (!points.length || points.some((point) => !Number.isInteger(point) || point < 0)) throw Error('Tabel poin harus angka bulat nonnegatif.')
      const track = tracks.find((item) => item.id === (form.trackId || tracks[0]?.id))
      const draft = newClubEvent({ clubId, name: form.name, date: form.date, track, format: form.format, classes: klasses, bestLegs: form.bestLegs, points })
      const saved = await saveClubEvent(draft)
      await refresh(); setSelectedId(saved.id); setView('active'); setForm({ ...form, name: '', classes: '' })
    } catch (cause) { setError(eventError(cause)) }
    finally { setBusy(false) }
  }
  const apply = async (event) => {
    event.preventDefault(); setBusy(true)
    try { await applyClubEvent(selected.id, application.classId || selected.classes[0]?.id, application.transponder || cars[0]?.transponder_id); setNotice('Pendaftaran dikirim. Operator akan meninjau dan melakukan check-in.'); await refresh() }
    catch (cause) { setError(eventError(cause)) }
    finally { setBusy(false) }
  }
  const shown = events.filter((event) => view === 'history' ? event.status === 'completed' : event.status !== 'completed')
  return <section className="mt-6 rounded-[2rem] border border-blue-100 bg-white p-5 sm:p-8">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-ocean">YurLaps Club</p><h2 className="mt-1 text-2xl font-extrabold text-ink">Event</h2><p className="mt-1 text-sm text-slate-600">Jadwal, peserta, dan hasil per kelas.</p></div><button type="button" onClick={refresh} className="grid h-11 w-11 place-items-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50" aria-label="Muat ulang Event"><RefreshCw size={17} /></button></div>
    <div className="mt-5 flex gap-2 border-b border-slate-200">{[['active','Event aktif'],['history','Riwayat event'], ...(operator ? [['create','Buat event']] : [])].map(([id,label]) => <button key={id} type="button" onClick={() => setView(id)} className={`min-h-11 border-b-2 px-3 text-sm font-bold ${view === id ? 'border-ocean text-ocean' : 'border-transparent text-slate-500'}`}>{label}</button>)}</div>
    {error && <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
    {notice && <p role="status" className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
    {loading ? <p className="py-10 text-center text-sm text-slate-500">Memuat Event…</p> : view === 'create' && operator ? <form onSubmit={create} className="mt-6 grid gap-4 sm:grid-cols-2"><label className="text-xs font-semibold text-slate-600">Nama event<input required maxLength="100" className={input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label><label className="text-xs font-semibold text-slate-600">Tanggal<input required type="date" className={input} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label><label className="text-xs font-semibold text-slate-600">Track<select required className={input} value={form.trackId} onChange={(e) => setForm({ ...form, trackId: e.target.value })}><option value="">{tracks[0]?.name || 'Belum ada track'}</option>{tracks.map((track) => <option key={track.id} value={track.id}>{track.name}</option>)}</select></label><label className="text-xs font-semibold text-slate-600">Format<select className={input} value={form.format} onChange={(e) => setForm({ ...form, format: e.target.value })}><option value="qualifying_main">Kualifikasi → Main</option><option value="heat_final">Heat → Final</option></select></label><label className="sm:col-span-2 text-xs font-semibold text-slate-600">Kelas, pisahkan dengan koma<input required className={input} value={form.classes} onChange={(e) => setForm({ ...form, classes: e.target.value })} placeholder="1/10 Buggy, 1/8 Buggy" /></label><label className="text-xs font-semibold text-slate-600">Leg terbaik dihitung<input required min="1" max="10" type="number" className={input} value={form.bestLegs} onChange={(e) => setForm({ ...form, bestLegs: e.target.value })} /></label><label className="text-xs font-semibold text-slate-600">Poin per posisi<input required className={input} value={form.points} onChange={(e) => setForm({ ...form, points: e.target.value })} /></label><button disabled={busy || !tracks.length} type="submit" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-ocean px-5 text-sm font-bold text-white disabled:opacity-50 sm:col-span-2 sm:justify-self-end"><Plus size={16} /> Simpan event</button></form> : <div className="mt-6 grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]"><div className="space-y-2">{shown.map((event) => <button key={event.id} onClick={() => setSelectedId(event.id)} className={`w-full rounded-xl border p-3 text-left ${selectedId === event.id ? 'border-ocean bg-blue-50' : 'border-slate-200 hover:border-blue-200'}`}><b className="block text-sm text-ink">{event.name}</b><small className="mt-1 block text-slate-500">{event.date || 'Tanpa tanggal'} · {statuses[event.status]}</small></button>)}{!shown.length && <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Belum ada Event di bagian ini.</p>}</div><div>{selected && shown.some((event) => event.id === selected.id) ? <><EventDetails key={selected.id} event={selected} races={races} operator={operator} onChange={save} busy={busy} />{selected.status === 'registration' && userId && !operator && <form onSubmit={apply} className="mt-5 grid gap-3 rounded-2xl border border-slate-200 p-5 sm:grid-cols-3"><h3 className="sm:col-span-3 font-bold text-ink">Daftar ke Event</h3><select className={input} aria-label="Pilih kelas" value={application.classId} onChange={(e) => setApplication({ ...application, classId: e.target.value })}><option value="">{selected.classes[0]?.name || 'Pilih kelas'}</option>{selected.classes.map((klass) => <option key={klass.id} value={klass.id}>{klass.name}</option>)}</select><select className={input} aria-label="Pilih transponder" value={application.transponder} onChange={(e) => setApplication({ ...application, transponder: e.target.value })}><option value="">{cars[0]?.transponder_id || 'Belum ada transponder'}</option>{cars.map((car) => <option key={car.transponder_id} value={car.transponder_id}>{car.transponder_id} · {car.rc_brand || 'Mobil'}</option>)}</select><button disabled={busy || !cars.length} type="submit" className="min-h-11 rounded-xl bg-ocean px-4 text-sm font-bold text-white disabled:opacity-50">Kirim pendaftaran</button><p className="sm:col-span-3 text-xs text-slate-500">Pendaftaran berlaku setelah disetujui operator dan check-in.</p></form>}{selected.status === 'registration' && !userId && <p className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">Login untuk mendaftar dengan transponder milik akun Anda.</p>}</> : <div className="grid min-h-40 place-items-center rounded-2xl bg-slate-50 text-center text-sm text-slate-500"><div><Flag className="mx-auto mb-2" size={20} />Pilih Event untuk melihat detail.</div></div>}</div></div>}
  </section>
}
