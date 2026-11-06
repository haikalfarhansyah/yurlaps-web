import { useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { parseDesktopRequest, desktopSessionPayload } from './lib/desktopLogin'

export default function DesktopLoginPage({ LoginPage, text, onBack }) {
  const [error, setError] = useState('')
  const [request] = useState(() => {
    try { return parseDesktopRequest(window.location.search) }
    catch { return null }
  })
  const [client] = useState(() => {
    const url = import.meta.env.VITE_SUPABASE_URL
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY
    return url && key ? createClient(url, key, { auth: {
      persistSession: false, autoRefreshToken: false, detectSessionInUrl: false,
      storageKey: 'yurlaps-desktop-handoff',
    } }) : null
  })
  function connect(session) {
    try {
      const form = document.createElement('form')
      form.method = 'POST'
      form.action = request.callback
      for (const [name, value] of Object.entries({
        state: request.state, session: desktopSessionPayload(session),
      })) {
        const input = document.createElement('input')
        input.type = 'hidden'; input.name = name; input.value = value
        form.appendChild(input)
      }
      document.body.appendChild(form)
      form.submit()
      form.remove()
    } catch (e) { setError(e.message) }
  }
  if (!request) return <main className="mx-auto max-w-xl p-10">
    <h1 className="text-2xl font-bold">Login aplikasi YurLaps</h1>
    <p className="mt-4">Buka halaman ini melalui tombol Akun di aplikasi YurLaps.</p>
  </main>
  return <>
    <p className="mx-auto max-w-3xl px-5 pt-6 text-center text-sm">
      Masuk untuk menghubungkan YurLaps di komputer ini. Akun harus menjadi leader club.
    </p>
    {error && <p role="alert" className="p-4 text-center text-red-600">{error}</p>}
    <LoginPage text={text} client={client} allowRegistration={false}
      onBack={onBack} onSignedIn={connect} />
  </>
}
