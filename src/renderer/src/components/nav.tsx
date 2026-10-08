import { invoke } from "@/lib/electron"
import { broom } from "@lucide/lab"
import { clsx } from "clsx"
import { CircleUserRound, Folder, Gamepad2, Home, Icon, RotateCw, Settings, Wrench } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import useRestartStore from "../store/restartState"
import Button from "./ui/button"
import Modal from "./ui/modal"

import Tooltip from "./ui/tooltip"

const tabIcons = {
  home: <Home size={20} />,
  tweaks: <Wrench size={20} />,
  clean: <Icon iconNode={broom} size={20} />,
  games: <Gamepad2 size={20} />,
  backup: <Folder size={20} />,
  account: <CircleUserRound size={20} />,
  settings: <Settings size={20} />,
}

const tabs = {
  home: { label: "Home", path: "/" },
  backup: { label: "Backup", path: "/backup" },
  tweaks: { label: "Tweaks", path: "/tweaks" },
  clean: { label: "Cleanup", path: "/clean" },
  games: { label: "Games", path: "/games" },
  account: { label: "Account", path: "/account" },
  settings: { label: "Settings", path: "/settings" },
}

function Nav({ collapsed }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { needsRestart } = useRestartStore()
  const [isPro, setIsPro] = useState(false)

  useEffect(() => {
    const loadPlan = () => {
      invoke({ channel: "auth:get-session" })
        .then((account) => setIsPro(account?.plan === "pro"))
        .catch(() => setIsPro(false))
    }
    loadPlan()
    window.addEventListener("auth:changed", loadPlan)
    return () => window.removeEventListener("auth:changed", loadPlan)
  }, [])

  const tabRefs = useRef<Record<string, HTMLElement | null>>({})
  const containerRef = useRef<HTMLDivElement | null>(null)

  const [showRestartModal, setShowRestartModal] = useState(false)

  const getActiveTab = () => {
    const path = location.pathname
    if (path === "/") return "home"
    const match = Object.entries(tabs).find(([, { path: p }]) => p === path)
    return match ? match[0] : ""
  }

  const activeTab = getActiveTab()

  useEffect(() => {

  }, [collapsed])

  return (
    <nav
      className={`h-screen text-k3d-text fixed left-0 top-0 flex flex-col py-6 z-40  transition-all duration-300 ease-in-out ${collapsed ? "w-16" : "w-52"}`}
    >
      <div className="flex-1 flex flex-col gap-2 px-3 mt-10 relative" ref={containerRef}>

        {Object.entries(tabs)
          .filter(([id]) => id !== "settings" && id !== "account" && (isPro || id !== "games"))
          .map(([id, { label, path }]) => {
            return (
              <Tooltip  content={!collapsed ? "" : label} side="right" delay={0} key={id}>
              <Button
                variant=""
                key={id}
                ref={(el) => (tabRefs.current[id] = el)}
                onClick={() => {
                  navigate(path)
                }}
                className={clsx(
                  `flex items-center gap-3 py-2.5 rounded-lg transition-all duration-200 border relative ${collapsed ? "px-2 justify-center" : "px-3"}`,
                  activeTab === id
                    ? "border-transparent text-k3d-primary bg-k3d-primary/10"
                    : "text-k3d-text-secondary hover:bg-k3d-border-secondary hover:text-k3d-text border-transparent",
                )}
              >
                <div>{tabIcons[id]}</div>
                {!collapsed && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{label}</span>
                  </div>
                )}
              </Button>
              </Tooltip>
            )
          })}
      </div>
      {needsRestart && (
        <button
          className={clsx(
            "flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 border m-3",
            "bg-k3d-card text-k3d-text border-k3d-border-secondary hover:bg-k3d-border-secondary hover:text-k3d-text",
          )}
          onClick={() => setShowRestartModal(true)}
        >
          <span
            className={`flex text-center items-center gap-2 text-red-500 ${collapsed ? "justify-center" : ""}`}
            title="Restart Windows to apply some changes"
          >
            <RotateCw size={16} /> {!collapsed && "Restart Required"}
          </span>
        </button>
      )}
      {}
      <div className="px-3 pt-3 mt-1 flex flex-col gap-2">
        <Tooltip content={!collapsed ? "" : tabs.account.label} side="right" delay={0}>
          <Button
            variant=""
            ref={(el) => (tabRefs.current["account"] = el)}
            onClick={() => navigate(tabs.account.path)}
            className={clsx(
              `flex items-center gap-3 py-2.5 rounded-lg transition-all duration-200 border relative ${collapsed ? "px-2 justify-center" : "px-3"}`,
              activeTab === "account"
                ? "border-transparent text-k3d-primary bg-k3d-primary/10"
                : "text-k3d-text-secondary hover:bg-k3d-border-secondary hover:text-k3d-text border-transparent",
            )}
          >
            <div>{tabIcons.account}</div>
            {!collapsed && (
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{tabs.account.label}</span>
              </div>
            )}
          </Button>
        </Tooltip>
        <Tooltip content={!collapsed ? "" : tabs.settings.label} side="right" delay={0}>
          <Button
            variant=""
            ref={(el) => (tabRefs.current["settings"] = el)}
            onClick={() => navigate(tabs.settings.path)}
            className={clsx(
              `flex items-center gap-3 py-2.5 rounded-lg transition-all duration-200 border relative ${collapsed ? "px-2 justify-center" : "px-3"}`,
              activeTab === "settings"
                ? "border-transparent text-k3d-primary bg-k3d-primary/10"
                : "text-k3d-text-secondary hover:bg-k3d-border-secondary hover:text-k3d-text border-transparent",
            )}
          >
            <div>{tabIcons.settings}</div>
            {!collapsed && (
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{tabs.settings.label}</span>
              </div>
            )}
          </Button>
        </Tooltip>
      </div>
      <Modal open={showRestartModal} onOpenChange={setShowRestartModal}>
        <div className="bg-k3d-card p-4 rounded-2xl border border-k3d-border text-k3d-text w-[90vw] max-w-md">
          <h2 className="text-lg font-semibold">Confirm Restart</h2>
          <p>Are you sure you want to restart your computer now?</p>
          <div className="flex gap-2 justify-end">
            <Button onClick={() => setShowRestartModal(false)} variant="secondary">
              Cancel
            </Button>
            <Button
              onClick={() => {
                setShowRestartModal(false)
                invoke({ channel: "restart" })
              }}
              variant="danger"
            >
              Restart
            </Button>
          </div>
        </div>
      </Modal>

    </nav>
  )
}

export default Nav
