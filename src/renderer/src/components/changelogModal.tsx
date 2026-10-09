import { useEffect, useState, type ComponentProps } from "react"
import Modal from "@/components/ui/modal"
import Button from "@/components/ui/button"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

interface Release {
  tag_name: string
  name: string
  body: string
  published_at: string
}

type CodeProps = ComponentProps<"code"> & { inline?: boolean }

function trimChecksums(body: string): string {
  const marker = /^#{1,6}\s*checksums\b/im
  const match = marker.exec(body)
  if (!match) return body
  return body.slice(0, match.index).trimEnd()
}

function ChangelogContent({ body }: { body: string }) {
  const trimmedBody = trimChecksums(body)
  return (
    <div className="prose prose-sm prose-green marker:text-k3d-secondary max-w-none text-k3d-text prose-headings:text-k3d-text prose-code:bg-k3d-border prose-code:text-k3d-text prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:text-sm prose-code:font-normal prose-code:before:content-none prose-code:after:content-none prose-pre:bg-k3d-card prose-pre:border prose-pre:border-k3d-border prose-img:rounded-lg prose-img:border prose-img:border-k3d-border">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children, ...props }) => (
            <a
              {...props}
              href={href}
              onClick={(e) => {
                e.preventDefault()
              }}
            >
              {children}
            </a>
          ),
          h1: ({ children, ...props }) => (
            <h1 {...props} className="font-semibold">
              {children}
            </h1>
          ),
          img: ({ ...props }) => (
            <img
              {...props}
              className="max-w-full h-auto rounded-lg border border-k3d-border"
              loading="lazy"
            />
          ),
          code: ({ inline, className, children, ...props }: CodeProps) => {
            if (inline) {
              return (
                <code
                  className="bg-k3d-primary px-1.5 py-0.5 rounded-md text-sm font-normal"
                  {...props}
                >
                  {children}
                </code>
              )
            }
            return (
              <code className={className} {...props}>
                {children}
              </code>
            )
          },
        }}
      >
        {trimmedBody}
      </ReactMarkdown>
    </div>
  )
}

const LOCAL_CHANGELOG: Release[] = [
  {
    tag_name: "v1.2.5",
    name: "K3d Tweaks v1.2.5",
    body: "## What's New\n\n- Login moved to the new auth server\n- Auth server address stays changeable in Settings\n",
    published_at: new Date().toISOString(),
  },
  {
    tag_name: "v1.2.4",
    name: "K3d Tweaks v1.2.4",
    body: "## What's New\n\n- Games folder with CS2 mega FPS boost and Fortnite optimization\n- BIOS tab with hardware detection and risk confirmation\n- 8 Pro tweaks with locks, Pro-only backgrounds, Games and BIOS tabs\n- Request Game section with Discord notifications\n- Changeable login server address in Settings\n\n## Improvements\n\n- Discord Rich Presence reconnect and connection status\n- Faster startup, darker popup backgrounds, all English\n",
    published_at: new Date().toISOString(),
  },
  {
    tag_name: "v1.2.3",
    name: "K3d Tweaks v1.2.3",
    body: "## What's New\n\n- Auth server address can now be changed in Settings\n",
    published_at: new Date().toISOString(),
  },
  {
    tag_name: "v1.2.2",
    name: "K3d Tweaks v1.2.2",
    body: "## What's New\n\n- Log out button in the profile card\n- Request Game section in Settings with Discord notifications\n- Discord Rich Presence connection status and automatic reconnect\n\n## Improvements\n\n- Faster app startup\n",
    published_at: new Date().toISOString(),
  },
  {
    tag_name: "v1.2.1",
    name: "K3d Tweaks v1.2.1",
    body: "## What's New\n\n- Request Game section in Settings with Discord notifications\n- Discord Rich Presence connection status and automatic reconnect\n\n## Improvements\n\n- Faster app startup\n",
    published_at: new Date().toISOString(),
  },
  {
    tag_name: "v1.2.0",
    name: "K3d Tweaks v1.2.0",
    body: "## What's New\n\n- Full rebrand to K3d Tweaks with a new logo\n- New BIOS tab with hardware detection (XMP, Resizable BAR, PBO, MCE, UEFI, C-States, virtualization)\n- Games folder with per-game optimizations (CS2 mega FPS boost, FiveM)\n- New Discord, Medal and OBS optimization tweaks\n- HWID license plans (Free and Pro) with Pro-only Games and BIOS tabs\n- Real NVIDIA, AMD and Intel driver optimization scripts\n\n## Improvements\n\n- Faster Home loading and a 15-second update check timeout\n- Restore points can no longer be created twice\n- Darker background behind popups for readability\n- Smaller download size and everything in English\n",
    published_at: new Date().toISOString(),
  },
  {
    tag_name: "v1.1.0",
    name: "K3d Tweaks v1.1.0",
    body: "## What's New\n\n- Login screen now uses your custom background.png\n- Login screen is clean: no search bar and no sidebar\n- Account page shows your real hardware UUID (HWID)\n- New minimize, maximize and close icons in the title bar\n- Full rebrand to K3d Tweaks\n\n## Improvements\n\n- Title bar only appears after sign-in\n- Removed leftover purple glow from the login screen\n",
    published_at: new Date().toISOString(),
  },
]

export default function ChangelogModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [releases, setReleases] = useState<Release[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    if (releases.length > 0) return

    setLoading(true)
    setReleases(LOCAL_CHANGELOG)
    setLoading(false)
  }, [open, releases.length])

  return (
    <Modal open={open} onClose={onClose}>
      <div className="bg-k3d-card border border-k3d-border rounded-2xl shadow-2xl max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-k3d-border shrink-0">
          <h2 className="text-xl font-semibold text-k3d-text">What's New</h2>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {loading && <p className="text-k3d-text-secondary">Loading changelog...</p>}
          {!loading &&
            releases.map((release) => (
              <div
                key={release.tag_name}
                className="border-b border-k3d-border pb-4 last:border-b-0 last:pb-0"
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-2xl font-semibold text-k3d-text">
                    {release.name || release.tag_name}
                  </h3>
                  <span className="text-sm text-k3d-text-secondary">
                    {new Date(release.published_at).toLocaleDateString()}
                  </span>
                </div>
                <ChangelogContent body={release.body} />
              </div>
            ))}
        </div>
      </div>
    </Modal>
  )
}
