import { create } from "zustand"

interface OnlineState {
  online: boolean
  setOnline: (online: boolean) => void
}

const useOnlineStore = create<OnlineState>((set) => ({
  online: typeof navigator !== "undefined" ? navigator.onLine : true,
  setOnline: (online: boolean) => set({ online }),
}))

if (typeof window !== "undefined") {
  window.addEventListener("online", () => useOnlineStore.getState().setOnline(true))
  window.addEventListener("offline", () => useOnlineStore.getState().setOnline(false))
}

export default useOnlineStore
