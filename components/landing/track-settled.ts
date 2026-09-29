/**
 * Wait for a carousel track to finish its own slide.
 *
 * Both landing carousels move a track with a CSS transform transition and
 * treat `transitionend` as "the slide is over" — that handler is where
 * `current` advances, the progress bar resets and `isAnimating` goes back
 * to false. Which makes listening for the RIGHT event load-bearing: get it
 * wrong and the auto-advance stops for good, because the loop that fills
 * the bars is gated on `!isAnimating`.
 *
 * TRANSITIONEND BUBBLES, and every card riding on the track carries
 * transitions of its own: `.discover-card-image-layer` fades opacity over
 * 0.4s and the `<img>` inside it moves transform over 0.5s. Both reach a
 * listener on the track from below, roughly eighteen cards' worth, none of
 * them the track's own move.
 *
 * So the TARGET check is the one that matters. `propertyName` alone will
 * not do it — the image's transition is on `transform` too, the very same
 * property name the track uses.
 *
 * How that killed the carousel: a card's transition ends the slide early,
 * so `current` says one thing while the track stands somewhere else. The
 * next auto-advance then animates to a position the track already
 * occupies. Setting a transform to the value it already has starts no
 * transition, so no `transitionend` ever arrives, `isAnimating` stays true
 * and the bars freeze — dead until a reload.
 *
 * THE TIMEOUT closes the rest of that door. A transition can also be
 * cancelled rather than completed — `snapTo` sets `transition: none`, and
 * a cancelled transition fires nothing at all — and a track that is still
 * null has no listener to attach. Neither is reachable through the guard
 * above, and both used to mean the same permanent freeze, so the slide
 * settles on a timer if the event never comes.
 *
 * The homepage hero never had any of this: it drives its bars off a plain
 * interval and never asks the DOM when a slide ended.
 */

/**
 * How long one slide takes to hand over, everywhere on the site.
 *
 * The carousels run their track's transform for this long and the
 * homepage hero crossfades for it, and in all three the progress bar is
 * raced to full over the same span — so a click looks like one movement
 * rather than three that nearly agree. Also the span the fallback below
 * waits out, which is why it cannot live in `animateTo` alone.
 */
export const SLIDE_MS = 550

/** Grace on top of SLIDE_MS before the fallback decides the event is not
 *  coming. Long enough not to race a transition that is merely late on a
 *  busy frame, short enough that a recovery is not visible as a stall. */
const FALLBACK_GRACE_MS = 120

/**
 * Calls `done` exactly once: when `track` finishes its own transform
 * transition, or on a fallback timer if that event never arrives.
 * Returns a cleanup that cancels the wait without running `done`.
 */
export function onTrackSettled(track: HTMLElement | null, done: () => void): () => void {
  // No track means no event is ever coming. Running `done` now is the
  // only option that does not strand the caller mid-slide.
  if (!track) {
    done()
    return () => {}
  }

  let settled = false
  let timer: ReturnType<typeof setTimeout> | undefined

  const finish = () => {
    if (settled) return
    settled = true
    track.removeEventListener("transitionend", onEnd)
    if (timer) clearTimeout(timer)
    done()
  }

  const onEnd = (event: Event) => {
    const e = event as TransitionEvent
    if (e.target !== track) return
    if (e.propertyName !== "transform") return
    finish()
  }

  track.addEventListener("transitionend", onEnd)
  timer = setTimeout(finish, SLIDE_MS + FALLBACK_GRACE_MS)

  return () => {
    settled = true
    track.removeEventListener("transitionend", onEnd)
    if (timer) clearTimeout(timer)
  }
}
