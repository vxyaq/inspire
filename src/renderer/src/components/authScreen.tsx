import { useState, useEffect } from "react"
import { toast } from "react-toastify"
import Button from "./ui/button"
import Card from "./ui/Card"
import { invoke } from "@/lib/electron"
import { applyBackgroundImage, getBackgroundStyle } from "@/lib/background"
import k3dTweaksLogo from "../assets/k3dtweaks-logo.svg"
import discordLogo from "../assets/discord-logo.svg"

export interface AccountProfile {
  provider: "discord" | "google"
  id: string
  displayName: string
  email?: string
  avatarUrl?: string
  plan?: "free" | "pro"
}

interface AuthScreenProps {
  onAuthenticated: (account: AccountProfile) => void
}

export default function AuthScreen({ onAuthenticated }: AuthScreenProps): React.ReactElement {
  const [loadingProvider, setLoadingProvider] = useState<AccountProfile["provider"] | null>(null)

  useEffect(() => {
    if (getBackgroundStyle() === "image") {
      void applyBackgroundImage()
    }
  }, [])

  const handleLogin = async (provider: AccountProfile["provider"]) => {
    setLoadingProvider(provider)
    try {
      const result = await invoke({ channel: "auth:login", payload: provider })
      if (result?.ok && result.account) {
        onAuthenticated(result.account as AccountProfile)
      } else {
        toast.error(result?.error ?? "Unable to sign in")
      }
    } catch (error) {
      toast.error(String(error))
    } finally {
      setLoadingProvider(null)
    }
  }

  return (
    <main className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden px-5 py-10">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/45 via-black/55 to-black/65" />
      <Card className="relative w-full max-w-[360px] overflow-hidden rounded-2xl border border-k3d-border bg-[#070707] px-7 py-10 sm:px-8">
        <div className="flex flex-col items-center text-center">
          <img src={k3dTweaksLogo} alt="K3d Tweaks" className="h-14 w-14" />
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-white">Login to K3d Tweaks</h1>
          <p className="mt-8 max-w-[250px] text-sm leading-5 text-zinc-400">
            Choose one of the following to authorize:
          </p>
        </div>

        <div className="mt-6 grid gap-3">
          <Button
            className="h-12 w-full justify-center gap-2 rounded-xl bg-[#b7b7b9] px-4 text-[15px] font-medium text-[#29292d] hover:bg-[#d0d0d2]"
            variant=""
            onClick={() => handleLogin("discord")}
            disabled={loadingProvider !== null}
          >
            {loadingProvider === "discord" ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#5865f2]/30 border-t-[#5865f2]" />
            ) : (
              <img src={discordLogo} alt="" className="h-[18px] w-[22px]" />
            )}
            <span>
              {loadingProvider === "discord" ? "Connecting to Discord…" : "Sign in with Discord"}
            </span>
          </Button>
        </div>

        <p className="mt-7 text-center text-xs font-medium text-zinc-300">
          Auth handled by <span className="text-k3d-primary">K3d Tweaks</span>
        </p>
        <p className="mt-1 text-center text-xs text-zinc-500">
          Authentication opens in your browser
        </p>
      </Card>
    </main>
  )
}
