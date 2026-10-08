import { useEffect, useState } from "react"
import Modal from "@/components/ui/modal"
import Button from "@/components/ui/button"
import { toast } from "react-toastify"
import { invoke } from "@/lib/electron"

export default function FirstTime(): React.ReactElement {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const firstTime = localStorage.getItem("firstTime")
    if (!firstTime || firstTime === "true") {
      const timer = setTimeout(() => setOpen(true), 20)
      return () => clearTimeout(timer)
    }
    return undefined
  }, [])

  const handleGetStarted = async () => {
    localStorage.setItem("firstTime", "false")
    setOpen(false)

    const toastId = toast.info("Creating restore point... Please wait before applying tweaks.", {
      autoClose: false,
      isLoading: true,
      closeOnClick: false,
      draggable: false,
    })

    try {
      await invoke({ channel: "create-inspire-restore-point" })

      toast.update(toastId, {
        render: "Restore point created successfully. You can now apply tweaks.",
        type: "success",
        isLoading: false,
        autoClose: 4000,
      })
    } catch (err) {
      toast.update(toastId, {
        render: "Failed to create restore point. Please try again or restart the application.",
        type: "error",
        isLoading: false,
        autoClose: 4000,
      })
      console.error("Error creating restore point:", err)
    }
  }

  const handleSkipRestorePoint = () => {
    localStorage.setItem("firstTime", "false")
    setOpen(false)
    toast.info("Restore point skipped. Consider creating one before applying tweaks.")
  }

  return (
    <Modal open={open} onClose={undefined}>
      <div className="bg-inspire-card border border-inspire-border rounded-2xl p-4 shadow-2xl max-w-2xl w-full mx-4 flex flex-col items-center text-center">
        <h1 className="text-3xl font-bold text-inspire-text mb-4">Welcome to Inspire</h1>

        <p className="text-inspire-text-secondary mb-6">
          It looks like this is your first time here. <br />
          Would you like to create a restore point before you start?
        </p>

        <p className="text-inspire-text-secondary mb-4 text-sm">
          <span className="font-medium">
            By clicking <strong>Yes</strong>, Inspire will create a system restore point and disable the
            cooldown for future restore points.
          </span>
        </p>

        <p className="text-inspire-text-secondary mb-8 text-sm">
          A restore point protects your system in case any tweak causes issues.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 w-full justify-center">
          <Button onClick={handleGetStarted}>Yes (Recommended)</Button>
          <Button onClick={handleSkipRestorePoint} variant="danger">
            No (Not Recommended)
          </Button>
        </div>
      </div>
    </Modal>
  )
}
