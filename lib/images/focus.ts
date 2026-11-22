/**
 * Focuspunt van een foto (0–1, migratie 326/328): waar een hero met
 * object-fit: cover omheen bijsnijdt. Gedeeld door de collectie- en de
 * projecthero.
 */

export type Focus = { x: number; y: number }

export const focusPosition = (focus: Focus | null | undefined) =>
  focus ? `${Math.round(focus.x * 100)}% ${Math.round(focus.y * 100)}%` : "50% 50%"

export const focusFromRow = (row: { focus_x?: number | null; focus_y?: number | null } | null | undefined): Focus | null =>
  row && row.focus_x != null && row.focus_y != null ? { x: row.focus_x, y: row.focus_y } : null

/** Van een klik op een <img> met object-fit: cover terug naar een punt in de foto. */
export function focusFromClick(e: { clientX: number; clientY: number; currentTarget: HTMLImageElement }, current: Focus | null | undefined): Focus | null {
  const img = e.currentTarget
  const box = img.getBoundingClientRect()
  const iw = img.naturalWidth, ih = img.naturalHeight
  if (!iw || !ih || !box.width || !box.height) return null
  // Bij cover wordt de foto geschaald tot hij het vlak vult en verschoven
  // volgens object-position.
  const scale = Math.max(box.width / iw, box.height / ih)
  const dw = iw * scale, dh = ih * scale
  const ox = (box.width - dw) * (current?.x ?? 0.5)
  const oy = (box.height - dh) * (current?.y ?? 0.5)
  const clamp = (n: number) => Math.min(1, Math.max(0, n))
  return { x: clamp((e.clientX - box.left - ox) / dw), y: clamp((e.clientY - box.top - oy) / dh) }
}
