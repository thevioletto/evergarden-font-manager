const GOOGLE_FONTS_STYLESHEET_URL = 'https://fonts.googleapis.com/css2'
const FONT_REQUEST_INTERVAL_MS = 250

let rateLimitedQueue: Promise<void> = Promise.resolve()
let lastFontRequestAt = 0

const loadedFamilies = new Set<string>()
const loadingFamilies = new Map<string, Promise<void>>()

function normalizeFamilyKey(family: string) {
  return family.trim().toLowerCase().replace(/\s+/g, ' ')
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

function enqueueRateLimitedTask(task: () => Promise<void>) {
  const runTask = async () => {
    const elapsed = Date.now() - lastFontRequestAt
    if (elapsed < FONT_REQUEST_INTERVAL_MS) {
      await sleep(FONT_REQUEST_INTERVAL_MS - elapsed)
    }
    lastFontRequestAt = Date.now()
    await task()
  }

  rateLimitedQueue = rateLimitedQueue.then(runTask, runTask)
  return rateLimitedQueue
}

function getFontStylesheetUrl(family: string, weights: readonly number[]) {
  const weightSet = new Set(weights.filter((weight) => Number.isFinite(weight)))
  if (!weightSet.size) weightSet.add(400)

  const sortedWeights = [...weightSet].sort((left, right) => left - right)
  const encodedFamily = encodeURIComponent(family).replace(/%20/g, '+')
  const weightQuery = sortedWeights.join(';')

  return `${GOOGLE_FONTS_STYLESHEET_URL}?family=${encodedFamily}:wght@${weightQuery}&display=swap`
}

export async function loadGoogleFontFamily(
  family: string,
  options?: { weights?: readonly number[] },
) {
  const normalizedFamily = family.trim()
  if (!normalizedFamily || typeof document === 'undefined') return

  const key = normalizeFamilyKey(normalizedFamily)
  if (loadedFamilies.has(key)) return

  const currentLoad = loadingFamilies.get(key)
  if (currentLoad) {
    await currentLoad
    return
  }

  const existingLink = document.querySelector<HTMLLinkElement>(`link[data-eg-font-family="${key}"]`)
  if (existingLink) {
    loadedFamilies.add(key)
    return
  }

  const fontLoadPromise = enqueueRateLimitedTask(
    () =>
      new Promise<void>((resolve, reject) => {
        const link = document.createElement('link')
        link.rel = 'stylesheet'
        link.href = getFontStylesheetUrl(normalizedFamily, options?.weights ?? [400, 500, 700])
        link.dataset.egFontFamily = key
        link.onload = () => {
          loadedFamilies.add(key)
          resolve()
        }
        link.onerror = () => {
          reject(new Error(`Failed to load Google Font stylesheet for "${normalizedFamily}"`))
        }

        document.head.appendChild(link)
      }),
  )

  loadingFamilies.set(key, fontLoadPromise)

  try {
    await fontLoadPromise
  } finally {
    loadingFamilies.delete(key)
  }
}
