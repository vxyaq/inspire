import clsx from "clsx"

type ButtonSize = "sm" | "md" | "lg"
type ButtonVariant = "primary" | "outline" | "secondary" | "danger" | ""

const sizes: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2 text-base",
  lg: "px-5 py-3 text-lg",
}

interface ButtonProps {
  children: React.ReactNode
  variant?: ButtonVariant
  size?: ButtonSize
  className?: string
  disabled?: boolean
  as?: React.ElementType
  [key: string]: any
}

const Button: React.FC<ButtonProps> = ({
  children,
  variant = "primary",
  size = "sm",
  className = "",
  disabled = false,
  as = "button",
  ...props
}) => {
  const base =
    "flex items-center rounded-lg font-medium transition-all duration-200 select-none active:scale-[0.97]"

  const variants: Record<ButtonVariant, string> = {
    primary:
      "bg-inspire-primary text-white border border-inspire-primary hover:brightness-110 shadow-[0_4px_14px_-8px_var(--color-inspire-primary)]",
    outline:
      "border border-inspire-primary/60 text-inspire-primary hover:bg-inspire-primary hover:text-white hover:border-inspire-primary",
    secondary:
      "bg-inspire-card border border-inspire-border-secondary text-inspire-text hover:bg-inspire-accent hover:border-inspire-border",
    danger:
      "bg-red-600 text-white border border-red-700 hover:bg-red-700 hover:border-red-800 focus:ring-red-500",
    "": "",
  }

  const disabledClasses = "opacity-50 cursor-not-allowed pointer-events-none"

  return (
    <button
      className={clsx(
        base,
        sizes[size as ButtonSize],
        variants[variant as ButtonVariant],
        disabled ? disabledClasses : "",
        className,
      )}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  )
}

export default Button
