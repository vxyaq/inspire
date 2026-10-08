import { create } from "zustand"

interface SystemInfoStore {
  systemInfo: Record<string, any>
  setSystemInfo: (info: Record<string, any>) => void
}

const useSystemStore = create<SystemInfoStore>((set) => ({
  systemInfo: {},
  setSystemInfo: (info: Record<string, any>) => set({ systemInfo: info }),
}))

export default useSystemStore
