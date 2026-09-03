"use client"

import { useEffect, useRef, useState } from "react"

import {
  searchAddressPredictions,
  resolveAddressDetails,
  type AddressPrediction,
  type ResolvedAddress,
} from "@/lib/places/resolve-address"

import styles from "./address-lookup.module.css"

/**
 * Shared Places address lookup: a text input with a styled prediction
 * dropdown, resolving to the full location record on pick. Deliberately
 * an ADDRESS lookup, not a company lookup — on flows where identity is
 * already pinned (a claim entered on a domain proof) re-searching the
 * company would let a different establishment be swapped in under the
 * same verified domain. This control only moves the pin.
 */
export function AddressLookup({
  placeholder,
  autoFocus,
  onResolved,
  onError,
  inputClassName,
}: {
  placeholder: string
  autoFocus?: boolean
  onResolved: (r: ResolvedAddress) => void
  onError?: () => void
  inputClassName?: string
}) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<AddressPrediction[]>([])
  const [searching, setSearching] = useState(false)
  const [resolving, setResolving] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setResults([])
    }
    document.addEventListener("mousedown", close)
    return () => document.removeEventListener("mousedown", close)
  }, [])

  function search(q: string) {
    setQuery(q)
    if (timer.current) clearTimeout(timer.current)
    if (q.trim().length < 2) { setResults([]); return }
    timer.current = setTimeout(async () => {
      setSearching(true)
      setResults(await searchAddressPredictions(q))
      setSearching(false)
    }, 300)
  }

  async function pick(p: AddressPrediction) {
    setResolving(true)
    setResults([])
    const resolved = await resolveAddressDetails(p.placeId)
    setResolving(false)
    if (!resolved) { onError?.(); return }
    setQuery("")
    onResolved(resolved)
  }

  return (
    <div className={styles.root} ref={rootRef}>
      <input
        className={inputClassName ?? styles.input}
        value={query}
        placeholder={placeholder}
        autoFocus={autoFocus}
        autoComplete="off"
        disabled={resolving}
        onChange={(e) => search(e.target.value)}
      />
      {(results.length > 0 || searching) && (
        <div className={styles.dropdown}>
          {searching && results.length === 0 && <div className={styles.hint}>…</div>}
          {results.map((r) => (
            <button key={r.placeId} type="button" className={styles.option} onClick={() => pick(r)}>
              <span className={styles.main}>{r.mainText}</span>
              <span className={styles.secondary}>{r.secondaryText}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
