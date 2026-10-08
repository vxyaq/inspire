import { useEffect, useState, type ComponentProps } from "react"
import Modal from "@/components/ui/modal"
import Button from "@/components/ui/button"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import rehypeRaw from "rehype-raw"

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
    <div className="prose prose-sm prose-green marker:text-inspire-secondary max-w-none text-inspire-text prose-headings:text-inspire-text prose-code:bg-inspire-border prose-code:text-inspire-text prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:text-sm prose-code:font-normal prose-code:before:content-none prose-code:after:content-none prose-pre:bg-inspire-card prose-pre:border prose-pre:border-inspire-border prose-img:rounded-lg prose-img:border prose-img:border-inspire-border">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
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
              className="max-w-full h-auto rounded-lg border border-inspire-border"
              loading="lazy"
            />
          ),
          code: ({ inline, className, children, ...props }: CodeProps) => {
            if (inline) {
              return (
                <code
                  className="bg-inspire-primary px-1.5 py-0.5 rounded-md text-sm font-normal"
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
    tag_name: "v1.1.0",
    name: "Inspire v1.1.0",
    body: "## What's New\n\n- Login screen now uses your custom background.png\n- Login screen is clean: no search bar and no sidebar\n- Account page shows your real hardware UUID (HWID)\n- New minimize, maximize and close icons in the title bar\n- Full rebrand to Inspire\n\n## Improvements\n\n- Title bar only appears after sign-in\n- Removed leftover purple glow from the login screen\n",
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
      <div className="bg-inspire-card border border-inspire-border rounded-2xl shadow-2xl max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-inspire-border shrink-0">
          <h2 className="text-xl font-semibold text-inspire-text">What's New</h2>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {loading && <p className="text-inspire-text-secondary">Loading changelog...</p>}
          {!loading &&
            releases.map((release) => (
              <div
                key={release.tag_name}
                className="border-b border-inspire-border pb-4 last:border-b-0 last:pb-0"
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-2xl font-semibold text-inspire-text">
                    {release.name || release.tag_name}
                  </h3>
                  <span className="text-sm text-inspire-text-secondary">
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
