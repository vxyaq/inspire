import { useState, useEffect } from "react"
import { Routes, Route, Navigate } from "react-router-dom"
import TitleBar from "./components/titlebar"
import Nav from "./components/nav"
import "./App.css"
import { ToastContainer, Slide } from "react-toastify"
import Home from "./pages/Home"
import Tweaks from "./pages/Tweaks"
import Clean from "./pages/Clean"
import Games from "./pages/Games"
import Settings from "./pages/Settings"
import Account from "./pages/Account"
import Backup from "./pages/Backup"
import FirstTime from "./components/firsttime"
import UpdateManager from "./components/updatemanager"
import ChangelogModal from "./components/changelogModal"
import useOnlineStore from "./store/online"
import { CURRENT_VERSION } from "./lib/version"

import NoAdmin from "./components/noAdmin"
import { loadSavedBackground } from "./lib/background"
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
              if (refreshed) {
                setAccount(refreshed)
                window.dispatchEvent(new Event("auth:changed"))
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
    const lastSeen = localStorage.getItem("inspire:changelogSeenVersion")
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
    <div className="flex flex-col h-screen bg-inspire-bg text-inspire-text overflow-hidden">
      {!authLoading && account && <FirstTime />}
      {authLoading ? (
        <main className="flex min-h-0 flex-1 items-center justify-center pt-[50px]">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-inspire-border border-t-inspire-primary" />
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
              localStorage.setItem("inspire:changelogSeenVersion", CURRENT_VERSION)
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
              className={`min-h-0 flex-1 rounded-tl-2xl border-l border-t border-inspire-border p-6 ${sidebarCollapsed ? "ml-16" : "ml-52"}`}
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
