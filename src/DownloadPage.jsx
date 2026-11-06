import { useEffect, useState } from 'react'
import { Download, Monitor, ArrowUpRight } from 'lucide-react'
import { getWindowsRelease } from './lib/releases'

export default function DownloadPage() {
  const [release, setRelease] = useState(null)
  const [status, setStatus] = useState('Memeriksa versi terbaru...')
  useEffect(() => {
    const controller = new AbortController()
    fetch('/releases/manifest.json', { signal: controller.signal, cache: 'no-store' })
      .then(r => { if (!r.ok) throw new Error('Belum dapat memuat rilis Windows.'); return r.json() })
      .then(data => { const value = getWindowsRelease(data); setRelease(value); setStatus(value ? '' : 'Installer Windows belum tersedia.') })
      .catch(e => { if (e.name !== 'AbortError') setStatus('Belum dapat memuat rilis. Periksa daftar rilis atau coba lagi nanti.') })
    return () => controller.abort()
  }, [])
  return <main className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
    <p className="text-xs font-bold uppercase tracking-[0.2em] text-ocean">YurLaps Desktop</p>
    <div className="mt-5 grid gap-10 lg:grid-cols-[1.25fr_1fr]">
      <div><h1 className="font-display text-5xl font-extrabold tracking-[-0.06em] text-ink sm:text-6xl">Timing di track.<br />Tetap jalan offline.</h1>
        <p className="mt-6 max-w-xl text-lg leading-8 text-slate-500">Catat lap, jalankan race, dan simpan hasil di komputer. Hubungkan akun club untuk menyinkronkan hasil ketika internet tersedia.</p>
        <div className="mt-8 rounded-3xl border border-blue-100 bg-blue-50 p-7">
          <div className="flex items-center gap-3 font-bold text-ink"><Monitor /> Windows 10 / 11, 64-bit</div>
          {release ? <><p className="mt-4 text-sm text-slate-600">Versi {release.version} · {new Date(release.date).toLocaleDateString('id-ID')} · {(release.size / 1048576).toFixed(1)} MB</p>
            <a href={release.url} className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-ocean px-6 py-4 font-bold text-white"><Download size={20} /> Download untuk Windows</a>
          </> : <p className="mt-5 text-slate-600" role="status">{status}</p>}
          <a href="/releases/" className="mt-5 flex items-center gap-2 text-sm font-bold text-ocean">Lihat file rilis YurLaps <ArrowUpRight size={16} /></a>
        </div>
      </div>
      <div className="rounded-3xl border border-slate-200 bg-white p-8">
        <h2 className="font-display text-2xl font-bold text-ink">Sudah memakai YurLaps?</h2>
        <ol className="mt-6 list-decimal space-y-5 pl-5 text-slate-600"><li>Buka menu <b>Pembaruan</b> di aplikasi.</li><li>Klik <b>Cek pembaruan</b>, lalu unduh versi terbaru.</li><li>Simpan race dan pilih <b>Pasang dan mulai ulang</b>.</li></ol>
        <p className="mt-7 border-t border-slate-100 pt-6 text-sm leading-6 text-slate-500">Tidak perlu uninstall. Data lokal dan antrean sinkronisasi tetap disimpan. Untuk versi lama tanpa menu Pembaruan, jalankan installer terbaru pada lokasi instalasi yang sama.</p>
        <p className="mt-4 text-sm text-slate-500">Paket portable: unduh ZIP dari daftar rilis dan perbarui secara manual.</p>
      </div>
    </div>
    {release?.notes && <section className="mt-12 rounded-3xl border border-slate-200 p-7"><h2 className="text-xl font-bold">Yang baru di versi {release.version}</h2><pre className="mt-4 whitespace-pre-wrap break-words font-sans text-sm leading-7 text-slate-600">{release.notes}</pre></section>}
  </main>
}
