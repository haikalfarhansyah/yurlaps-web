import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { devicePairSessionPayload, parseDevicePairRequest } from './lib/devicePair'

export default function DevicePairPage({ LoginPage, text, onBack, session: initialSession, client = supabase }) {
  const [request] = useState(() => {
    try { return parseDevicePairRequest(window.location.search) } catch { return null }
  })
  const [session, setSession] = useState(initialSession || null)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!client || session) return undefined
    let mounted = true
    client.auth.getSession().then(({ data }) => { if (mounted) setSession(data.session) })
    return () => { mounted = false }
  }, [client, session])

  async function publish(nextSession) {
    if (!client || !request) return
    setLoading(true); setError('')
    try {
      const result = await client.rpc('desktop_pair_publish', {
        p_state: request.state,
        p_code: request.code,
        p_session: devicePairSessionPayload(nextSession),
      })
      if (result.error) {
        setError(result.error.message || 'Kode pairing sudah kedaluwarsa. Buat kode baru dari aplikasi.')
        return
      }
      setSession(nextSession); setDone(true)
    } catch (e) {
      setError(e.message || 'Pairing gagal. Coba buat kode baru dari aplikasi.')
    } finally { setLoading(false) }
  }

  if (!request) return <main className="mx-auto max-w-xl p-10">
    <h1 className="text-2xl font-bold">Hubungkan YurLaps</h1>
    <p className="mt-4 text-slate-600">Buka halaman ini dari menu Akun di aplikasi YurLaps.</p>
  </main>

  if (done) return <main className="relative flex min-h-[calc(100vh-5rem)] items-center justify-center px-5 py-16">
    <section className="w-full max-w-md rounded-3xl border border-blue-100 bg-white p-8 text-center shadow-xl">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-100 text-2xl text-emerald-700">✓</div>
      <h1 className="mt-5 text-2xl font-extrabold text-ink">YurLaps berhasil dihubungkan</h1>
      <p className="mt-3 text-sm text-slate-600">Kembali ke tab aplikasi. Sesi ini hanya dipakai sekali dan disimpan aman di perangkat.</p>
    </section>
  </main>

  if (session) return <main className="relative flex min-h-[calc(100vh-5rem)] items-center justify-center px-5 py-16">
    <section className="w-full max-w-md rounded-3xl border border-blue-100 bg-white p-8 shadow-xl">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-ocean">Device pairing</p>
      <h1 className="mt-3 text-2xl font-extrabold text-ink">Hubungkan YurLaps</h1>
      <p className="mt-3 text-sm text-slate-600">Akun <b>{session.user?.email || 'YurLaps'}</b> akan dipakai untuk sinkronisasi aplikasi.</p>
      <div className="mt-5 rounded-2xl bg-blue-50 px-5 py-4 text-center"><p className="text-xs font-bold uppercase tracking-widest text-slate-500">Kode pairing</p><p className="mt-2 font-mono text-3xl font-extrabold tracking-[0.25em] text-ocean">{request.code}</p></div>
      {error && <p role="alert" className="mt-4 text-sm text-red-600">{error}</p>}
      <div className="mt-6 flex justify-end gap-3"><button type="button" onClick={onBack} className="rounded-xl px-4 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-100">Batal</button><button type="button" disabled={loading} onClick={() => publish(session)} className="rounded-xl bg-ocean px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{loading ? 'Menghubungkan…' : 'Hubungkan perangkat'}</button></div>
    </section>
  </main>

  return <>
    <p className="mx-auto max-w-3xl px-5 pt-6 text-center text-sm">Login ke website dengan akun yang akan dipakai YurLaps. Password tetap di website.</p>
    {error && <p role="alert" className="p-4 text-center text-red-600">{error}</p>}
    <LoginPage text={text} client={client} allowRegistration={false} onBack={onBack}
      onSignedIn={(nextSession) => publish(nextSession)} />
  </>
}
