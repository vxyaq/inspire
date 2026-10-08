import { cn } from "@/lib/utils"

function Card({ children, className, ...props }) {
  return (
    <div
      className={cn(
        "bg-inspire-card border border-inspire-border rounded-xl shadow-[0_1px_2px_rgba(0,0,0,0.2)] transition-colors duration-150 group",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export default Card
