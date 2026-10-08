import { useState, useEffect, useMemo, useRef, useDeferredValue } from "react"
import {
  Wrench,
  Search,
  AlertTriangle,
  Monitor,
  Shield,
  Gamepad,
  Network,
  Zap,
  Paintbrush,
  HardDrive,
} from "lucide-react"
import { toast } from "react-toastify"
import RootDiv from "@/components/rootdiv"
import Tooltip from "@/components/ui/tooltip"
import Modal from "@/components/ui/modal"
import { invoke } from "@/lib/electron"
import useRestartStore from "@/store/restartState"
import useSystemStore from "@/store/systemInfo"
import Button from "@/components/ui/button"
import Toggle from "@/components/ui/Toggle"
import Checkbox from "@/components/ui/Checkbox"
import log from "electron-log/renderer"
import Card from "@/components/ui/Card"
import { Gpu, Plus, RotateCw } from "lucide-react"
import useSearchStore from "@/store/search"
import { isNewInCurrentVersion, isUpdatedInCurrentVersion, CURRENT_VERSION } from "@/lib/version"
import { Star } from "lucide-react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Tweak } from "@/types/index"

const CATEGORY_ALIASES: Record<string, string> = { AI: "General" }

const tweakCategories = (tweak: any): string[] => {
  const raw = Array.isArray(tweak?.category)
    ? tweak.category
    : tweak?.category
      ? [tweak.category]
      : []
  return raw.filter(Boolean).map((cat: string) => CATEGORY_ALIASES[cat] ?? cat)
}

