import { cn } from "@/lib/utils"
import Card from "./ui/Card"
import { LucideIcon } from "lucide-react"

interface InfoCardItem {
  label: string
  value: string
}

interface InfoCardProps {
  icon: LucideIcon
  iconBgColor?: string
  iconColor?: string
  title: string
  subtitle?: string
  items?: InfoCardItem[]
  className?: string
  [key: string]: any
}

const InfoCard = ({
  icon: Icon,
  iconBgColor = "bg-k3d-accent",
  iconColor = "text-k3d-primary",
  title,
  subtitle,
  items = [],
  className,
  ...props
}: InfoCardProps): React.ReactElement => {
  return (
    <Card
      className={cn(
        "bg-k3d-card backdrop-blur-xs rounded-xl border border-k3d-border hover:shadow-xs overflow-hidden p-5",
        className,
      )}
      {...props}
    >
      <div className="flex items-center gap-3 mb-4">
        <div className={cn("p-2.5 rounded-lg ring-1 ring-inset ring-k3d-border", iconBgColor)}>
          <Icon className={cn("text-lg", iconColor)} size={22} />
        </div>
        <div>
          <h2 className="text-base font-semibold text-k3d-text mb-0.5">{title}</h2>
          {subtitle && (
            <p className="text-k3d-text-secondary text-xs tracking-wide">{subtitle}</p>
          )}
        </div>
      </div>
      <div className="space-y-3">
        {items.map((item, index) => (
          <div
            key={index}
            className="flex items-baseline justify-between gap-3 border-b border-k3d-border/60 last:border-0 pb-2 last:pb-0"
          >
            <p className="text-k3d-text-secondary text-xs uppercase tracking-[0.08em]">
              {item.label}
            </p>
            <p className="text-k3d-text font-medium text-right">{item.value}</p>
          </div>
        ))}
      </div>
    </Card>
  )
}

export default InfoCard
