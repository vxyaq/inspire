import { invoke } from "./electron"

export type BackgroundStyle = "image" | "gray"

declare global {
  interface Window {
    background?: {
      getPath: () => Promise<string | null>
      getDataUrl: () => Promise<string | null>
    }
  }
}

const STYLE_KEY = "k3d:backgroundStyle"
const STYLE_V2_KEY = "k3d:backgroundStyleV2"

/**
 * Returns the saved background style, migrating legacy state on first run.
 *
 * Older builds wrote `k3d:backgroundStyle` ("gray"/"none") even though no UI
 * ever existed to change it back, which left the background permanently off for
 * existing users. Such orphaned values are superseded once, and from then on the
 * value is a real user preference (written by Settings -> Appearance -> Background).
 */
export const getBackgroundStyle = (): BackgroundStyle => {
  if (!localStorage.getItem(STYLE_V2_KEY)) {
    localStorage.setItem(STYLE_KEY, "image")
    localStorage.setItem(STYLE_V2_KEY, "1")
  }
  return localStorage.getItem(STYLE_KEY) === "gray" ? "gray" : "image"
}

export const setBackgroundStyle = (style: BackgroundStyle): void => {
  localStorage.setItem(STYLE_KEY, style)
  localStorage.setItem(STYLE_V2_KEY, "1")
}

// Windows paths contain backslashes, which CSS strings would eat as escapes, and
// file:// subresources are blocked on the http dev origin — so the main process
// returns a data URL (preferred) and this is only a safe fallback.
const toFileUrl = (filePath: string): string => {
  const normalized = filePath.replace(/\\/g, "/")
  return normalized.startsWith("/") ? `file://${normalized}` : `file:///${normalized}`
}

export const applyPlainGray = (): void => {
  document.body.style.removeProperty("--k3d-bg-image")
  document.body.classList.add("bg-gray")
  document.body.classList.remove("bg-image", "bg-none")
}

/** Loads background.png through IPC and applies it as the blurred page background. */
export const applyBackgroundImage = async (): Promise<boolean> => {
  try {
    let image: string | null = null
    try {
      image = (await window.background?.getDataUrl?.()) ?? null
    } catch {
      image = null
    }

    if (!image) {
      const bgPath =
        (await window.background?.getPath?.()) ?? (await invoke({ channel: "background:get-path" }))
      if (typeof bgPath === "string" && bgPath) {
        image = toFileUrl(bgPath)
      }
    }

    if (!image) {
      applyPlainGray()
      return false
    }

    document.body.style.setProperty("--k3d-bg-image", `url("${image}")`)
    document.body.classList.add("bg-image")
    document.body.classList.remove("bg-gray", "bg-none")
    return true
  } catch {
    applyPlainGray()
    return false
  }
}

/** Applies the saved background style (called once on app startup). */
export const loadSavedBackground = async (): Promise<void> => {
  if (getBackgroundStyle() === "image") {
    await applyBackgroundImage()
  } else {
    applyPlainGray()
  }
}
