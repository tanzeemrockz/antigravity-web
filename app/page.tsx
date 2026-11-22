"use client";

import React, { useState, useEffect, useRef } from "react";
import { marked } from "marked";
import hljs from "highlight.js";
import katex from "katex";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  thinking_content?: string | null;
  model?: string | null;
  duration?: number | null;
  created_at: number;
}

interface Conversation {
  id: string;
  title: string;
  model: string;
  effort: string;
  pinned: boolean;
  created_at: number;
  updated_at: number;
}

interface ModelOption {
  id: string;
  name: string;
  short_name: string;
  description: string;
  category: string;
}

interface UsageData {
  requests_today: number;
  tokens_today: number;
  model_distribution: Record<string, number>;
  quota_status: string;
  server_limits: {
    memory_used_mb: number;
    memory_total_mb: number;
    memory_percent: number;
    disk_used_gb: number;
    disk_total_gb: number;
    disk_percent: number;
  };
}

export default function Home() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputPrompt, setInputPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidePaneOpen, setIsSidePaneOpen] = useState(false);
  const [sidePaneTab, setSidePaneTab] = useState<"files" | "stats" | "logs">("stats");
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [isUsageModalOpen, setIsUsageModalOpen] = useState(false);

  // Models & Synchronized Effort
  const [availableModels, setAvailableModels] = useState<ModelOption[]>([]);
  const [activeModel, setActiveModel] = useState("gemini-3.8-flash-medium");
  const [activeEffort, setActiveEffort] = useState("medium");

  // Usage & Metrics
  const [usageData, setUsageData] = useState<UsageData | null>(null);
  const [statsData, setStatsData] = useState<any>(null);
  const [filesData, setFilesData] = useState<any[]>([]);
  const [logsData, setLogsData] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");

  // Speech Recognition & TTS
  const [isListening, setIsListening] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);

  // Thinking timer
  const [thinkingSeconds, setThinkingSeconds] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const modelDropdownRef = useRef<HTMLDivElement>(null);

  // Dismiss model dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(e.target as Node)) {
        setIsModelDropdownOpen(false);
      }
    };
    if (isModelDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isModelDropdownOpen]);

  // Code copy button event delegation (preserves SVG icons permanently)
  useEffect(() => {
    const handleCopy = (e: MouseEvent) => {
      const btn = (e.target as HTMLElement).closest(".code-copy-btn");
      if (!btn) return;
      const rawCode = btn.getAttribute("data-code");
      if (!rawCode) return;
      navigator.clipboard.writeText(decodeURIComponent(rawCode));
      const span = btn.querySelector(".copy-text");
      if (span) {
        span.textContent = "Copied!";
        setTimeout(() => {
          span.textContent = "Copy code";
        }, 2000);
      }
    };
    document.addEventListener("click", handleCopy);
    return () => document.removeEventListener("click", handleCopy);
  }, []);

  // Initialize marked with Full Developer Code Snippet Box
  useEffect(() => {
    const renderer = new marked.Renderer();
    renderer.code = function ({ text, lang }) {
      const validLang = lang || "text";
      const lines = text.split("\n");
      const lineNumbersHtml = lines.map((_, i) => `<div>${i + 1}</div>`).join("");
      const codeId = "code-" + Math.random().toString(36).substring(2, 9);

      let highlighted = text;
      try {
        if (hljs.getLanguage(validLang)) {
          highlighted = hljs.highlight(text, { language: validLang }).value;
        } else {
          highlighted = hljs.highlightAuto(text).value;
        }
      } catch (e) {
        highlighted = text;
      }

      return `
        <div class="code-box-wrapper">
          <div class="code-box-header">
            <span class="font-mono text-xs text-blue-400">${validLang}</span>
            <button type="button" data-code="${encodeURIComponent(
              text
            )}" class="code-copy-btn flex items-center gap-1.5 px-2.5 py-1 rounded hover:bg-gemini-border text-zinc-300 hover:text-white transition text-xs">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
              <span class="copy-text">Copy code</span>
            </button>
          </div>
          <div class="code-box-body">
            <div class="code-line-numbers">${lineNumbersHtml}</div>
            <div class="code-box-content">
              <pre><code id="${codeId}" class="hljs ${validLang}">${highlighted}</code></pre>
            </div>
          </div>
        </div>
      `;
    };
    marked.use({ renderer, breaks: true, gfm: true });
  }, []);

  // Fetch initial data
  useEffect(() => {
    loadModels();
    loadConversations();
    fetchUsage();
  }, []);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isGenerating]);

  // Thinking timer interval
  useEffect(() => {
    let interval: any = null;
    if (isGenerating) {
      setThinkingSeconds(0);
      interval = setInterval(() => {
        setThinkingSeconds((s) => s + 1);
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isGenerating]);

  const loadModels = async () => {
    try {
      const res = await fetch("/api/models");
      if (res.ok) {
        const data = await res.json();
        setAvailableModels(data);
      }
    } catch (e) {
      console.error("Error loading models", e);
    }
  };

  const loadConversations = async () => {
    try {
      const res = await fetch("/api/conversations");
      if (res.ok) {
        const data = await res.json();
        setConversations(data);
      }
    } catch (e) {
      console.error("Error loading conversations", e);
    }
  };

  const loadConversationMessages = async (cid: string) => {
    setActiveConversationId(cid);
    setIsSidebarOpen(false);
    try {
      const res = await fetch(`/api/conversations/${cid}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      }
    } catch (e) {
      console.error("Error loading messages", e);
    }
  };

  const fetchUsage = async () => {
    try {
      const res = await fetch("/api/usage");
      if (res.ok) {
        const data = await res.json();
        setUsageData(data);
      }
    } catch (e) {
      console.error("Error fetching usage", e);
    }
  };

  const fetchSidePaneData = async (tab: "files" | "stats" | "logs") => {
    setSidePaneTab(tab);
    try {
      if (tab === "stats") {
        const res = await fetch("/api/stats");
        if (res.ok) setStatsData(await res.json());
      } else if (tab === "files") {
        const res = await fetch("/api/workspace/files");
        if (res.ok) {
          const data = await res.json();
          setFilesData(data.files || []);
        }
      } else if (tab === "logs") {
        const res = await fetch("/api/logs");
        if (res.ok) {
          const data = await res.json();
          setLogsData(data.logs || "");
        }
      }
    } catch (err) {
      console.error("Failed to load sidepane tab:", err);
    }
  };

  // Synchronized Model & Effort Selection
  const handleSelectEffort = (eff: string) => {
    setActiveEffort(eff);
    if (eff === "high" || eff === "max") {
      if (activeModel === "gemini-3.8-flash-medium") {
        setActiveModel("gemini-3.8-flash-high");
      }
    } else if (eff === "low" || eff === "medium") {
      if (activeModel === "gemini-3.8-flash-high") {
        setActiveModel("gemini-3.8-flash-medium");
      }
    }
  };

  const handleSelectModel = (modelId: string) => {
    setActiveModel(modelId);
    if (modelId === "gemini-3.8-flash-high") {
      setActiveEffort("high");
    } else if (modelId === "gemini-3.8-flash-medium" && activeEffort === "high") {
      setActiveEffort("medium");
    }
    setIsModelDropdownOpen(false);
  };

  const handleSendPrompt = async (promptOverride?: string) => {
    const textToSend = (promptOverride || inputPrompt).trim();
    if (!textToSend || isGenerating) return;

    setInputPrompt("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    const userMessage: Message = {
      id: "usr-" + Date.now(),
      role: "user",
      content: textToSend,
      created_at: Math.floor(Date.now() / 1000),
    };
    setMessages((prev) => [...prev, userMessage]);
    setIsGenerating(true);

    // Safeguard effort & model compatibility
    let modelToSend = activeModel;
    let effortToSend = activeEffort;
    if (activeModel === "gemini-3.8-flash-medium" && (activeEffort === "high" || activeEffort === "max")) {
      modelToSend = "gemini-3.8-flash-high";
    } else if (activeModel === "gemini-3.8-flash-high" && (activeEffort === "low" || activeEffort === "medium")) {
      modelToSend = "gemini-3.8-flash-medium";
    }

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: textToSend,
          conversation_id: activeConversationId,
          model: modelToSend,
          effort: effortToSend,
        }),
      });

      const data = await res.json();
      if (data.conversation_id && !activeConversationId) {
        setActiveConversationId(data.conversation_id);
      }

      const assistantMessage: Message = {
        id: "ast-" + Date.now(),
        role: "assistant",
        content: data.response || "(Task completed, no output returned)",
        thinking_content: data.thinking,
        model: data.model || modelToSend,
        duration: data.duration,
        created_at: Math.floor(Date.now() / 1000),
      };

      setMessages((prev) => [...prev, assistantMessage]);
      loadConversations();
      fetchUsage();
    } catch (err: any) {
      const errorMessage: Message = {
        id: "err-" + Date.now(),
        role: "assistant",
        content: "Error communicating with Antigravity: " + err.message,
        created_at: Math.floor(Date.now() / 1000),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAbort = async () => {
    if (!activeConversationId) return;
    try {
      await fetch("/api/chat/abort", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversation_id: activeConversationId }),
      });
      setIsGenerating(false);
    } catch (e) {
      console.error("Failed to abort turn", e);
    }
  };

  const handleCreateNewChat = () => {
    setActiveConversationId(null);
    setMessages([]);
    setInputPrompt("");
    setIsSidebarOpen(false);
  };

  const handleDeleteConversation = async (cid: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Delete this conversation?")) return;
    try {
      await fetch(`/api/conversations/${cid}`, { method: "DELETE" });
      if (activeConversationId === cid) handleCreateNewChat();
      loadConversations();
    } catch (err) {
      alert("Error: " + err);
    }
  };

  const handleExportConversation = () => {
    if (messages.length === 0) return;
    const title = conversations.find((c) => c.id === activeConversationId)?.title || "Antigravity Chat";
    let md = `# ${title}\n\nExported on ${new Date().toLocaleString()}\n\n---\n\n`;
    messages.forEach((m) => {
      if (m.role === "user") {
        md += `### User\n${m.content}\n\n`;
      } else {
        md += `### Antigravity (${m.model || "Gemini"})\n`;
        if (m.thinking_content) {
          md += `> **Thought Process:**\n> ${m.thinking_content.replace(/\n/g, "\n> ")}\n\n`;
        }
        md += `${m.content}\n\n`;
      }
    });

    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `antigravity-chat-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleSpeechRecognition = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser. Please use Chrome on Android or Desktop.");
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    try {
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = "en-US";

      rec.onstart = () => setIsListening(true);
      rec.onresult = (e: any) => {
        const transcript = e.results[0][0].transcript;
        setInputPrompt((prev) => (prev ? prev + " " : "") + transcript);
      };
      rec.onerror = () => setIsListening(false);
      rec.onend = () => setIsListening(false);

      rec.start();
    } catch (err) {
      setIsListening(false);
      console.error("Speech recognition error:", err);
    }
  };

  const speakText = (msgId: string, text: string) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;

    if (window.speechSynthesis.speaking && speakingMessageId === msgId) {
      window.speechSynthesis.cancel();
      setSpeakingMessageId(null);
      return;
    }

    window.speechSynthesis.cancel();
    const cleanText = text.replace(/```[\s\S]*?```/g, "Code block omitted");
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.0;
    utterance.onend = () => setSpeakingMessageId(null);
    utterance.onerror = () => setSpeakingMessageId(null);

    setSpeakingMessageId(msgId);
    window.speechSynthesis.speak(utterance);
  };

  // Render LaTeX math + Markdown
  const renderFormattedMarkdown = (content: string) => {
    if (!content) return "";
    let processed = content;
    // Replace block math $$...$$
    processed = processed.replace(/\$\$([\s\S]+?)\$\$/g, (_, math) => {
      try {
        return `<div class="katex-block my-2 text-center overflow-x-auto py-1">${katex.renderToString(math.trim(), { displayMode: true, throwOnError: false })}</div>`;
      } catch {
        return `$$${math}$$`;
      }
    });
    // Replace inline math $...$
    processed = processed.replace(/(?<!\\)\$([^\$\n]+?)\$/g, (_, math) => {
      try {
        return katex.renderToString(math.trim(), { displayMode: false, throwOnError: false });
      } catch {
        return `$${math}$`;
      }
    });

    return marked.parse(processed) as string;
  };

  const currentModelName =
    availableModels.find((m) => m.id === activeModel)?.short_name || "Gemini 3.8 Flash";

  return (
    <div className="flex flex-col h-full bg-gemini-base text-[#e3e3e3] antialiased select-auto">
      {/* Mobile Sidebar Backdrop */}
      {isSidebarOpen && (
        <div
          onClick={() => setIsSidebarOpen(false)}
          className="fixed inset-0 bg-black/60 z-30 lg:hidden"
        />
      )}

      {/* Top Navigation Header */}
      <header className="h-14 border-b border-gemini-border/80 flex items-center justify-between px-3 sm:px-4 z-20 bg-gemini-base/95 backdrop-blur safe-top flex-shrink-0">
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Menu button */}
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            aria-label="Toggle menu"
            className="p-2 rounded-full text-zinc-400 hover:text-white hover:bg-gemini-surface transition"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {/* Model Switcher Dropdown */}
          <div className="relative" ref={modelDropdownRef}>
            <button
              type="button"
              onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full hover:bg-gemini-surface transition text-left group"
            >
              <div className="h-5 w-5 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 2C12 7.52285 7.52285 12 2 12C7.52285 12 12 16.4771 12 22C12 16.4771 16.4771 12 22 12C16.4771 12 12 7.52285 12 2Z"
                    fill="url(#gemini_grad)"
                  />
                  <defs>
                    <linearGradient id="gemini_grad" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
                      <stop stopColor="#4285F4" />
                      <stop offset="0.5" stopColor="#9B72CB" />
                      <stop offset="1" stopColor="#D96570" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>
              <span className="text-xs sm:text-sm font-medium text-white tracking-tight">{currentModelName}</span>
              <svg className="w-3.5 h-3.5 text-zinc-400 group-hover:text-white transition-transform" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Model Dropdown Menu */}
            {isModelDropdownOpen && (
              <div className="absolute left-0 mt-2 w-72 sm:w-80 bg-gemini-surface border border-gemini-border rounded-2xl shadow-2xl p-2 z-50">
                <div className="px-3 py-2 text-xs font-medium text-zinc-400 border-b border-gemini-border/60">
                  Select Model
                </div>
                <div className="p-1 space-y-1" role="menu">
                  {availableModels.map((m) => {
                    const isSelected = m.id === activeModel;
                    return (
                      <button
                        type="button"
                        role="menuitem"
                        key={m.id}
                        onClick={() => handleSelectModel(m.id)}
                        className={`w-full p-2 rounded-xl cursor-pointer transition text-left flex items-center justify-between ${
                          isSelected ? "bg-gemini-border text-white" : "hover:bg-gemini-border/50 text-zinc-300"
                        }`}
                      >
                        <div>
                          <div className="text-xs font-medium">{m.name}</div>
                          <div className="text-[11px] text-zinc-400">{m.description}</div>
                        </div>
                        {isSelected && <span className="h-2 w-2 rounded-full bg-blue-400 ml-2"></span>}
                      </button>
                    );
                  })}
                </div>

                {/* Reasoning Effort Selector */}
                <div className="px-3 pt-2 pb-1 border-t border-gemini-border/60 flex items-center justify-between">
                  <span className="text-xs text-zinc-400">Reasoning Effort</span>
                  <div className="flex items-center gap-1">
                    {["low", "medium", "high", "max"].map((eff) => (
                      <button
                        type="button"
                        key={eff}
                        onClick={() => handleSelectEffort(eff)}
                        className={`px-2 py-0.5 rounded text-[11px] font-medium capitalize transition ${
                          activeEffort === eff
                            ? "bg-gemini-blue text-white"
                            : "text-zinc-400 hover:text-white"
                        }`}
                      >
                        {eff === "medium" ? "Med" : eff}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Header Controls */}
        <div className="flex items-center gap-1 sm:gap-2">
          {/* Side Pane Drawer Toggle (Files, Stats, Logs) */}
          <button
            type="button"
            onClick={() => {
              if (!isSidePaneOpen) fetchSidePaneData(sidePaneTab);
              setIsSidePaneOpen(!isSidePaneOpen);
            }}
            title="Inspect Environment"
            className={`p-2 rounded-full transition ${
              isSidePaneOpen ? "bg-gemini-border text-blue-400" : "text-zinc-400 hover:text-white hover:bg-gemini-surface"
            }`}
          >
            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
          </button>

          {/* Export conversation */}
          {messages.length > 0 && (
            <button
              type="button"
              onClick={handleExportConversation}
              title="Export Conversation"
              className="p-2 rounded-full text-zinc-400 hover:text-white hover:bg-gemini-surface transition"
            >
              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </button>
          )}

          {/* Usage Monitor Pill */}
          <button
            type="button"
            onClick={() => {
              fetchUsage();
              setIsUsageModalOpen(true);
            }}
            title="View Usage & Limits"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-gemini-surface hover:bg-gemini-border border border-gemini-border/60 text-xs text-zinc-300 transition"
          >
            <span
              className={`h-2 w-2 rounded-full ${
                usageData?.quota_status === "healthy"
                  ? "bg-emerald-400"
                  : usageData?.quota_status === "warning"
                  ? "bg-amber-400"
                  : "bg-rose-400"
              }`}
            ></span>
            <span className="text-[11px] font-medium">{usageData?.requests_today ?? 0} req</span>
          </button>

          {/* New Chat Button */}
          <button
            type="button"
            onClick={handleCreateNewChat}
            title="New Chat"
            className="p-2 rounded-full text-zinc-400 hover:text-white hover:bg-gemini-surface transition"
          >
            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
      </header>

      {/* Main Body */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Collapsible Sidebar */}
        <aside
          aria-hidden={!isSidebarOpen}
          inert={!isSidebarOpen ? true : undefined}
          className={`fixed lg:static inset-y-0 left-0 z-40 w-72 bg-[#18191a] border-r border-gemini-border flex flex-col transition-transform duration-300 ${
            isSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
          }`}
        >
          <div className="p-3 border-b border-gemini-border/70 flex flex-col gap-2.5">
            {/* Mobile Header with close button */}
            <div className="flex items-center justify-between lg:hidden pb-1">
              <span className="text-xs font-semibold text-zinc-400">Conversations</span>
              <button
                type="button"
                onClick={() => setIsSidebarOpen(false)}
                className="p-1 rounded-full text-zinc-400 hover:text-white hover:bg-gemini-surface transition"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <button
              type="button"
              onClick={handleCreateNewChat}
              className="w-full flex items-center justify-between px-3.5 py-2 rounded-full bg-gemini-surface hover:bg-gemini-border text-sm font-medium text-white transition"
            >
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                New Chat
              </span>
              <span className="hidden lg:inline text-[11px] text-zinc-400 font-mono">Ctrl+K</span>
            </button>

            {/* Live Search */}
            <div className="relative">
              <svg className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search conversations..."
                className="w-full bg-gemini-surface border border-gemini-border/60 rounded-full pl-9 pr-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition"
              />
            </div>
          </div>

          {/* Conversations list */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {conversations
              .filter((c) => c.title.toLowerCase().includes(searchQuery.toLowerCase()))
              .map((c) => {
                const isActive = c.id === activeConversationId;
                return (
                  <div
                    key={c.id}
                    onClick={() => loadConversationMessages(c.id)}
                    className={`group flex items-center justify-between px-3 py-2 rounded-full text-xs cursor-pointer transition ${
                      isActive ? "bg-gemini-surface text-white font-medium" : "text-zinc-400 hover:bg-gemini-surface hover:text-white"
                    }`}
                  >
                    <span className="truncate flex-1 mr-2">{c.title || "Untitled"}</span>
                    <button
                      type="button"
                      onClick={(e) => handleDeleteConversation(c.id, e)}
                      title="Delete"
                      className="opacity-0 group-hover:opacity-100 p-1 text-zinc-400 hover:text-rose-400 transition"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                );
              })}
          </div>

          <div className="p-3 border-t border-gemini-border/70 bg-[#161718] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400"></span>
              <span className="text-xs text-zinc-300 font-medium">Nest 24/7 Active</span>
            </div>
            <button
              type="button"
              onClick={() => {
                fetchUsage();
                setIsUsageModalOpen(true);
              }}
              className="text-xs text-blue-400 hover:underline"
            >
              Usage
            </button>
          </div>
        </aside>

        {/* Chat Feed */}
        <main className="flex-1 flex flex-col h-full bg-gemini-base relative overflow-hidden">
          <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-4 sm:py-6 scroll-smooth">
            {/* Welcome view when empty */}
            {messages.length === 0 && (
              <div className="max-w-2xl mx-auto py-8 sm:py-16 flex flex-col items-start">
                <h1 className="text-3xl sm:text-5xl font-semibold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-purple-300 to-rose-300 mb-2">
                  Hello, Tanzeem
                </h1>
                <p className="text-xl sm:text-3xl text-zinc-400 font-normal mb-6 sm:mb-10">
                  How can I help you today?
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                  {[
                    { title: "Check Nest Environment", desc: "Review RAM, CPU usage, and system services", p: "Inspect the Nest system memory, CPU load, and running services." },
                    { title: "Explore Project Files", desc: "Browse bridge.py, SQLite storage, and system units", p: "Explore the files in /root/slack-agy-bridge and summarize the architecture." },
                    { title: "Inspect Slack Bridge", desc: "View real-time Socket Mode status and messages", p: "Check the latest logs from the Slack bridge service." },
                    { title: "Write Python Automation", desc: "Generate script with cron schedule and error handling", p: "Write a clean Python script to automate database backups." },
                  ].map((card, i) => (
                    <button
                      type="button"
                      key={i}
                      onClick={() => handleSendPrompt(card.p)}
                      className="p-4 rounded-2xl bg-gemini-surface hover:bg-gemini-border/80 border border-gemini-border/70 text-left transition group"
                    >
                      <div className="text-sm font-medium text-white group-hover:text-blue-400 mb-1">{card.title}</div>
                      <div className="text-xs text-zinc-400">{card.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Messages */}
            <div className="max-w-3xl mx-auto w-full space-y-6 pb-36">
              {messages.map((m, idx) => {
                if (m.role === "user") {
                  return (
                    <div key={m.id} className="flex justify-end">
                      <div className="max-w-[85%] sm:max-w-[75%] rounded-[24px] bg-gemini-bubble px-4 py-3 text-white shadow-sm group">
                        <div className="whitespace-pre-wrap text-sm leading-relaxed">{m.content}</div>
                        <div className="flex items-center justify-end gap-2 mt-2 pt-1 border-t border-zinc-700/50 text-[10px] text-zinc-400">
                          <span>{new Date(m.created_at * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                          <button
                            type="button"
                            onClick={() => {
                              setInputPrompt(m.content);
                              textareaRef.current?.focus();
                            }}
                            title="Edit prompt"
                            className="opacity-0 group-hover:opacity-100 hover:text-white transition"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                } else {
                  return (
                    <div key={m.id} className="flex items-start gap-3 sm:gap-4">
                      <div className="h-7 w-7 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
                          <path
                            d="M12 2C12 7.52285 7.52285 12 2 12C7.52285 12 12 16.4771 12 22C12 16.4771 16.4771 12 22 12C16.4771 12 12 7.52285 12 2Z"
                            fill="url(#gemini_grad)"
                          />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5 text-xs text-zinc-400 font-medium">
                          <span className="text-white">{m.model || "Antigravity"}</span>
                          {m.duration && <span className="text-zinc-500 font-mono">· {m.duration}s</span>}
                        </div>

                        {/* Collapsible Thought Process */}
                        {m.thinking_content && (
                          <details className="mb-3 bg-gemini-surface border border-gemini-border rounded-2xl overflow-hidden group">
                            <summary className="flex items-center gap-2 px-3 py-2 text-xs font-mono text-zinc-400 hover:text-white cursor-pointer select-none">
                              <svg className="w-3.5 h-3.5 transform transition-transform group-open:rotate-90 text-blue-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                              </svg>
                              <span>Thought process</span>
                            </summary>
                            <div className="p-3 text-xs text-zinc-300 font-mono border-t border-gemini-border bg-[#141416] whitespace-pre-wrap leading-relaxed">
                              {m.thinking_content}
                            </div>
                          </details>
                        )}

                        <div
                          className="prose-gemini"
                          dangerouslySetInnerHTML={{ __html: renderFormattedMarkdown(m.content || "") }}
                        />

                        {/* Action buttons */}
                        <div className="flex items-center gap-3 mt-3 pt-2 text-xs text-zinc-400">
                          {/* Copy */}
                          <button
                            type="button"
                            onClick={() => navigator.clipboard.writeText(m.content)}
                            title="Copy text"
                            className="flex items-center gap-1 hover:text-white transition"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                            <span>Copy</span>
                          </button>

                          {/* Audio TTS */}
                          <button
                            type="button"
                            onClick={() => speakText(m.id, m.content)}
                            title="Read aloud"
                            className={`flex items-center gap-1 transition ${
                              speakingMessageId === m.id ? "text-blue-400 animate-pulse font-medium" : "hover:text-white"
                            }`}
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                            </svg>
                            <span>{speakingMessageId === m.id ? "Speaking..." : "Audio"}</span>
                          </button>

                          {/* Retry previous prompt */}
                          {idx > 0 && messages[idx - 1]?.role === "user" && (
                            <button
                              type="button"
                              onClick={() => handleSendPrompt(messages[idx - 1].content)}
                              title="Retry generation"
                              className="flex items-center gap-1 hover:text-white transition"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                              </svg>
                              <span>Retry</span>
                            </button>
                          )}

                          <span className="ml-auto text-[10px] text-zinc-500 font-mono">
                            {new Date(m.created_at * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                }
              })}

              {/* Generating Thinking Indicator */}
              {isGenerating && (
                <div className="flex items-start gap-3 sm:gap-4">
                  <div className="h-7 w-7 rounded-full flex items-center justify-center flex-shrink-0 mt-1 animate-pulse">
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M12 2C12 7.52285 7.52285 12 2 12C7.52285 12 12 16.4771 12 22C12 16.4771 16.4771 12 22 12C16.4771 12 12 7.52285 12 2Z"
                        fill="url(#gemini_grad)"
                      />
                    </svg>
                  </div>
                  <div className="bg-gemini-surface border border-gemini-border rounded-2xl px-4 py-2.5 flex items-center gap-2.5 text-xs text-zinc-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse"></span>
                    <span className="font-mono">Thinking ({thinkingSeconds}s)...</span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Docked Bottom Capsule (Mobile-Optimized) */}
          <div className="flex-shrink-0 w-full bg-gradient-to-t from-gemini-base via-gemini-base/95 to-transparent pt-3 pb-2 px-3 sm:px-6 safe-bottom z-10">
            <div className="max-w-3xl mx-auto w-full">
              <div className="bg-gemini-surface border border-gemini-border rounded-[28px] p-2.5 sm:p-3 shadow-2xl transition-all focus-within:border-blue-500/70">
                <textarea
                  ref={textareaRef}
                  rows={1}
                  value={inputPrompt}
                  onChange={(e) => {
                    setInputPrompt(e.target.value);
                    e.target.style.height = "auto";
                    e.target.style.height = Math.min(e.target.scrollHeight, 180) + "px";
                  }}
                  onKeyDown={(e) => {
                    const isTouchOrMobile =
                      typeof window !== "undefined" &&
                      ("ontouchstart" in window || window.innerWidth < 768);

                    if (e.key === "Enter" && !e.shiftKey) {
                      if (isTouchOrMobile) {
                        // Allow mobile virtual keyboard Enter to insert a newline
                        return;
                      }
                      e.preventDefault();
                      handleSendPrompt();
                    }
                  }}
                  placeholder="Ask Antigravity..."
                  className="w-full bg-transparent text-base sm:text-sm text-white placeholder-zinc-500 px-3 py-1.5 resize-none focus:outline-none max-h-48 overflow-y-auto leading-relaxed"
                />

                <div className="flex items-center justify-between pt-1 px-1">
                  <div className="flex items-center gap-1.5">
                    {/* Speech Recognition Mic */}
                    <button
                      type="button"
                      onClick={toggleSpeechRecognition}
                      title="Voice input"
                      className={`p-2 rounded-full transition ${
                        isListening
                          ? "bg-rose-500 text-white animate-pulse"
                          : "text-zinc-400 hover:text-white hover:bg-gemini-border"
                      }`}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                      </svg>
                    </button>
                    <span className="text-[11px] text-zinc-500 hidden sm:inline">
                      Enter to send · Shift+Enter for newline
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* Send / Stop button */}
                    <button
                      type="button"
                      onClick={() => (isGenerating ? handleAbort() : handleSendPrompt())}
                      className="h-8 w-8 rounded-full bg-white hover:bg-zinc-200 text-black flex items-center justify-center transition shadow-md"
                    >
                      {isGenerating ? (
                        <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                          <rect x="5" y="5" width="14" height="14" rx="2" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <div className="text-center text-[11px] text-zinc-500 mt-2">
                Antigravity can make mistakes. Verify important system actions.
              </div>
            </div>
          </div>
        </main>

        {/* Auxiliary Side Pane (Files, Stats, Logs) */}
        {isSidePaneOpen && (
          <aside className="fixed inset-y-0 right-0 z-40 w-80 sm:w-96 bg-[#18191a] border-l border-gemini-border flex flex-col shadow-2xl safe-top">
            <div className="p-3 border-b border-gemini-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-white">Nest Inspector</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                  Online
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsSidePaneOpen(false)}
                className="p-1 rounded-full text-zinc-400 hover:text-white"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gemini-border text-xs">
              {(["stats", "files", "logs"] as const).map((t) => (
                <button
                  type="button"
                  key={t}
                  onClick={() => fetchSidePaneData(t)}
                  className={`flex-1 py-2 font-medium capitalize text-center transition ${
                    sidePaneTab === t ? "text-blue-400 border-b-2 border-blue-400 bg-gemini-surface/50" : "text-zinc-400 hover:text-white"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* Tab Body */}
            <div className="flex-1 overflow-y-auto p-3 text-xs font-mono">
              {sidePaneTab === "stats" && (
                <div className="space-y-3">
                  <div className="bg-gemini-surface border border-gemini-border rounded-xl p-3">
                    <div className="text-zinc-400 text-[11px] mb-1">Server Host</div>
                    <div className="text-white font-semibold">tanzeemrockz@hackclub.app</div>
                  </div>
                  <div className="bg-gemini-surface border border-gemini-border rounded-xl p-3">
                    <div className="text-zinc-400 text-[11px] mb-1">RAM (2048 MB limit)</div>
                    <div className="text-emerald-400 font-semibold">{statsData?.memory_used || "120 MB / 2048 MB"}</div>
                  </div>
                  <div className="bg-gemini-surface border border-gemini-border rounded-xl p-3">
                    <div className="text-zinc-400 text-[11px] mb-1">Systemd Services</div>
                    <div className="text-white space-y-1 text-[11px]">
                      <div>slack-bridge.service: active (running)</div>
                      <div>slack-dashboard.service: active (running)</div>
                      <div>cloudflared-tunnel.service: active (running)</div>
                    </div>
                  </div>
                </div>
              )}

              {sidePaneTab === "files" && (
                <div className="space-y-1">
                  {filesData.length === 0 ? (
                    <div className="text-zinc-500 py-4 text-center">Loading files...</div>
                  ) : (
                    filesData.map((f, i) => (
                      <div key={i} className="flex items-center gap-2 p-1.5 rounded hover:bg-gemini-surface text-zinc-300">
                        <svg className="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                        <span className="truncate flex-1">{f.name || f}</span>
                        <span className="text-[10px] text-zinc-500">{f.size || ""}</span>
                      </div>
                    ))
                  )}
                </div>
              )}

              {sidePaneTab === "logs" && (
                <div className="bg-[#121214] p-2 rounded-xl border border-gemini-border text-[11px] text-zinc-300 whitespace-pre-wrap leading-relaxed max-h-full overflow-x-auto">
                  {logsData || "Waiting for recent system logs..."}
                </div>
              )}
            </div>
          </aside>
        )}
      </div>

      {/* Usage Limit & Quota Modal */}
      {isUsageModalOpen && usageData && (
        <div
          onClick={() => setIsUsageModalOpen(false)}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-gemini-surface border border-gemini-border rounded-3xl w-full max-w-lg p-5 shadow-2xl flex flex-col gap-4 cursor-default"
          >
            <div className="flex items-center justify-between border-b border-gemini-border pb-3">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400"></span>
                <h3 className="text-base font-semibold text-white">Usage & Quota Monitor</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsUsageModalOpen(false)}
                className="p-1 rounded-full text-zinc-400 hover:text-white"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="bg-gemini-base border border-gemini-border rounded-2xl p-3.5">
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-zinc-400 font-medium">Daily Request Volume</span>
                  <span className="font-mono text-white font-semibold">{usageData.requests_today} turns</span>
                </div>
                <div className="h-2 rounded-full bg-gemini-surface overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full"
                    style={{ width: `${Math.min((usageData.requests_today / 100) * 100, 100)}%` }}
                  />
                </div>
              </div>

              <div className="bg-gemini-base border border-gemini-border rounded-2xl p-3.5 flex justify-between items-center">
                <div>
                  <div className="text-zinc-400">Estimated Tokens Today</div>
                  <div className="text-lg font-semibold text-white font-mono mt-0.5">
                    ~{usageData.tokens_today.toLocaleString()}
                  </div>
                </div>
                <div
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium ${
                    usageData.quota_status === "healthy"
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                      : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                  }`}
                >
                  {usageData.quota_status === "healthy" ? "Quota Normal" : "Rate Limited"}
                </div>
              </div>

              <div className="bg-gemini-base border border-gemini-border rounded-2xl p-3.5 space-y-2.5">
                <div className="text-zinc-400 font-medium">Nest Container Limits</div>
                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-zinc-400">RAM Limit</span>
                    <span className="font-mono text-zinc-200">
                      {usageData.server_limits.memory_used_mb}MB / {usageData.server_limits.memory_total_mb}MB ({usageData.server_limits.memory_percent}%)
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-gemini-surface overflow-hidden">
                    <div
                      className="h-full bg-purple-500 rounded-full"
                      style={{ width: `${usageData.server_limits.memory_percent}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-zinc-400">Disk Storage</span>
                    <span className="font-mono text-zinc-200">
                      {usageData.server_limits.disk_used_gb}GB / {usageData.server_limits.disk_total_gb}GB
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-gemini-surface overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full"
                      style={{ width: `${usageData.server_limits.disk_percent}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-gemini-border flex justify-end">
              <button
                type="button"
                onClick={() => setIsUsageModalOpen(false)}
                className="px-4 py-2 rounded-full bg-white text-black font-medium text-xs hover:bg-zinc-200 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
