import RootDiv from "@/components/rootdiv"
import { useEffect, useState } from "react"
import { invoke } from "@/lib/electron"
import Button from "@/components/ui/button"
import ChangelogModal from "@/components/changelogModal"
import Toggle from "@/components/ui/Toggle"
import { toast } from "react-toastify"
import Card from "@/components/ui/Card"
import { Input } from "@/components/ui/input"
import { Dropdown } from "@/components/ui/dropdown"
import {
  applyBackgroundImage,
  applyPlainGray,
  getBackgroundStyle,
  setBackgroundStyle as persistBackgroundStyle,
  type BackgroundStyle,
} from "@/lib/background"

function Settings() {
  const [animationDirection, setAnimationDirection] = useState<"up" | "left" | "off">(
    (localStorage.getItem("pageAnimation") as "up" | "left" | "off") || "up",
  )
  const [checking, setChecking] = useState(false)
  const [trayEnabled, setTrayEnabled] = useState(true)
  const [trayLoading, setTrayLoading] = useState(false)
  const [changelogOpen, setChangelogOpen] = useState(false)
  const [gameRequest, setGameRequest] = useState("")
  const [requestSending, setRequestSending] = useState(false)
  const [isPro, setIsPro] = useState(false)
  const [rpcEnabled, setRpcEnabled] = useState(true)
  const [rpcLoading, setRpcLoading] = useState(false)
  const [rpcConnected, setRpcConnected] = useState<boolean | null>(null)
  const submitGameRequest = async () => {
    const name = gameRequest.trim()
    if (name.length < 2) {
      toast.error("Enter a game name first")
      return
    }
    try {
      setRequestSending(true)
      const res = await invoke({ channel: "request:send", payload: name })
      if (res?.ok) {
        toast.success("Request sent")
        setGameRequest("")
      } else {
        toast.error(res?.error ?? "Unable to send request")
      }
    } catch (e) {
      toast.error(String(e))
    } finally {
      setRequestSending(false)
    }
  }

  const checkForUpdates = async () => {
    try {
      setChecking(true)
      const res = await invoke({ channel: "updater:check" })
      if (res?.ok && !res.updateInfo) {
        toast.success("You're up to date")
      } else if (res?.updateInfo) {
        toast.info(`Update available: ${res.updateInfo.version}`)
      } else {
        toast.error(res?.error ?? "Unable to check for updates")
      }
    } catch (e) {
      toast.error(String(e))
    } finally {
      setChecking(false)
    }
  }

  useEffect(() => {
    invoke({ channel: "tray:get" }).then((status) => setTrayEnabled(status))
  }, [])

  const [backgroundStyle, setBackgroundStyleState] = useState<BackgroundStyle>(() =>
    getBackgroundStyle(),
  )

  const backgroundLabel = (style: BackgroundStyle): string =>
    style === "image2" ? "Second image" : style === "gray" ? "Plain gray" : "Blurred image"

  const handleBackgroundChange = (value: string) => {
    const style: BackgroundStyle =
      value === "Second image" ? "image2" : value === "Plain gray" ? "gray" : "image"
    setBackgroundStyleState(style)
    persistBackgroundStyle(style)
    if (style === "gray") {
      applyPlainGray()
    } else {
      void applyBackgroundImage(style)
    }
  }

  useEffect(() => {
    const loadPlan = () => {
      invoke({ channel: "auth:get-session" })
        .then((account) => {
          const pro = account?.plan === "pro"
          setIsPro(pro)
          if (!pro) {
            setBackgroundStyleState("gray")
            persistBackgroundStyle("gray")
            applyPlainGray()
          }
        })
        .catch(() => setIsPro(false))
    }
    loadPlan()
    window.addEventListener("auth:changed", loadPlan)
    return () => window.removeEventListener("auth:changed", loadPlan)
  }, [])

  useEffect(() => {
    invoke({ channel: "rpc-enabled:get" }).then((status) => setRpcEnabled(status))
    const checkRpc = () => {
      invoke({ channel: "rpc:status" })
        .then((status) => setRpcConnected(!!status?.connected))
        .catch(() => setRpcConnected(null))
    }
    checkRpc()
    const timer = setInterval(checkRpc, 5000)
    return () => clearInterval(timer)
  }, [])

  const handleToggleTray = async () => {
    setTrayLoading(true)
    const newStatus = !trayEnabled
    await invoke({ channel: "tray:set", payload: newStatus })
    setTrayEnabled(newStatus)
    setTrayLoading(false)
  }

  const handleToggleRpc = async () => {
    setRpcLoading(true)
    const newStatus = !rpcEnabled
    await invoke({ channel: "rpc-enabled:set", payload: newStatus })
    setRpcEnabled(newStatus)
    setRpcLoading(false)
    toast.success("Discord RPC " + (newStatus ? "Enabled" : "Disabled"))
  }

  return (
    <>
      <ChangelogModal open={changelogOpen} onClose={() => setChangelogOpen(false)} />
      <RootDiv>
        <div className="min-h-screen w-full pb-16 overflow-y-auto">
          <div className="space-y-8 ">
            <SettingSection title="Appearance">
              <SettingCard>
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="text-base font-medium text-k3d-text mb-1">
                      Animation Direction
                    </h3>
                    <p className="text-sm text-k3d-text-secondary">
                      Choose the page transition animation direction
                    </p>
                  </div>
                  <Dropdown
                    value={animationDirection}
                    options={["up", "left", "off"]}
                    onChange={(value) => {
                      setAnimationDirection(value as "up" | "left" | "off")
                      localStorage.setItem("pageAnimation", value)
                    }}
                  />                </div>
              </SettingCard>
              <SettingCard>
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="text-base font-medium text-k3d-text mb-1">Background</h3>
                    <p className="text-sm text-k3d-text-secondary">
                      Show the blurred background image or a plain gray background
                    </p>
                  </div>
                  <Dropdown
                    value={isPro ? backgroundLabel(backgroundStyle) : "Plain gray"}
                    options={isPro ? ["Blurred image", "Second image", "Plain gray"] : ["Plain gray"]}
                    onChange={handleBackgroundChange}
                    disabled={!isPro}
                  />
                </div>
              </SettingCard>
            </SettingSection>

            <SettingSection title="Updates">
              <SettingCard>
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="text-base font-medium text-k3d-text mb-1">
                      Check for Updates
                    </h3>
                    <p className="text-sm text-k3d-text-secondary">Check for updates</p>
                  </div>
                  <Button onClick={checkForUpdates} disabled={checking}>
                    {checking ? "Checking..." : "Check for Updates"}
                  </Button>
                </div>
              </SettingCard>
            </SettingSection>

            <SettingSection title="Request Game">
              <SettingCard>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1">
                    <h3 className="text-base font-medium text-k3d-text mb-1">
                      Request a game
                    </h3>
                    <p className="text-sm text-k3d-text-secondary mb-3">
                      Tell us which game optimization you want next.
                    </p>
                    <Input
                      value={gameRequest}
                      onChange={(e) => setGameRequest(e.target.value)}
                      placeholder="Game name..."
                      maxLength={100}
                    />
                  </div>
                  <Button onClick={submitGameRequest} disabled={requestSending} className="shrink-0 self-end">
                    {requestSending ? "Sending..." : "Submit"}
                  </Button>
                </div>
              </SettingCard>
            </SettingSection>

            <SettingSection title="Other">
              <SettingCard>
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="text-base font-medium text-k3d-text mb-1">Show tray icon</h3>
                    <p className="text-sm text-k3d-text-secondary">
                      Enable or disable K3d Tweaks running in the system tray.
                      <span className="inline-flex items-center gap-1 ml-2 text-yellow-500">
                        <span className="w-1.5 h-1.5 bg-yellow-500 rounded-full"></span>
                        Requires restart
                      </span>
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Toggle
                      checked={trayEnabled}
                      onChange={handleToggleTray}
                      disabled={trayLoading}
                    />
                    <span
                      className={`text-xs font-medium px-2 py-1 rounded-full ${
                        trayEnabled
                          ? "text-green-400 bg-green-400/10"
                          : "text-k3d-text-secondary bg-k3d-border-secondary/20"
                      }`}
                    >
                      {trayEnabled ? "Enabled" : "Disabled"}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-4">
                  <div className="flex-1">
                    <h3 className="text-base font-medium text-k3d-text mb-1">
                      Discord Rich Presence
                    </h3>
                    <p className="text-sm text-k3d-text-secondary">
                      Show your current K3d Tweaks activity on Discord.
                      {rpcConnected !== null && (
                        <span
                          className={`ml-2 text-xs font-medium ${rpcConnected ? "text-green-400" : "text-yellow-500"}`}
                        >
                          {rpcConnected ? "● Connected" : "● Waiting for Discord…"}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Toggle checked={rpcEnabled} onChange={handleToggleRpc} disabled={rpcLoading} />
                    <span
                      className={`text-xs font-medium px-2 py-1 rounded-full ${
                        rpcEnabled
                          ? "text-green-400 bg-green-400/10"
                          : "text-k3d-text-secondary bg-k3d-border-secondary/20"
                      }`}
                    >
                      {rpcEnabled ? "Enabled" : "Disabled"}
                    </span>
                  </div>
                </div>
              </SettingCard>
              <SettingCard>
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="text-base font-medium text-k3d-text mb-1">
                      View Changelog
                    </h3>
                    <p className="text-sm text-k3d-text-secondary">
                      Open the changelog modal.
                    </p>
                  </div>
                  <Button variant="secondary" onClick={() => setChangelogOpen(true)}>
                    Open Changelog
                  </Button>
                </div>
              </SettingCard>
            </SettingSection>

          </div>
        </div>
      </RootDiv>
    </>
  )
}
const SettingCard = ({ children, className = "" }) => (
  <Card className={`p-4 ${className}`}>{children}</Card>
)

const SettingSection = ({ title, children }) => (
  <div className="space-y-4">
    <h2 className="text-xl font-semibold text-k3d-primary">{title}</h2>
    {children}
  </div>
)
export default Settings
