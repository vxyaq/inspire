import { useState, useEffect, lazy, Suspense } from "react"
import { Routes, Route, Navigate } from "react-router-dom"
import TitleBar from "./components/titlebar"
import Nav from "./components/nav"
import "./App.css"
import { ToastContainer, Slide } from "react-toastify"
import Home from "./pages/Home"
import FirstTime from "./components/firsttime"

const Tweaks = lazy(() => import("./pages/Tweaks"))
const Clean = lazy(() => import("./pages/Clean"))
const Games = lazy(() => import("./pages/Games"))
const Settings = lazy(() => import("./pages/Settings"))
const Account = lazy(() => import("./pages/Account"))
const Backup = lazy(() => import("./pages/Backup"))
import UpdateManager from "./components/updatemanager"
import ChangelogModal from "./components/changelogModal"
import useOnlineStore from "./store/online"
import { CURRENT_VERSION } from "./lib/version"

import NoAdmin from "./components/noAdmin"
import {
  loadSavedBackground,
  applyPlainGray,
  setBackgroundStyle,
} from "./lib/background"
import { invoke } from "./lib/electron"
import AuthScreen, { type AccountProfile } from "./components/authScreen"

function App() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    localStorage.getItem("sidebarCollapsed") === "true",
  )
  const [adminStatus, setAdminStatus] = useState<boolean | null>(null)
  const [platformName, setPlatformName] = useState<string | null>(null)
  const [account, setAccount] = useState<AccountProfile | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const { setOnline } = useOnlineStore()

  useEffect(() => {
    document.body.classList.remove("light", "purple", "dark", "classic")
    document.body.classList.add("gray", "dark")
    document.body.setAttribute("data-theme", "gray")
  }, [])

  useEffect(() => {
    void loadSavedBackground()
  }, [])

  useEffect(() => {
    invoke({ channel: "auth:get-session" })
      .then((session) => {
        setAccount(session ?? null)
        if (session) {
          invoke({ channel: "auth:refresh-plan" })
            .then((refreshed) => {
              const current = refreshed ?? session
              if (refreshed) {
                setAccount(refreshed)
                window.dispatchEvent(new Event("auth:changed"))
              }
              if (current?.plan !== "pro") {
                setBackgroundStyle("gray")
                applyPlainGray()
              }
            })
            .catch(() => {})
        }
      })
      .catch(() => setAccount(null))
      .finally(() => setAuthLoading(false))
  }, [])

  useEffect(() => {
    const handleAuthChanged = () => {
      invoke({ channel: "auth:get-session" })
        .then((session) => setAccount(session ?? null))
        .catch(() => setAccount(null))
    }
    window.addEventListener("auth:changed", handleAuthChanged)
    return () => window.removeEventListener("auth:changed", handleAuthChanged)
  }, [])

  const toggleSidebar = () => {
    const newCollapsed = !sidebarCollapsed
    setSidebarCollapsed(newCollapsed)
    localStorage.setItem("sidebarCollapsed", newCollapsed.toString())
  }
  useEffect(() => {
    const handleOnline = () => setOnline(true)
    const handleOffline = () => setOnline(false)
    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)
    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [setOnline])

  const [changelogOpen, setChangelogOpen] = useState(false)

  useEffect(() => {
    const lastSeen = localStorage.getItem("k3d:changelogSeenVersion")
    if (lastSeen !== CURRENT_VERSION) {
      const timer = setTimeout(() => setChangelogOpen(true), 500)
      return () => clearTimeout(timer)
    }
    return undefined
  }, [])

  useEffect(() => {
    window.electron.ipcRenderer.invoke("get-admin-status").then((isAdmin: boolean) => {
      setAdminStatus(isAdmin)
    })
  }, [])

  useEffect(() => {
    window.electron.ipcRenderer
      .invoke("get-platform")
      .then((platform: string | undefined) => {
        setPlatformName(platform ?? null)
      })
      .catch(() => {})
  }, [])

  return (
    <div className="flex flex-col h-screen bg-k3d-bg text-k3d-text overflow-hidden">
      {!authLoading && account && <FirstTime />}
      {authLoading ? (
        <main className="flex min-h-0 flex-1 items-center justify-center pt-[50px]">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-k3d-border border-t-k3d-primary" />
        </main>
      ) : !account ? (
        <AuthScreen onAuthenticated={setAccount} />
      ) : (
        <>
          <TitleBar
            onToggleSidebar={toggleSidebar}
            sidebarCollapsed={sidebarCollapsed}
          />
          <ChangelogModal
            open={changelogOpen}
            onClose={() => {
              localStorage.setItem("k3d:changelogSeenVersion", CURRENT_VERSION)
              setChangelogOpen(false)
            }}
          />
          <NoAdmin
            open={adminStatus === false && platformName === "win32"}
            onClose={() => setAdminStatus(true)}
            platform={platformName}
          />
          <Nav collapsed={sidebarCollapsed} />
          <div className="relative flex min-h-0 flex-1 pt-[50px]">
            <main
              className={`min-h-0 flex-1 rounded-tl-2xl border-l border-t border-k3d-border p-6 ${sidebarCollapsed ? "ml-16" : "ml-52"}`}
            >
              <Suspense
                fallback={
                  <div className="flex min-h-64 items-center justify-center">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-k3d-border border-t-k3d-primary" />
                  </div>
                }
              >
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/tweaks" element={<Tweaks />} />
                  <Route path="/clean" element={<Clean />} />
                  <Route
                    path="/games"
                    element={
                      account?.plan === "pro" ? <Games /> : <Navigate to="/" replace />
                    }
                  />
                  <Route path="/backup" element={<Backup />} />
                  <Route path="/account" element={<Account />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Suspense>
            </main>
          </div>
          <UpdateManager />
        </>
      )}
      <ToastContainer
        stacked
        limit={5}
        position="bottom-right"
        theme="dark"
        transition={Slide}
        hideProgressBar
        pauseOnFocusLoss={false}
      />
    </div>
  )
}

export default App
