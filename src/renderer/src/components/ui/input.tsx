import { useState } from "react"
import { cn } from "@/lib/utils"
import { LucideIcon, X } from "lucide-react"

interface InputProps {
  type?: string
  defaultValue?: string
  value?: string
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
  className?: string
  placeholder?: string
  Icon?: LucideIcon
  disabled?: boolean
}

function Input({
  type = "text",
  defaultValue,
  onChange,
  className,
  placeholder,
  disabled,
  ...props
}: InputProps): React.ReactElement {
  return (
    <input
      type={type}
      defaultValue={defaultValue}
      onChange={onChange}
      className={cn(
        "w-full bg-inspire-card border border-inspire-border rounded-lg px-3 py-2 text-inspire-text",
        "focus:ring-0 focus:outline-hidden focus:border-inspire-primary transition-colors",
        "placeholder:text-inspire-text-secondary disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      placeholder={placeholder}
      disabled={disabled}
      {...props}
    />
  )
}

interface LargeInputProps {
  placeholder?: string
  value?: string
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
  onClear?: () => void
  icon?: LucideIcon
  className?: string
}

function LargeInput({
  placeholder,
  value,
  onChange,
  onClear,
  icon: Icon,
  className,
  ...props
}: LargeInputProps): React.ReactElement {
  const [focused, setFocused] = useState(false)
  const showClear = Boolean(onClear) && typeof value === "string" && value.length > 0

  return (
    <div
      className={cn(
        "flex items-center gap-3 bg-inspire-card border rounded-lg px-4 backdrop-blur-xs transition-all duration-200",
        focused
          ? "border-inspire-primary shadow-[0_0_0_3px_rgba(22,163,74,0.15)]"
          : "border-inspire-border hover:border-inspire-border-secondary",
        className,
      )}
    >
      {Icon && (
        <Icon
          className={cn(
            "w-5 h-5 shrink-0 transition-colors",
            focused ? "text-inspire-primary" : "text-inspire-text-secondary",
          )}
        />
      )}
      <input
        type="text"
        placeholder={placeholder}
        className="w-full py-3 px-0 bg-transparent border-none focus:outline-hidden focus:ring-0 text-inspire-text placeholder:text-inspire-text-secondary"
        value={value}
        onChange={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        {...props}
      />
      {showClear && (
        <button
          type="button"
          title="Clear search"
          aria-label="Clear search"
          onClick={onClear}
          className="p-1.5 shrink-0 rounded-lg text-inspire-text-secondary hover:bg-inspire-accent hover:text-inspire-text transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}

export { Input, LargeInput }
