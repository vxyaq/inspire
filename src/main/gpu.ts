import si from "systeminformation"
import log from "electron-log"
import { TtlCache } from "@main/cache"

console.log = log.log
console.error = log.error
console.warn = log.warn

const gpuCache = new TtlCache<GPUInfo>(5 * 60 * 1000)

export interface GPUInfo {
  model: string
  vram: string
  hasGPU: boolean
  isNvidia: boolean
  isAmd: boolean
  isIntel: boolean
  integratedModel: string
  hasIntegratedGPU: boolean
  wglIssue: boolean
}

function isIntegratedController(model: string): boolean {
  const m = model.toLowerCase()
  return (
    m.includes("integrated") ||
    (m.includes("intel") && (m.includes("hd") || m.includes("uhd") || m.includes("iris"))) ||
    (m.includes("amd") && m.includes("radeon") && m.includes("graphics")) ||
    (m.includes("amd") && m.includes("vega") && !m.includes("rx")) ||
    m.includes("intel graphics")
  )
}
function isDedicatedController(model: string): boolean {
  const m = model.toLowerCase()
  return (
    !isIntegratedController(m) &&
    (m.includes("nvidia") ||
      (m.includes("amd") &&
        (m.includes("radeon") ||
          m.includes("rx") ||
          m.includes("vega") ||
          m.includes("firepro") ||
          m.includes("instinct"))) ||
      (m.includes("intel") && m.includes("arc")))
  )
}

export async function detectGPU(): Promise<GPUInfo> {
  const cached = gpuCache.get("gpu")
  if (cached) return cached

  const defaults: GPUInfo = {
    model: "GPU not found",
    vram: "N/A",
    hasGPU: false,
    isNvidia: false,
    isAmd: false,
    isIntel: false,
    integratedModel: "Not detected",
    hasIntegratedGPU: false,
    wglIssue: false,
  }

  try {
    const graphicsData = await si.graphics()
    if (!graphicsData.controllers || graphicsData.controllers.length === 0) {
      gpuCache.set("gpu", defaults)
      return defaults
    }

    const integratedControllers = graphicsData.controllers.filter((c: any) =>
      isIntegratedController(c.model || ""),
    )

    const dedicatedControllers = graphicsData.controllers.filter((c: any) =>
      isDedicatedController(c.model || ""),
    )

    const dedicatedGPU = dedicatedControllers.sort(
      (a: any, b: any) => (b.vram || 0) - (a.vram || 0),
    )[0]

    const integratedGPU = integratedControllers.sort(
      (a: any, b: any) => (b.vram || 0) - (a.vram || 0),
    )[0]

    const result = { ...defaults }

    if (integratedGPU) {
      result.integratedModel = integratedGPU.model || "Unknown Integrated GPU"
      result.hasIntegratedGPU = true
    }

    if (dedicatedGPU) {
      result.model = dedicatedGPU.model || "Unknown GPU"
      result.vram = dedicatedGPU.vram ? `${Math.round(dedicatedGPU.vram / 1024)} GB` : "Unknown"
      result.hasGPU = true
      result.isNvidia = dedicatedGPU.model.toLowerCase().includes("nvidia")
      result.isAmd = dedicatedGPU.model.toLowerCase().includes("amd")
      result.isIntel = dedicatedGPU.model.toLowerCase().includes("intel")

      const modelLower = dedicatedGPU.model.toLowerCase()
      result.wglIssue = modelLower.includes("intel") && !modelLower.includes("arc")
    }

    gpuCache.set("gpu", result)
    return result
  } catch (error) {
    console.error("Error detecting GPU:", error)
    gpuCache.set("gpu", defaults)
    return defaults
  }
}

export function clearGpuCache(): void {
  gpuCache.clear()
}
