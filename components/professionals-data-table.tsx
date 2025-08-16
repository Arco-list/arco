"use client"

import * as React from "react"
import {
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconChevronsLeft,
  IconChevronsRight,
  IconCircleCheckFilled,
  IconDotsVertical,
  IconLayoutColumns,
  IconPlus,
  IconClock,
  IconStar,
} from "@tabler/icons-react"
import {
  type ColumnDef,
  type ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
  type VisibilityState,
} from "@tanstack/react-table"
import { toast } from "sonner"
import { z } from "zod"
import { csvData } from "@/lib/csv-data"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

export const professionalSchema = z.object({
  id: z.number(),
  name: z.string(),
  profilePicture: z.string(),
  categories: z.array(z.string()),
  projectCount: z.number(),
  rating: z.number(),
  location: z.string(),
  status: z.string(),
})

const columns: ColumnDef<z.infer<typeof professionalSchema>>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <div className="flex items-center justify-center">
        <Checkbox
          checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      </div>
    ),
    cell: ({ row }) => (
      <div className="flex items-center justify-center">
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      </div>
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "name",
    header: "Professional",
    cell: ({ row }) => (
      <div className="flex items-center gap-3">
        <img
          src={row.original.profilePicture || "/placeholder.svg"}
          alt={row.original.name}
          className="h-10 w-10 rounded-full object-cover"
        />
        <div>
          <div className="font-medium">{row.original.name}</div>
          <div className="text-sm text-muted-foreground flex items-center gap-1">
            <IconStar className="h-3 w-3 fill-yellow-400 text-yellow-400" />
            {row.original.rating} • {row.original.location}
          </div>
        </div>
      </div>
    ),
    enableHiding: false,
  },
  {
    accessorKey: "categories",
    header: "Categories",
    cell: ({ row }) => (
      <div className="flex flex-wrap gap-1">
        {row.original.categories.slice(0, 2).map((category, index) => (
          <Badge key={index} variant="outline" className="text-xs px-2 py-0.5">
            {category}
          </Badge>
        ))}
        {row.original.categories.length > 2 && (
          <Badge variant="outline" className="text-xs px-2 py-0.5 text-muted-foreground">
            +{row.original.categories.length - 2}
          </Badge>
        )}
      </div>
    ),
  },
  {
    accessorKey: "projectCount",
    header: "Projects",
    cell: ({ row }) => <div className="text-center font-medium">{row.original.projectCount}</div>,
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = row.original.status
      return (
        <Badge
          variant="outline"
          className={`px-1.5 ${
            status === "Active"
              ? "text-green-600 border-green-200"
              : status === "Pending"
                ? "text-yellow-600 border-yellow-200"
                : "text-red-600 border-red-200"
          }`}
        >
          {status === "Active" && <IconCircleCheckFilled className="mr-1 h-3 w-3 fill-green-500" />}
          {status === "Pending" && <IconClock className="mr-1 h-3 w-3" />}
          {status}
        </Badge>
      )
    },
  },
  {
    id: "actions",
    cell: ({ row }) => (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="data-[state=open]:bg-muted text-muted-foreground flex size-8" size="icon">
            <IconDotsVertical />
            <span className="sr-only">Open menu</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem>Edit Professional</DropdownMenuItem>
          <DropdownMenuItem>View Profile</DropdownMenuItem>
          <DropdownMenuItem>View Projects</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onClick={() => {
              toast.promise(new Promise((resolve) => setTimeout(resolve, 1000)), {
                loading: `Removing ${row.original.name}...`,
                success: "Professional removed successfully",
                error: "Failed to remove professional",
              })
            }}
          >
            Remove Professional
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  },
]

const sampleData: z.infer<typeof professionalSchema>[] = [
  {
    id: 1,
    name: "Sarah Johnson",
    profilePicture: "/placeholder.svg?height=40&width=40",
    categories: [csvData.professionalCategories[0], csvData.professionalCategories[4]], // Architect, Landscape Architect
    projectCount: 24,
    rating: 4.8,
    location: "Amsterdam",
    status: "Active",
  },
  {
    id: 2,
    name: "Michael Chen",
    profilePicture: "/placeholder.svg?height=40&width=40",
    categories: [csvData.professionalCategories[3], csvData.professionalCategories[5]], // Engineer, Project Manager
    projectCount: 18,
    rating: 4.9,
    location: "Rotterdam",
    status: "Active",
  },
  {
    id: 3,
    name: "Emma Williams",
    profilePicture: "/placeholder.svg?height=40&width=40",
    categories: [csvData.professionalCategories[1], csvData.professionalCategories[6]], // Interior Designer, Consultant
    projectCount: 31,
    rating: 4.7,
    location: "Utrecht",
    status: "Pending",
  },
  {
    id: 4,
    name: "David Rodriguez",
    profilePicture: "/placeholder.svg?height=40&width=40",
    categories: [csvData.professionalCategories[2], csvData.professionalCategories[7]], // Contractor, Specialist
    projectCount: 42,
    rating: 4.6,
    location: "The Hague",
    status: "Active",
  },
  {
    id: 5,
    name: "Lisa Anderson",
    profilePicture: "/placeholder.svg?height=40&width=40",
    categories: [csvData.professionalCategories[8], csvData.professionalCategories[9]], // Surveyor, Planning Consultant
    projectCount: 15,
    rating: 4.5,
    location: "Eindhoven",
    status: "Inactive",
  },
]

