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
import Head from "next/head";

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
  // Easter egg: triple click state
  const [eyeClickCount, setEyeClickCount] = useState(0);
  const [eyeClickTimer, setEyeClickTimer] = useState<NodeJS.Timeout | null>(null);

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
      let engineList = [];
      if (Array.isArray(data)) engineList = data;
      else if (Array.isArray(data.engines)) engineList = data.engines;
      setEngines(engineList);
      // Default select all engines
      setSelectedEngines(engineList.map(e => e.name));
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
  const parseScanResult = (result: any): FileAnalysis & { spoofed?: boolean } => {
    // Debug log
    console.log('Scan result:', result);
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
    let threats = result.security?.threat_level === "high" || result.security?.threat_level === "medium" ? 1 : 0;
    // Defensive checks
    let fileSize = '-- MB';
    if (typeof result.size === 'number' && !isNaN(result.size)) {
      fileSize = `${(result.size / 1024 / 1024).toFixed(2)} MB`;
    }
    const fileType = result.mime_type || result.detected_type || 'Unknown';
    const fileName = result.filename || 'Unknown';
    // Spoofed extension detection
    let spoofed = false;
    let ext = '';
    if (fileName && fileName.includes('.')) {
      ext = fileName.split('.').pop()?.toLowerCase() || '';
    }
    // Canonical file type mapping for spoofed extension logic
    function canonicalFileType(val: string): string {
      if (!val) return '';
      const map: Record<string, string> = {
        'application/pdf': 'pdf',
        'pdf': 'pdf',
        'application/vnd.microsoft.portable-executable': 'exe',
        'application/x-msdownload': 'exe',
        'exe': 'exe',
        'jpg': 'jpg',
        'jpeg': 'jpg',
        'image/jpeg': 'jpg',
        'png': 'png',
        'image/png': 'png',
        'gif': 'gif',
        'image/gif': 'gif',
        'bmp': 'bmp',
        'image/bmp': 'bmp',
        'svg': 'svg',
        'image/svg+xml': 'svg',
        'doc': 'doc',
        'application/msword': 'doc',
        'docx': 'docx',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
        'xls': 'xls',
        'application/vnd.ms-excel': 'xls',
        'xlsx': 'xlsx',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
        'ppt': 'ppt',
        'application/vnd.ms-powerpoint': 'ppt',
        'pptx': 'pptx',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
        'zip': 'zip',
        'application/zip': 'zip',
        'rar': 'rar',
        'application/x-rar-compressed': 'rar',
        'mp3': 'mp3',
        'audio/mpeg': 'mp3',
        'mp4': 'mp4',
        'video/mp4': 'mp4',
        'txt': 'txt',
        'text/plain': 'txt',
        'html': 'html',
        'text/html': 'html',
        'csv': 'csv',
        'text/csv': 'csv',
      };
      return map[val.toLowerCase()] || val.toLowerCase();
    }
    // Only flag as spoofed if canonical types are truly different
    if (ext && fileType) {
      if (canonicalFileType(ext) && canonicalFileType(fileType) && canonicalFileType(ext) !== canonicalFileType(fileType)) {
        spoofed = true;
        threats += 1;
      }
    }
    return {
      fileName,
      fileSize,
      fileType,
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
      spoofed,
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
      // If spoofed, add a note to the prompt
      let scanData = { ...analysis };
      // Only use the structured format for the initial scan summary, not for chat
      let aiInstruction = chatInput.trim()
        ? `You are an expert file security assistant. Given the following file context, answer the user's question in 1-2 sentences. Be concise but conversational. Only answer the user's question directly, with no extra explanation or context unless asked.\nFile context: ${JSON.stringify(scanData)}`
        : `Please format your response as follows:\n\nSummary\n⚠️ If there is a threat or spoofed extension, start with a warning (e.g., 'Potential Threat Detected').\n- File: [filename]\n- Size: [file size]\n- Uploaded: [upload time]\n- Detected Type: [detected type]\n- Extension: [extension] (note if it does not match detected type)\n\nWhy is this risky?\n- Briefly explain why a spoofed extension or threat is dangerous (if applicable).\n\nWhat should you do?\n- Give clear, actionable recommendations (e.g., 'Do NOT open this file. Delete it or report it to your IT/security team.').\n\nScan Results\n- Threats detected: [number]\n- Behavioral analysis: [summary or 'not conducted']\n\nUse bullet points, be concise, and make the summary easy to read. Only flag as spoofed if the extension and detected type are truly mismatched (e.g., .pdf vs application/exe, but not .jpg vs image/jpeg).`;
      const res = await fetch("/api/ai-insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scanData,
          userPrompt: `${aiInstruction}\n${chatInput}`,
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
          const parsedResults = res.results.map(r => parseScanResult(r.result || r));
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
      const file = files[0];
      try {
        const res = await scanFile(file, { engines: selectedEngines.join(","), generate_hashes: true, extract_metadata_flag: true });
        if (res && (res.success || res.status === 'complete')) {
          const parsed = parseScanResult(res.result || res);
          setScanResults([parsed]);
          setAnalysis(parsed);
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

  // Handler for Eye icon triple click easter egg
  const handleEyeClick = () => {
    setEyeClickCount((prev) => {
      const newCount = prev + 1;
      if (newCount === 1) {
        // Start/reset timer on first click
        if (eyeClickTimer) clearTimeout(eyeClickTimer);
        const timer = setTimeout(() => {
          setEyeClickCount(0);
        }, 2000);
        setEyeClickTimer(timer);
      }
      if (newCount === 3) {
        // Trigger easter egg
        setShowPNGs((prev) => !prev);
        setEyeClickCount(0);
        if (eyeClickTimer) clearTimeout(eyeClickTimer);
        setEyeClickTimer(null);
      }
      return newCount === 3 ? 0 : newCount;
    });
  };

  // Helper to map MIME types to friendly labels
  function getFriendlyFileType(mime: string): string {
    const map: Record<string, string> = {
      'application/pdf': 'PDF',
      'application/vnd.microsoft.portable-executable': '.exe (Windows Executable)',
      'application/msword': 'Word Document',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word Document (.docx)',
      'application/vnd.ms-excel': 'Excel Spreadsheet',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Excel Spreadsheet (.xlsx)',
      'application/vnd.ms-powerpoint': 'PowerPoint Presentation',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PowerPoint Presentation (.pptx)',
      'application/zip': 'ZIP Archive',
      'application/x-rar-compressed': 'RAR Archive',
      'audio/mpeg': 'MP3 Audio',
      'video/mp4': 'MP4 Video',
      'text/plain': 'Text File',
      'text/html': 'HTML Document',
      'text/csv': 'CSV File',
      'image/jpeg': 'JPEG Image',
      'image/png': 'PNG Image',
      'image/gif': 'GIF Image',
      'image/bmp': 'BMP Image',
      'image/svg+xml': 'SVG Image',
      'application/x-msdownload': '.exe (Windows Executable)',
    };
    return map[mime] || mime;
  }

  return (
    <>
      <Head>
        <link rel="icon" href="/placeholder.svg" />
      </Head>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        {/* Header */}
        <header className="w-full flex justify-center py-4 bg-transparent relative">
          {/* Chromatic glow behind the pill */}
          <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[110%] h-[180%] rounded-full bg-gradient-to-r from-blue-600/20 to-purple-600/20 blur-3xl" style={{zIndex:1}} />
          <div className="w-full max-w-5xl flex items-center justify-between px-8 py-3 rounded-full bg-white shadow-lg relative z-10 overflow-visible"
            style={{
              background: '#fff',
              boxShadow: '0 4px 24px 0 rgba(31, 38, 135, 0.08)',
            }}
          >
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
          {/* Upload Area */}
          {!analysis ? (
            <div className="max-w-2xl mx-auto relative">
              {/* Chromatic glow behind the upload box */}
              <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[140%] rounded-3xl bg-gradient-to-r from-blue-600/20 to-purple-600/20 blur-3xl" style={{zIndex:1}} />
              <div
                className={`flex flex-col items-center justify-center w-full rounded-3xl p-16 mb-10 bg-white dark:bg-slate-900 shadow-2xl border border-gray-200 dark:border-gray-700 ring-1 ring-gray-200/40 hover:shadow-3xl transition-all duration-300 relative overflow-hidden ${isDragging ? "scale-[1.03] ring-2 ring-blue-400/60" : ""}`}
                style={{ background: '#fff', boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.10)', border: '1.5px solid rgba(94, 114, 228, 0.12)', zIndex:2 }}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
              >
                {/* Gradient overlay for depth */}
                <div className="pointer-events-none absolute inset-0 rounded-3xl bg-gradient-to-br from-blue-50/60 via-white/30 to-purple-100/60 dark:from-blue-900/30 dark:via-slate-800/20 dark:to-purple-900/30" />
                {/* Dashed border for drop area */}
                <div className={`absolute inset-0 rounded-3xl border-4 border-dashed transition-colors duration-300 ${isDragging ? "border-blue-400/80" : "border-blue-200/40 dark:border-blue-800/40"}`} style={{ zIndex: 1 }} />
                {/* Content */}
                <div className="relative z-10 flex flex-col items-center w-full">
                  <div className="mx-auto mb-8 flex h-24 w-24 items-center justify-center rounded-full bg-white shadow-xl" style={{ boxShadow: '0 0 24px 0 #7c3aed33' }}>
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="url(#eye-gradient)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-12 h-12">
                      <defs>
                        <linearGradient id="eye-gradient" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
                          <stop stopColor="#2563eb" />
                          <stop offset="1" stopColor="#7c3aed" />
                        </linearGradient>
                      </defs>
                      <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  </div>
                  <h3 className="text-3xl font-bold mb-3 text-center bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Upload or Drag Your Files</h3>
                  <p className="text-lg text-gray-700 dark:text-gray-200 mb-6 text-center max-w-lg">Drop your files here, or use the button below to select files from your device. Your files are never stored.</p>
                  <div className="flex items-center w-full justify-center mb-6">
                    <div className="flex-1 h-px bg-gradient-to-r from-transparent via-blue-200 to-transparent dark:via-blue-800" />
                    <span className="mx-4 text-gray-400 text-base font-semibold">or</span>
                    <div className="flex-1 h-px bg-gradient-to-r from-transparent via-purple-200 to-transparent dark:via-purple-800" />
                  </div>
                  <div className="flex flex-row gap-4 w-full justify-center items-center mt-4">
                    <Button
                      type="button"
                      size="lg"
                      className="w-56 h-14 text-base rounded-xl bg-white/60 backdrop-blur-md border border-blue-200 shadow-lg font-bold flex items-center justify-center gap-2 hover:bg-white/80 hover:border-blue-400 hover:shadow-xl transition-all duration-200 focus-visible:ring-2 focus-visible:ring-blue-400"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={advancedOpen && selectedEngines.length === 0}
                    >
                      <FileUp className="w-6 h-6 text-blue-600" strokeWidth={2} />
                      <span className="font-bold text-base bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Files</span>
                    </Button>
                    <Popover open={advancedOpen} onOpenChange={setAdvancedOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          size="lg"
                          className="w-56 h-14 text-base rounded-xl bg-white/60 backdrop-blur-md border border-blue-200 shadow-lg font-bold flex items-center justify-center gap-2 hover:bg-white/80 hover:border-blue-400 hover:shadow-xl transition-all duration-200 focus-visible:ring-2 focus-visible:ring-blue-400"
                          aria-expanded={advancedOpen}
                        >
                          <Sliders className="h-6 w-6 text-blue-600" strokeWidth={2} />
                          <span className="font-bold text-base bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Engines</span>
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
                  <input type="file" id="file-upload" className="hidden" onChange={handleFileSelect} accept="*/*" multiple={false} ref={fileInputRef} />
                  <div className="mt-12 grid grid-cols-3 gap-8 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center relative">
                        <div className="absolute inset-0 m-auto w-12 h-12 rounded-full bg-white opacity-40 blur-2xl z-0" />
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="url(#zap-gradient)" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 relative z-10">
                          <defs>
                            <linearGradient id="zap-gradient" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
                              <stop stopColor="#2563eb" />
                              <stop offset="1" stopColor="#7c3aed" />
                            </linearGradient>
                          </defs>
                          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                        </svg>
                      </div>
                      <span className="font-medium">Lightning Fast</span>
                      <span className="text-sm text-muted-foreground">Results in seconds</span>
                    </div>
                    <div className="flex flex-col items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center relative">
                        <div className="absolute inset-0 m-auto w-12 h-12 rounded-full bg-white opacity-40 blur-2xl z-0" />
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="url(#db-gradient)" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 relative z-10">
                          <defs>
                            <linearGradient id="db-gradient" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
                              <stop stopColor="#2563eb" />
                              <stop offset="1" stopColor="#7c3aed" />
                            </linearGradient>
                          </defs>
                          <ellipse cx="12" cy="5" rx="9" ry="3" />
                          <path d="M3 5v14c0 1.657 4.03 3 9 3s9-1.343 9-3V5" />
                          <path d="M3 12c0 1.657 4.03 3 9 3s9-1.343 9-3" />
                        </svg>
                      </div>
                      <span className="font-medium">30+ Engines</span>
                      <span className="text-sm text-muted-foreground">Comprehensive scanning</span>
                    </div>
                    <div className="flex flex-col items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center relative">
                        <div className="absolute inset-0 m-auto w-12 h-12 rounded-full bg-white opacity-40 blur-2xl z-0" />
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="url(#lock-gradient)" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 relative z-10">
                          <defs>
                            <linearGradient id="lock-gradient" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
                              <stop stopColor="#2563eb" />
                              <stop offset="1" stopColor="#7c3aed" />
                            </linearGradient>
                          </defs>
                          <rect x="3" y="11" width="18" height="11" rx="2" />
                          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </svg>
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
                </div>
              </div>
            </div>
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
                          <Badge variant={analysis.spoofed ? "destructive" : (analysis.threats > 0 ? "destructive" : "default") } className="text-sm px-3 py-1">
                            {analysis.spoofed
                              ? "Possible Threat: Spoofed Extension"
                              : analysis.threats > 0
                                ? `${analysis.threats} threats detected`
                                : "✓ Clean"}
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
                                      {/* Detection Summary Box */}
                                      <div className="mb-8">
                                        <div className="rounded-3xl bg-white/80 dark:bg-slate-900/80 shadow-2xl p-8 flex flex-col md:flex-row items-center gap-6 border border-gray-200 dark:border-gray-700 backdrop-blur-xl">
                                          <div className="flex-shrink-0 flex flex-col items-center gap-2">
                                            <span className={`inline-flex items-center justify-center w-16 h-16 rounded-full shadow-lg text-4xl ${analysis.spoofed ? 'bg-gradient-to-br from-red-500 to-red-700 text-white' : analysis.threats > 0 ? 'bg-gradient-to-br from-red-500 to-pink-500 text-white' : 'bg-gradient-to-br from-green-400 to-blue-500 text-white'}`}>
                                              {analysis.spoofed ? (
                                                // Shield-exclamation for spoofed
                                                <svg width="36" height="36" fill="none" viewBox="0 0 24 24"><path d="M12 3l7.53 4.36A2 2 0 0 1 21 8.92v6.16a2 2 0 0 1-1.47 1.56L12 21l-7.53-4.36A2 2 0 0 1 3 15.08V8.92a2 2 0 0 1 1.47-1.56L12 3Z" stroke="currentColor" strokeWidth="2"/><path d="M12 9v4m0 4h.01" stroke="currentColor" strokeWidth="2"/></svg>
                                              ) : analysis.threats > 0 ? (
                                                // Bug for threat detected
                                                <svg width="36" height="36" fill="none" viewBox="0 0 24 24"><path d="M19 7l-1.5 1.5M5 7l1.5 1.5M12 3v2m0 14v2m7-7h2M3 12H1m16.24 7.24l-1.42-1.42M7.76 19.24l1.42-1.42M12 8a4 4 0 0 1 4 4v4a4 4 0 0 1-8 0v-4a4 4 0 0 1 4-4Z" stroke="currentColor" strokeWidth="2"/></svg>
                                              ) : (
                                                // Shield-check for clean
                                                <svg width="36" height="36" fill="none" viewBox="0 0 24 24"><path d="M12 3l7.53 4.36A2 2 0 0 1 21 8.92v6.16a2 2 0 0 1-1.47 1.56L12 21l-7.53-4.36A2 2 0 0 1 3 15.08V8.92a2 2 0 0 1 1.47-1.56L12 3Z" stroke="currentColor" strokeWidth="2"/><path d="M9 12l2 2l4-4" stroke="currentColor" strokeWidth="2"/></svg>
                                              )}
                                            </span>
                                            <span className="font-bold text-lg mt-2">
                                              {analysis.spoofed ? 'Possible Spoofed File' : analysis.threats > 0 ? 'Threat Detected' : 'File is Clean'}
                                            </span>
                                          </div>
                                          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                              <div className="text-sm text-gray-500 dark:text-gray-400">File Name</div>
                                              <div className="font-semibold text-gray-900 dark:text-white break-words whitespace-pre-line" title={analysis.fileName}>{analysis.fileName}</div>
                                            </div>
                                            <div>
                                              <div className="text-sm text-gray-500 dark:text-gray-400">File Type</div>
                                              <div className="font-semibold text-gray-900 dark:text-white break-words whitespace-pre-line" title={analysis.fileType}>{getFriendlyFileType(analysis.fileType)}</div>
                                            </div>
                                            <div>
                                              <div className="text-sm text-gray-500 dark:text-gray-400">File Size</div>
                                              <div className="font-semibold text-gray-900 dark:text-white">{analysis.fileSize}</div>
                                            </div>
                                            <div>
                                              <div className="text-sm text-gray-500 dark:text-gray-400">Uploaded</div>
                                              <div className="font-semibold text-gray-900 dark:text-white">{analysis.uploadTime}</div>
                                            </div>
                                            {analysis.spoofed && (
                                              <div className="col-span-2">
                                                <div className="text-sm text-yellow-700 dark:text-yellow-300 font-semibold">Warning: File extension does not match detected file type. This is a possible spoofed or malicious file.</div>
                                              </div>
                                            )}
                                            {analysis.threats > 0 && !analysis.spoofed && (
                                              <div className="col-span-2">
                                                <div className="text-sm text-red-700 dark:text-red-300 font-semibold">Threats detected: {analysis.threats}</div>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                      {/* Glassmorphic AI Output Cards */}
                                      <div className="grid gap-6 md:grid-cols-2">
                                        {sections["Summary"] && (
                                          <div className="rounded-2xl bg-white/60 dark:bg-slate-900/60 shadow-xl p-6 backdrop-blur-md border border-gray-200 dark:border-gray-700 flex flex-col gap-2">
                                            <div className="flex items-center gap-2 mb-2">
                                              <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 text-white shadow-lg">
                                                <svg width="20" height="20" fill="none" viewBox="0 0 24 24"><path d="M12 20c4.418 0 8-4.03 8-8s-3.582-8-8-8-8 4.03-8 8 3.582 8 8 8Zm0-4a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" stroke="currentColor" strokeWidth="2"/></svg>
                                              </span>
                                              <span className="font-bold text-lg">Summary</span>
                                            </div>
                                            <div className="text-base text-gray-800 dark:text-gray-200 whitespace-pre-line">{sections["Summary"].join(" ")}</div>
                                          </div>
                                        )}
                                        {sections["Notable Findings"] && (
                                          <div className="rounded-2xl bg-white/60 dark:bg-slate-900/60 shadow-xl p-6 backdrop-blur-md border border-gray-200 dark:border-gray-700 flex flex-col gap-2">
                                            <div className="flex items-center gap-2 mb-2">
                                              <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-green-400 to-green-600 text-white shadow-lg">
                                                {/* Warning triangle for Notable Findings */}
                                                <svg width="20" height="20" fill="none" viewBox="0 0 24 24"><path d="M12 9v2m0 4h.01M10.29 3.86l-8.53 14.78A2 2 0 0 0 3.18 21h17.64a2 2 0 0 0 1.71-2.36l-8.53-14.78a2 2 0 0 0-3.42 0Z" stroke="currentColor" strokeWidth="2"/></svg>
                                              </span>
                                              <span className="font-bold text-lg">Notable Findings</span>
                                            </div>
                                            <ul className="list-disc pl-6 text-base text-gray-800 dark:text-gray-200">
                                              {analysis.spoofed && (
                                                <li className="text-red-600 font-semibold">File extension does not match detected file type. This is a possible spoofed or malicious file.</li>
                                              )}
                                              <li>File type: {analysis.fileType}</li>
                                              {sections["Notable Findings"].map((item, idx) => (
                                                <li key={idx}>{item}</li>
                                              ))}
                                            </ul>
                                          </div>
                                        )}
                                        {sections["What should you do?"] && (
                                          <div className="rounded-2xl bg-white/60 dark:bg-slate-900/60 shadow-xl p-6 backdrop-blur-md border border-gray-200 dark:border-gray-700 flex flex-col gap-2">
                                            <div className="flex items-center gap-2 mb-2">
                                              <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-green-400 to-blue-500 text-white shadow-lg">
                                                {/* Checkmark for What should you do? */}
                                                <svg width="20" height="20" fill="none" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2"/></svg>
                                              </span>
                                              <span className="font-bold text-lg">What should you do?</span>
                                            </div>
                                            <ul className="list-disc pl-6 text-base text-gray-800 dark:text-gray-200">
                                              {sections["What should you do?"].map((item, idx) => (
                                                <li key={idx}>{item}</li>
                                              ))}
                                            </ul>
                                          </div>
                                        )}
                                        {sections["Scan Results"] && (
                                          <div className="rounded-2xl bg-white/60 dark:bg-slate-900/60 shadow-xl p-6 backdrop-blur-md border border-gray-200 dark:border-gray-700 flex flex-col gap-2">
                                            <div className="flex items-center gap-2 mb-2">
                                              <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 text-white shadow-lg">
                                                {/* Info circle for Scan Results */}
                                                <svg width="20" height="20" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/><path d="M12 16v-4m0-4h.01" stroke="currentColor" strokeWidth="2"/></svg>
                                              </span>
                                              <span className="font-bold text-lg">Scan Results</span>
                                            </div>
                                            <ul className="list-disc pl-6 text-base text-gray-800 dark:text-gray-200">
                                              {sections["Scan Results"].map((item, idx) => (
                                                <li key={idx}>{item}</li>
                                              ))}
                                            </ul>
                                          </div>
                                        )}
                                      </div>
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
                                  {analysis.metadata.md5 || <span className="text-muted-foreground">Not available</span>}
                                </p>
                              </div>
                              <div className="space-y-2">
                                <label className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                                  SHA1
                                </label>
                                <p className="font-mono text-sm bg-gray-50 dark:bg-slate-800 p-3 rounded-lg break-all">
                                  {analysis.metadata.sha1 || <span className="text-muted-foreground">Not available</span>}
                                </p>
                              </div>
                              <div className="space-y-2">
                                <label className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                                  SHA256
                                </label>
                                <p className="font-mono text-sm bg-gray-50 dark:bg-slate-800 p-3 rounded-lg break-all">
                                  {analysis.metadata.sha256 || <span className="text-muted-foreground">Not available</span>}
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
                                  {analysis.behaviorAnalysis.events.map(function(event: any, idx: number) {
                                    return (
                                      <li key={idx} className="text-sm text-gray-800 dark:text-gray-200 bg-blue-50 dark:bg-blue-900/20 rounded p-2">
                                        <span className="font-mono text-xs text-blue-700 mr-2">{event.timestamp || idx}</span>
                                        {event.description || JSON.stringify(event)}
                                      </li>
                                    );
                                  })}
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
                                {analysis.metadata.relatedThreats.map(function(threat: any, idx: number) {
                                  return (
                                    <li key={idx} className="text-sm text-gray-800 dark:text-gray-200 bg-red-50 dark:bg-red-900/20 rounded p-2">
                                      {threat}
                                    </li>
                                  );
                                })}
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
    </>
  )
}
