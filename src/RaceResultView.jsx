import { chartSeries } from './lib/raceCharts.js'
import { normalizeRaceRows } from './lib/raceIdentity'

const palette = ['#e65a43', '#4988db', '#19a56a', '#a769dc', '#da8e20', '#24a9b4', '#c8508b', '#7a9b2b', '#65758d']
const num = (value) => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)) ? Number(value) : null
const lapText = (value) => {
  const ms = num(value)
  if (ms === null) return '–'
  return `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}.${String(Math.round(ms % 1000)).padStart(3, '0')}`
}
const secondsText = (value) => `${Number(value).toFixed(value >= 10 ? 0 : 1)} s`
const axisTime = (value, max) => max < 60 ? secondsText(value) : `${Math.floor(value / 60)}:${String(Math.round(value % 60)).padStart(2, '0')}`
const niceUpper = (value) => {
  const magnitude = 10 ** Math.floor(Math.log10(Math.max(1, value / 4)))
  const step = [1, 2, 5, 10].find((candidate) => candidate * magnitude >= value / 4) * magnitude
  return Math.ceil(value / step) * step
}
const statusText = (row) => {
  const raw = String(row.result_status || row.status || '').toUpperCase()
  if (raw === 'FIN' || raw === 'FINISH' || raw === 'FINISHED') return 'FINISH'
  if (raw === 'DNF' || raw === 'DNS') return raw
  if (row.finished === true || row.finish_decoder_ts != null) return 'FINISH'
  if (Object.prototype.hasOwnProperty.call(row, 'first_decoder_ts')) return row.first_decoder_ts == null ? 'DNS' : 'DNF'
  return '–'
}
const gapText = (value) => {
  if (!value || typeof value !== 'object') return '–'
  if (num(value.laps)) return Number(value.laps) > 0 ? `+${value.laps} lap` : '–'
  return num(value.ms) === null || Number(value.ms) < 0 ? '–' : `+${(Number(value.ms) / 1000).toFixed(3)} s`
}

export function prepareRaceRows(race) {
  return normalizeRaceRows(race).map((row, index) => {
    const laps = (Array.isArray(row.laps) ? row.laps : []).map(num).filter((value) => value !== null && value > 0)
    const sorted = [...laps].sort((a, b) => a - b)
    const mean = laps.length ? laps.reduce((sum, value) => sum + value, 0) / laps.length : null
    const variance = mean ? laps.reduce((sum, value) => sum + (value - mean) ** 2, 0) / laps.length : null
    let consecutive = null
    for (let start = 0; start + 3 <= laps.length; start += 1) {
      const avg = (laps[start] + laps[start + 1] + laps[start + 2]) / 3
      consecutive = Math.min(consecutive ?? avg, avg)
    }
    const p80 = sorted.slice(0, Math.ceil(sorted.length * 0.8))
    return {
      ...row, laps, pos: num(row.pos) ?? index + 1,
      n_lap: num(row.n_lap) ?? laps.length,
      total_ms: num(row.total_ms) ?? (laps.length ? laps.reduce((sum, value) => sum + value, 0) : null),
      best_ms: num(row.best_ms) ?? sorted[0] ?? null,
      top3_ms: num(row.top3_ms) ?? (sorted.length >= 3 ? (sorted[0] + sorted[1] + sorted[2]) / 3 : null),
      consecutive_ms: num(row.consecutive_ms ?? row.top3_consecutive_ms) ?? consecutive,
      p80_ms: num(row.p80_ms) ?? (p80.length ? p80.reduce((sum, value) => sum + value, 0) / p80.length : null),
      consistency: num(row.consistency) ?? (mean && variance !== null ? Math.max(0, 1 - Math.sqrt(variance) / mean) * 100 : null),
      top_speed_kmh: num(row.top_speed_kmh ?? row.speed_kmh),
    }
  })
}

function LapDetails({ row, label }) {
  const [shown, setShown] = useState(10)
  return <details className="rounded-xl border border-slate-200 bg-white open:border-blue-200">
    <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-ocean">
      <span>{row.name || row.nick || label} <span className="ml-1 font-normal text-slate-500">{row.laps.length} lap</span></span>
      <span className="text-xs text-ocean">Lihat lap</span>
    </summary>
    <div className="grid grid-cols-2 gap-px border-t border-slate-200 bg-slate-200 sm:grid-cols-4 lg:grid-cols-5">
      {row.laps.slice(0, shown).map((lap, index) => <div key={index} className="flex justify-between gap-3 bg-white px-4 py-3 text-xs">
        <span className="text-slate-500">L{index + 1}</span><span className={`font-mono ${lap === row.best_ms ? 'font-bold text-ocean' : 'text-ink'}`}>{lapText(lap)}</span>
      </div>)}
    </div>
    {shown < row.laps.length && <button type="button" onClick={() => setShown((current) => current + 10)} className="min-h-11 w-full border-t border-slate-200 px-4 py-2 text-sm font-bold text-ocean hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ocean">Tampilkan 10 lap berikutnya</button>}
  </details>
}

