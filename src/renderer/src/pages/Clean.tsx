import Button from "@/components/ui/button"
import Toggle from "@/components/ui/Toggle"
import { useState, useEffect } from "react"
import { invoke } from "@/lib/electron"
import RootDiv from "@/components/rootdiv"
import Tooltip from "@/components/ui/tooltip"
import {
  Icon,
  FileX,
  Gauge,
  Trash2,
  Download,
  Image,
  Bug,
  LoaderCircle,
} from "lucide-react"
import { broom } from "@lucide/lab"
import { toast } from "react-toastify"
import log from "electron-log/renderer"
import Card from "@/components/ui/Card"

type CleanupItem = {
  id: string
  label: string
  path: string
  description: string
  icon: React.ReactNode
}

const cleanups: CleanupItem[] = [
  {
    id: "temp",
    label: "Clean Temporary Files",
    path: "C:\\Windows\\Temp",
    description: "Remove system and user temporary files.",
    icon: <FileX className="w-5 h-5" />,
  },
  {
    id: "prefetch",
    label: "Clean Prefetch Files",
    path: "C:\\Windows\\Prefetch",
    description: "Delete files from the Windows Prefetch folder.",
    icon: <Gauge className="w-5 h-5" />,
  },
  {
    id: "recyclebin",
    label: "Empty Recycle Bin",
    path: "Recycle Bin",
    description: "Permanently remove files from the Recycle Bin.",
    icon: <Trash2 className="w-5 h-5" />,
  },
  {
    id: "windows-update",
    label: "Clean Windows Update Cache",
    path: "C:\\Windows\\SoftwareDistribution\\Download",
    description: "Remove Windows Update downloaded installation files.",
    icon: <Download className="w-5 h-5" />,
  },
  {
    id: "thumbnails",
    label: "Clear Thumbnail Cache",
    path: "C:\\Users\\<User>\\AppData\\Local\\Microsoft\\Windows\\Explorer",
    description: "Remove cached thumbnail images used by File Explorer.",
    icon: <Image className="w-5 h-5" />,
  },
  {
    id: "errorreports",
    label: "Clear Error Reports",
    path: "C:\\Users\\<User>\\AppData\\Local\\CrashDumps",
    description: "Remove error report and crash dump files.",
    icon: <Bug className="w-5 h-5" />,
  },
]

const cleanupLabels: Record<string, string> = {
  temp: "Temporary files",
  prefetch: "Prefetch files",
  recyclebin: "Recycle Bin",
  "windows-update": "Windows Update cache",
  thumbnails: "Thumbnail cache",
  errorreports: "Error reports",
}

