# Motion

Everything that moves: story, relationships, loops, pace, the finger. Site scenes animate with
CSS animations or the Web Animations API so `film.mjs` can seek them frame-exactly; a scene
driven by JS timers exposes `window.scene.seek(ms)` instead. Flutter motion uses `HlDuration`,
`HlEasing` and `hlMotion`.

## Story

- Pick the shape from what Hummlist is valued for:
  - **How it feels:** one gesture, the result under the finger (add an item, tick it off).
  - **A flow:** a few screens as one continuous object, the payoff last.
  - **What the system does:** the consequence lands elsewhere (an item added on one phone
    appears on another; an AI request becomes rows). Make the link visible; usually no finger.
- Three to five beats, 10 to 16 s per loop. Add a beat only when it clarifies; the calmer,
  better-framed version beats the one with more story.
- Open on a finished screen that works as a still. The first real content is there before the
  first beat.
- The payoff is visible at the shown size and arrives full: a sheet opens with its rows in it,
  never a blank surface for a quarter second.
- Cover each moving element in turn: if the story is clearer without it, cut it.

## Relationships that animate

- **A new row carries the rows below it:** animate the list's height so neighbours move with it.
- **A ticked item leaves and its gap closes** as one eased motion; a struck-through row that
  vanishes in one frame is a pop.
- **Added content opens its own space:** an icon's width and gap open together while the label
  travels; reverse on removal.
- **A resizing surface** (the add sheet, a chip) moves size, position and content as one
  transition, never stretching text, and retargets from where it is when interrupted.
- **Keep the frame steady:** app bar, sheet outline and button positions hold while content
  inside them changes in tracks.
- **Change only what changed:** a quantity rolls its digits, the rest of the row holds.
- **Button states share one slot:** keep the button mounted, variants in one footprint sized for
  the longest label.
- **Identity survives change:** a plus becoming a close rotates the same strokes.
- **Solid things do not fade through:** phones, sheets and cards arrive by moving, opaque.
  Cards, toasts and chips arrive whole from just above, never uncovered by a hard edge.
- **One object, one trip:** open the room, measure the slot, fly into it; never land and then
  re-lay out around it. After motion nothing moves: the handoff frame matches.
- **A moving edge never slices text:** fade content before and after a height change, or mask
  only the moving slot.
- **Sync between phones:** the second phone's row arrives at the real measured latency, never
  faster than real; a short accent (mint flash on the new row) marks the cause landing.

## Pace and easing

- UI feedback is as quick as the app: press 70 ms, release 160 ms (`--hl-motion-duration-press`,
  `-release`), state changes 180 to 360 ms with `--hl-motion-easing-standard`.
- Story travel is slower: a gentle departure, clear travel, a long soft settle, 600 to 900 ms.
  A thing that grows as it travels takes the longest settle.
- Choose durations and curves by job, not one easing everywhere. The bounce easing is for a
  small accent (the hex tick), never a whole card.
- Related responses overlap: stagger in reading order 40 to 80 ms apart, 80 to 120 ms between
  tiles of a grid. A confirmation still follows its cause.
- Colour changes between distant hues (yellow to mint) take about 200 ms; let the label carry
  the slower motion.
- Holding a result means stopping: no pulse, no repeated count.

## The finger and the cursor

- Phones get a touch dot only where it taps or drags, never a desktop arrow. A web-app scene
  gets one cursor style throughout.
- No pointer means no stand-in: never walk a focus ring or spotlight between controls.
- The finger never covers the words it taps: aim inside the target, off its label.
- Between beats it rests on empty surface near its next target, never on an unused control.
- A drag starts where the thing is, follows the finger exactly, and the row lifts only on press
  (slight scale, deeper shadow), settling flat on drop. A swipe is a flick at finger speed.
- Keyboard input shows the real keyboard from the capture, never a drawn one.

## Loops and the seam

- The last frame equals the first. Check it with `film.mjs --seam <loop ms>`.
- A reset has a seen cause (untick, undo, clear) or happens while hidden (behind a closing sheet,
  off the crop). Data never rewinds in view; a list that grew loses its new rows in one motion.
- A loop never plays a navigation backwards; leave the way the app leaves or cut under cover.
- An accumulating story runs as a conveyor: the built batch exits, a fresh one enters.
- The payoff holds about 2 s; nothing sits still more than 3 s; within about 1 s of the exit
  ending the next action has begun.
- A second scene in one loop earns its length by adding something new, never repeating the beat.
- A loop starts on a calm frame, never mid fast motion.

## Poster frame

- Set it before filming the loop. Most people see only this frame: a thumbnail, reduced
  motion, a shared screenshot, the `<video poster>`.
- It tells the story alone: cover the motion and ask what happened. Choose the beat with the
  result on screen (the ticked item in mint, the new row on the second phone), never a frame
  mid-roll, mid-fade or mid-morph.
- Export it from the same scene at the same size as the video (`film.mjs --still --at <ms>`).

## Reduced motion

- Site: under `prefers-reduced-motion: reduce` the `<video>` shows the poster with a play
  button and never autoplays; CSS scenes jump to their poster state.
- Flutter: every design-system animation goes through `hlMotion(context, d)`; goldens and
  integration tests also run with `disableAnimations` to prove the end state is complete.
- Drop presentation waits; keep task timing and reading time. Film `--reduced` and check the
  poster is complete.
