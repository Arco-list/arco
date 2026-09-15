import type { ClipboardEvent, DragEvent } from "react"

/**
 * Paste/drop handlers for the inline contentEditable editors.
 *
 * A contentEditable accepts whatever the clipboard carries, so pasting
 * a title copied from a website drags that site's markup — and with it
 * its font, weight and colour — straight into the page. The text saves
 * fine (every editor persists `textContent`), but until the next
 * reload the heading renders in the source's styling instead of ours.
 *
 * These insert the clipboard's plain text and nothing else.
 * `execCommand` is deprecated but remains the only way to insert text
 * while keeping the browser's native undo stack intact; the Range
 * fallback covers engines that have dropped it.
 */

function insertPlainText(text: string) {
  if (!text) return
  if (typeof document !== "undefined" && document.execCommand?.("insertText", false, text)) return

  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return
  const range = selection.getRangeAt(0)
  range.deleteContents()
  const node = document.createTextNode(text)
  range.insertNode(node)
  range.setStartAfter(node)
  range.collapse(true)
  selection.removeAllRanges()
  selection.addRange(range)
}

/** Newlines become spaces unless the field is explicitly multiline. */
function normalize(text: string, multiline: boolean): string {
  return multiline ? text : text.replace(/\s*\n+\s*/g, " ")
}

export function handlePlainTextPaste(
  event: ClipboardEvent<HTMLElement>,
  options: { multiline?: boolean } = {},
) {
  event.preventDefault()
  const text = event.clipboardData.getData("text/plain")
  insertPlainText(normalize(text, options.multiline ?? false))
}

/** Same guarantee for text dragged in from another tab. */
export function handlePlainTextDrop(
  event: DragEvent<HTMLElement>,
  options: { multiline?: boolean } = {},
) {
  const text = event.dataTransfer?.getData("text/plain")
  if (!text) return
  event.preventDefault()
  insertPlainText(normalize(text, options.multiline ?? false))
}
