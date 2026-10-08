import { useEffect, useState } from "react"
import { LoaderCircle } from "lucide-react"
import { toast } from "react-toastify"
import { invoke } from "@/lib/electron"
import Button from "@/components/ui/button"
import Card from "@/components/ui/Card"
import RootDiv from "@/components/rootdiv"
import cs2Background from "../assets/cs2-background.webp"
import fivemBackground from "../assets/fivem-background.webp"

const CS2_OPTIMIZATION_SCRIPT = String.raw`
$ErrorActionPreference = "Stop"
$processes = Get-Process -Name "cs2" -ErrorAction SilentlyContinue

if (-not $processes) {
  Write-Output "CS2_NOT_RUNNING"
  exit 0
}

# High priority improves scheduling consistency without the instability of Realtime.
$processes | ForEach-Object {
  try { $_.PriorityClass = "High" } catch { Write-Output "Could not set process priority for $($_.Id)" }
}

# Detect the installed GPU vendor and request the high-performance GPU profile for CS2.
$gpuNames = @(Get-CimInstance Win32_VideoController -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Name)
$gpuText = $gpuNames -join "; "
$gpuVendor = if ($gpuText -match "NVIDIA") { "NVIDIA" } elseif ($gpuText -match "AMD|Radeon") { "AMD" } elseif ($gpuText -match "Intel") { "Intel" } else { "Unknown" }
$gameProcess = $processes | Select-Object -First 1
try {
  $gamePath = $gameProcess.Path
  if ($gamePath) {
    $gpuPreferencesPath = "HKCU:\Software\Microsoft\DirectX\UserGpuPreferences"
    New-Item -Path $gpuPreferencesPath -Force | Out-Null
    New-ItemProperty -Path $gpuPreferencesPath -Name $gamePath -PropertyType String -Value "GpuPreference=2;" -Force | Out-Null
  }
} catch {
  Write-Output "Could not set the Windows high-performance GPU preference."
}

# Disable background Game DVR capture, which can compete with the game for CPU/GPU time.
$gameConfigPath = "HKCU:\System\GameConfigStore"
$gameBarPath = "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\GameDVR"
New-Item -Path $gameConfigPath -Force | Out-Null
New-Item -Path $gameBarPath -Force | Out-Null
New-ItemProperty -Path $gameConfigPath -Name "GameDVR_Enabled" -PropertyType DWord -Value 0 -Force | Out-Null
New-ItemProperty -Path $gameBarPath -Name "AppCaptureEnabled" -PropertyType DWord -Value 0 -Force | Out-Null

Write-Output "CS2_OPTIMIZED:$gpuVendor"
`

const FIVEM_OPTIMIZATION_SCRIPT = String.raw`
$ErrorActionPreference = "Stop"
$processes = Get-Process -Name "FiveM", "FiveM_GTAProcess", "FiveM_ChromeBrowser" -ErrorAction SilentlyContinue

if (-not $processes) {
  Write-Output "FIVEM_NOT_RUNNING"
} else {
  $processes | ForEach-Object {
    try { $_.PriorityClass = "High" } catch { Write-Output "Could not set process priority for $($_.Id)" }
  }
}

$fivemPath = Join-Path $env:LOCALAPPDATA "FiveM\FiveM.exe"
if ((Test-Path $fivemPath) -and $processes) {
  try {
    $gpuPreferencesPath = "HKCU:\Software\Microsoft\DirectX\UserGpuPreferences"
    New-Item -Path $gpuPreferencesPath -Force | Out-Null
    New-ItemProperty -Path $gpuPreferencesPath -Name $fivemPath -PropertyType String -Value "GpuPreference=2;" -Force | Out-Null
  } catch {
    Write-Output "Could not set the Windows high-performance GPU preference."
  }
}

if (-not $processes) {
  $cacheDirs = @(
    (Join-Path $env:LOCALAPPDATA "FiveM\FiveM.app\cache"),
    (Join-Path $env:LOCALAPPDATA "FiveM\FiveM.app\crashes"),
    (Join-Path $env:LOCALAPPDATA "FiveM\FiveM.app\logs")
  )
  foreach ($dir in $cacheDirs) {
    if (Test-Path $dir) {
      Remove-Item (Join-Path $dir "*") -Recurse -Force -ErrorAction SilentlyContinue
    }
  }
}

$gameConfigPath = "HKCU:\System\GameConfigStore"
$gameBarPath = "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\GameDVR"
New-Item -Path $gameConfigPath -Force | Out-Null
New-Item -Path $gameBarPath -Force | Out-Null
New-ItemProperty -Path $gameConfigPath -Name "GameDVR_Enabled" -PropertyType DWord -Value 0 -Force | Out-Null
New-ItemProperty -Path $gameBarPath -Name "AppCaptureEnabled" -PropertyType DWord -Value 0 -Force | Out-Null

Write-Output "FIVEM_OPTIMIZED"
`

const OPTIMIZE_TIMEOUT_MS = 90000

