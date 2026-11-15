export function parseDevicePairRequest(search) {
  const params = new URLSearchParams(search)
  const state = params.get('state') || ''
  const code = (params.get('code') || '').toUpperCase()
  if (params.has('callback') || !/^[A-Za-z0-9_-]{32}$/.test(state) || !/^[0-9A-F]{8}$/.test(code)) {
    throw new Error('Buka halaman pairing dari aplikasi YurLaps.')
  }
  return { state, code }
}

export function devicePairSessionPayload(session) {
  if (!session?.access_token || !session?.refresh_token || !session?.expires_at) {
    throw new Error('Sesi login tidak tersedia. Silakan coba lagi.')
  }
  return {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at,
  }
}

