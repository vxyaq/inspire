import { cn } from "@/lib/utils"

interface TableProps {
  children: React.ReactNode
  className?: string
}

function Table({ children, className }: TableProps) {
  return (
    <div className={cn("w-full overflow-auto rounded-xl border border-inspire-border", className)}>
      <table className="w-full caption-bottom text-sm">{children}</table>
    </div>
  )
}

interface TableHeaderProps {
  children: React.ReactNode
  className?: string
}

function TableHeader({ children, className }: TableHeaderProps) {
  return <thead className={cn("[&_tr]:border-b border-inspire-border", className)}>{children}</thead>
}

interface TableBodyProps {
  children: React.ReactNode
  className?: string
}

function TableBody({ children, className }: TableBodyProps) {
  return <tbody className={cn("[&_tr:last-child]:border-0", className)}>{children}</tbody>
}

interface TableRowProps {
  children: React.ReactNode
  className?: string
}

function TableRow({ children, className }: TableRowProps) {
  return (
    <tr
      className={cn(
        "border-b border-inspire-border transition-colors hover:bg-inspire-accent/50",
        className,
      )}
    >
      {children}
    </tr>
  )
}

interface TableHeadProps {
  children?: React.ReactNode
  className?: string
}

function TableHead({ children, className }: TableHeadProps) {
  return (
    <th
      className={cn(
        "h-10 px-4 text-left align-middle font-medium text-inspire-text-secondary text-xs uppercase tracking-wider",
        className,
      )}
    >
      {children}
    </th>
  )
}

interface TableCellProps {
  children?: React.ReactNode
  className?: string
}

function TableCell({ children, className }: TableCellProps) {
  return (
    <td className={cn("p-4 align-middle text-inspire-text", className)}>
      {children}
    </td>
  )
}

export { Table, TableHeader, TableBody, TableRow, TableHead, TableCell }
export default Table
