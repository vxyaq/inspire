import { useState, useRef, useEffect } from "react"
import { ChevronDown } from "lucide-react"

interface DropdownProps {
  options: string[]
  value: string
  onChange: (value: string) => void
}

export function Dropdown({ options, value, onChange }: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="px-4 py-2 rounded-lg border border-inspire-border bg-inspire-bg text-inspire-text hover:border-inspire-primary transition-all duration-200 flex items-center gap-2 min-w-[180px] justify-between shadow-sm hover:shadow"
      >
        <span>{value}</span>
        <ChevronDown
          className={`w-4 h-4 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`}
        />
      </button>
      <div
        className={`absolute top-full mt-1 w-full bg-inspire-bg border border-inspire-border rounded-lg shadow-lg z-10 overflow-hidden transition-all duration-200 origin-top ${
          isOpen ? "opacity-100 scale-y-100" : "opacity-0 scale-y-0 pointer-events-none"
        }`}
      >
        {options.map((option, index) => (
          <button
            key={option}
            onClick={() => {
              onChange(option)
              setIsOpen(false)
            }}
            style={{ transitionDelay: isOpen ? `${index * 30}ms` : "0ms" }}
            className={`w-full px-4 py-1.5 text-left transition-all duration-200 relative group ${
              value === option
                ? "bg-inspire-primary text-white font-medium"
                : "text-inspire-text hover:bg-inspire-border"
            }`}
          >
            <span className="relative z-10 text-sm">{option}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
