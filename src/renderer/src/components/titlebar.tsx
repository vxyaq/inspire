import { Menu, Minimize, Maximize, X, Search } from "lucide-react"
import { useLocation, useNavigate } from "react-router-dom"
import useSearchStore from "@/store/search"
import { close, minimize, toggleMaximize } from "../lib/electron"

interface TitleBarProps {
  onToggleSidebar: () => void
  sidebarCollapsed: boolean
}

function TitleBar({
  onToggleSidebar,
  sidebarCollapsed: _sidebarCollapsed,
}: TitleBarProps): React.ReactElement {
  const navigate = useNavigate()
  const location = useLocation()
  const searchQuery = useSearchStore((state) => state.query)
  const setSearchQuery = useSearchStore((state) => state.setQuery)

  const handleSearchChange = (value: string) => {
    setSearchQuery(value)
    if (location.pathname !== "/tweaks") navigate("/tweaks")
  }
  return (
    <div
      style={{ WebkitAppRegion: "drag" } as any}
      className="h-[50px] fixed top-0 left-0 right-0 flex justify-between items-center pl-3 pr-2 bg-inspire-bg border-b border-inspire-border z-50"
    >
      <div className="flex items-center gap-2.5 h-full pr-4">
        <button
          onClick={onToggleSidebar}
          title="Toggle sidebar"
          className="h-8 w-8 inline-flex items-center justify-center text-inspire-text-secondary hover:bg-inspire-accent hover:text-inspire-text transition-colors rounded-lg"
          style={{ WebkitAppRegion: "no-drag" } as any}
        >
          <Menu size={16} />
        </button>
      </div>
      <div className="flex-1 flex items-center justify-center gap-3 px-4 min-w-0">
        <div
          className="flex items-center gap-2 h-8 w-full max-w-80 rounded-lg bg-inspire-accent/60 border border-inspire-border px-2.5 transition-colors hover:border-inspire-border-secondary"
          style={{ WebkitAppRegion: "no-drag" } as any}
        >
          <Search size={14} className="text-inspire-text-secondary shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search tweaks..."
            className="w-full min-w-0 bg-transparent border-none focus:outline-hidden text-sm text-inspire-text placeholder:text-inspire-text-secondary"
          />
          {searchQuery && (
            <button
              type="button"
              aria-label="Clear search"
              title="Clear search"
              onClick={() => setSearchQuery("")}
              className="p-0.5 rounded hover:bg-inspire-border text-inspire-text-secondary transition-colors shrink-0"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      <div
        className="flex h-full items-center gap-1 pl-3 pr-1"
        style={{ WebkitAppRegion: "no-drag" } as any}
      >
        <button
          onClick={minimize}
          title="Minimize"
          className="h-8 w-10 inline-flex items-center justify-center text-inspire-text-secondary rounded-lg hover:bg-inspire-accent hover:text-inspire-text transition-colors"
        >
          <Minimize size={16} />
        </button>
        <button
          onClick={toggleMaximize}
          title="Maximize"
          className="h-8 w-10 inline-flex items-center justify-center text-inspire-text-secondary rounded-lg hover:bg-inspire-accent hover:text-inspire-text transition-colors"
        >
          <Maximize size={14} />
        </button>
        <button
          onClick={close}
          title="Close"
          className="h-8 w-10 inline-flex items-center justify-center text-inspire-text-secondary rounded-lg hover:bg-red-600 hover:text-white transition-colors"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  )
}

export default TitleBar
