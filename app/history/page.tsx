"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Download,
  Eye,
  FileText,
  Search,
  SlidersHorizontal,
  Trash2,
} from "lucide-react"
import { format } from "date-fns"

interface FileAnalysis {
  fileName: string;
  fileSize: string;
  fileType: string;
  uploadTime: string;
  scanProgress: number;
  status: "uploading" | "scanning" | "complete" | "error";
  threats: number;
  engines: {
    name: string;
    result: "clean" | "threat" | "suspicious";
    details?: string;
  }[];
  metadata: any;
  behaviorAnalysis?: any;
  error?: string;
}

export default function HistoryPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [history, setHistory] = useState<FileAnalysis[]>([])
  const [filteredHistory, setFilteredHistory] = useState<FileAnalysis[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [sortBy, setSortBy] = useState("date")
  const [sortOrder, setSortOrder] = useState("desc")
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  useEffect(() => {
    if (status === "authenticated" && session?.user?.email) {
      const key = `probium_history_${session.user.email}`
      const savedHistory = JSON.parse(localStorage.getItem(key) || "[]")
      setHistory(savedHistory)
      setFilteredHistory(savedHistory)
    } else if (status === "unauthenticated") {
      // Redirect to home if not logged in
      router.push("/")
    }
  }, [session, status, router])

  // Apply filters and sorting
  useEffect(() => {
    let result = [...history]

    // Apply search filter
    if (searchTerm) {
      result = result.filter(
        (item) =>
          item.fileName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.fileType.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Apply status filter
    if (statusFilter !== "all") {
      result = result.filter((item) => {
        if (statusFilter === "clean") return item.threats === 0 && item.status === "complete"
        if (statusFilter === "threats") return item.threats > 0
        if (statusFilter === "error") return item.status === "error"
        return true
      })
    }

    // Apply sorting
    result.sort((a, b) => {
      if (sortBy === "date") {
        return new Date(a.uploadTime).getTime() - new Date(b.uploadTime).getTime()
      }
      if (sortBy === "name") {
        return a.fileName.localeCompare(b.fileName)
      }
      if (sortBy === "type") {
        return a.fileType.localeCompare(b.fileType)
      }
      if (sortBy === "status") {
        if (a.threats > 0 && b.threats === 0) return -1
        if (a.threats === 0 && b.threats > 0) return 1
        return 0
      }
      return 0
    })

    if (sortOrder === "desc") {
      result.reverse()
    }

    setFilteredHistory(result)
    setCurrentPage(1) // Reset to first page when filters change
  }, [history, searchTerm, statusFilter, sortBy, sortOrder])

  // Calculate pagination
  const totalPages = Math.ceil(filteredHistory.length / itemsPerPage)
  const currentItems = filteredHistory.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  // Handle clear history
  const handleClearHistory = () => {
    if (window.confirm("Are you sure you want to clear your scan history? This cannot be undone.")) {
      if (session?.user?.email) {
        const key = `probium_history_${session.user.email}`
        localStorage.removeItem(key)
        setHistory([])
        setFilteredHistory([])
      }
    }
  }

  // Handle view details
  const handleViewDetails = (scan: FileAnalysis) => {
    // Store the selected scan in session storage
    sessionStorage.setItem("selectedScan", JSON.stringify(scan))
    router.push("/")
  }

  const getStatusBadge = (scan: FileAnalysis) => {
    if (scan.status === "error") {
      return <Badge variant="destructive">Error</Badge>
    }
    if (scan.status !== "complete") {
      return <Badge variant="secondary">Processing</Badge>
    }
    if (scan.threats > 0) {
      return <Badge variant="destructive">Threats: {scan.threats}</Badge>
    }
    return <Badge variant="default">Clean</Badge>
  }

  const getStatusIcon = (scan: FileAnalysis) => {
    if (scan.status === "error") {
      return <AlertTriangle className="h-5 w-5 text-red-500" />
    }
    if (scan.status !== "complete") {
      return <Clock className="h-5 w-5 text-yellow-500" />
    }
    if (scan.threats > 0) {
      return <AlertTriangle className="h-5 w-5 text-red-500" />
    }
    return <CheckCircle className="h-5 w-5 text-green-500" />
  }

  // Format date for display
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString)
      return format(date, "MMM d, yyyy h:mm a")
    } catch (e) {
      return dateString
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl font-bold">Scan History</CardTitle>
              <CardDescription className="text-base mt-2">
                View and manage your file scan history
              </CardDescription>
            </div>
            {history.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearHistory}
                className="text-red-500 border-red-200 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Clear History
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search by filename or type..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Scans</SelectItem>
                  <SelectItem value="clean">Clean Files</SelectItem>
                  <SelectItem value="threats">Threats Detected</SelectItem>
                  <SelectItem value="error">Errors</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date">Date</SelectItem>
                  <SelectItem value="name">Filename</SelectItem>
                  <SelectItem value="type">File Type</SelectItem>
                  <SelectItem value="status">Status</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                title={sortOrder === "asc" ? "Sort Descending" : "Sort Ascending"}
              >
                {sortOrder === "asc" ? "↑" : "↓"}
              </Button>
            </div>
          </div>

          {/* History Table */}
          {history.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground opacity-30 mb-4" />
              <h3 className="text-lg font-medium mb-2">No scan history</h3>
              <p className="text-muted-foreground">
                Your scan history will appear here once you scan files.
              </p>
              <Button className="mt-4" onClick={() => router.push("/")}>
                Scan a File
              </Button>
            </div>
          ) : filteredHistory.length === 0 ? (
            <div className="text-center py-12">
              <Search className="mx-auto h-12 w-12 text-muted-foreground opacity-30 mb-4" />
              <h3 className="text-lg font-medium mb-2">No matching results</h3>
              <p className="text-muted-foreground">
                Try adjusting your search filters to find what you're looking for.
              </p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => {
                  setSearchTerm("")
                  setStatusFilter("all")
                }}
              >
                Clear Filters
              </Button>
            </div>
          ) : (
            <>
              <div className="rounded-md border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">Status</TableHead>
                      <TableHead>File Name</TableHead>
                      <TableHead className="hidden md:table-cell">Type</TableHead>
                      <TableHead className="hidden md:table-cell">Size</TableHead>
                      <TableHead>Scan Date</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentItems.map((scan, index) => (
                      <TableRow key={index}>
                        <TableCell>{getStatusIcon(scan)}</TableCell>
                        <TableCell className="font-medium">
                          <div className="flex flex-col">
                            <span className="truncate max-w-[200px]" title={scan.fileName}>
                              {scan.fileName}
                            </span>
                            <span className="md:hidden text-xs text-muted-foreground">
                              {scan.fileType} • {scan.fileSize}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">{scan.fileType}</TableCell>
                        <TableCell className="hidden md:table-cell">{scan.fileSize}</TableCell>
                        <TableCell>{formatDate(scan.uploadTime)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewDetails(scan)}
                              title="View Details"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-6">
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                          className={currentPage === 1 ? "pointer-events-none opacity-50" : ""}
                        />
                      </PaginationItem>
                      {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
                        let pageNum = i + 1
                        if (totalPages > 5) {
                          if (currentPage > 3 && currentPage < totalPages - 1) {
                            pageNum = currentPage - 2 + i
                          } else if (currentPage >= totalPages - 1) {
                            pageNum = totalPages - 4 + i
                          }
                        }
                        return (
                          <PaginationItem key={i}>
                            <PaginationLink
                              isActive={currentPage === pageNum}
                              onClick={() => setCurrentPage(pageNum)}
                            >
                              {pageNum}
                            </PaginationLink>
                          </PaginationItem>
                        )
                      })}
                      {totalPages > 5 && currentPage < totalPages - 2 && (
                        <PaginationItem>
                          <PaginationEllipsis />
                        </PaginationItem>
                      )}
                      {totalPages > 5 && currentPage < totalPages - 1 && (
                        <PaginationItem>
                          <PaginationLink onClick={() => setCurrentPage(totalPages)}>
                            {totalPages}
                          </PaginationLink>
                        </PaginationItem>
                      )}
                      <PaginationItem>
                        <PaginationNext
                          onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                          className={currentPage === totalPages ? "pointer-events-none opacity-50" : ""}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
} 