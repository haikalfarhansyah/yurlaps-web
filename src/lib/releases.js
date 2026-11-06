export function getWindowsRelease(data) {
  if (!data || data.draft || data.prerelease || !/^v\d+\.\d+\.\d+$/.test(data.tag_name || '')) return null
  const version = data.tag_name.slice(1)
  const asset = data.assets?.find(a => a.name === `YurLaps-Setup-${version}.exe`)
  const expected = `https://github.com/Khasya207/Yurlapsss/releases/download/${data.tag_name}/${asset?.name}`
  if (!asset || asset.browser_download_url !== expected || !(asset.size > 0) || !Number.isFinite(Date.parse(data.published_at))) return null
  return { version, url: asset.browser_download_url, size: asset.size, date: data.published_at, notes: typeof data.body === 'string' ? data.body : '' }
}
