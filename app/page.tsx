"use client"

import * as React from "react"

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
  Folder,
  FileUp,
  FolderOpen,
  Sliders,
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
import { scanFile, scanBatch, getEngines } from "@/lib/probium";
import { useSession, signIn, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Send } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

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

// 1. Update FileAnalysis to support tree structure for folders
interface FileNode {
  name: string;
  path: string;
  isFolder: boolean;
  children?: FileNode[];
  analysis?: FileAnalysis;
}

export default function ProbiumLens() {
  const { data: session, status } = useSession();
  const [analysis, setAnalysis] = useState<FileAnalysis | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const [engines, setEngines] = useState<{ name: string; result: "clean" | "threat" | "suspicious" }[]>([]);
  const [selectedEngines, setSelectedEngines] = useState<string[]>([]);
  const [engineError, setEngineError] = useState<string | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [aiInsights, setAiInsights] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<{ role: "user" | "ai"; content: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [chatTemperature, setChatTemperature] = useState(0.6);
  const [chatMaxTokens, setChatMaxTokens] = useState(400);
  const [showPNGs, setShowPNGs] = useState(false);

  // 2. Refactor state for multi-file/folder support
  const [fileTree, setFileTree] = useState<FileNode[] | null>(null);
  const [scanResults, setScanResults] = useState<FileAnalysis[] | null>(null);
  const [selectedFile, setSelectedFile] = useState<FileAnalysis | null>(null);

  // 1. Add state for upload error
  const [uploadError, setUploadError] = useState<string | null>(null);

  // 4. Update fetchAiInsights to cache result per scan
  const fetchAiInsights = useCallback(async () => {
    if (!analysis) return;
    setAiLoading(true);
    setAiError(null);
    setAiInsights(null);
    const scanKey = getScanKey(analysis);
    // Check cache first
    if (scanKey) {
      const cached = localStorage.getItem(`probium_ai_${scanKey}`);
      if (cached) {
        setAiInsights(cached);
        setAiLoading(false);
        return;
      }
    }
    try {
      const res = await fetch("/api/ai-insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scanData: analysis }),
      });
      const data = await res.json();
      if (data.insights) {
        setAiInsights(data.insights);
        // Cache it
        if (scanKey) localStorage.setItem(`probium_ai_${scanKey}`, data.insights);
        // Also update history with AI insight
        saveScanToHistory(analysis, data.insights);
      } else setAiError(data.error || "No insights available.");
    } catch (err: any) {
      setAiError(err?.message || "Failed to fetch AI insights.");
    }
    setAiLoading(false);
  }, [analysis, session]);

  // 1. Automatically trigger fetchAiInsights when a scan completes and the AI Insights tab is active
  const [activeTab, setActiveTab] = useState("ai");
  useEffect(() => {
    if (analysis && activeTab === "ai") {
      fetchAiInsights();
    }
  }, [analysis, activeTab, fetchAiInsights]);

  // Fetch available engines on mount
  useEffect(() => {
    getEngines().then((data) => {
      if (Array.isArray(data)) setEngines(data);
      else if (Array.isArray(data.engines)) setEngines(data.engines);
    });
  }, []);

  // Helper to check if file type is supported by selected engines (mock logic)
  const isFileTypeSupported = (fileType: string) => {
    // For demo, assume all engines support all types except if none selected
    return selectedEngines.length > 0;
  };

  // Remove any forced login screen or blocking logic
  // Always render the main UI below

  // Helper to parse backend scan result into FileAnalysis
  const parseScanResult = (result: any): FileAnalysis => {
    // Map engines_used to a list of engines, using threat_level for all (since no per-engine breakdown)
    const engines = Array.isArray(result.engines_used)
      ? result.engines_used.map((engine: string) => ({
          name: engine,
          result:
            result.security?.threat_level === "high"
              ? "threat"
              : result.security?.threat_level === "medium"
              ? "suspicious"
              : "clean",
        }))
      : [];
    const threats = result.security?.threat_level === "high" || result.security?.threat_level === "medium" ? 1 : 0;
    return {
      fileName: result.filename,
      fileSize: `${(result.size / 1024 / 1024).toFixed(2)} MB`,
      fileType: result.mime_type || result.detected_type || "Unknown",
      uploadTime: result.timestamp ? new Date(result.timestamp).toLocaleString() : new Date().toLocaleString(),
      scanProgress: 100,
      status: "complete",
      threats,
      engines,
      metadata: {
        ...result.metadata,
        ...result.hashes,
      },
      behaviorAnalysis: {},
    };
  };

  // 1. Add a helper to get a unique key for a scan (using SHA256 or fileName+size+type+timestamp as fallback)
  function getScanKey(scan: FileAnalysis) {
    if (!scan) return null;
    // Prefer SHA256, fallback to fileName+size+type+uploadTime
    return (
      scan.metadata?.sha256 ||
      `${scan.fileName}|${scan.fileSize}|${scan.fileType}|${scan.uploadTime}`
    );
  }

  // 2. Update saveScanToHistory to also save AI insight if available
  const saveScanToHistory = (scan: FileAnalysis, aiInsight: string | null) => {
    if (!session?.user?.email) return;
    const key = `probium_history_${session.user.email}`;
    const prev = JSON.parse(localStorage.getItem(key) || '[]');
    // Attach aiInsight if provided
    const scanWithAI = aiInsight ? { ...scan, _aiInsight: aiInsight } : scan;
    prev.unshift(scanWithAI); // add newest first
    localStorage.setItem(key, JSON.stringify(prev.slice(0, 100)));
    // Also cache AI insight by scan key
    if (aiInsight) {
      const scanKey = getScanKey(scan);
      if (scanKey) localStorage.setItem(`probium_ai_${scanKey}`, aiInsight);
    }
  };

  // 3. On mount, check if restoring from history (sessionStorage)
  useEffect(() => {
    const selected = sessionStorage.getItem("selectedScan");
    if (selected) {
      try {
        const scan = JSON.parse(selected);
        setAnalysis(scan);
        // Try to restore cached AI insight
        const scanKey = getScanKey(scan);
        if (scanKey) {
          const cachedAI = localStorage.getItem(`probium_ai_${scanKey}`) || scan._aiInsight || null;
          if (cachedAI) setAiInsights(cachedAI);
        }
        sessionStorage.removeItem("selectedScan");
      } catch (e) {
        // ignore
      }
    }
  }, []);

  // Helper to parse AI insights into sections
  function parseAiInsights(text: string) {
    const sections: { [key: string]: string[] } = {};
    let current: string | null = null;
    text.split(/\r?\n/).forEach(line => {
      const trimmed = line.trim();
      if (/^Summary[:：]?$/i.test(trimmed)) current = "Summary";
      else if (/^Notable Findings[:：]?$/i.test(trimmed)) current = "Notable Findings";
      else if (/^Recommendations?[:：]?$/i.test(trimmed)) current = "Recommendations";
      else if (current && trimmed) {
        if (!sections[current]) sections[current] = [];
        sections[current].push(trimmed.replace(/^[-•\d.]+\s*/, ""));
      }
    });
    return sections;
  }

  // Chatbox handler
  const sendChat = async () => {
    if (!chatInput.trim() || !analysis) return;
    setChatLoading(true);
    setChatError(null);
    const userMsg = { role: "user" as const, content: chatInput };
    setChatMessages((prev) => [...prev, userMsg]);
    setChatInput("");
    try {
      const res = await fetch("/api/ai-insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scanData: analysis,
          userPrompt: chatInput,
          temperature: chatTemperature,
          max_tokens: chatMaxTokens,
        }),
      });
      const data = await res.json();
      if (data.insights) {
        setChatMessages((prev) => [...prev, { role: "ai", content: data.insights }]);
      } else {
        setChatError(data.error || "No response from AI.");
      }
    } catch (err: any) {
      setChatError(err?.message || "Failed to fetch AI response.");
    }
    setChatLoading(false);
  };

  const handleLogin = (userData: any) => {
    setUser(userData);
    localStorage.setItem("probiumUser", JSON.stringify(userData));
  };

  const getStatusIcon = () => {
    if (!analysis) return <Eye className="w-6 h-6" />;
    switch (analysis.status) {
      case "uploading":
        return <Upload className="w-6 h-6 animate-pulse text-blue-500" />;
      case "scanning":
        return <Activity className="w-6 h-6 animate-pulse text-orange-500" />;
      case "complete":
        return analysis.threats > 0 ? (
          <AlertTriangle className="w-6 h-6 text-red-500" />
        ) : (
          <CheckCircle className="w-6 h-6 text-green-500" />
        );
      default:
        return <Eye className="w-6 h-6" />;
    }
  };

  // Engines popover redesign
  const [engineSearch, setEngineSearch] = useState("");
  const filteredEngines = engines.filter(engine =>
    engine.name.toLowerCase().includes(engineSearch.toLowerCase())
  );

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      setLoading(true);
      setScanResults(null);
      setFileTree(null);
      setSelectedFile(null);
      let files: File[] = [];
      if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
        files = await collectFilesFromDataTransfer(e.dataTransfer.items);
      } else if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        files = Array.from(e.dataTransfer.files);
      }
      if (files.length > 0) {
        const idToken = (session as any)?.id_token;
        const res = await scanBatch(files, { engines: selectedEngines.join(",") });
        if (res.success && Array.isArray(res.results)) {
          const parsedResults = res.results.map(parseScanResult);
          setScanResults(parsedResults);
          setAnalysis(parsedResults[0]);
        }
      }
      setLoading(false);
    },
    [session, selectedEngines]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const folderInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files) return;
      if (files.length === 0) return;
      setLoading(true);
      setScanResults(null);
      setFileTree(null);
      setSelectedFile(null);
      setUploadError(null);
      const fileArr = Array.from(files);
      try {
        const res = await scanBatch(fileArr, { engines: selectedEngines.join(",") });
        if (res.success && Array.isArray(res.results)) {
          const parsedResults = res.results.map(parseScanResult);
          setScanResults(parsedResults);
          setAnalysis(parsedResults[0]);
        } else {
          setUploadError('Scan failed. Raw response: ' + JSON.stringify(res, null, 2));
        }
      } catch (err: any) {
        setUploadError(err?.message || "Scan failed.");
      }
      setLoading(false);
    },
    [selectedEngines]
  );

  const handleFolderSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files) return;
      if (files.length === 0) return;
      setLoading(true);
      setScanResults(null);
      setFileTree(null);
      setSelectedFile(null);
      setUploadError(null);
      const fileArr = Array.from(files);
      try {
        const res = await scanBatch(fileArr, { engines: selectedEngines.join(",") });
        if (res.success && Array.isArray(res.results)) {
          const parsedResults = res.results.map(parseScanResult);
          setScanResults(parsedResults);
          setAnalysis(parsedResults[0]);
        } else {
          setUploadError('Scan failed. Raw response: ' + JSON.stringify(res, null, 2));
        }
      } catch (err: any) {
        setUploadError(err?.message || "Scan failed.");
      }
      setLoading(false);
    },
    [selectedEngines]
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      {/* Header */}
      <header className="w-full flex justify-center py-4 bg-transparent">
        <div className="w-full max-w-5xl flex items-center justify-between px-8 py-3 bg-white/70 backdrop-blur-xl rounded-full shadow-lg border border-blue-100">
          <div className="flex items-center gap-8">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent tracking-tight">Probium Lens</h1>
            <nav className="flex gap-4">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="text-gray-800 text-base font-semibold px-3 py-1">Features</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56">
                  <DropdownMenuItem>File Scanning</DropdownMenuItem>
                  <DropdownMenuItem>Threat Intelligence</DropdownMenuItem>
                  <DropdownMenuItem>AI Insights</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="text-gray-800 text-base font-semibold px-3 py-1">Resources</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56">
                  <DropdownMenuItem>Docs</DropdownMenuItem>
                  <DropdownMenuItem>API Reference</DropdownMenuItem>
                  <DropdownMenuItem>Support</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="text-gray-800 text-base font-semibold px-3 py-1">Probity</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56">
                  <DropdownMenuItem asChild>
                    <a href="https://www.probity.com" target="_blank" rel="noopener noreferrer">Visit Probity.com</a>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            {session ? (
              <div className="flex items-center gap-2">
                {session && analysis ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-2"
                    onClick={() => setAnalysis(null)}
                  >
                    <Upload className="h-4 w-4" />
                    Scan a File
                  </Button>
                ) : null}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => router.push("/history")}
                  className="flex items-center gap-2"
                >
                  <History className="h-4 w-4" />
                  <span className="hidden sm:inline">History</span>
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={session.user?.image || "/placeholder.svg"} alt={session.user?.name || "User"} />
                        <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                          {session.user?.name?.charAt(0) || "U"}
                        </AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-64" align="end" forceMount>
                    <DropdownMenuLabel className="font-normal">
                      <div className="flex flex-col space-y-2">
                        <p className="text-sm font-medium leading-none">{session.user?.name}</p>
                        <p className="text-xs leading-none text-muted-foreground">{session.user?.email}</p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => signOut()}>
                      <LogOut className="mr-2 h-4 w-4" />
                      <span>Sign out</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ) : (
              <Button
                variant="default"
                size="sm"
                onClick={() => signIn("google")}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              >
                Sign In
              </Button>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero Section */}
        <div className="text-center mb-12 relative">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg relative">
            <Eye className="h-10 w-10 text-white" />
            {/* Invisible button over the Eye icon */}
            <button
              aria-label="Show PNGs"
              onClick={() => setShowPNGs((prev) => !prev)}
              style={{ position: 'absolute', inset: 0, background: 'transparent', border: 'none', cursor: 'pointer', zIndex: 10 }}
              tabIndex={0}
            />
          </div>
          {/* Animated PNGs in background, shown when showPNGs is true */}
          {showPNGs && (
            <>
              <style>{`
                @keyframes moveLeftToRight {
                  0% { left: -40vw; }
                  100% { left: 100vw; }
                }
                @keyframes moveRightToLeft {
                  0% { right: -40vw; }
                  100% { right: 100vw; }
                }
              `}</style>
              <img
                src="/1731786333420.jpg"
                alt="Background 1"
                style={{
                  position: 'fixed',
                  top: '20vh',
                  left: 0,
                  width: '40vw',
                  maxHeight: '60vh',
                  opacity: 0.3,
                  zIndex: 100,
                  pointerEvents: 'none',
                  animation: 'moveLeftToRight 3s linear infinite',
                }}
              />
              <img
                src="/chad.png"
                alt="Chad"
                style={{
                  position: 'fixed',
                  top: '50vh',
                  right: 0,
                  width: '40vw',
                  maxHeight: '60vh',
                  opacity: 0.3,
                  zIndex: 100,
                  pointerEvents: 'none',
                  animation: 'moveRightToLeft 3s linear infinite',
                }}
              />
            </>
          )}
          <h2 className="text-4xl font-bold mb-4 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Upload Your Files
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Drag & drop or use the buttons below to upload files and folders.
          </p>
        </div>

        {!analysis ? (
          /* Upload Area */
          <Card className="max-w-2xl mx-auto shadow-xl border-0 bg-white/80 backdrop-blur-sm">
            <CardContent className="p-12">
              {/* Replace the upload area with a true water glass effect and improved readability */}
              <div
                className={
                  `flex flex-col items-center justify-center w-full border border-gray-200 dark:border-gray-700 rounded-2xl p-14 mb-8 
                  bg-white/80 dark:bg-slate-800/80 backdrop-filter backdrop-blur-xl shadow-lg 
                  transition-all duration-300 ${
                    isDragging
                      ? "border-blue-400 bg-blue-50/80 dark:bg-blue-900/30 scale-[1.02]"
                      : ""
                  }`
                }
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
              >
                {/* Update the upload area icons to be larger and more intuitive */}
                <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-gray-100/90 dark:bg-gray-700/90 shadow-sm">
                  <Upload className="w-10 h-10 text-blue-600 dark:text-blue-400" strokeWidth={1.5} />
                </div>
                <h3 className="text-2xl font-semibold mb-2 text-center text-gray-900 dark:text-white">Upload files or folders</h3>
                <p className="text-lg text-gray-600 dark:text-gray-300 mb-8 text-center">Drag & drop or use the buttons below</p>
                <div className="flex flex-col gap-8 w-full max-w-2xl justify-center items-center">
  <div className="flex flex-row gap-8 w-full justify-center items-center">
    <Button
      asChild
      size="lg"
      className="w-80 h-28 text-lg rounded-xl bg-white/60 backdrop-blur-md border border-blue-200 shadow-lg hover:bg-white/80 hover:border-blue-400 hover:shadow-xl transition-all duration-200 font-bold text-blue-900 focus-visible:ring-2 focus-visible:ring-blue-400 flex items-center justify-center gap-3"
      disabled={advancedOpen && selectedEngines.length === 0}
    >
      <label htmlFor="file-upload" className="cursor-pointer w-full h-full flex items-center justify-center gap-2">
        <FileUp className="w-7 h-7 text-blue-600" strokeWidth={2} />
        <span className="font-bold text-lg text-blue-900">Files</span>
      </label>
    </Button>
    <Button
      asChild
      size="lg"
      className="w-80 h-28 text-lg rounded-xl bg-white/60 backdrop-blur-md border border-blue-200 shadow-lg hover:bg-white/80 hover:border-blue-400 hover:shadow-xl transition-all duration-200 font-bold text-blue-900 focus-visible:ring-2 focus-visible:ring-blue-400 flex items-center justify-center gap-3"
      disabled={advancedOpen && selectedEngines.length === 0}
    >
      <label htmlFor="folder-upload" className="cursor-pointer w-full h-full flex items-center justify-center gap-2">
        <FolderOpen className="w-7 h-7 text-blue-600" strokeWidth={2} />
        <span className="font-bold text-lg text-blue-900">Folder</span>
      </label>
    </Button>
  </div>
  <Popover open={advancedOpen} onOpenChange={setAdvancedOpen}>
    <PopoverTrigger asChild>
      <Button
        type="button"
        size="lg"
        className="w-56 h-12 text-base rounded-xl bg-white/60 backdrop-blur-md border border-blue-200 shadow-lg font-bold text-blue-900 flex items-center justify-center gap-2 hover:bg-white/80 hover:border-blue-400 hover:shadow-xl transition-all duration-200 focus-visible:ring-2 focus-visible:ring-blue-400"
        aria-expanded={advancedOpen}
      >
        <Sliders className="h-6 w-6 text-blue-600" strokeWidth={2} />
        <span className="font-bold text-base text-blue-900">Engines</span>
      </Button>
    </PopoverTrigger>
    <PopoverContent className="w-96 p-6 rounded-xl shadow-2xl bg-white/90 dark:bg-slate-900/90 border border-blue-200 dark:border-blue-700 backdrop-blur-md backdrop-saturate-150">
      <div className="mb-4 text-lg font-bold text-blue-700 dark:text-blue-200 flex items-center gap-2">
        <Sliders className="h-5 w-5" />
        Select Engines
      </div>
      <input
        type="text"
        value={engineSearch}
        onChange={e => setEngineSearch(e.target.value)}
        placeholder="Search engines..."
        className="w-full mb-3 px-3 py-2 rounded border border-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-400 text-base"
        aria-label="Search engines"
      />
      <div className="max-h-64 overflow-y-auto grid grid-cols-2 gap-3">
        {filteredEngines.length === 0 ? (
          <div className="col-span-2 text-center text-muted-foreground">No engines match your search.</div>
        ) : (
          filteredEngines.map((engine, idx) => (
            <label key={engine.name || idx} className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/30">
              <input
                type="checkbox"
                checked={selectedEngines.includes(engine.name)}
                onChange={e => {
                  setSelectedEngines(prev =>
                    e.target.checked
                      ? [...prev, engine.name]
                      : prev.filter(n => n !== engine.name)
                  );
                }}
                className="accent-blue-600 w-5 h-5"
              />
              <span className="text-base font-bold text-gray-800 dark:text-gray-200">{engine.name}</span>
            </label>
          ))
        )}
      </div>
      {engineError && <div className="text-red-600 font-semibold mt-2">{engineError}</div>}
      <Button
        type="button"
        className="mt-4 w-full bg-gradient-to-r from-blue-600 to-blue-400 text-white font-bold rounded-xl"
        onClick={() => setAdvancedOpen(false)}
      >
        Done
      </Button>
    </PopoverContent>
  </Popover>
</div>
                <input type="file" id="file-upload" className="hidden" onChange={handleFileSelect} accept="*/*" multiple ref={fileInputRef} />
                <input type="file" id="folder-upload" className="hidden" onChange={handleFolderSelect} multiple ref={folderInputRef} />
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
                  <span className="font-medium">30+ Engines</span>
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
              {/* Add a loading spinner/message and visible error message in the upload area */}
              {loading && (
                <div className="flex flex-col items-center justify-center my-8">
                  <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-blue-500 border-opacity-50 mb-4"></div>
                  <span className="text-blue-700 font-semibold text-lg">Processing your scan...</span>
                </div>
              )}
              {uploadError && (
                <div className="flex flex-col items-center justify-center my-8">
                  <span className="text-red-600 font-bold text-lg">{uploadError}</span>
                </div>
              )}
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
                          ? `${analysis.engines.length}/${analysis.engines.length} engines`
                          : `${Math.round(analysis.scanProgress)}%`}
                      </span>
                    </div>
                    <Progress
                      value={
                        analysis.status === "uploading"
                          ? analysis.scanProgress
                          : (analysis.engines.length / analysis.engines.length) * 100
                      }
                      className="h-3"
                    />
                  </div>
                </CardContent>
              )}
            </Card>

            {analysis && selectedEngines.length > 0 && !isFileTypeSupported(analysis.fileType) && (
              <div className="my-4 p-4 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-800 rounded">
                <strong>Warning:</strong> The scanned file type <span className="font-mono">{analysis.fileType}</span> is not supported by any of the selected engines. Results may be incomplete or unavailable.
              </div>
            )}

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

                <Tabs defaultValue="ai" value={activeTab} onValueChange={setActiveTab} className="w-full">
                  <TabsList className="grid w-full grid-cols-4 h-12 bg-gradient-to-r from-blue-100 via-purple-100 to-blue-50 dark:from-blue-900/30 dark:via-purple-900/30 dark:to-blue-900/30 rounded-xl shadow-md">
                    {/* AI Insights first */}
                    <TabsTrigger
                      value="ai"
                      onClick={fetchAiInsights}
                      className="text-base font-semibold transition-all duration-200 ease-in-out rounded-lg mx-1 h-10 flex items-center justify-center
                        data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-blue-600 data-[state=active]:text-white
                        data-[state=inactive]:bg-transparent data-[state=inactive]:text-blue-700 dark:data-[state=inactive]:text-blue-200
                        hover:bg-blue-200/60 dark:hover:bg-blue-800/40 hover:scale-105 focus-visible:ring-2 focus-visible:ring-blue-400"
                    >
                      <Eye className="w-5 h-5 mr-2 group-data-[state=active]:text-white group-data-[state=inactive]:text-blue-700 dark:group-data-[state=inactive]:text-blue-200" /> AI Insights
                    </TabsTrigger>
                    {/* File Details second */}
                    <TabsTrigger
                      value="details"
                      className="text-base font-semibold transition-all duration-200 ease-in-out rounded-lg mx-1 h-10 flex items-center justify-center
                        data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-purple-500 data-[state=active]:text-white
                        data-[state=inactive]:bg-transparent data-[state=inactive]:text-blue-700 dark:data-[state=inactive]:text-blue-200
                        hover:bg-blue-200/60 dark:hover:bg-blue-800/40 hover:scale-105 focus-visible:ring-2 focus-visible:ring-blue-400"
                    >
                      <FileText className="w-5 h-5 mr-2 group-data-[state=active]:text-white group-data-[state=inactive]:text-blue-700 dark:group-data-[state=inactive]:text-blue-200" /> File Details
                    </TabsTrigger>
                    {/* Behavior Analysis */}
                    <TabsTrigger
                      value="behavior"
                      className="text-base font-semibold transition-all duration-200 ease-in-out rounded-lg mx-1 h-10 flex items-center justify-center
                        data-[state=active]:bg-gradient-to-r data-[state=active]:from-green-500 data-[state=active]:to-blue-500 data-[state=active]:text-white
                        data-[state=inactive]:bg-transparent data-[state=inactive]:text-green-700 dark:data-[state=inactive]:text-green-200
                        hover:bg-green-200/60 dark:hover:bg-green-800/40 hover:scale-105 focus-visible:ring-2 focus-visible:ring-green-400"
                    >
                      <Activity className="w-5 h-5 mr-2 group-data-[state=active]:text-white group-data-[state=inactive]:text-green-700 dark:group-data-[state=inactive]:text-green-200" /> Behavior Analysis
                    </TabsTrigger>
                    {/* Intelligence */}
                    <TabsTrigger
                      value="history"
                      className="text-base font-semibold transition-all duration-200 ease-in-out rounded-lg mx-1 h-10 flex items-center justify-center
                        data-[state=active]:bg-gradient-to-r data-[state=active]:from-yellow-400 data-[state=active]:to-yellow-500 data-[state=active]:text-white
                        data-[state=inactive]:bg-transparent data-[state=inactive]:text-yellow-700 dark:data-[state=inactive]:text-yellow-200
                        hover:bg-yellow-200/60 dark:hover:bg-yellow-800/40 hover:scale-105 focus-visible:ring-2 focus-visible:ring-yellow-400"
                    >
                      <Database className="w-5 h-5 mr-2 group-data-[state=active]:text-white group-data-[state=inactive]:text-yellow-600 dark:group-data-[state=inactive]:text-yellow-200" /> Intelligence
                    </TabsTrigger>
                  </TabsList>

                  {/* Swap the order of TabsContent as well */}
                  <TabsContent value="ai" className="space-y-6 mt-8">
                    <div className="flex flex-col md:flex-row gap-8">
                      {/* Main AI Insights Section */}
                      <div className="flex-1 min-w-0">
                        <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
                          <CardHeader>
                            <CardTitle className="flex items-center gap-3 text-xl">
                              <Eye className="w-6 h-6 text-blue-600" />
                              AI Insights
                            </CardTitle>
                            <CardDescription className="text-base">
                              Expert AI-generated analysis and recommendations for this file
                            </CardDescription>
                          </CardHeader>
                          <CardContent>
                            {aiLoading ? (
                              <div className="text-center py-8 text-lg">Generating insights...</div>
                            ) : aiError ? (
                              <div className="text-center text-red-600 font-semibold py-8">{aiError}</div>
                            ) : aiInsights ? (
                              (() => {
                                const sections = parseAiInsights(aiInsights);
                                return (
                                  <div className="space-y-6">
                                    {sections["Summary"] && (
                                      <div>
                                        <div className="font-semibold text-lg mb-1">Summary</div>
                                        <div className="text-base text-gray-800 dark:text-gray-200">
                                          {sections["Summary"].join(" ")}
                                        </div>
                                      </div>
                                    )}
                                    {sections["Notable Findings"] && (
                                      <div>
                                        <div className="font-semibold text-lg mb-1">Notable Findings</div>
                                        <ul className="list-disc pl-6 text-base text-gray-800 dark:text-gray-200">
                                          {sections["Notable Findings"].map((item, idx) => (
                                            <li key={idx}>{item}</li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}
                                  </div>
                                );
                              })()
                            ) : (
                              <div className="text-center text-muted-foreground py-8">No insights yet. Click the tab to generate AI insights.</div>
                            )}
                          </CardContent>
                        </Card>
                      </div>
                      {/* Chatbox Sidebar */}
                      <div className="w-full md:w-[380px] flex flex-col gap-4">
                        <Card className="shadow-lg border-0 bg-gradient-to-br from-blue-50 via-purple-50 to-blue-100 dark:from-blue-900/30 dark:via-purple-900/30 dark:to-blue-900/30">
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-lg">
                              <Send className="h-5 w-5 text-purple-600" />
                              Ask the AI
                            </CardTitle>
                            <CardDescription className="text-base">Ask custom questions about this file or tune the AI response.</CardDescription>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-2 mb-4">
                              <label className="block text-sm font-medium mb-1">Response Style</label>
                              <div className="flex gap-2 items-center">
                                <span className="text-xs text-blue-700 dark:text-blue-300">Concise</span>
                                <Slider
                                  min={0.2}
                                  max={1.2}
                                  step={0.1}
                                  value={[chatTemperature]}
                                  onValueChange={([v]) => setChatTemperature(v)}
                                  className="flex-1"
                                />
                                <span className="text-xs text-purple-700 dark:text-purple-300">Creative</span>
                              </div>
                              <label className="block text-sm font-medium mt-2 mb-1">Max Length</label>
                              <Slider
                                min={100}
                                max={1000}
                                step={50}
                                value={[chatMaxTokens]}
                                onValueChange={([v]) => setChatMaxTokens(v)}
                              />
                              <div className="flex justify-between text-xs text-muted-foreground">
                                <span>{chatMaxTokens} tokens</span>
                                <span>~{Math.round(chatMaxTokens/4)} words</span>
                              </div>
                            </div>
                            <div className="flex flex-col gap-2 h-64 overflow-y-auto bg-white/60 dark:bg-slate-900/30 rounded-lg p-3 mb-2 border">
                              {chatMessages.length === 0 && (
                                <div className="text-muted-foreground text-center my-auto">No conversation yet. Ask a question about this file.</div>
                              )}
                              {chatMessages.map((msg, idx) => (
                                <div
                                  key={idx}
                                  className={`rounded-xl px-4 py-2 mb-1 max-w-[90%] text-base whitespace-pre-line ${
                                    msg.role === "user"
                                      ? "bg-blue-100 dark:bg-blue-900/40 self-end text-right text-blue-900 dark:text-blue-100"
                                      : "bg-purple-100 dark:bg-purple-900/40 self-start text-left text-purple-900 dark:text-purple-100"
                                  }`}
                                >
                                  {msg.content}
                                </div>
                              ))}
                              {chatLoading && (
                                <div className="text-center text-blue-600">Thinking...</div>
                              )}
                              {chatError && (
                                <div className="text-center text-red-600 font-semibold">{chatError}</div>
                              )}
                            </div>
                            <form
                              className="flex gap-2 mt-2"
                              onSubmit={e => {
                                e.preventDefault();
                                sendChat();
                              }}
                            >
                              <Input
                                value={chatInput}
                                onChange={e => setChatInput(e.target.value)}
                                placeholder="Ask about this file..."
                                className="flex-1 bg-white/80 dark:bg-slate-900/40"
                                disabled={chatLoading}
                              />
                              <Button type="submit" size="icon" disabled={chatLoading || !chatInput.trim()} className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
                                <Send className="h-5 w-5" />
                              </Button>
                            </form>
                          </CardContent>
                        </Card>
                      </div>
                    </div>
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
                          Detailed analysis of file behavior and system interactions
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-8">
                          {/* File System Activity */}
                          <div>
                            <h4 className="text-lg font-semibold flex items-center gap-2">
                              <FileText className="h-5 w-5 text-blue-600" />
                              File System Activity
                              <span className="ml-1 text-blue-400 cursor-help" title="Tracks file creation, modification, and deletion events.">?</span>
                            </h4>
                            <div className="grid gap-4">
                              <div className="flex items-center justify-between p-4 rounded-xl border bg-white/50 dark:bg-slate-800/50">
                                <div className="flex items-center gap-3">
                                  <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                  <span className="font-medium">Files Created</span>
                                </div>
                                <Badge variant={analysis.behaviorAnalysis?.filesCreated ? "destructive" : "default"} className="text-sm px-3 py-1">
                                  {analysis.behaviorAnalysis?.filesCreated ?? 0}
                                </Badge>
                              </div>
                              <div className="flex items-center justify-between p-4 rounded-xl border bg-white/50 dark:bg-slate-800/50">
                                <div className="flex items-center gap-3">
                                  <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                  <span className="font-medium">Files Modified</span>
                                </div>
                                <Badge variant={analysis.behaviorAnalysis?.filesModified ? "destructive" : "default"} className="text-sm px-3 py-1">
                                  {analysis.behaviorAnalysis?.filesModified ?? 0}
                                </Badge>
                              </div>
                              <div className="flex items-center justify-between p-4 rounded-xl border bg-white/50 dark:bg-slate-800/50">
                                <div className="flex items-center gap-3">
                                  <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                  <span className="font-medium">Files Deleted</span>
                                </div>
                                <Badge variant={analysis.behaviorAnalysis?.filesDeleted ? "destructive" : "default"} className="text-sm px-3 py-1">
                                  {analysis.behaviorAnalysis?.filesDeleted ?? 0}
                                </Badge>
                              </div>
                            </div>
                          </div>
                          {/* Network Activity */}
                          <div>
                            <h4 className="text-lg font-semibold flex items-center gap-2">
                              <Globe className="h-5 w-5 text-blue-600" />
                              Network Activity
                              <span className="ml-1 text-blue-400 cursor-help" title="Tracks outbound connections, data exfiltration, and C2 activity.">?</span>
                            </h4>
                            <div className="grid gap-4">
                              <div className="flex items-center justify-between p-4 rounded-xl border bg-white/50 dark:bg-slate-800/50">
                                <div className="flex items-center gap-3">
                                  <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                  <span className="font-medium">Outbound Connections</span>
                                </div>
                                <Badge variant={analysis.behaviorAnalysis?.outboundConnections ? "destructive" : "default"} className="text-sm px-3 py-1">
                                  {analysis.behaviorAnalysis?.outboundConnections ?? 0}
                                </Badge>
                              </div>
                              <div className="flex items-center justify-between p-4 rounded-xl border bg-white/50 dark:bg-slate-800/50">
                                <div className="flex items-center gap-3">
                                  <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                  <span className="font-medium">Unique IPs/Domains</span>
                                </div>
                                <Badge variant={analysis.behaviorAnalysis?.uniqueEndpoints ? "destructive" : "default"} className="text-sm px-3 py-1">
                                  {analysis.behaviorAnalysis?.uniqueEndpoints ?? 0}
                                </Badge>
                              </div>
                              <div className="flex items-center justify-between p-4 rounded-xl border bg-white/50 dark:bg-slate-800/50">
                                <div className="flex items-center gap-3">
                                  <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                  <span className="font-medium">Data Exfiltration</span>
                                </div>
                                <Badge variant={analysis.behaviorAnalysis?.dataExfiltration ? "destructive" : "default"} className="text-sm px-3 py-1">
                                  {analysis.behaviorAnalysis?.dataExfiltration ? "Yes" : "No"}
                                </Badge>
                              </div>
                            </div>
                          </div>
                          {/* System Modifications */}
                          <div>
                            <h4 className="text-lg font-semibold flex items-center gap-2">
                              <Settings className="h-5 w-5 text-blue-600" />
                              System Modifications
                              <span className="ml-1 text-blue-400 cursor-help" title="Tracks registry changes, process creation, and persistence mechanisms.">?</span>
                            </h4>
                            <div className="grid gap-4">
                              <div className="flex items-center justify-between p-4 rounded-xl border bg-white/50 dark:bg-slate-800/50">
                                <div className="flex items-center gap-3">
                                  <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                  <span className="font-medium">Registry Changes</span>
                                </div>
                                <Badge variant={analysis.behaviorAnalysis?.registryChanges ? "destructive" : "default"} className="text-sm px-3 py-1">
                                  {analysis.behaviorAnalysis?.registryChanges ? "Yes" : "No"}
                                </Badge>
                              </div>
                              <div className="flex items-center justify-between p-4 rounded-xl border bg-white/50 dark:bg-slate-800/50">
                                <div className="flex items-center gap-3">
                                  <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                  <span className="font-medium">Process Creation</span>
                                </div>
                                <Badge variant={analysis.behaviorAnalysis?.processCreation ? "destructive" : "default"} className="text-sm px-3 py-1">
                                  {analysis.behaviorAnalysis?.processCreation ? "Yes" : "No"}
                                </Badge>
                              </div>
                              <div className="flex items-center justify-between p-4 rounded-xl border bg-white/50 dark:bg-slate-800/50">
                                <div className="flex items-center gap-3">
                                  <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                  <span className="font-medium">Persistence Mechanisms</span>
                                </div>
                                <Badge variant={analysis.behaviorAnalysis?.persistence ? "destructive" : "default"} className="text-sm px-3 py-1">
                                  {analysis.behaviorAnalysis?.persistence ? "Yes" : "No"}
                                </Badge>
                              </div>
                            </div>
                          </div>
                          {/* Behavioral Risk Score */}
                          <div className="p-6 rounded-xl border bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                              <div>
                                <h4 className="text-lg font-semibold mb-2 flex items-center gap-2">
                                  Behavioral Risk Score
                                  <span className="ml-1 text-blue-400 cursor-help" title="Overall risk based on observed behaviors. Higher is more dangerous.">?</span>
                                </h4>
                                <p className="text-muted-foreground">Overall assessment based on observed behaviors</p>
                              </div>
                              <div className="flex items-center gap-3">
                                <div className="w-16 h-16 rounded-full flex items-center justify-center border-4 border-blue-500">
                                  <span className="text-xl font-bold text-blue-600">
                                    {analysis.behaviorAnalysis?.riskScore || 0}
                                  </span>
                                </div>
                                <div>
                                  <Badge variant={
                                    (analysis.behaviorAnalysis?.riskScore || 0) > 70 ? "destructive" : 
                                    (analysis.behaviorAnalysis?.riskScore || 0) > 30 ? "secondary" : "default"
                                  } className="text-sm px-3 py-1">
                                    {(analysis.behaviorAnalysis?.riskScore || 0) > 70 ? "High Risk" : 
                                     (analysis.behaviorAnalysis?.riskScore || 0) > 30 ? "Medium Risk" : "Low Risk"}
                                  </Badge>
                                  <p className="text-xs text-muted-foreground mt-1">Scale: 0-100</p>
                                </div>
                              </div>
                            </div>
                          </div>
                          {/* Timeline of Events */}
                          {Array.isArray(analysis.behaviorAnalysis?.events) && analysis.behaviorAnalysis.events.length > 0 && (
                            <div>
                              <h4 className="text-lg font-semibold flex items-center gap-2">
                                <Activity className="h-5 w-5 text-blue-600" />
                                Timeline of Events
                                <span className="ml-1 text-blue-400 cursor-help" title="Chronological list of key behavioral events.">?</span>
                              </h4>
                              <ul className="mt-2 space-y-2">
                                {analysis.behaviorAnalysis.events.map((event, idx) => (
                                  <li key={idx} className="text-sm text-gray-800 dark:text-gray-200 bg-blue-50 dark:bg-blue-900/20 rounded p-2">
                                    <span className="font-mono text-xs text-blue-700 mr-2">{event.timestamp || idx}</span>
                                    {event.description || JSON.stringify(event)}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {/* Fallback if no behavioral data */}
                          {(!analysis.behaviorAnalysis || Object.keys(analysis.behaviorAnalysis).length === 0) && (
                            <div className="text-center text-muted-foreground py-8">No behavioral data available for this file.</div>
                          )}
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
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-6 text-center">
                          <div className="p-6 rounded-xl border bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20">
                            <div className="text-3xl font-bold text-blue-600 mb-2">
                              {analysis.metadata.submissions || 1}
                            </div>
                            <div className="text-sm font-medium text-muted-foreground">Community Submissions</div>
                          </div>
                          <div className="p-6 rounded-xl border bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20">
                            <div className="text-3xl font-bold text-green-600 mb-2">
                              {analysis.metadata.first_seen || new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </div>
                            <div className="text-sm font-medium text-muted-foreground">First Seen</div>
                          </div>
                          <div className="p-6 rounded-xl border bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20">
                            <div className="text-3xl font-bold text-purple-600 mb-2">
                              {analysis.metadata.last_seen || new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </div>
                            <div className="text-sm font-medium text-muted-foreground">Last Seen</div>
                          </div>
                          <div className="p-6 rounded-xl border bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-900/20 dark:to-yellow-800/20 col-span-2 md:col-span-1">
                            <div className="text-3xl font-bold text-yellow-600 mb-2">
                              {analysis.metadata.globalPrevalence ?? 'N/A'}
                            </div>
                            <div className="text-sm font-medium text-muted-foreground">Global Prevalence</div>
                          </div>
                          <div className="p-6 rounded-xl border bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 col-span-2 md:col-span-1">
                            <div className="text-3xl font-bold text-red-600 mb-2">
                              {typeof analysis.metadata.detectionRate === 'number' ? `${analysis.metadata.detectionRate}%` : 'N/A'}
                            </div>
                            <div className="text-sm font-medium text-muted-foreground">Detection Rate</div>
                          </div>
                          <div className="p-6 rounded-xl border bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900/20 dark:to-gray-800/20 col-span-2 md:col-span-1">
                            <div className="text-3xl font-bold text-gray-600 mb-2">
                              {typeof analysis.metadata.reputationScore === 'number' ? analysis.metadata.reputationScore : 'N/A'}
                            </div>
                            <div className="text-sm font-medium text-muted-foreground">Reputation Score</div>
                          </div>
                        </div>
                        {/* Related Threats */}
                        {Array.isArray(analysis.metadata.relatedThreats) && analysis.metadata.relatedThreats.length > 0 && (
                          <div className="mt-8">
                            <h4 className="text-lg font-semibold flex items-center gap-2">
                              <AlertTriangle className="h-5 w-5 text-red-600" />
                              Related Threats
                              <span className="ml-1 text-red-400 cursor-help" title="Other threats or malware related to this file.">?</span>
                            </h4>
                            <ul className="mt-2 space-y-2">
                              {analysis.metadata.relatedThreats.map((threat, idx) => (
                                <li key={idx} className="text-sm text-gray-800 dark:text-gray-200 bg-red-50 dark:bg-red-900/20 rounded p-2">
                                  {threat}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {/* Fallback if no intelligence data */}
                        {(!analysis.metadata || Object.keys(analysis.metadata).length === 0) && (
                          <div className="text-center text-muted-foreground py-8">No threat intelligence data available for this file.</div>
                        )}
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
