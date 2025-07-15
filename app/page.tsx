"use client"

import type React from "react"

import { useState, useCallback, useEffect } from "react"
import {
  Upload,
  Eye,
  AlertTriangle,
  CheckCircle,
  FileText,
  Zap,
  Database,
  Lock,
  User,
  LogOut,
  Settings,
  History,
  Download,
  RefreshCw,
  Globe,
  Activity,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { LoginModal } from "@/components/login-modal"

interface FileAnalysis {
  fileName: string
  fileSize: string
  fileType: string
  uploadTime: string
  scanProgress: number
  status: "uploading" | "scanning" | "complete"
  threats: number
  engines: {
    name: string
    result: "clean" | "threat" | "suspicious"
    details?: string
  }[]
  metadata: {
    md5: string
    sha1: string
    sha256: string
    firstSeen: string
    lastSeen: string
    submissions: number
  }
  behaviorAnalysis: {
    networkActivity: boolean
    fileModification: boolean
    registryChanges: boolean
    processCreation: boolean
  }
}

const mockEngines = [
  { name: "Probium Core", result: "clean" as const },
  { name: "ClamAV", result: "clean" as const },
  { name: "Windows Defender", result: "clean" as const },
  { name: "Kaspersky", result: "threat" as const, details: "Trojan.Win32.Generic" },
  { name: "Bitdefender", result: "clean" as const },
  { name: "Norton", result: "suspicious" as const, details: "Heuristic detection" },
  { name: "McAfee", result: "clean" as const },
  { name: "Avast", result: "clean" as const },
  { name: "ESET", result: "clean" as const },
  { name: "Trend Micro", result: "clean" as const },
]

export default function ProbiumLens() {
  const [analysis, setAnalysis] = useState<FileAnalysis | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isLoginOpen, setIsLoginOpen] = useState(false)
  const [user, setUser] = useState<any>(null)

  const simulateAnalysis = useCallback((file: File) => {
    const newAnalysis: FileAnalysis = {
      fileName: file.name,
      fileSize: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
      fileType: file.type || "Unknown",
      uploadTime: new Date().toLocaleString(),
      scanProgress: 0,
      status: "uploading",
      threats: 0,
      engines: [],
      metadata: {
        md5: "5d41402abc4b2a76b9719d911017c592",
        sha1: "aaf4c61ddcc5e8a2dabede0f3b482cd9aea9434d",
        sha256: "2c26b46b68ffc68ff99b453c1d30413413422d706483bfa0f98a5e886266e7ae",
        firstSeen: "2024-01-15 14:30:22",
        lastSeen: "2024-01-20 09:15:45",
        submissions: 127,
      },
      behaviorAnalysis: {
        networkActivity: Math.random() > 0.7,
        fileModification: Math.random() > 0.8,
        registryChanges: Math.random() > 0.6,
        processCreation: Math.random() > 0.5,
      },
    }

    setAnalysis(newAnalysis)

    // Simulate upload progress
    const uploadInterval = setInterval(() => {
      setAnalysis((prev) => {
        if (!prev || prev.scanProgress >= 100) return prev
        const newProgress = Math.min(prev.scanProgress + Math.random() * 20, 100)

        if (newProgress >= 100) {
          clearInterval(uploadInterval)
          return {
            ...prev,
            scanProgress: 100,
            status: "scanning",
          }
        }

        return {
          ...prev,
          scanProgress: newProgress,
        }
      })
    }, 150)

    // Simulate scanning process
    setTimeout(() => {
      const scanInterval = setInterval(() => {
        setAnalysis((prev) => {
          if (!prev) return prev

          const enginesScanned = prev.engines.length
          if (enginesScanned >= mockEngines.length) {
            clearInterval(scanInterval)
            const threatCount = prev.engines.filter((e) => e.result === "threat").length
            return {
              ...prev,
              status: "complete",
              threats: threatCount,
            }
          }

          const nextEngine = mockEngines[enginesScanned]
          return {
            ...prev,
            engines: [...prev.engines, nextEngine],
          }
        })
      }, 250)
    }, 800)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)

      const files = Array.from(e.dataTransfer.files)
      if (files.length > 0) {
        simulateAnalysis(files[0])
      }
    },
    [simulateAnalysis],
  )

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files
      if (files && files.length > 0) {
        simulateAnalysis(files[0])
      }
    },
    [simulateAnalysis],
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const getThreatColor = (result: string) => {
    switch (result) {
      case "threat":
        return "destructive"
      case "suspicious":
        return "secondary"
      default:
        return "default"
    }
  }

  const getStatusIcon = () => {
    if (!analysis) return <Eye className="w-6 h-6" />

    switch (analysis.status) {
      case "uploading":
        return <Upload className="w-6 h-6 animate-pulse text-blue-500" />
      case "scanning":
        return <Activity className="w-6 h-6 animate-pulse text-orange-500" />
      case "complete":
        return analysis.threats > 0 ? (
          <AlertTriangle className="w-6 h-6 text-red-500" />
        ) : (
          <CheckCircle className="w-6 h-6 text-green-500" />
        )
    }
  }

  const handleLogin = (userData: any) => {
    setUser(userData)
    localStorage.setItem("probiumUser", JSON.stringify(userData))
  }

  const handleLogout = () => {
    setUser(null)
    localStorage.removeItem("probiumUser")
  }

  // Load user from localStorage on initial render
  useEffect(() => {
    const savedUser = localStorage.getItem("probiumUser")
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser))
      } catch (e) {
        console.error("Failed to parse saved user data")
      }
    }
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      {/* Header */}
      <header className="border-b bg-white/90 backdrop-blur-md shadow-sm dark:bg-slate-900/90">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-purple-600">
              <Eye className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Probium Lens
              </h1>
              <p className="text-xs text-muted-foreground">Advanced File Intelligence</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={user.avatar || "/placeholder.svg"} alt={user.name} />
                      <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                        {user.name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-64" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-2">
                      <p className="text-sm font-medium leading-none">{user.name}</p>
                      <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>Member since {user.joinDate}</span>
                        <span>{user.scansCompleted} scans</span>
                      </div>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>
                    <User className="mr-2 h-4 w-4" />
                    <span>Profile</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <History className="mr-2 h-4 w-4" />
                    <span>Scan History</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Settings</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Sign out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button
                variant="default"
                size="sm"
                onClick={() => setIsLoginOpen(true)}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              >
                Sign In
              </Button>
            )}
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-12">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg">
            <Eye className="h-10 w-10 text-white" />
          </div>
          <h2 className="text-4xl font-bold mb-4 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            See Through Any File
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Upload any file and get instant, comprehensive security analysis powered by advanced threat intelligence.
          </p>
        </div>

        {!analysis ? (
          /* Upload Area */
          <Card className="max-w-2xl mx-auto shadow-xl border-0 bg-white/80 backdrop-blur-sm">
            <CardContent className="p-12">
              <div
                className={`border-2 border-dashed rounded-2xl p-16 text-center transition-all duration-300 ${
                  isDragging
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20 scale-105"
                    : "border-muted-foreground/25 hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-950/10"
                }`}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
              >
                <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900/20 dark:to-purple-900/20">
                  <Upload className="w-8 h-8 text-blue-600" />
                </div>
                <h3 className="text-2xl font-semibold mb-3">Drop your file here</h3>
                <p className="text-muted-foreground mb-8 text-lg">Or click to browse • Maximum file size: 100MB</p>
                <input type="file" id="file-upload" className="hidden" onChange={handleFileSelect} accept="*/*" />
                <Button
                  asChild
                  size="lg"
                  className="text-lg px-8 py-6 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                >
                  <label htmlFor="file-upload" className="cursor-pointer">
                    Choose File
                  </label>
                </Button>
              </div>

              <div className="mt-12 grid grid-cols-3 gap-8 text-center">
                <div className="flex flex-col items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-yellow-100 to-orange-100 dark:from-yellow-900/20 dark:to-orange-900/20">
                    <Zap className="w-6 h-6 text-yellow-600" />
                  </div>
                  <span className="font-medium">Lightning Fast</span>
                  <span className="text-sm text-muted-foreground">Results in seconds</span>
                </div>
                <div className="flex flex-col items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-blue-100 to-cyan-100 dark:from-blue-900/20 dark:to-cyan-900/20">
                    <Database className="w-6 h-6 text-blue-600" />
                  </div>
                  <span className="font-medium">10+ Engines</span>
                  <span className="text-sm text-muted-foreground">Comprehensive scanning</span>
                </div>
                <div className="flex flex-col items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-green-100 to-emerald-100 dark:from-green-900/20 dark:to-emerald-900/20">
                    <Lock className="w-6 h-6 text-green-600" />
                  </div>
                  <span className="font-medium">100% Secure</span>
                  <span className="text-sm text-muted-foreground">Files never stored</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          /* Analysis Results */
          <div className="max-w-6xl mx-auto space-y-8">
            {/* Status Card */}
            <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900/20 dark:to-purple-900/20">
                    {getStatusIcon()}
                  </div>
                  <div className="flex-1">
                    <CardTitle className="flex items-center gap-3 text-xl">
                      {analysis.fileName}
                      {analysis.status === "complete" && (
                        <Badge variant={analysis.threats > 0 ? "destructive" : "default"} className="text-sm px-3 py-1">
                          {analysis.threats > 0 ? `${analysis.threats} threats detected` : "✓ Clean"}
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription className="text-base mt-1">
                      {analysis.fileSize} • {analysis.fileType} • Uploaded {analysis.uploadTime}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>

              {analysis.status !== "complete" && (
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between text-base">
                      <span className="font-medium">
                        {analysis.status === "uploading" ? "Uploading file..." : "Analyzing with security engines..."}
                      </span>
                      <span className="text-muted-foreground">
                        {analysis.status === "scanning"
                          ? `${analysis.engines.length}/${mockEngines.length} engines`
                          : `${Math.round(analysis.scanProgress)}%`}
                      </span>
                    </div>
                    <Progress
                      value={
                        analysis.status === "uploading"
                          ? analysis.scanProgress
                          : (analysis.engines.length / mockEngines.length) * 100
                      }
                      className="h-3"
                    />
                  </div>
                </CardContent>
              )}
            </Card>

            {analysis.status === "complete" && (
              <>
                {/* Threat Alert */}
                {analysis.threats > 0 && (
                  <Alert variant="destructive" className="border-red-200 bg-red-50 dark:bg-red-950/20">
                    <AlertTriangle className="h-5 w-5" />
                    <AlertDescription className="text-base">
                      <strong>⚠️ Security Warning:</strong> This file has been flagged by {analysis.threats} security
                      engine{analysis.threats > 1 ? "s" : ""}. Exercise extreme caution when handling this file.
                    </AlertDescription>
                  </Alert>
                )}

                <Tabs defaultValue="detection" className="w-full">
                  <TabsList className="grid w-full grid-cols-4 h-12">
                    <TabsTrigger value="detection" className="text-base">
                      Detection Results
                    </TabsTrigger>
                    <TabsTrigger value="details" className="text-base">
                      File Details
                    </TabsTrigger>
                    <TabsTrigger value="behavior" className="text-base">
                      Behavior Analysis
                    </TabsTrigger>
                    <TabsTrigger value="history" className="text-base">
                      Intelligence
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="detection" className="space-y-6 mt-8">
                    <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-3 text-xl">
                          <Eye className="w-6 h-6 text-blue-600" />
                          Security Engine Results
                        </CardTitle>
                        <CardDescription className="text-base">
                          Scanned by {analysis.engines.length} leading security engines
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="grid gap-4">
                          {analysis.engines.map((engine, index) => (
                            <div
                              key={index}
                              className="flex items-center justify-between p-4 rounded-xl border bg-white/50 dark:bg-slate-800/50"
                            >
                              <div className="flex items-center gap-4">
                                <div
                                  className={`w-4 h-4 rounded-full ${
                                    engine.result === "clean"
                                      ? "bg-green-500"
                                      : engine.result === "threat"
                                        ? "bg-red-500"
                                        : "bg-yellow-500"
                                  }`}
                                />
                                <span className="font-medium text-base">{engine.name}</span>
                              </div>
                              <div className="flex items-center gap-3">
                                <Badge variant={getThreatColor(engine.result)} className="text-sm px-3 py-1">
                                  {engine.result === "clean"
                                    ? "✓ Clean"
                                    : engine.result === "threat"
                                      ? "⚠️ Threat"
                                      : "⚡ Suspicious"}
                                </Badge>
                                {engine.details && (
                                  <span className="text-sm text-muted-foreground font-mono">{engine.details}</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="details" className="space-y-6 mt-8">
                    <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-3 text-xl">
                          <FileText className="w-6 h-6 text-blue-600" />
                          File Information
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        <div className="grid grid-cols-2 gap-6">
                          <div className="space-y-2">
                            <label className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                              File Name
                            </label>
                            <p className="font-mono text-base bg-gray-50 dark:bg-slate-800 p-3 rounded-lg">
                              {analysis.fileName}
                            </p>
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                              File Size
                            </label>
                            <p className="font-mono text-base bg-gray-50 dark:bg-slate-800 p-3 rounded-lg">
                              {analysis.fileSize}
                            </p>
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                              File Type
                            </label>
                            <p className="font-mono text-base bg-gray-50 dark:bg-slate-800 p-3 rounded-lg">
                              {analysis.fileType}
                            </p>
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                              Upload Time
                            </label>
                            <p className="font-mono text-base bg-gray-50 dark:bg-slate-800 p-3 rounded-lg">
                              {analysis.uploadTime}
                            </p>
                          </div>
                        </div>

                        <Separator />

                        <div className="space-y-4">
                          <h4 className="font-semibold text-lg">Cryptographic Hashes</h4>
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <label className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                                MD5
                              </label>
                              <p className="font-mono text-sm bg-gray-50 dark:bg-slate-800 p-3 rounded-lg break-all">
                                {analysis.metadata.md5}
                              </p>
                            </div>
                            <div className="space-y-2">
                              <label className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                                SHA1
                              </label>
                              <p className="font-mono text-sm bg-gray-50 dark:bg-slate-800 p-3 rounded-lg break-all">
                                {analysis.metadata.sha1}
                              </p>
                            </div>
                            <div className="space-y-2">
                              <label className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                                SHA256
                              </label>
                              <p className="font-mono text-sm bg-gray-50 dark:bg-slate-800 p-3 rounded-lg break-all">
                                {analysis.metadata.sha256}
                              </p>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="behavior" className="space-y-6 mt-8">
                    <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-3 text-xl">
                          <Activity className="w-6 h-6 text-blue-600" />
                          Behavioral Analysis
                        </CardTitle>
                        <CardDescription className="text-base">
                          Analysis of file behavior and system interactions
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="grid gap-4">
                          <div className="flex items-center justify-between p-4 rounded-xl border bg-white/50 dark:bg-slate-800/50">
                            <div className="flex items-center gap-3">
                              <Globe className="w-5 h-5 text-muted-foreground" />
                              <span className="font-medium">Network Activity</span>
                            </div>
                            <Badge
                              variant={analysis.behaviorAnalysis.networkActivity ? "destructive" : "default"}
                              className="text-sm px-3 py-1"
                            >
                              {analysis.behaviorAnalysis.networkActivity ? "⚠️ Detected" : "✓ None"}
                            </Badge>
                          </div>
                          <div className="flex items-center justify-between p-4 rounded-xl border bg-white/50 dark:bg-slate-800/50">
                            <div className="flex items-center gap-3">
                              <FileText className="w-5 h-5 text-muted-foreground" />
                              <span className="font-medium">File Modification</span>
                            </div>
                            <Badge
                              variant={analysis.behaviorAnalysis.fileModification ? "destructive" : "default"}
                              className="text-sm px-3 py-1"
                            >
                              {analysis.behaviorAnalysis.fileModification ? "⚠️ Detected" : "✓ None"}
                            </Badge>
                          </div>
                          <div className="flex items-center justify-between p-4 rounded-xl border bg-white/50 dark:bg-slate-800/50">
                            <div className="flex items-center gap-3">
                              <Settings className="w-5 h-5 text-muted-foreground" />
                              <span className="font-medium">Registry Changes</span>
                            </div>
                            <Badge
                              variant={analysis.behaviorAnalysis.registryChanges ? "destructive" : "default"}
                              className="text-sm px-3 py-1"
                            >
                              {analysis.behaviorAnalysis.registryChanges ? "⚠️ Detected" : "✓ None"}
                            </Badge>
                          </div>
                          <div className="flex items-center justify-between p-4 rounded-xl border bg-white/50 dark:bg-slate-800/50">
                            <div className="flex items-center gap-3">
                              <Zap className="w-5 h-5 text-muted-foreground" />
                              <span className="font-medium">Process Creation</span>
                            </div>
                            <Badge
                              variant={analysis.behaviorAnalysis.processCreation ? "destructive" : "default"}
                              className="text-sm px-3 py-1"
                            >
                              {analysis.behaviorAnalysis.processCreation ? "⚠️ Detected" : "✓ None"}
                            </Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="history" className="space-y-6 mt-8">
                    <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-3 text-xl">
                          <Database className="w-6 h-6 text-blue-600" />
                          Threat Intelligence
                        </CardTitle>
                        <CardDescription className="text-base">Historical data and community insights</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-3 gap-6 text-center">
                          <div className="p-6 rounded-xl border bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20">
                            <div className="text-3xl font-bold text-blue-600 mb-2">{analysis.metadata.submissions}</div>
                            <div className="text-sm font-medium text-muted-foreground">Community Submissions</div>
                          </div>
                          <div className="p-6 rounded-xl border bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20">
                            <div className="text-3xl font-bold text-green-600 mb-2">Jan 15</div>
                            <div className="text-sm font-medium text-muted-foreground">First Seen</div>
                          </div>
                          <div className="p-6 rounded-xl border bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20">
                            <div className="text-3xl font-bold text-purple-600 mb-2">Jan 20</div>
                            <div className="text-sm font-medium text-muted-foreground">Last Seen</div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>

                {/* Action Buttons */}
                <div className="flex gap-4 justify-center pt-8">
                  <Button onClick={() => setAnalysis(null)} variant="outline" size="lg" className="text-base px-8 py-6">
                    <RefreshCw className="w-5 h-5 mr-2" />
                    Scan Another File
                  </Button>
                  <Button
                    size="lg"
                    className="text-base px-8 py-6 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                  >
                    <Download className="w-5 h-5 mr-2" />
                    Download Report
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Login Modal */}
      <LoginModal isOpen={isLoginOpen} onClose={() => setIsLoginOpen(false)} onLogin={handleLogin} />
    </div>
  )
}
