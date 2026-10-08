import { promises as fsp } from "fs"
import os from "os"
import path from "path"
import { ipcMain } from "electron"
import log from "electron-log"
import { TtlCache } from "./cache"
import { executePowerShell } from "./powershell"

console.log = log.log
console.error = log.error
console.warn = log.warn

function systemRoot(): string {
  return process.env.SystemRoot || "C:\\Windows"
}

function localAppData(): string {
  return process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local")
}

const SIZE_WORKERS = 32

export async function getFolderSize(root: string): Promise<number> {
  const dirQueue = [root]
  let total = 0
  let active = 0

  const processDir = async (dir: string): Promise<void> => {
    const entries = await fsp.readdir(dir, { withFileTypes: true }).catch(() => [])
    const subdirs: string[] = []
    const fileSizes: Array<Promise<number>> = []
    for (const entry of entries) {
      if (entry.isDirectory()) {
        subdirs.push(path.join(dir, entry.name))
      } else if (entry.isFile()) {
        fileSizes.push(
          fsp
            .stat(path.join(dir, entry.name))
            .then((stat) => stat.size)
            .catch(() => 0),
        )
      }
    }
    const sizes = await Promise.all(fileSizes)
    for (const size of sizes) total += size
    dirQueue.push(...subdirs)
  }

  const workers = Array.from({ length: SIZE_WORKERS }, async () => {
    while (true) {
      active++
      const dir = dirQueue.pop()
      if (!dir) {
        active--
        if (active === 0) return
        await new Promise((resolve) => setTimeout(resolve, 1))
        continue
      }
      try {
        await processDir(dir)
      } finally {
        active--
      }
    }
  })

  await Promise.all(workers)
  return total
}

export async function emptyFolderContents(root: string): Promise<number> {
  const entries = await fsp.readdir(root, { withFileTypes: true }).catch(() => [])
  const freed = await Promise.all(
    entries.map(async (entry) => {
      const full = path.join(root, entry.name)
      let size = 0
      try {
        const stat = await fsp.lstat(full)
        size = stat.isDirectory() ? await getFolderSize(full) : stat.size
      } catch {
        size = 0
      }
      await fsp
        .rm(full, { recursive: true, force: true, maxRetries: 2, retryDelay: 100 })
        .catch(() => {})
      return size
    }),
  )
  return freed.reduce((sum, size) => sum + size, 0)
}

async function thumbnailFiles(): Promise<string[]> {
  const thumbCache = path.join(localAppData(), "Microsoft", "Windows", "Explorer")
  const entries = await fsp.readdir(thumbCache, { withFileTypes: true }).catch(() => [])
  return entries
    .filter((entry) => entry.isFile() && /^thumbcache_.*\.db$/i.test(entry.name))
    .map((entry) => path.join(thumbCache, entry.name))
}

async function getThumbnailCacheSize(): Promise<number> {
  const files = await thumbnailFiles()
  const sizes = await Promise.all(
    files.map((file) =>
      fsp
        .stat(file)
        .then((stat) => stat.size)
        .catch(() => 0),
    ),
  )
  return sizes.reduce((sum, size) => sum + size, 0)
}

async function clearThumbnailCache(): Promise<number> {
  const files = await thumbnailFiles()
  let freed = 0
  await Promise.all(
    files.map(async (file) => {
      const stat = await fsp.stat(file).catch(() => null)
      if (stat) freed += stat.size
      await fsp.rm(file, { force: true, maxRetries: 2, retryDelay: 100 }).catch(() => {})
    }),
  )
  return freed
}

interface CleanerTarget {
  id: string
  size: () => Promise<number>
  clean: () => Promise<number>
}

function recycleBinScript(withClear: boolean): string {
  return `
    $recycleBinSize = 0
    $shell = New-Object -ComObject Shell.Application
    $recycleBin = $shell.Namespace(0xA)
    $recycleBinSize = ($recycleBin.Items() | Measure-Object -Property Size -Sum).Sum
    if ($null -eq $recycleBinSize) { $recycleBinSize = 0 }
    ${withClear ? "Clear-RecycleBin -Force -ErrorAction SilentlyContinue" : ""}
    Write-Output $recycleBinSize
  `
}

async function runRecycleBinScript(script: string, name: string): Promise<number> {
  const result = await executePowerShell({ script, name, output: false })
  return parseInt((result.output || "0").trim(), 10) || 0
}

const targets: CleanerTarget[] = [
  {
    id: "temp",
    size: async () => {
      const tempDirs = [path.join(systemRoot(), "Temp"), os.tmpdir()]
      const sizes = await Promise.all(tempDirs.map((dir) => getFolderSize(dir)))
      return sizes.reduce((sum, size) => sum + size, 0)
    },
    clean: async () => {
      const tempDirs = [path.join(systemRoot(), "Temp"), os.tmpdir()]
      const freed = await Promise.all(tempDirs.map((dir) => emptyFolderContents(dir)))
      return freed.reduce((sum, size) => sum + size, 0)
    },
  },
  {
    id: "prefetch",
    size: () => getFolderSize(path.join(systemRoot(), "Prefetch")),
    clean: () => emptyFolderContents(path.join(systemRoot(), "Prefetch")),
  },
  {
    id: "recyclebin",
    size: () => runRecycleBinScript(recycleBinScript(false), "size-recyclebin"),
    clean: () => runRecycleBinScript(recycleBinScript(true), "cleanup-recyclebin"),
  },
  {
    id: "windows-update",
    size: () => getFolderSize(path.join(systemRoot(), "SoftwareDistribution", "Download")),
    clean: () => emptyFolderContents(path.join(systemRoot(), "SoftwareDistribution", "Download")),
  },
  {
    id: "thumbnails",
    size: getThumbnailCacheSize,
    clean: clearThumbnailCache,
  },
  {
    id: "errorreports",
    size: () => getFolderSize(path.join(localAppData(), "CrashDumps")),
    clean: () => emptyFolderContents(path.join(localAppData(), "CrashDumps")),
  },
]

const targetById = new Map(targets.map((target) => [target.id, target]))

const sizesCache = new TtlCache<Record<string, number>>(15_000)

export async function getAllSizes(): Promise<Record<string, number>> {
  const cached = sizesCache.get("all")
  if (cached) return cached

  const results: Record<string, number> = {}
  await Promise.all(
    targets.map(async (target) => {
      try {
        results[target.id] = await target.size()
      } catch (error) {
        log.warn(`Failed to get size for ${target.id}:`, error)
        results[target.id] = 0
      }
    }),
  )
  sizesCache.set("all", results, 15_000)
  return results
}

export async function cleanTarget(id: string): Promise<number> {
  const target = targetById.get(id)
  if (!target) throw new Error(`Unknown cleaner target: ${id}`)
  const freed = await target.clean()
  sizesCache.delete("all")
  return freed
}

export const setupCleanerHandlers = (): void => {
  ipcMain.handle("cleaner:get-sizes", () => getAllSizes())
  ipcMain.handle("cleaner:run-cleanup", (_event, id: string) => cleanTarget(id))
}

export const cleanupCleanerHandlers = (): void => {
  ipcMain.removeHandler("cleaner:get-sizes")
  ipcMain.removeHandler("cleaner:run-cleanup")
}