function Clean() {
  const [selected, setSelected] = useState<string[]>([])
  const [loadingQueue, setLoadingQueue] = useState<string[]>([])
  const [lastClean, setLastClean] = useState<string>(
    () => localStorage.getItem("last-clean") || "Not cleaned yet.",
  )
  const [isCleaning, setIsCleaning] = useState(false)
  const [cleanupResults, setCleanupResults] = useState<Record<string, number>>({})
  const [currentSizes, setCurrentSizes] = useState<Record<string, number>>({})
  const [loadingSizes, setLoadingSizes] = useState(false)

  const toggleCleanup = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  const formatBytes = (bytes?: number): string => {
    if (!bytes || bytes === 0) return "0 B"
    const sizes = ["B", "KB", "MB", "GB", "TB"]
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`
  }

  async function fetchSizes(silent = false) {
    if (!silent) setLoadingSizes(true)

    try {
      const sizes = await invoke({ channel: "cleaner:get-sizes" })
      setCurrentSizes((prev) => ({ ...prev, ...(sizes || {}) }))
    } catch (err) {
      log.error(`Failed to fetch cleaner sizes: ${err}`)
    } finally {
      if (!silent) setLoadingSizes(false)
    }
  }

  useEffect(() => {
    fetchSizes()
  }, [])

  const totalSize = Object.values(currentSizes).reduce(
    (sum, size) => sum + (size || 0),
    0,
  )
  const totalFreed = Object.values(cleanupResults).reduce(
    (sum, size) => sum + (size || 0),
    0,
  )

  async function runSelectedCleanups() {
    toast.dismiss()
    setIsCleaning(true)
    setLoadingQueue([])
    setCleanupResults({})
    let anySuccess = false
    const newResults: Record<string, number> = {}

    for (const cleanup of cleanups) {
      if (!selected.includes(cleanup.id)) continue
      setLoadingQueue((q) => [...q, cleanup.id])
      const toastId = toast.loading(
        `Cleaning ${cleanupLabels[cleanup.id] || cleanup.label}...`,
      )
      try {
        const freedSpace = Number(
          await invoke({ channel: "cleaner:run-cleanup", payload: cleanup.id }),
        )
        newResults[cleanup.id] = freedSpace || 0

        toast.update(toastId, {
          render: `Cleaned ${cleanupLabels[cleanup.id] || cleanup.label}: ${formatBytes(freedSpace)} recovered.`,
          type: "success",
          isLoading: false,
          autoClose: 3500,
        })
        anySuccess = true
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err)
        toast.update(toastId, {
          render: `Couldn't clean ${cleanupLabels[cleanup.id] || cleanup.label}: ${errorMsg}`,
          type: "error",
          isLoading: false,
          autoClose: 4500,
        })
        log.error(`Failed to run ${cleanup.id} cleanup: ${errorMsg}`)
      }
    }

    if (anySuccess) {
      const now = new Date().toLocaleString()
      setLastClean(now)
      localStorage.setItem("last-clean", now)
      setCleanupResults(newResults)
      fetchSizes(true)
    }

    setLoadingQueue([])
    setIsCleaning(false)
  }

  return (
    <RootDiv>
      <div className="flex flex-col gap-6">
        <Card className="p-4">
          <div className="flex items-start gap-4">
            <div className="flex items-center justify-center p-3 rounded-xl bg-k3d-accent shrink-0">
              <Icon iconNode={broom} className="text-k3d-primary" size={24} />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-semibold text-k3d-text mb-1">
                System Cleaner
              </h2>
              <p className="text-sm text-k3d-text-secondary">
                Last cleaned: <span className="font-medium">{lastClean}</span>
              </p>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
                <p className="text-sm text-k3d-text-secondary">
                  {loadingSizes ? (
                    "Calculating total size..."
                  ) : (
                    <>
                      Total size:{" "}
                      <span className="font-medium text-k3d-primary">
                        {formatBytes(totalSize)}
                      </span>
                    </>
                  )}
                </p>
                {totalFreed > 0 && (
                  <p className="text-sm text-green-500">
                    Total freed:{" "}
                    <span className="font-medium">{formatBytes(totalFreed)}</span>
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {selected.length > 0 ? (
                <Button onClick={() => setSelected([])} variant="secondary">
                  Unselect All
                </Button>
              ) : (
                <Button
                  onClick={() => setSelected(cleanups.map((c) => c.id))}
                  variant="secondary"
                >
                  Select All
                </Button>
              )}
              <Button
                onClick={runSelectedCleanups}
                disabled={isCleaning || selected.length === 0}
                className="shrink-0"
              >
                {isCleaning ? (
                  <>
                    <LoaderCircle className="animate-spin" size={14} />
                    <span>Cleaning...</span>
                  </>
                ) : (
                  <>
                    <Icon iconNode={broom} size={14} />
                    <span>Clean Selected ({selected.length})</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {cleanups.map(({ id, label, description, icon }) => {
            const isSelected = selected.includes(id)
            const currentSize = currentSizes[id]
            const freedSpace = cleanupResults[id]
            const isCurrentlyCleaning = loadingQueue.includes(id)

            return (
              <Card key={id} className="p-4 h-48 flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-semibold text-k3d-text text-sm leading-tight">
                      {label}
                    </h3>
                    {freedSpace !== undefined && freedSpace > 0 && (
                      <span className="shrink-0 px-2 py-0.5 text-[11px] font-medium rounded-full bg-green-900/30 text-green-400">
                        {formatBytes(freedSpace)} freed
                      </span>
                    )}
                  </div>
                  <p className="text-k3d-text-secondary text-xs leading-relaxed line-clamp-2">
                    {description}
                  </p>
                </div>

                <div className="pt-3 border-t border-k3d-border/40 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Tooltip content="Clean this item" delay={0.3} side="top">
                      <div className="p-1.5 bg-k3d-accent rounded-md text-k3d-text-secondary shrink-0">
                        {icon}
                      </div>
                    </Tooltip>
                    <span className="text-xs text-k3d-text-muted font-medium truncate">
                      {loadingSizes
                        ? "Calculating..."
                        : currentSize !== undefined
                          ? formatBytes(currentSize)
                          : "Unknown"}
                    </span>
                  </div>

                  <div className="shrink-0">
                    {isCurrentlyCleaning ? (
                      <Button
                        variant="outline"
                        className="h-7 px-2 text-[11px] flex items-center gap-1 rounded-md border-k3d-border"
                        disabled
                      >
                        <LoaderCircle className="animate-spin w-3 h-3" />
                        Cleaning
                      </Button>
                    ) : (
                      <Tooltip
                        content={isCleaning ? "Cleaning in progress" : undefined}
                        delay={0.3}
                      >
                        <Toggle
                          checked={isSelected}
                          onChange={() => toggleCleanup(id)}
                          disabled={isCleaning}
                        />
                      </Tooltip>
                    )}
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      </div>
    </RootDiv>
  )
}

export default Clean