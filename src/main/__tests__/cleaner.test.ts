import { describe, it, expect, vi, afterEach } from "vitest"
import os from "os"
import path from "path"
import { promises as fsp } from "fs"

vi.mock("electron-log", () => ({
  default: { log: vi.fn(), error: vi.fn(), warn: vi.fn() },
  log: vi.fn(), error: vi.fn(), warn: vi.fn(),
}))

vi.mock("electron", () => ({
  ipcMain: { handle: vi.fn(), removeHandler: vi.fn() },
  app: { isPackaged: true, getPath: vi.fn(() => "/tmp") },
}))

const { getFolderSize, emptyFolderContents, getAllSizes } = await import("@main/cleaner")

const tempRoot = path.join(os.tmpdir(), `k3d-cleaner-test-${Date.now()}`)

afterEach(async () => {
  await fsp.rm(tempRoot, { recursive: true, force: true }).catch(() => {})
})

describe("getFolderSize", () => {
  it("sums the size of files recursively", async () => {
    const dir = path.join(tempRoot, "size")
    const nested = path.join(dir, "sub")
    await fsp.mkdir(nested, { recursive: true })
    await fsp.writeFile(path.join(dir, "a.txt"), Buffer.alloc(1024))
    await fsp.writeFile(path.join(nested, "b.txt"), Buffer.alloc(512))

    expect(await getFolderSize(dir)).toBe(1536)
  })

  it("returns 0 for a missing path", async () => {
    expect(await getFolderSize(path.join(tempRoot, "does-not-exist"))).toBe(0)
  })
})

describe("emptyFolderContents", () => {
  it("removes contents and keeps the folder", async () => {
    const dir = path.join(tempRoot, "clean")
    await fsp.mkdir(dir, { recursive: true })
    await fsp.writeFile(path.join(dir, "a.txt"), Buffer.alloc(256))

    const freed = await emptyFolderContents(dir)

    expect(freed).toBe(256)
    expect(await fsp.readdir(dir)).toHaveLength(0)
  })
})

describe("getAllSizes", () => {
  it(
    "returns a numeric size for every target",
    async () => {
      const sizes = await getAllSizes()
      const ids = [
        "temp",
        "prefetch",
        "recyclebin",
        "windows-update",
        "thumbnails",
        "errorreports",
      ]
      for (const id of ids) {
        expect(typeof sizes[id]).toBe("number")
        expect(sizes[id]).toBeGreaterThanOrEqual(0)
      }
    },
    90_000,
  )
})