function Tweaks() {
  const [tweaks, setTweaks] = useState<Tweak[]>([])
  const [toggleStates, setToggleStates] = useState({})
  const [isLoading, setIsLoading] = useState(true)
  const searchTerm = useSearchStore((state) => state.query)
  const deferredSearchTerm = useDeferredValue(searchTerm)
  const [activeCategory, setActiveCategory] = useState("All")
  const [modalContent, setModalContent] = useState<string | boolean | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedTweak, setSelectedTweak] = useState<Tweak | null>(null)
  const [biosAccepted, setBiosAccepted] = useState(false)
  const [isRecommendedModalOpen, setIsRecommendedModalOpen] = useState(false)
  const [recommendedTweaksToApply, setRecommendedTweaksToApply] = useState<Tweak[]>([])
  const [selectedRecommendedTweaks, setSelectedRecommendedTweaks] = useState<Set<string>>(new Set())
  const [isApplyingRecommended, setIsApplyingRecommended] = useState(false)
  const [isAltHeld, setIsAltHeld] = useState(false)
  const [biosFacts, setBiosFacts] = useState<any>(null)
  const [isPro, setIsPro] = useState(false)

  const { setNeedsRestart } = useRestartStore()
  const systemInfo = useSystemStore((state) => state.systemInfo)

  const stateRef = useRef({ toggleStates, tweaks })
  stateRef.current = { toggleStates, tweaks }

  const isTweakCompatible = (tweak) => {
    if (!systemInfo || Object.keys(systemInfo).length === 0) {
      return { compatible: true }
    }

    if (tweak.category && tweak.category.includes("GPU")) {
      if (!systemInfo.hasGPU) {
        return { compatible: false, reason: "Requires a dedicated GPU" }
      }
    }

    if (tweak.name === "optimize-nvidia-settings") {
      if (!systemInfo.isNvidia) {
        return { compatible: false, reason: "Requires an NVIDIA GPU" }
      }
    }

    if (biosFacts) {
      if (tweak.name === "xmp-expo-ram") {
        if (
          biosFacts.ramRated &&
          biosFacts.ramRunning &&
          biosFacts.ramRunning >= biosFacts.ramRated * 0.95
        ) {
          return { compatible: false, reason: "XMP/EXPO already enabled" }
        }
      }
      if (tweak.name === "resizable-bar") {
        if (systemInfo.hasGPU === false) {
          return { compatible: false, reason: "Requires a dedicated GPU" }
        }
        if (biosFacts.uefiBoot === false) {
          return { compatible: false, reason: "Requires UEFI boot mode" }
        }
      }
      if (tweak.name === "pbo-ryzen") {
        if (!biosFacts.isRyzen) {
          return { compatible: false, reason: "Requires an AMD Ryzen CPU" }
        }
      }
      if (tweak.name === "mce-intel") {
        if (biosFacts.cpuVendor !== "Intel") {
          return { compatible: false, reason: "Requires an Intel CPU" }
        }
      }
      if (tweak.name === "uefi-csm") {
        if (biosFacts.uefiBoot === true) {
          return { compatible: false, reason: "Already booting in UEFI mode" }
        }
      }
      if (tweak.name === "virtualization-off") {
        if (biosFacts.virtFirmware === false) {
          return { compatible: false, reason: "Already disabled in firmware" }
        }
      }
    }

    return { compatible: true }
  }

  useEffect(() => {
    loadTweaks()
    loadToggleStates()
    invoke({ channel: "bios:status" })
      .then((facts) => {
        if (facts) setBiosFacts(facts)
      })
      .catch(() => {})
    const loadPlan = () => {
      invoke({ channel: "auth:get-session" })
        .then((account) => {
          const pro = account?.plan === "pro"
          setIsPro(pro)
          if (!pro) setActiveCategory((prev) => (prev === "BIOS" ? "All" : prev))
        })
        .catch(() => setIsPro(false))
    }
    loadPlan()
    window.addEventListener("auth:changed", loadPlan)
    return () => window.removeEventListener("auth:changed", loadPlan)
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey) setIsAltHeld(true)
    }
    const handleKeyUp = (e: KeyboardEvent) => {
      if (!e.altKey) setIsAltHeld(false)
    }
    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("keyup", handleKeyUp)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("keyup", handleKeyUp)
    }
  }, [])

  const loadTweaks = async () => {
    try {
      const cached = localStorage.getItem("k3d:tweakInfo")
      if (cached) {
        const parsed = JSON.parse(cached)
        if (Array.isArray(parsed) && parsed.length > 0) {
          setTweaks(parsed)
          setIsLoading(false)
        }
      }

      const fetchedTweaks = await invoke({
        channel: "tweaks:fetch",
      })
      if (Array.isArray(fetchedTweaks) && fetchedTweaks.length > 0) {
        setTweaks(fetchedTweaks)
        localStorage.setItem("k3d:tweakInfo", JSON.stringify(fetchedTweaks))
      }
    } catch (error) {
      console.error("Error fetching tweaks:", error)
      log.error("Error fetching tweaks:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const loadToggleStates = async () => {
    try {
      const savedStates = await invoke({
        channel: "tweak-states:load",
      })

      if (savedStates) {
        setToggleStates(JSON.parse(savedStates))
      }
    } catch (error) {
      console.error("Error loading toggle states:", error)
      log.error("Error loading toggle states:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const saveToggleStates = async (newStates) => {
    try {
      await invoke({
        channel: "tweak-states:save",
        payload: JSON.stringify(newStates),
      })
    } catch (error) {
      console.error("Error saving toggle states:", error)
      log.error("Error saving toggle states:", error)
    }
  }

  const applyTweak = async (tweak, _) => {
    toast.dismiss()
    const newState = !toggleStates[tweak.name]
    const newStates = {
      ...toggleStates,
      [tweak.name]: newState,
    }

    setToggleStates(newStates)

    const loadingToastId = toast.loading(
      `${newState ? "Applying" : "Unapplying"} tweak: ${tweak.title}`,
    )

    try {
      await saveToggleStates(newStates)

      if (newState) {
        const result = await invoke({
          channel: "tweak:apply",
          payload: tweak.name,
        })
        if (result?.success === false) {
          throw new Error(result.error || `Failed to apply tweak: ${tweak.title}`)
        }
        if (tweak.restart) {
          setNeedsRestart(true)
        }
        toast.update(loadingToastId, {
          render: `Applied tweak: ${tweak.title}`,
          type: "success",
          isLoading: false,
          autoClose: 3000,
        })
      } else {
        const result = await invoke({
          channel: "tweak:unapply",
          payload: tweak.name,
        })
        if (result?.success === false) {
          throw new Error(result.error || `Failed to unapply tweak: ${tweak.title}`)
        }
        if (tweak.restart) {
          setNeedsRestart(true)
        }
        toast.update(loadingToastId, {
          render: `Unapplied tweak: ${tweak.title}`,
          type: "info",
          isLoading: false,
          autoClose: 3000,
        })
      }
    } catch (error) {
      console.error(`Error toggling tweak ${tweak.title}:`, error)
      log.error(`Error toggling tweak ${tweak.title}:`, error)

      toast.update(loadingToastId, {
        render: `Failed to ${newState ? "apply" : "unapply"} tweak: ${tweak.title}`,
        type: "error",
        isLoading: false,
        autoClose: 3000,
      })

      const revertedStates = {
        ...newStates,
        [tweak.name]: !newState,
      }

      setToggleStates(revertedStates)

      try {
        await saveToggleStates(revertedStates)
      } catch (err) {
        console.error("Error reverting toggle state:", err)
        log.error("Error reverting toggle state:", err)
      }
    }
  }

  const isReversible = (tweak: any) => tweak.reversible == null || tweak.reversible === true

  const handleToggle = async (index) => {
    const tweak: any = tweaks[index]

    if (tweak.modal && !toggleStates[tweak.name]) {
      setSelectedTweak(tweak)
      setModalContent(tweak.modal)
      setBiosAccepted(false)
      setIsModalOpen(true)
      return
    }

    if (toggleStates[tweak.name] && !isReversible(tweak)) {
      toast.info(`"${tweak.title}" is a one-way tweak and can't be reverted.`)
      return
    }

    await applyTweak(tweak, index)
  }

  const forceReapplyTweak = async (tweak: Tweak) => {
    toast.dismiss()
    const loadingToastId = toast.loading(`Reapplying tweak: ${tweak.title}`)

    try {
      const result = await invoke({
        channel: "tweak:apply",
        payload: tweak.name,
      })
      if (result?.success === false) {
        throw new Error(result.error || `Failed to reapply tweak: ${tweak.title}`)
      }
      if (tweak.restart) {
        setNeedsRestart(true)
      }
      toast.update(loadingToastId, {
        render: `Reapplied tweak: ${tweak.title}`,
        type: "success",
        isLoading: false,
        autoClose: 3000,
      })
    } catch (error) {
      console.error(`Error reapplying tweak ${tweak.title}:`, error)
      log.error(`Error reapplying tweak ${tweak.title}:`, error)
      toast.update(loadingToastId, {
        render: `Failed to reapply tweak: ${tweak.title}`,
        type: "error",
        isLoading: false,
        autoClose: 3000,
      })
    }
  }

  const handleApplyRecommended = async () => {
    const preset = presets[0]
    const presetTweaks = tweaks.filter(
      (t) => preset.tweaks.includes(t.name) && !tweakCategories(t).includes("BIOS"),
    )
    setRecommendedTweaksToApply(presetTweaks)
    setSelectedRecommendedTweaks(new Set(presetTweaks.map((t) => t.name)))
    setIsRecommendedModalOpen(true)
  }

  const applyRecommendedTweaks = async () => {
    toast.dismiss()
    setIsApplyingRecommended(true)
    setIsRecommendedModalOpen(false)

    const newStates = { ...toggleStates }
    const tweaksToApply = recommendedTweaksToApply.filter((t) =>
      selectedRecommendedTweaks.has(t.name),
    )

    for (const tweak of tweaksToApply) {
      const loadingToastId = toast.loading(`Applying tweak: ${tweak.title}`)

      try {
        newStates[tweak.name] = true
        setToggleStates({ ...newStates })
        await saveToggleStates(newStates)

        const result = await invoke({
          channel: "tweak:apply",
          payload: tweak.name,
        })
        if (result?.success === false) {
          throw new Error(result.error || `Failed to apply tweak: ${tweak.title}`)
        }

        if (tweak.restart) {
          setNeedsRestart(true)
        }

        toast.update(loadingToastId, {
          render: `Applied tweak: ${tweak.title}`,
          type: "success",
          isLoading: false,
          autoClose: 3000,
        })
      } catch (error) {
        console.error(`Error applying tweak ${tweak.title}:`, error)
        log.error(`Error applying tweak ${tweak.title}:`, error)

        newStates[tweak.name] = false
        setToggleStates({ ...newStates })
        await saveToggleStates(newStates)

        toast.update(loadingToastId, {
          render: `Failed to apply tweak: ${tweak.title}`,
          type: "error",
          isLoading: false,
          autoClose: 3000,
        })
      }
    }

    setIsApplyingRecommended(false)
  }

  const filteredTweaks: any = useMemo(() => {
    const term = deferredSearchTerm.toLowerCase().trim()
    return tweaks.filter((tweak) => {
      const matchesSearch =
        !term ||
        tweak.title?.toLowerCase().includes(term) ||
        tweak.description?.toLowerCase().includes(term) ||
        tweakCategories(tweak).some((cat) => cat.toLowerCase().includes(term))

      if (!isPro && tweakCategories(tweak).includes("BIOS")) return false

      const matchesCategory =
        activeCategory === "All" || tweakCategories(tweak).includes(activeCategory)

      return matchesSearch && matchesCategory
    })
  }, [tweaks, deferredSearchTerm, activeCategory, isPro])

  const categories = useMemo(() => {
    const all = [...new Set(tweaks.flatMap((t: any) => tweakCategories(t)))]
    const rest = all.filter((c) => c !== "BIOS")
    const ordered = [...rest, ...(all.includes("BIOS") ? ["BIOS"] : [])]
    return ["All", ...ordered.filter((c) => isPro || c !== "BIOS")]
  }, [tweaks, isPro])

  const sortedTweaks = useMemo(() => {
    return [...filteredTweaks].sort((a, b) => {
      const aRec: any = !!a.top
      const bRec: any = !!b.top
      return bRec - aRec
    })
  }, [filteredTweaks])

  const categoryIcons = {
    Performance: <Zap className="w-4 h-4  text-k3d-primary" />,
    GPU: <Gpu className="w-4 h-4 text-k3d-primary" />,
    Privacy: <Shield className="w-4 h-4 text-k3d-primary" />,
    Network: <Network className="w-4 h-4 text-k3d-primary" />,
    Appearance: <Paintbrush className="w-4 h-4 text-k3d-primary" />,
    Gaming: <Gamepad className="w-4 h-4 text-k3d-primary" />,
    General: <Wrench className="w-4 h-4 text-k3d-primary" />,
    BIOS: <HardDrive className="w-4 h-4 text-k3d-primary" />,
  }

  const presets = [
    {
      name: "Apply Recommended Tweaks",
      description: "A balanced set of tweaks for everyday use.",
      tweaks: [
        "disable-telemetry",
        "revert-context-menu",
        "hide-taskview-and-widgets",
        "set-win32-priority-separation",
        "disable-copilot",
        "enable-end-task-right-click",
        "disable-location-tracking",
        "disable-lockscreen-tips",
        "optimize-network-settings",
        "set-services-to-manual",
      ],
    },
  ]

  if (isLoading) {
    return (
      <RootDiv>
        <div className="flex items-center justify-center h-64">
          <div className="text-slate-400">Loading tweaks...</div>
        </div>
      </RootDiv>
    )
  }

  return (
    <>
      <Modal open={isRecommendedModalOpen} onClose={() => setIsRecommendedModalOpen(false)}>
        <div className="bg-k3d-card border border-k3d-border rounded-2xl p-4 max-w-xl w-full mx-4 max-h-2xl">
          <h3 className="text-xl font-semibold text-k3d-text mb-3">Apply Recommended Tweaks</h3>
          <div className="text-k3d-text-secondary text-sm leading-6 whitespace-pre-wrap max-h-64 overflow-y-auto custom-scrollbar mb-6">
            Select the tweaks you want to apply:
            <p className="text-xs text-k3d-text-secondary ">
              Debloating Windows is highly recommended — apply recommended tweaks first, then use the
              separate Debloat page.
            </p>
            <ul className="mt-3 space-y-3">
              {recommendedTweaksToApply.map((tweak) => (
                <li
                  key={tweak.name}
                  className="flex flex-col rounded-lg border border-k3d-border p-3 mr-2"
                >
                  <label className="flex items-center cursor-pointer">
                    <Checkbox
                      checked={selectedRecommendedTweaks.has(tweak.name)}
                      onChange={(checked) => {
                        const newSelected = new Set(selectedRecommendedTweaks)
                        if (checked) newSelected.add(tweak.name)
                        else newSelected.delete(tweak.name)
                        setSelectedRecommendedTweaks(newSelected)
                      }}
                    />
                    <h2 className="font-medium text-k3d-text">{tweak.title}</h2>
                  </label>

                  {tweak.description && (
                    <p className="ml-7 text-sm text-k3d-text-secondary leading-snug">
                      {tweak.description}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex justify-end gap-3">
            <Button
              variant="secondary"
              onClick={() => setIsRecommendedModalOpen(false)}
              disabled={isApplyingRecommended}
            >
              Cancel
            </Button>
            <Button
              onClick={applyRecommendedTweaks}
              disabled={isApplyingRecommended || selectedRecommendedTweaks.size === 0}
            >
              {isApplyingRecommended
                ? "Applying..."
                : `Apply Selected (${selectedRecommendedTweaks.size})`}
            </Button>
          </div>
        </div>
      </Modal>
      <Modal
        open={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
        }}
      >
        <div className="bg-k3d-card border border-k3d-border rounded-2xl p-4 shadow-xl max-w-lg w-full mx-4">
          <h3 className="text-xl font-semibold text-k3d-text mb-3">{selectedTweak?.title}</h3>
          <div className="text-k3d-text-secondary text-sm leading-6 max-h-64 overflow-y-auto custom-scrollbar mb-6 prose prose-green marker:text-k3d-secondary">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{String(modalContent)}</ReactMarkdown>
          </div>
          {selectedTweak && tweakCategories(selectedTweak).includes("BIOS") && (
            <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 p-3">
              <Checkbox
                label="I understand the risks of changing BIOS-related settings"
                checked={biosAccepted}
                onChange={setBiosAccepted}
              />
            </div>
          )}
          <div className="flex justify-end gap-3">
            <Button
              variant="secondary"
              onClick={() => {
                setIsModalOpen(false)
              }}
            >
              Cancel
            </Button>
            {selectedTweak && (
              <Button
                disabled={
                  tweakCategories(selectedTweak).includes("BIOS") && !biosAccepted
                }
                onClick={async () => {
                  const newState = true
                  const newStates = {
                    ...toggleStates,
                    [selectedTweak.name]: newState,
                  }

                  setToggleStates(newStates)
                  setIsModalOpen(false)

                  const loadingToastId = toast.loading(`Applying tweak: ${selectedTweak.title}`)

                  try {
                    await saveToggleStates(newStates)
                    const result = await invoke({
                      channel: "tweak:apply",
                      payload: selectedTweak.name,
                    })
                    if (result?.success === false) {
                      throw new Error(
                        result.error || `Failed to apply tweak: ${selectedTweak.title}`,
                      )
                    }
                    if (selectedTweak.restart) {
                      setNeedsRestart(true)
                    }
                    toast.update(loadingToastId, {
                      render: `Applied tweak: ${selectedTweak.title}`,
                      type: "success",
                      isLoading: false,
                      autoClose: 3000,
                    })
                  } catch (error) {
                    console.error(`Error applying tweak ${selectedTweak.title}:`, error)
                    log.error(`Error applying tweak ${selectedTweak.title}:`, error)

                    const revertedStates = {
                      ...toggleStates,
                      [selectedTweak.name]: false,
                    }
                    setToggleStates(revertedStates)
                    await saveToggleStates(revertedStates)

                    toast.update(loadingToastId, {
                      render: `Failed to apply tweak: ${selectedTweak.title}`,
                      type: "error",
                      isLoading: false,
                      autoClose: 3000,
                    })
                  }
                }}
              >
                Apply
              </Button>
            )}
          </div>
        </div>
      </Modal>
      <RootDiv>
        <div className="max-w-450 mx-auto ">
          <div className="mb-4 flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
              {categories.map((category) => (
                <button
                  key={category}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 active:scale-95 flex gap-1.5 items-center ` +
                    (activeCategory === category
                      ? "bg-k3d-accent/90 text-k3d-text shadow-sm border border-k3d-border"
                      : "bg-k3d-card/60 text-k3d-text-secondary hover:bg-k3d-border hover:text-k3d-text border border-k3d-border-secondary")
                  }
                  onClick={() => setActiveCategory(category)}
                >
                  {categoryIcons[category]} {category}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {presets.length > 0 && tweaks.some((t) => presets[0].tweaks.includes(t.name)) && (
                <button
                  type="button"
                  onClick={handleApplyRecommended}
                  disabled={isApplyingRecommended}
                  className={`shrink-0 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 active:scale-95 flex items-center gap-1.5 ${
                    isApplyingRecommended
                      ? "bg-k3d-accent/90 text-k3d-text-secondary cursor-not-allowed"
                      : "bg-k3d-accent/90 text-k3d-text shadow-sm border border-k3d-border hover:bg-k3d-border hover:text-k3d-text"
                  }`}
                >
                  Apply Recommended Tweaks
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4">
            {sortedTweaks.length > 0 ? (
              sortedTweaks.map((tweak, _) => {
                const originalIndex = tweaks.indexOf(tweak)
                const cardBody = (
                  <div className="p-4 flex flex-col h-full">
                    <h2 className="font-semibold text-k3d-text text-sm leading-tight mb-2">{tweak.title}</h2>
                    <p className="text-k3d-text-secondary text-xs leading-relaxed flex-1 overflow-y-auto custom-scrollbar pr-1">
                      {tweak.description}
                    </p>
                    <div className="mt-auto flex items-start justify-between gap-2">
                      <div className="flex items-start gap-1.5 flex-wrap">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {tweakCategories(tweak).map((cat) => (
                            <Tooltip
                              key={cat}
                              content={`${cat} Optimization`}
                              delay={0.3}
                              side="top"
                            >
                              <div className="p-1 bg-k3d-accent rounded-md hover:bg-k3d-border-secondary transition-colors text-k3d-text-secondary">
                                {categoryIcons[cat] || categoryIcons["General"]}
                              </div>
                            </Tooltip>
                          ))}
                          {tweak.warning && (
                            <Tooltip content={tweak.warning} delay={0.3} side="top">
                              <div className="p-1 rounded-md bg-red-900/30 text-red-400 hover:bg-red-900/50 transition-colors">
                                <AlertTriangle className="w-3.5 h-3.5" />
                              </div>
                            </Tooltip>
                          )}
                          {tweak.recommended && (
                            <Tooltip content={"Recommended Tweak"} delay={0.3} side="top">
                              <div className="p-1 rounded-md bg-green-900/30 text-green-400 hover:bg-green-900/50 transition-colors">
                                <Star className="w-3.5 h-3.5 text-green-400" />
                              </div>
                            </Tooltip>
                          )}
                          {tweak.addedversion &&
                            isNewInCurrentVersion(tweak.addedversion, CURRENT_VERSION) && (
                              <Tooltip
                                content={`New in K3d Tweaks ${tweak.addedversion}`}
                                delay={0.3}
                                side="top"
                              >
                                <div className="p-1 rounded-md bg-k3d-accent text-k3d-text-secondary hover:bg-k3d-border-secondary transition-colors">
                                  <Plus className="w-3.5 h-3.5" />
                                </div>
                              </Tooltip>
                            )}
                          {tweak.updatedversion &&
                            isUpdatedInCurrentVersion(tweak.updatedversion, CURRENT_VERSION) && (
                              <Tooltip
                                content={`Updated in K3d Tweaks ${tweak.updatedversion}`}
                                delay={0.3}
                                side="top"
                              >
                                <div className="p-1 rounded-md bg-k3d-accent text-k3d-text-secondary hover:bg-k3d-border-secondary transition-colors">
                                  <RotateCw className="w-3.5 h-3.5" />
                                </div>
                              </Tooltip>
                            )}
                          {!isTweakCompatible(tweak) && (
                            <Tooltip content={isTweakCompatible(tweak).reason} delay={0.3} side="top">
                              <div className="p-1 rounded-md bg-k3d-accent text-k3d-text-muted hover:bg-k3d-border-secondary transition-colors">
                                <Monitor className="w-3.5 h-3.5" />
                              </div>
                            </Tooltip>
                          )}
                        </div>
                      </div>
                      {(() => {
                        const compatibility = isTweakCompatible(tweak)
                        const reversible = isReversible(tweak)
                        const isApplied = !!toggleStates[tweak.name]
                        const hint = !compatibility.compatible
                          ? compatibility.reason
                          : !reversible
                            ? isApplied
                              ? "One-way tweak — applied, it can't be reverted"
                              : "One-way tweak — it can't be reverted once applied"
                            : null
                        return (
                          <>
                            {isApplied && isAltHeld ? (
                              <Tooltip
                                content={
                                  !compatibility.compatible
                                    ? compatibility.reason
                                    : "Force reapply"
                                }
                              >
                                <Button
                                  variant="outline"
                                  className="h-7 px-2.5 text-[11px] flex items-center justify-center gap-1 rounded-md border-k3d-border shrink-0"
                                  onClick={() => forceReapplyTweak(tweak)}
                                  disabled={!compatibility.compatible}
                                >
                                  <RotateCw className="w-3 h-3" /> Reapply
                                </Button>
                              </Tooltip>
                            ) : (
                              <Tooltip content={hint} delay={0.3}>
                                <Toggle
                                  checked={isApplied}
                                  onChange={() => handleToggle(originalIndex)}
                                  disabled={!compatibility.compatible}
                                />
                              </Tooltip>
                            )}
                          </>
                        )
                      })()}
                    </div>
                  </div>
                )
                return tweak.name === "debloat-windows" ? (
                  <div
                    key={originalIndex}
                    className="animate-border-spin rounded-xl p-[1px]"
                    style={{
                      background:
                        "linear-gradient(135deg, #16a34a 0%, #22c55e 55%, #15803d 100%)",
                    }}
                  >
                    <Card className="border-0 p-0 h-52">{cardBody}</Card>
                  </div>
                ) : (
                  <Card key={originalIndex} className=" p-0 h-52">
                    {cardBody}
                  </Card>
                )
              })
            ) : (
              <div className="col-span-full flex flex-col items-center justify-center py-16 text-center">
                <div className="bg-k3d-card p-6 rounded-xl mb-4">
                  <Search className="w-10 h-10 text-k3d-text-secondary" />
                </div>
                <h3 className="text-sm font-medium mb-2 text-k3d-text">
                  No tweaks Found
                </h3>
                <p className="text-k3d-text-secondary">Try adjusting your search or filters</p>
              </div>
            )}
          </div>
        </div>
      </RootDiv>
    </>
  )
}

export default Tweaks