export default function Games(): React.ReactElement {
  const [optimizing, setOptimizing] = useState(false)
  const [optimizingFivem, setOptimizingFivem] = useState(false)
  const [cs2Installed, setCs2Installed] = useState<boolean | null>(null)
  const [fivemInstalled, setFivemInstalled] = useState<boolean | null>(null)

  useEffect(() => {
    invoke({ channel: "games:detect" })
      .then((games) => {
        const find = (id: string) => (Array.isArray(games) ? games.find((g) => g.id === id) : null)
        const cs2 = find("cs2")
        const fivem = find("fivem")
        setCs2Installed(cs2 ? !!cs2.installed : false)
        setFivemInstalled(fivem ? !!fivem.installed : false)
      })
      .catch(() => {
        setCs2Installed(false)
        setFivemInstalled(false)
      })
  }, [])

  const optimizeCS2 = async () => {
    setOptimizing(true)
    try {
      const result = await Promise.race([
        invoke({
          channel: "run-powershell",
          payload: { script: CS2_OPTIMIZATION_SCRIPT, name: "cs2-optimization", output: false },
        }),
        new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error("Optimization timed out. Try again.")), OPTIMIZE_TIMEOUT_MS)
        }),
      ])

      if (!result?.success) {
        throw new Error(result?.error || "Failed to apply the optimization.")
      }

      if (result.output?.includes("CS2_NOT_RUNNING")) {
        toast.info("Launch CS2 and click the button again.")
        return
      }

      toast.success("CS2 optimization applied successfully.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    } finally {
      setOptimizing(false)
    }
  }

  const optimizeFivem = async () => {
    setOptimizingFivem(true)
    try {
      const result = await Promise.race([
        invoke({
          channel: "run-powershell",
          payload: { script: FIVEM_OPTIMIZATION_SCRIPT, name: "fivem-optimization", output: false },
        }),
        new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error("Optimization timed out. Try again.")), OPTIMIZE_TIMEOUT_MS)
        }),
      ])

      if (!result?.success) {
        throw new Error(result?.error || "Failed to apply the optimization.")
      }

      if (result.output?.includes("FIVEM_NOT_RUNNING")) {
        toast.success("FiveM cache cleared. Launch FiveM and click again for full optimization.")
        return
      }

      toast.success("FiveM optimization applied successfully.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    } finally {
      setOptimizingFivem(false)
    }
  }

  return (
    <RootDiv>
      <div className="w-full">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4">
          <Card
            className="relative h-52 overflow-hidden border border-inspire-border bg-cover bg-center p-0"
            style={{ backgroundImage: `url(${cs2Background})` }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/55 to-black/30" />
            <div className="relative flex h-full flex-col p-4">
              <h2 className="text-sm font-semibold leading-tight text-white">Counter-Strike 2</h2>
              {cs2Installed === false && (
                <span className="absolute top-3 right-3 text-[11px] font-semibold text-white/70">
                  Not installed
                </span>
              )}
              <div className="pointer-events-none absolute inset-0 flex items-center bg-black/75 p-4 text-xs leading-relaxed text-white/85 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                Sets High process priority, disables Game DVR capture, and applies a GPU-aware
                high-performance profile for NVIDIA, AMD, or Intel graphics.
              </div>
              {cs2Installed !== false && (
                <Button
                  onClick={optimizeCS2}
                  disabled={optimizing || cs2Installed === null}
                  variant=""
                  className="absolute bottom-4 right-4 h-7 border border-white bg-white px-2.5 text-[11px] font-semibold text-black shadow-lg shadow-black/40 hover:bg-gray-200 hover:border-gray-200"
                >
                  {optimizing || cs2Installed === null ? (
                    <LoaderCircle size={13} className="animate-spin" />
                  ) : (
                    "Optimize"
                  )}
                </Button>
              )}
            </div>
          </Card>
          <Card
            className="relative h-52 overflow-hidden border border-inspire-border bg-cover bg-center p-0"
            style={{ backgroundImage: `url(${fivemBackground})` }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/55 to-black/30" />
            <div className="relative flex h-full flex-col p-4">
              <h2 className="text-sm font-semibold leading-tight text-white">FiveM</h2>
              {fivemInstalled === false && (
                <span className="absolute top-3 right-3 text-[11px] font-semibold text-white/70">
                  Not installed
                </span>
              )}
              <div className="pointer-events-none absolute inset-0 flex items-center bg-black/75 p-4 text-xs leading-relaxed text-white/85 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                Sets High process priority, clears FiveM cache, disables Game DVR capture, and
                applies a high-performance GPU profile.
              </div>
              {fivemInstalled !== false && (
                <Button
                  onClick={optimizeFivem}
                  disabled={optimizingFivem || fivemInstalled === null}
                  variant=""
                  className="absolute bottom-4 right-4 h-7 border border-white bg-white px-2.5 text-[11px] font-semibold text-black shadow-lg shadow-black/40 hover:bg-gray-200 hover:border-gray-200"
                >
                  {optimizingFivem || fivemInstalled === null ? (
                    <LoaderCircle size={13} className="animate-spin" />
                  ) : (
                    "Optimize"
                  )}
                </Button>
              )}
            </div>
          </Card>
        </div>
      </div>
    </RootDiv>
  )
}
