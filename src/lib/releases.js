export function getWindowsRelease(data) {
  if (!data || !/^\d+\.\d+\.\d+$/.test(data.version || '') || !data.installer || !data.installer.url || !(data.installer.size > 0)) return null
  return { version: data.version, url: data.installer.url, size: data.installer.size,
    date: data.published_at, notes: typeof data.notes === 'string' ? data.notes : '' }
}
