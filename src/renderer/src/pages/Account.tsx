import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { CircleUserRound, CreditCard, Fingerprint, LogIn, LogOut, ShieldCheck } from "lucide-react"
import RootDiv from "@/components/rootdiv"
import Button from "@/components/ui/button"
import Card from "@/components/ui/Card"
import { invoke } from "@/lib/electron"

type AccountProfile = {
  provider: "discord" | "google"
  id: string
  displayName: string
  email?: string
  avatarUrl?: string
  plan?: "free" | "pro"
}

function Account() {
  const navigate = useNavigate()
  const [account, setAccount] = useState<AccountProfile | null>(null)
  const [systemUuid, setSystemUuid] = useState<string>("")
  const [loading, setLoading] = useState(true)

  const signOut = async () => {
    try {
      await invoke({ channel: "auth:logout" })
    } catch {
      return
    }
    setAccount(null)
    navigate("/")
    window.dispatchEvent(new Event("auth:changed"))
  }

  useEffect(() => {
    const loadAccount = () => {
      setLoading(true)
      invoke({ channel: "auth:get-session" })
        .then((session) => setAccount(session ?? null))
        .catch(() => setAccount(null))
        .finally(() => setLoading(false))
    }

    const loadSystemUuid = async () => {
      try {
        const uuid = await invoke({ channel: "get-system-uuid" })
        setSystemUuid(uuid ?? "Unknown")
      } catch {
        setSystemUuid("Unknown")
      }
    }

    loadAccount()
    loadSystemUuid()
    window.addEventListener("auth:changed", loadAccount)
    return () => window.removeEventListener("auth:changed", loadAccount)
  }, [])

  if (loading) {
    return (
      <RootDiv>
        <div className="flex min-h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-k3d-border border-t-k3d-primary" />
        </div>
      </RootDiv>
    )
  }

  if (!account) {
    return (
      <RootDiv>
        <Card className="mx-auto flex max-w-xl flex-col items-center gap-3 p-8 text-center">
          <LogIn className="h-10 w-10 text-k3d-primary" />
          <h1 className="text-xl font-semibold">No account signed in</h1>
          <p className="text-sm text-k3d-text-secondary">
            Sign in to view your account information.
          </p>
        </Card>
      </RootDiv>
    )
  }

  const providerName = account.provider === "discord" ? "Discord" : "Google"

  return (
    <RootDiv>
      <div className="mx-auto flex max-w-3xl flex-col gap-6 pb-12">
        <div>
          <h1 className="text-2xl font-semibold text-k3d-text">Account</h1>
          <p className="mt-1 text-sm text-k3d-text-secondary">
            Information about the account connected to K3d Tweaks.
          </p>
        </div>

        <Card className="flex items-center gap-4 p-6">
          {account.avatarUrl ? (
            <img
              src={account.avatarUrl}
              alt=""
              className="h-16 w-16 rounded-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-k3d-primary/15 text-2xl font-semibold text-k3d-primary">
              {account.displayName.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-xl font-semibold text-k3d-text">
              {account.displayName}
            </h2>
            <p className="truncate text-sm text-k3d-text-secondary">
              {account.email ?? `Connected via ${providerName}`}
            </p>
          </div>
          <Button variant="secondary" onClick={signOut} className="shrink-0">
            <LogOut size={16} /> Log out
          </Button>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2">
          <InfoCard icon={<CircleUserRound />} label="Account name" value={account.displayName} />
          <InfoCard
            icon={<CreditCard />}
            label="Plan"
            value={account.plan === "pro" ? "Pro" : "Free"}
          />
          <InfoCard
            icon={<Fingerprint />}
            label="HWID (click to copy)"
            value={systemUuid}
            valueClassName="break-all font-mono text-xs blur-xs select-all"
            onClick={() => copyHwid(systemUuid)}
          />
          <InfoCard icon={<ShieldCheck />} label="Signed in with" value={providerName} />
        </div>
      </div>
    </RootDiv>
  )
}

async function copyHwid(hwid: string) {
  if (!hwid) return
  try {
    await navigator.clipboard.writeText(hwid)
  } catch {
    const area = document.createElement("textarea")
    area.value = hwid
    document.body.appendChild(area)
    area.select()
    document.execCommand("copy")
    document.body.removeChild(area)
  }
}

function InfoCard({
  icon,
  label,
  value,
  valueClassName = "",
  onClick,
}: {
  icon: React.ReactNode
  label: string
  value: string
  valueClassName?: string
  onClick?: () => void
}) {
  return (
    <Card
      className={`flex min-w-0 items-start gap-3 p-4 ${onClick ? "cursor-pointer" : ""}`}
      onClick={onClick}
    >
      <div className="rounded-lg bg-k3d-primary/10 p-2 text-k3d-primary">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-k3d-text-muted">{label}</p>
        <p className={`mt-1 text-sm font-medium text-k3d-text ${valueClassName}`}>{value}</p>
      </div>
    </Card>
  )
}

export default Account
