import { useEffect, useRef, useState } from 'react'
import { Maximize2, Minimize2, Radio } from 'lucide-react'
import { supabase } from './lib/supabase'

const STALE_MS = 15000

function duration(ms) {
  if (ms === null || ms === undefined || !Number.isFinite(Number(ms))) return '—'
  const value = Math.max(0, Number(ms))
  return `${Math.floor(value / 60000)}:${String(Math.floor(value / 1000) % 60).padStart(2, '0')}.${String(Math.floor(value % 1000)).padStart(3, '0')}`
}

export default function ClubLive({ clubId }) {
  const panel = useRef(null)
  const [snapshot, setSnapshot] = useState(null)
  const [error, setError] = useState('')
  const [now, setNow] = useState(Date.now())
  const [full, setFull] = useState(false)

  useEffect(() => {
    let active = true
    let latestSeq = 0
    setSnapshot(null)
    setError('')
    const load = async () => {
      if (!supabase) { setError('Siaran belum tersedia: konfigurasi Supabase belum lengkap.'); return }
      const { data, error: fetchError } = await supabase.from('club_live_state')
        .select('club_id,mode,payload,seq,updated_at').eq('club_id', clubId).maybeSingle()
      if (!active) return
      if (fetchError) { setError('Siaran belum dapat dimuat. Periksa migrasi Live di Supabase.'); return }
      setError('')
      if (data && Number(data.seq) >= latestSeq) { latestSeq = Number(data.seq); setSnapshot(data) }
      if (!data) setSnapshot(null)
    }
    load()
    const poll = window.setInterval(load, 5000)
    const clock = window.setInterval(() => setNow(Date.now()), 1000)
    const channel = supabase?.channel(`club-live-${clubId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'club_live_state', filter: `club_id=eq.${clubId}` },
        ({ new: row }) => {
          if (!active || !row || Number(row.seq) < latestSeq) return
          latestSeq = Number(row.seq)
          setSnapshot(row)
          setError('')
        }).subscribe()
    return () => {
      active = false
      window.clearInterval(poll)
      window.clearInterval(clock)
      if (channel) supabase.removeChannel(channel)
    }
  }, [clubId])

  useEffect(() => {
    const changed = () => setFull(document.fullscreenElement === panel.current)
    document.addEventListener('fullscreenchange', changed)
    return () => document.removeEventListener('fullscreenchange', changed)
  }, [])

  const fresh = snapshot && now - Date.parse(snapshot.updated_at) < STALE_MS
  const waiting = fresh && snapshot.payload?.status === 'waiting'
  const payload = fresh ? snapshot.payload || {} : {}
  const rows = Array.isArray(payload.rows) ? payload.rows : []
  const mode = fresh ? snapshot.mode : null
  const labels = { event: 'Event Race', quick: 'Quick Race', practice: 'Practice' }
  const toggleFull = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await panel.current?.requestFullscreen?.()
    } catch { setError('Layar penuh tidak tersedia di browser ini.') }
  }

  return <section ref={panel} className="mt-6 min-h-[28rem] rounded-[2rem] border border-blue-100 bg-white p-5 shadow-card sm:p-8 fullscreen:overflow-y-auto fullscreen:rounded-none fullscreen:p-8">
    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-5">
      <div>
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-ocean"><Radio size={15} /> Community Live</div>
        <h2 className="mt-2 font-display text-2xl font-extrabold text-ink sm:text-3xl">{fresh ? payload.name || labels[mode] || 'Live' : 'Menunggu siaran'}</h2>
        <p className="mt-1 text-sm text-slate-500">{fresh ? [labels[mode], payload.stage, payload.track].filter(Boolean).join(' · ') : 'Aplikasi club belum mengirim data terbaru.'}</p>
      </div>
      <div className="flex items-center gap-3">
        <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${fresh && !waiting ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{fresh ? waiting ? 'SIAGA' : 'LIVE' : 'OFFLINE'}</span>
        <button type="button" onClick={toggleFull} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-bold text-slate-700 hover:bg-slate-50" aria-label={full ? 'Keluar layar penuh' : 'Layar penuh'}>{full ? <Minimize2 size={17} /> : <Maximize2 size={17} />} <span className="hidden sm:inline">{full ? 'Keluar' : 'Layar penuh'}</span></button>
      </div>
    </div>
    {error && <p role="alert" className="mt-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">{error}</p>}
    {fresh && rows.length > 0 ? <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[34rem] text-left"><thead><tr className="text-xs uppercase tracking-wide text-slate-500"><th className="px-3 py-3">Pos</th><th className="px-3 py-3">Driver</th><th className="px-3 py-3 text-right">Lap</th><th className="px-3 py-3 text-right">Total</th><th className="px-3 py-3 text-right">Best</th><th className="px-3 py-3 text-right">Gap</th><th className="px-3 py-3">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{rows.map((row, index) => <tr key={`${row.pos}-${index}`} className="text-sm text-ink"><td className="px-3 py-4 font-mono font-extrabold text-ocean">{row.pos}</td><td className="px-3 py-4 font-bold">{row.name}</td><td className="px-3 py-4 text-right font-mono">{row.laps}</td><td className="px-3 py-4 text-right font-mono">{duration(row.total_ms)}</td><td className="px-3 py-4 text-right font-mono">{duration(row.best_ms)}</td><td className="px-3 py-4 text-right font-mono">{index === 0 ? '—' : duration(row.gap_ms)}</td><td className="px-3 py-4 text-xs font-bold uppercase text-slate-500">{row.status || '—'}</td></tr>)}</tbody></table></div> : <p className="mt-12 text-center text-sm text-slate-500">{fresh ? 'Belum ada passing pada sesi ini.' : 'Buka aplikasi YurLaps dan pilih club ini untuk memulai siaran.'}</p>}
    {fresh && <p className="mt-6 text-right text-xs text-slate-400">Diperbarui {new Date(snapshot.updated_at).toLocaleTimeString('id-ID')}</p>}
  </section>
}