function ProgressChart({ rows, race, type }) {
  const series = chartSeries(rows, race)
  if (!series.maxLap) return <p className="text-sm text-slate-500">Belum ada lap untuk ditampilkan.</p>
  const W = 760, H = 220, left = 55, right = 68, top = 18, bottom = 32
  const chartW = W - left - right, chartH = H - top - bottom
  const allGaps = series.gaps.flat().filter((value) => Number.isFinite(value))
  const gapMax = niceUpper(Math.max(1, ...allGaps))
  const ticks = type === 'position' ? Array.from({ length: Math.max(1, rows.length) }, (_, index) => index + 1) : [0, gapMax / 4, gapMax / 2, gapMax * 0.75, gapMax]
  const y = (value) => type === 'position'
    ? top + (value - 1) / Math.max(1, rows.length - 1) * chartH
    : top + chartH - value / gapMax * chartH
  const x = (lap) => left + (lap - 1) / Math.max(1, series.maxLap - 1) * chartW
  const xTicks = [...new Set([1, Math.ceil(series.maxLap / 4), Math.ceil(series.maxLap / 2), Math.ceil(series.maxLap * 3 / 4), series.maxLap])]
  return <div className="rounded-2xl border border-slate-200 bg-white p-3 sm:p-5">
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={type === 'position' ? 'Pergerakan posisi setiap lap' : 'Selisih waktu terhadap pemimpin setiap lap'}>
      {ticks.map((tick) => <g key={tick}>
        <line x1={left} x2={W - right} y1={y(tick)} y2={y(tick)} stroke="#dce3ec" strokeDasharray="3 5" />
        <text x={left - 8} y={y(tick) + 4} textAnchor="end" fontSize="12" fill="#475569">{type === 'position' ? `P${tick}` : axisTime(tick, gapMax)}</text>
      </g>)}
      {xTicks.map((tick) => <text key={tick} x={x(tick)} y={H - 7} textAnchor="middle" fontSize="11" fill="#64748b">L{tick}</text>)}
      {rows.map((row, index) => {
        const values = type === 'position' ? series.positions[index] : series.gaps[index]
        const points = values.map((value, lap) => value == null ? null : `${x(lap + 1)},${y(value)}`).filter(Boolean).join(' ')
        return <g key={row.uid || row.id || index}><polyline points={points} fill="none" stroke={palette[index % palette.length]} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />{values.map((value, lap) => value == null ? null : <circle key={lap} cx={x(lap + 1)} cy={y(value)} r="2" fill={palette[index % palette.length]} />)}</g>
      })}
    </svg>
    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-600">{rows.map((row, index) => <span key={row.uid || row.id || index} className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: palette[index % palette.length] }} />{row.name || row.nick || `Driver ${index + 1}`}</span>)}</div>
    {type === 'gap' && <p className="mt-3 text-xs text-slate-500">Skala 0–{axisTime(gapMax, gapMax)}{gapMax >= 60 ? ' (menit:detik)' : ''}. Garis putus menunjukkan jarak waktu. {series.sharedClock ? 'Posisi grid memakai waktu decoder.' : 'Perbandingan memakai akumulasi waktu lap yang tersedia.'}</p>}
  </div>
}

function LapDistribution({ rows }) {
  const all = rows.flatMap((row) => row.laps)
  if (!all.length) return <p className="text-sm text-slate-500">Belum ada lap yang dapat dibandingkan.</p>
  const low = Math.min(...all), high = Math.max(...all)
  const x = (value) => 185 + (value - low) / Math.max(1, high - low) * 505
  const ticks = Array.from({ length: 6 }, (_, index) => low + (high - low) * index / 5)
  const height = Math.max(120, rows.length * 33 + 48)
  return <div className="rounded-2xl border border-slate-200 bg-white p-3 sm:p-5">
    <svg viewBox={`0 0 740 ${height}`} className="h-auto w-full" role="img" aria-label="Sebaran waktu lap setiap pembalap: rentang minimum sampai maksimum, kuartil 25 sampai 75 persen, dan median">
      {ticks.map((tick, index) => <g key={index}><line x1={x(tick)} x2={x(tick)} y1="8" y2={height - 30} stroke="#e2e8f0" strokeDasharray="3 5" /><text x={x(tick)} y={height - 8} textAnchor="middle" fontSize="10" fill="#475569">{(tick / 1000).toFixed(2)}s</text></g>)}
      {rows.map((row, index) => {
        const laps = [...row.laps].sort((a, b) => a - b)
        const y = 20 + index * 33
        if (!laps.length) return <text key={index} x="8" y={y + 4} fontSize="11" fill="#475569">{(row.nick || row.name || `Driver ${index + 1}`).slice(0, 23)} · belum ada lap</text>
        const q1 = laps[Math.floor((laps.length - 1) * .25)]
        const q3 = laps[Math.floor((laps.length - 1) * .75)]
        const median = (laps[Math.floor((laps.length - 1) / 2)] + laps[Math.ceil((laps.length - 1) / 2)]) / 2
        return <g key={row.uid || row.id || index}><text x="8" y={y + 4} fontSize="11" fill="#172c43">{(row.nick || row.name || `Driver ${index + 1}`).slice(0, 23)}</text><line x1={x(laps[0])} x2={x(laps.at(-1))} y1={y} y2={y} stroke="#edaaa3" strokeWidth="9" strokeLinecap="round" /><line x1={x(q1)} x2={x(q3)} y1={y} y2={y} stroke="#da594d" strokeWidth="9" strokeLinecap="round" /><line x1={x(median)} x2={x(median)} y1={y - 8} y2={y + 8} stroke="#172c43" strokeWidth="2" /></g>
      })}
    </svg>
    <p className="mt-2 text-xs text-slate-600">Garis terang: lap tercepat sampai terlambat. Garis gelap: 25% sampai 75%. Penanda tegak: median.</p>
  </div>
}

