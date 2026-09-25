let last = 0

/** Строго возрастающее время правки на этом устройстве (устойчиво к повторному Date.now()). */
export function tick(): number {
  last = Math.max(Date.now(), last + 1)
  return last
}
