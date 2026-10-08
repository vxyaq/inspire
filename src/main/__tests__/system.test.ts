import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("electron-log", () => ({
  default: { log: vi.fn(), error: vi.fn(), warn: vi.fn() },
  log: vi.fn(), error: vi.fn(), warn: vi.fn(),
}))

vi.mock("electron", () => ({
  app: { getPath: vi.fn(() => ""), getAppPath: vi.fn(() => "") },
  shell: { openPath: vi.fn(), openExternal: vi.fn() },
  ipcMain: { handle: vi.fn(), removeHandler: vi.fn() },
}))

const mockExecFile = vi.fn()
vi.mock("child_process", () => ({
  execFile: mockExecFile,
  exec: vi.fn(),
}))

const { checkWinget } = await import("@main/system")

beforeEach(() => {
  vi.clearAllMocks()
})

describe("checkWinget", () => {
  it("returns installed=true when winget command succeeds", async () => {
    mockExecFile.mockImplementation((_cmd, _args, callback) => {
      callback(null, "v1.2.3", "")
    })

    const result = await checkWinget()

    expect(result).toEqual({ success: true, installed: true })
    expect(mockExecFile).toHaveBeenCalledWith("winget", ["--version"], expect.any(Function))
  })

  it("returns installed=false when winget command fails", async () => {
    mockExecFile.mockImplementation((_cmd, _args, callback) => {
      callback(new Error("not found"))
    })

    const result = await checkWinget()

    expect(result).toEqual({ success: true, installed: false })
  })

  it("calls execFile with correct arguments", async () => {
    mockExecFile.mockImplementation((_cmd, _args, callback) => {
      callback(null, "v1.2.3", "")
    })

    await checkWinget()

    expect(mockExecFile).toHaveBeenCalledWith("winget", ["--version"], expect.any(Function))
  })
})
