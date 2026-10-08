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
      <div className="bg-inspire-card p-4 rounded-2xl border border-inspire-border text-inspire-text w-[90vw] max-w-md">
        <h1 className="text-lg font-semibold mb-2">
          {isWindows ? "Inspire Not Running as Admin" : "Inspire Not Running as Root"}
        </h1>
        <p className="text-sm mb-4">
          {isWindows
            ? "Inspire is not running with administrator privileges. Some features may not work correctly."
            : "Inspire is not running as root. System-level changes will fail until it is started with elevated privileges."}
        </p>
        <div className="flex justify-end">
          <Button onClick={onClose}>Close</Button>
        </div>
      </div>
    </Modal>
  )
}

export default NoAdmin