export function ProfessionalsDataTable({
  data: initialData = sampleData,
}: {
  data?: z.infer<typeof professionalSchema>[]
}) {
  const [data, setData] = React.useState(() => initialData)
  const [rowSelection, setRowSelection] = React.useState({})
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [pagination, setPagination] = React.useState({
    pageIndex: 0,
    pageSize: 10,
  })

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnVisibility,
      rowSelection,
      columnFilters,
      pagination,
    },
    getRowId: (row) => row.id.toString(),
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  })

  return (
    <div className="w-full flex-col justify-start gap-6">
      <div className="flex items-center justify-between px-4 lg:px-6 mb-4">
        <div className="flex items-center gap-2">
          <Input
            placeholder="Search professionals..."
            value={(table.getColumn("name")?.getFilterValue() as string) ?? ""}
            onChange={(event) => table.getColumn("name")?.setFilterValue(event.target.value)}
            className="max-w-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <IconLayoutColumns />
                <span className="hidden lg:inline">Customize Columns</span>
                <span className="lg:hidden">Columns</span>
                <IconChevronDown />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {table
                .getAllColumns()
                .filter((column) => typeof column.accessorFn !== "undefined" && column.getCanHide())
                .map((column) => {
                  return (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      className="capitalize"
                      checked={column.getIsVisible()}
                      onCheckedChange={(value) => column.toggleVisibility(!!value)}
                    >
                      {column.id}
                    </DropdownMenuCheckboxItem>
                  )
                })}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" size="sm">
            <IconPlus />
            <span className="hidden lg:inline">Add Professional</span>
          </Button>
        </div>
      </div>

      <div className="relative flex flex-col gap-4 overflow-auto px-4 lg:px-6">
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader className="bg-muted sticky top-0 z-10">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    return (
                      <TableHead key={header.id} colSpan={header.colSpan}>
                        {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    )
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 text-center">
                    No professionals found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center justify-between px-4">
          <div className="text-muted-foreground hidden flex-1 text-sm lg:flex">
            {table.getFilteredSelectedRowModel().rows.length} of {table.getFilteredRowModel().rows.length}{" "}
            professional(s) selected.
          </div>
          <div className="flex w-full items-center gap-8 lg:w-fit">
            <div className="hidden items-center gap-2 lg:flex">
              <Label htmlFor="rows-per-page" className="text-sm font-medium">
                Rows per page
              </Label>
              <Select
                value={`${table.getState().pagination.pageSize}`}
                onValueChange={(value) => {
                  table.setPageSize(Number(value))
                }}
              >
                <SelectTrigger size="sm" className="w-20" id="rows-per-page">
                  <SelectValue placeholder={table.getState().pagination.pageSize} />
                </SelectTrigger>
                <SelectContent side="top">
                  {[10, 20, 30, 40, 50].map((pageSize) => (
                    <SelectItem key={pageSize} value={`${pageSize}`}>
                      {pageSize}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex w-fit items-center justify-center text-sm font-medium">
              Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
            </div>
            <div className="ml-auto flex items-center gap-2 lg:ml-0">
              <Button
                variant="outline"
                className="hidden h-8 w-8 p-0 lg:flex bg-transparent"
                onClick={() => table.setPageIndex(0)}
                disabled={!table.getCanPreviousPage()}
              >
                <span className="sr-only">Go to first page</span>
                <IconChevronsLeft />
              </Button>
              <Button
                variant="outline"
                className="size-8 bg-transparent"
                size="icon"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                <span className="sr-only">Go to previous page</span>
                <IconChevronLeft />
              </Button>
              <Button
                variant="outline"
                className="size-8 bg-transparent"
                size="icon"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                <span className="sr-only">Go to next page</span>
                <IconChevronRight />
              </Button>
              <Button
                variant="outline"
                className="hidden size-8 lg:flex bg-transparent"
                size="icon"
                onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                disabled={!table.getCanNextPage()}
              >
                <span className="sr-only">Go to last page</span>
                <IconChevronsRight />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
