export function resultValue(value) {
  if (value === null || value === undefined) return '—'
  if (Array.isArray(value)) return value.map(resultValue).join(', ')
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}
export function csvValue(value) {
  let text = value === null || value === undefined ? '' : resultValue(value)
  if (/^[\s]*[=+@-]/.test(text)) text = "'" + text
  return `"${text.replaceAll('"', '""')}"`
}
