import Modal from "./ui/modal"
import Button from "./ui/button"

function NoAdmin({
  open,
  onClose,
  platform,
}: {
  open: boolean
  onClose: () => void
  platform?: string | null
}) {
  const isWindows = !platform || platform === "win32"

  return (
    <Modal open={open} onClose={onClose}>
      <div className="bg-k3d-card p-4 rounded-2xl border border-k3d-border text-k3d-text w-[90vw] max-w-md">
        <h1 className="text-lg font-semibold mb-2">
          {isWindows ? "K3d Tweaks Not Running as Admin" : "K3d Tweaks Not Running as Root"}
        </h1>
        <p className="text-sm mb-4">
          {isWindows
            ? "K3d Tweaks is not running with administrator privileges. Some features may not work correctly."
            : "K3d Tweaks is not running as root. System-level changes will fail until it is started with elevated privileges."}
        </p>
        <div className="flex justify-end">
          <Button onClick={onClose}>Close</Button>
        </div>
      </div>
    </Modal>
  )
}

export default NoAdmin
