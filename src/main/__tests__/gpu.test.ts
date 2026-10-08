import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@main/cache", () => ({
  TtlCache: vi.fn(function () {
    return {
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
      clear: vi.fn(),
    }
  }),
}))

vi.mock("electron-log", () => ({
  default: {
    log: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
  log: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
}))

const mockGraphics = vi.fn()

vi.mock("systeminformation", () => ({
  default: {
    graphics: mockGraphics,
  },
}))

const { detectGPU } = await import("@main/gpu")

beforeEach(() => {
  vi.clearAllMocks()
})

describe("detectGPU", () => {
  it("returns defaults when no controllers exist", async () => {
    mockGraphics.mockResolvedValue({ controllers: [] })

    const result = await detectGPU()

    expect(result).toEqual({
      model: "GPU not found",
      vram: "N/A",
      hasGPU: false,
      isNvidia: false,
      isAmd: false,
      isIntel: false,
      integratedModel: "Not detected",
      hasIntegratedGPU: false,
      wglIssue: false,
    })
  })

  it("returns defaults when controllers is undefined", async () => {
    mockGraphics.mockResolvedValue({})

    const result = await detectGPU()

    expect(result.hasGPU).toBe(false)
    expect(result.hasIntegratedGPU).toBe(false)
  })

  it("detects NVIDIA dedicated GPU", async () => {
    mockGraphics.mockResolvedValue({
      controllers: [
        {
          model: "NVIDIA GeForce RTX 3080",
          vram: 10240,
        },
      ],
    })

    const result = await detectGPU()

    expect(result).toMatchObject({
      model: "NVIDIA GeForce RTX 3080",
      vram: "10 GB",
      hasGPU: true,
      isNvidia: true,
    })
    expect(result.hasIntegratedGPU).toBe(false)
  })

  it("detects AMD dedicated GPU", async () => {
    mockGraphics.mockResolvedValue({
      controllers: [
        {
          model: "AMD Radeon RX 7900 XTX",
          vram: 24576,
        },
      ],
    })

    const result = await detectGPU()

    expect(result).toMatchObject({
      model: "AMD Radeon RX 7900 XTX",
      vram: "24 GB",
      hasGPU: true,
      isNvidia: false,
    })
  })

  it("detects both integrated and dedicated GPU", async () => {
    mockGraphics.mockResolvedValue({
      controllers: [
        {
          model: "Intel Iris Xe Graphics",
          vram: 0,
        },
        {
          model: "NVIDIA GeForce RTX 4060",
          vram: 8192,
        },
      ],
    })

    const result = await detectGPU()

    expect(result).toMatchObject({
      model: "NVIDIA GeForce RTX 4060",
      vram: "8 GB",
      hasGPU: true,
      isNvidia: true,
      integratedModel: "Intel Iris Xe Graphics",
      hasIntegratedGPU: true,
    })
  })

  it("detects AMD integrated GPU without false positive", async () => {
    mockGraphics.mockResolvedValue({
      controllers: [
        {
          model: "AMD Radeon(TM) Graphics",
          vram: 512,
        },
      ],
    })

    const result = await detectGPU()

    expect(result.hasGPU).toBe(false)
    expect(result.isNvidia).toBe(false)
    expect(result.hasIntegratedGPU).toBe(true)
    expect(result.integratedModel).toContain("AMD Radeon")
  })

  it("picks the dedicated GPU with highest VRAM", async () => {
    mockGraphics.mockResolvedValue({
      controllers: [
        {
          model: "AMD Radeon RX 6800",
          vram: 16384,
        },
        {
          model: "AMD Radeon RX 6700",
          vram: 12288,
        },
      ],
    })

    const result = await detectGPU()

    expect(result.model).toBe("AMD Radeon RX 6800")
    expect(result.vram).toBe("16 GB")
  })

  it("handles error from systeminformation gracefully", async () => {
    mockGraphics.mockRejectedValue(new Error("GPU query failed"))

    const result = await detectGPU()

    expect(result).toEqual({
      model: "GPU not found",
      vram: "N/A",
      hasGPU: false,
      isNvidia: false,
      isAmd: false,
      isIntel: false,
      integratedModel: "Not detected",
      hasIntegratedGPU: false,
      wglIssue: false,
    })
  })

  it("detects Intel Arc as dedicated GPU", async () => {
    mockGraphics.mockResolvedValue({
      controllers: [
        {
          model: "Intel Arc A770",
          vram: 16384,
        },
      ],
    })

    const result = await detectGPU()

    expect(result).toMatchObject({
      hasGPU: true,
      isNvidia: false,
      model: "Intel Arc A770",
    })
  })

  it("classifies AMD Radeon RX as dedicated GPU", async () => {
    mockGraphics.mockResolvedValue({
      controllers: [
        {
          model: "AMD Radeon RX 570",
          vram: 4096,
        },
      ],
    })

    const result = await detectGPU()

    expect(result.hasGPU).toBe(true)
    expect(result.isNvidia).toBe(false)
  })
})