export default function RaceResultView({ race, language = 'id' }) {
  const rows = prepareRaceRows(race)
  const id = language === 'id'
  if (!rows.length) return <p className="rounded-xl bg-slate-50 p-5 text-sm text-slate-600">{id ? 'Belum ada hasil peserta.' : 'No driver results yet.'}</p>
  return <div className="space-y-7">
    <section aria-label={id ? 'Hasil race' : 'Race results'}>
      <h3 className="mb-3 text-sm font-extrabold uppercase tracking-wide text-slate-600">{id ? 'Hasil race' : 'Race results'}</h3>
      <div className="space-y-2">
        {rows.map((row, index) => <div key={row.uid || row.id || index} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <div className="grid gap-x-3 gap-y-2 md:grid-cols-[2rem_minmax(9rem,1.8fr)_4rem_6rem_6rem_5rem] md:items-center">
            <span className={`grid h-8 w-8 place-items-center rounded-full text-sm font-extrabold ${index === 0 ? 'bg-amber-100 text-amber-800' : index === 1 ? 'bg-slate-200 text-slate-700' : index === 2 ? 'bg-orange-100 text-orange-800' : 'bg-blue-50 text-ocean'}`}>{row.pos}</span>
            <div className="min-w-0"><b className="block truncate text-sm text-ink">{row.name || row.nick || `Driver ${index + 1}`}</b><span className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500"><span className={`rounded px-1.5 py-0.5 font-bold ${statusText(row) === 'FINISH' ? 'bg-emerald-50 text-emerald-800' : statusText(row) === 'DNF' ? 'bg-amber-50 text-amber-800' : 'bg-slate-100 text-slate-700'}`}>{statusText(row)}</span>{row.transponder ? `TP ${row.transponder}` : ''}</span></div>
            <span className="text-sm font-semibold text-ink"><small className="mb-1 block text-[11px] font-bold uppercase text-slate-500">Lap</small>{row.n_lap}</span>
            <span className="font-mono text-xs text-ink"><small className="mb-1 block font-sans text-[11px] font-bold uppercase text-slate-500">Total</small>{lapText(row.total_ms)}</span>
            <span className="font-mono text-xs font-bold text-ocean"><small className="mb-1 block font-sans text-[11px] font-bold uppercase text-slate-500">Best</small>{lapText(row.best_ms)}</span>
            <span className="font-mono text-xs text-slate-600"><small className="mb-1 block font-sans text-[11px] font-bold uppercase text-slate-500">Gap</small>{gapText(row.gap_leader)}</span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-slate-100 pt-3 text-xs sm:grid-cols-3 lg:grid-cols-5">
            {[["Top 3 avg", lapText(row.top3_ms)], ["Top 3 consecutive", lapText(row.consecutive_ms)], ["P80 avg", lapText(row.p80_ms)], ["Consistency", row.consistency == null ? '–' : `${row.consistency.toFixed(1)}%`], ["Top speed", row.top_speed_kmh == null ? '–' : `${row.top_speed_kmh.toFixed(1)} km/h`]].map(([label, value]) => <div key={label}><span className="block text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</span><span className="mt-0.5 block font-mono font-semibold text-ink">{value}</span></div>)}
          </div>
        </div>)}
      </div>
    </section>
    <section><h3 className="mb-3 text-sm font-extrabold uppercase tracking-wide text-slate-600">{id ? 'Waktu per lap' : 'Lap times'}</h3><div className="space-y-2">{rows.map((row, index) => <LapDetails key={row.uid || row.id || index} row={row} label={`Driver ${index + 1}`} />)}</div></section>
    <section><h3 className="mb-3 text-sm font-extrabold uppercase tracking-wide text-slate-600">{id ? 'Pergerakan posisi' : 'Position progression'}</h3><ProgressChart rows={rows} race={race} type="position" /></section>
    <section><h3 className="mb-3 text-sm font-extrabold uppercase tracking-wide text-slate-600">{id ? 'Gap ke pemimpin' : 'Gap to leader'}</h3><ProgressChart rows={rows} race={race} type="gap" /></section>
    <section><h3 className="mb-3 text-sm font-extrabold uppercase tracking-wide text-slate-600">{id ? 'Sebaran waktu lap' : 'Lap time distribution'}</h3><LapDistribution rows={rows} /></section>
  </div>
}
