export function escapeHtml(s: string): string {
  const div = document.createElement('div')
  div.textContent = s
  return div.innerHTML
}

export function escapeAttr(s: string): string {
  return s.replace(/"/g, '&quot;')
}
