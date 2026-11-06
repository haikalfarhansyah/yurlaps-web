export function parseDesktopRequest(search) {
  const params = new URLSearchParams(search)
  const state = params.get('state') || ''
  const callback = new URL(params.get('callback') || '')
  if (callback.protocol !== 'http:' || callback.hostname !== '127.0.0.1' ||
      !callback.port || Number(callback.port) < 1024 || callback.pathname !== '/callback' ||
      callback.username || callback.password || callback.search || callback.hash ||
      !/^[A-Za-z0-9_-]{43}$/.test(state)) {
    throw new Error('Buka login ini melalui tombol Akun di aplikasi YurLaps.')
  }
  return { callback: callback.href, state }
}

export function desktopSessionPayload(session) {
  if (!session?.access_token || !session?.refresh_token || !session?.expires_at) {
    throw new Error('Sesi login tidak tersedia. Silakan coba lagi.')
  }
  return JSON.stringify({ access_token: session.access_token,
    refresh_token: session.refresh_token, expires_at: session.expires_at })
}
