import { useEffect, useState } from "react"
import {
  RotateCw,
  PlusCircle,
  Shield,
  RotateCcw,
  Loader2,
  Trash,
} from "lucide-react"
import { invoke } from "@/lib/electron"
import Button from "@/components/ui/button"
import Modal from "@/components/ui/modal"
import { toast } from "react-toastify"
import log from "electron-log/renderer"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table"

type RestorePoint = {
  SequenceNumber: number
  Description: string
  CreationTime: string
  EventType: number
  RestorePointType: number
}

type RestorePointList = RestorePoint[]

export default function RestorePoints() {
  const [activeTab, setActiveTab] = useState<"restore" | "tweaks">("restore")
  const [restorePoints, setRestorePoints] = useState<RestorePointList>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)

  const [modalState, setModalState] = useState<{
    isOpen: boolean
    type: string | null
    restorePoint: any | null
  }>({
    isOpen: false,
    type: null,
    restorePoint: null,
  })
  const [customModalOpen, setCustomModalOpen] = useState(false)
  const [customName, setCustomName] = useState("")
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false)

  const fetchRestorePoints = async () => {
    setLoading(true)
    try {
      const response = await invoke({ channel: "get-restore-points" })
      if (response.success && Array.isArray(response.points)) {
        setRestorePoints(response.points)
      } else {
        toast.error("Failed to load restore points")
      }
    } catch (error) {
      toast.error("Failed to load restore points")
      log.error("Failed to load restore points:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRestorePoints()
  }, [])

  const handleCreateRestorePoint = async () => {
    setProcessing(true)
    try {
      await invoke({ channel: "create-inspire-restore-point" })
      toast.success("Restore point created")
      await fetchRestorePoints()
    } catch (err) {
      toast.error("Failed to create restore point")
      log.error("Failed to create restore point:", err)
    }
    setProcessing(false)
  }

  const handleRestore = (restorePoint: any) => {
    setModalState({ isOpen: true, type: "restore", restorePoint })
  }

  const executeRestore = async () => {
    setProcessing(true)
    try {
      await invoke({
        channel: "restore-restore-point",
        payload: modalState.restorePoint.SequenceNumber,
      })
      toast.success("System restore started. Your PC may restart.")
    } catch (err) {
      toast.error("Failed to start system restore")
      log.error("Failed to start system restore:", err)
    }
    setProcessing(false)
    setModalState({ isOpen: false, type: null, restorePoint: null })
  }

  const handleCustomRestorePoint = async () => {
    if (!customName.trim()) {
      toast.error("Enter a name for the restore point")
      return
    }
    setProcessing(true)
    try {
      await invoke({ channel: "create-restore-point", payload: customName })
      toast.success("Restore point created")
      setCustomModalOpen(false)
      setCustomName("")
      await fetchRestorePoints()
    } catch (err) {
      toast.error("Failed to create restore point")
      log.error("Failed to create restore point:", err)
    }
    setProcessing(false)
  }

  const handleDeleteAll = async () => {
    setProcessing(true)
    try {
      await invoke({ channel: "delete-all-restore-points" })
      toast.success("All restore points deleted")
      await fetchRestorePoints()
    } catch (err) {
      toast.error("Failed to delete restore points")
      log.error("Failed to delete restore points:", err)
    }
    setProcessing(false)
    setConfirmDeleteAll(false)
  }

  const filteredRestorePoints = restorePoints

  return (
    <div className="h-full max-w-full space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => setActiveTab("restore")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all active:scale-95 ${
            activeTab === "restore"
              ? "bg-inspire-primary text-white shadow"
              : "text-inspire-text-secondary hover:text-inspire-text bg-inspire-card/50"
          }`}
        >
          <Shield size={16} className="inline mr-2" />
          Restore Points
        </button>
        <button
          onClick={() => setActiveTab("tweaks")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all active:scale-95 ${
            activeTab === "tweaks"
              ? "bg-inspire-primary text-white shadow"
              : "text-inspire-text-secondary hover:text-inspire-text bg-inspire-card/50"
          }`}
        >
          <RotateCw size={16} className="inline mr-2" />
          Revert Tweaks
        </button>
      </div>

      {activeTab === "restore" && (
        <div key="restore" className="space-y-4 transition-opacity duration-200">
          <div className="flex flex-wrap items-center justify-end gap-3">
            <Button
              variant="danger"
              onClick={() => setConfirmDeleteAll(true)}
              disabled={loading || processing || restorePoints.length === 0}
              className="flex items-center gap-2"
            >
              <Trash size={16} /> Delete All
            </Button>
            <Button
              variant="secondary"
              onClick={fetchRestorePoints}
              className="flex items-center gap-2"
              disabled={loading || processing}
            >
              <RotateCw size={16} /> Refresh
            </Button>
            <Button
              variant="primary"
              onClick={handleCreateRestorePoint}
              className="flex items-center gap-2"
              disabled={loading || processing}
            >
              {processing ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <PlusCircle size={16} />
              )}
              Quick Restore Point
            </Button>
            <Button
              variant="primary"
              onClick={() => setCustomModalOpen(true)}
              disabled={loading || processing}
            >
              Custom Restore Point
            </Button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-96">
              <Loader2 size={32} className="text-inspire-primary animate-spin" />
            </div>
          ) : filteredRestorePoints.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center bg-inspire-card border border-inspire-border rounded-lg">
              <div className="p-4 bg-inspire-secondary rounded-full mb-4">
                <Shield size={28} className="text-inspire-text" />
              </div>
              <h3 className="text-lg font-medium mb-2 text-inspire-text">No Restore Points</h3>
              <p className="text-inspire-text-secondary max-w-sm mb-4">
                Create a restore point to preserve your system state. You can restore your system to any point when needed.
              </p>
              <Button
                variant="primary"
                onClick={handleCreateRestorePoint}
                disabled={processing}
              >
                Create a Quick Restore Point
              </Button>
            </div>
          ) : (
            <Table className="max-h-96">
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead className="w-32 text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRestorePoints.map((rp, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{rp.Description}</TableCell>
                    <TableCell className="text-center">
                      <Button
                        variant="outline"
                        className="!p-2 gap-2"
                        onClick={() => handleRestore(rp)}
                        disabled={processing}
                        title="Restore System"
                      >
                        <RotateCcw size={16} />
                        Restore
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          <Modal
            open={modalState.isOpen}
            onClose={() => setModalState({ isOpen: false, type: null, restorePoint: null })}
          >
            {modalState.type === "restore" && modalState.restorePoint && (
              <div className="bg-inspire-card border border-inspire-border rounded-2xl p-4 shadow-xl max-w-lg w-full mx-4">
                <h3 className="text-lg font-medium text-inspire-text mb-4">Restore System</h3>
                <p className="text-inspire-text-secondary mb-4">
                  Restore your system to "{modalState.restorePoint.Description}"?
                  <br /><br />
                  Your files will not be affected, but recently installed applications and settings
                  may be lost. This will revert all changes made since this restore point was created.
                </p>
                <div className="flex justify-end gap-3">
                  <Button
                    variant="secondary"
                    onClick={() => setModalState({ isOpen: false, type: null, restorePoint: null })}
                    disabled={processing}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    onClick={executeRestore}
                    disabled={processing}
                  >
                    {processing ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      "Restore"
                    )}
                  </Button>
                </div>
              </div>
            )}
          </Modal>

          <Modal open={customModalOpen} onClose={() => setCustomModalOpen(false)}>
            <div className="bg-inspire-card border border-inspire-border rounded-2xl p-4 shadow-xl max-w-lg w-full mx-4">
              <h3 className="text-lg font-medium text-inspire-text mb-4">Create Custom Restore Point</h3>
              <Input
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="Enter restore point name"
                disabled={processing}
                className="w-full"
              />
              <div className="flex justify-end gap-3 mt-4">
                <Button
                  variant="secondary"
                  onClick={() => setCustomModalOpen(false)}
                  disabled={processing}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={handleCustomRestorePoint}
                  disabled={processing || !customName.trim()}
                >
                  {processing ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    "Create"
                  )}
                </Button>
              </div>
            </div>
          </Modal>

          <Modal open={confirmDeleteAll} onClose={() => !processing && setConfirmDeleteAll(false)}>
            <div className="bg-inspire-card border border-inspire-border rounded-2xl p-4 shadow-xl max-w-lg w-full mx-4">
              <h3 className="text-lg font-medium text-inspire-text mb-4">Delete All Restore Points</h3>
              <p className="text-inspire-text-secondary mb-4">
                Delete all {restorePoints.length} restore point
                {restorePoints.length !== 1 ? "s" : ""}? This cannot be undone.
              </p>
              <div className="flex justify-end gap-3">
                <Button
                  variant="secondary"
                  onClick={() => setConfirmDeleteAll(false)}
                  disabled={processing}
                >
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  onClick={handleDeleteAll}
                  disabled={processing}
                >
                  {processing ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    `Delete All (${restorePoints.length})`
                  )}
                </Button>
              </div>
            </div>
          </Modal>
        </div>
      )}

      {activeTab === "tweaks" && (
        <div key="tweaks" className="transition-opacity duration-200">
          <div className="bg-inspire-card border border-inspire-border rounded-lg p-6 text-center">
            <RotateCw size={32} className="text-inspire-text-secondary mx-auto mb-3 animate-spin" />
            <h3 className="text-lg font-medium text-inspire-text mb-2">Revert Applied Tweaks</h3>
            <p className="text-inspire-text-secondary">
              This section is under construction
            </p>
          </div>
        </div>
      )}
    </div>
  )
}