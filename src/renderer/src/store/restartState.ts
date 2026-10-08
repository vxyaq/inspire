import { create } from "zustand"

interface RestartState {
  needsRestart: boolean
  setNeedsRestart: (value: boolean) => void
  resetRestartState: () => void
}

const useRestartStore = create<RestartState>((set) => ({
  needsRestart: false,
  setNeedsRestart: (value: boolean) => set({ needsRestart: value }),
  resetRestartState: () => set({ needsRestart: false }),
}))

export default useRestartStore
