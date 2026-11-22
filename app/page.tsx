"use client";

import React, { useState, useEffect, useRef } from "react";
import { marked } from "marked";
import hljs from "highlight.js";
import katex from "katex";

interface AssistantVersion {
  content: string;
  thinking_content?: string | null;
  model?: string | null;
  duration?: number | null;
  created_at: number;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  thinking_content?: string | null;
  model?: string | null;
  duration?: number | null;
  created_at: number;
  versions?: AssistantVersion[];
  activeVersionIndex?: number;
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

type SidePaneTab = "terminal" | "mcp" | "skills" | "stats" | "files" | "logs";

export default function Home() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputPrompt, setInputPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidePaneOpen, setIsSidePaneOpen] = useState(false);
  const [sidePaneTab, setSidePaneTab] = useState<SidePaneTab>("terminal");
  const [sidePaneLoading, setSidePaneLoading] = useState(false);
  const [sidePaneError, setSidePaneError] = useState<string | null>(null);
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [isUsageModalOpen, setIsUsageModalOpen] = useState(false);
  const [conversationToDelete, setConversationToDelete] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [isSlashMenuOpen, setIsSlashMenuOpen] = useState(false);

  // Authentication State (Saved on Nest)
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [currentUser, setCurrentUser] = useState<{ email: string } | null>(null);
  const [loginEmail, setLoginEmail] = useState("imohamedtanzeem@gmail.com");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Terminal & MCP & Skills
  const [terminalCommand, setTerminalCommand] = useState("");
  const [terminalHistory, setTerminalHistory] = useState<
    Array<{ command: string; stdout: string; stderr: string; exit_code: number; duration: number }>
  >([
    {
      command: "uptime; whoami; agy --version",
      stdout: "Linux tanzeemrockz 7.0.14-26-pve x86_64\nuser: root (tanzeemrockz@hackclub.app)\nagy: 1.5.14 (Nest 24/7 service active)",
      stderr: "",
      exit_code: 0,
      duration: 0.01,
    },
  ]);
  const [isExecutingCommand, setIsExecutingCommand] = useState(false);
  const [commandHistoryList, setCommandHistoryList] = useState<string[]>([]);
  const [historyNavIndex, setHistoryNavIndex] = useState(-1);
  const [mcpServers, setMcpServers] = useState<any[]>([]);
  const [skillsList, setSkillsList] = useState<any[]>([]);

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

  // Speech Recognition & TTS & Copy feedback
  const [isListening, setIsListening] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [exportNotice, setExportNotice] = useState(false);

  // Thinking timer
  const [thinkingSeconds, setThinkingSeconds] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const modelDropdownRef = useRef<HTMLDivElement>(null);
  const terminalBottomRef = useRef<HTMLDivElement>(null);
  const isGeneratingRef = useRef(false);
  const currentPromptAbortControllerRef = useRef<AbortController | null>(null);
  const conversationAbortControllerRef = useRef<AbortController | null>(null);
  const activeConversationIdRef = useRef<string | null>(null);

  // Detect mobile viewport for accessibility and touch ergonomics
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

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

  // Code copy button event delegation with async write & feedback
  useEffect(() => {
    const handleCopy = async (e: MouseEvent) => {
      const btn = (e.target as HTMLElement).closest(".code-copy-btn");
      if (!btn) return;
      const rawCode = btn.getAttribute("data-code");
      if (!rawCode) return;
      const span = btn.querySelector(".copy-text");
      try {
        await navigator.clipboard.writeText(decodeURIComponent(rawCode));
        btn.classList.add("is-copied");
        if (span) {
          span.textContent = "Copied!";
          setTimeout(() => {
            span.textContent = "Copy code";
            btn.classList.remove("is-copied");
          }, 2000);
        }
      } catch {
        btn.classList.add("is-copy-failed");
        if (span) {
          span.textContent = "Failed";
          setTimeout(() => {
            span.textContent = "Copy code";
            btn.classList.remove("is-copy-failed");
          }, 2000);
        }
      }
    };
    document.addEventListener("click", handleCopy);
    return () => document.removeEventListener("click", handleCopy);
  }, []);

  // Escape untrusted HTML entities
  const escapeHtml = (str: string) =>
    str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  // Initialize marked with Full Developer Code Snippet Box
  useEffect(() => {
    const renderer = new marked.Renderer();
    renderer.code = function ({ text, lang }) {
      const validLang = (lang || "text").replace(/[^a-zA-Z0-9_\-\.]/g, "");
      const lines = text.split("\n");
      const lineNumbersHtml = lines.map((_, i) => `<div>${i + 1}</div>`).join("");
      const codeId = "code-" + Math.random().toString(36).substring(2, 9);

      let highlighted = "";
      try {
        if (hljs.getLanguage(validLang)) {
          highlighted = hljs.highlight(text, { language: validLang }).value;
        } else {
          highlighted = hljs.highlightAuto(text).value;
        }
      } catch {
        highlighted = escapeHtml(text);
      }

      return `
        <div class="code-box-wrapper">
          <div class="code-box-header">
            <span class="font-mono text-xs text-blue-400">${validLang}</span>
            <button type="button" aria-label="Copy code" data-code="${encodeURIComponent(
              text
            )}" class="code-copy-btn flex items-center gap-1.5 px-2.5 py-1 rounded hover:bg-gemini-border text-zinc-300 hover:text-white transition text-xs touch-manipulation">
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

  // Smart scroll: only scroll if already near bottom
  useEffect(() => {
    if (!chatContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 200;
    if (isNearBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
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
    activeConversationIdRef.current = cid;
    setIsSidebarOpen(false);

    if (conversationAbortControllerRef.current) {
      conversationAbortControllerRef.current.abort();
    }
    const controller = new AbortController();
    conversationAbortControllerRef.current = controller;

    try {
      const res = await fetch(`/api/conversations/${cid}`, { signal: controller.signal });
      if (res.ok && activeConversationIdRef.current === cid) {
        const data = await res.json();
        setMessages(data.messages || []);
      }
    } catch (e: any) {
      if (e.name !== "AbortError") {
        console.error("Error loading messages", e);
      }
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

  // Check auth session on startup
  useEffect(() => {
    const checkAuth = async () => {
      const token = typeof window !== "undefined" ? localStorage.getItem("agy_session_token") : null;
      if (!token) {
        setIsAuthenticated(false);
        return;
      }
      try {
        const res = await fetch("/api/auth/verify", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (data.authenticated) {
            setIsAuthenticated(true);
            setCurrentUser(data.user || { email: "imohamedtanzeem@gmail.com" });
            loadModels();
            loadConversations();
            fetchUsage();
            return;
          }
        }
        setIsAuthenticated(false);
      } catch {
        // Fallback for offline or cached token
        setIsAuthenticated(true);
        setCurrentUser({ email: "imohamedtanzeem@gmail.com" });
        loadModels();
        loadConversations();
        fetchUsage();
      }
    };
    checkAuth();
  }, []);

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!loginEmail || !loginPassword) {
      setLoginError("Please enter your email and password.");
      return;
    }
    setLoginLoading(true);
    setLoginError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Authentication failed. Check your password.");
      }
      localStorage.setItem("agy_session_token", data.token);
      setCurrentUser(data.user || { email: loginEmail });
      setIsAuthenticated(true);
      loadModels();
      loadConversations();
      fetchUsage();
    } catch (err: any) {
      setLoginError(err.message || "Failed to sign in. Verify credentials.");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = async () => {
    const token = typeof window !== "undefined" ? localStorage.getItem("agy_session_token") : null;
    if (token) {
      try {
        await fetch("/api/auth/logout", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });
      } catch {}
    }
    localStorage.removeItem("agy_session_token");
    setIsAuthenticated(false);
    setCurrentUser(null);
  };

  const handleExecuteTerminalCommand = async (cmdToRun?: string) => {
    const cmd = (cmdToRun ?? terminalCommand).trim();
    if (!cmd || isExecutingCommand) return;
    setTerminalCommand("");
    setIsExecutingCommand(true);
    setCommandHistoryList((prev) => [cmd, ...prev]);
    setHistoryNavIndex(-1);

    try {
      const res = await fetch("/api/terminal/exec", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: cmd, cwd: "/root" }),
      });
      const data = await res.json();
      setTerminalHistory((prev) => [
        ...prev,
        {
          command: cmd,
          stdout: data.stdout || "",
          stderr: data.stderr || "",
          exit_code: data.exit_code ?? 0,
          duration: data.duration ?? 0,
        },
      ]);
    } catch (err: any) {
      setTerminalHistory((prev) => [
        ...prev,
        {
          command: cmd,
          stdout: "",
          stderr: err.message || "Failed to connect to terminal endpoint",
          exit_code: 1,
          duration: 0,
        },
      ]);
    } finally {
      setIsExecutingCommand(false);
      setTimeout(() => {
        terminalBottomRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 50);
    }
  };

  const fetchSidePaneData = async (tab: SidePaneTab) => {
    setSidePaneTab(tab);
    setSidePaneLoading(true);
    setSidePaneError(null);
    try {
      if (tab === "stats") {
        const res = await fetch("/api/stats");
        if (!res.ok) throw new Error(`Stats endpoint returned status ${res.status}`);
        setStatsData(await res.json());
      } else if (tab === "files") {
        const res = await fetch("/api/workspace/files");
        if (!res.ok) throw new Error(`Files endpoint returned status ${res.status}`);
        const data = await res.json();
        setFilesData(data.files || []);
      } else if (tab === "logs") {
        const res = await fetch("/api/logs");
        if (!res.ok) throw new Error(`Logs endpoint returned status ${res.status}`);
        const data = await res.json();
        setLogsData(data.logs || "");
      } else if (tab === "mcp") {
        const res = await fetch("/api/mcp/list");
        if (!res.ok) throw new Error(`MCP endpoint returned status ${res.status}`);
        const data = await res.json();
        setMcpServers(data.servers || []);
      } else if (tab === "skills") {
        const res = await fetch("/api/skills/list");
        if (!res.ok) throw new Error(`Skills endpoint returned status ${res.status}`);
        const data = await res.json();
        setSkillsList(data.skills || []);
      }
    } catch (err: any) {
      setSidePaneError(err.message || "Failed to load data");
    } finally {
      setSidePaneLoading(false);
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
    } else if (modelId === "gemini-3.8-flash-medium") {
      if (activeEffort === "high" || activeEffort === "max") {
        setActiveEffort("medium");
      }
    }
    setIsModelDropdownOpen(false);
  };

  // Switch between branched turns
  const handleSwitchVersion = (msgId: string, newIdx: number) => {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== msgId || !m.versions || !m.versions[newIdx]) return m;
        const v = m.versions[newIdx];
        return {
          ...m,
          content: v.content,
          thinking_content: v.thinking_content,
          model: v.model,
          duration: v.duration,
          activeVersionIndex: newIdx,
        };
      })
    );
  };

  const handleSendPrompt = async (
    promptOverride?: string,
    retryAssistantMessageId?: string
  ) => {
    const textToSend = (promptOverride || inputPrompt).trim();
    if (!textToSend || isGenerating) return;

    // Check for Slash Command execution
    if (!promptOverride && textToSend.startsWith("/")) {
      const cmd = textToSend.toLowerCase().split(" ")[0];
      if (cmd === "/terminal") {
        setInputPrompt("");
        setIsSlashMenuOpen(false);
        fetchSidePaneData("terminal");
        setIsSidePaneOpen(true);
        return;
      } else if (cmd === "/mcp") {
        setInputPrompt("");
        setIsSlashMenuOpen(false);
        fetchSidePaneData("mcp");
        setIsSidePaneOpen(true);
        return;
      } else if (cmd === "/skills") {
        setInputPrompt("");
        setIsSlashMenuOpen(false);
        fetchSidePaneData("skills");
        setIsSidePaneOpen(true);
        return;
      } else if (cmd === "/status") {
        setInputPrompt("");
        setIsSlashMenuOpen(false);
        fetchSidePaneData("stats");
        setIsSidePaneOpen(true);
        return;
      } else if (cmd === "/files") {
        setInputPrompt("");
        setIsSlashMenuOpen(false);
        fetchSidePaneData("files");
        setIsSidePaneOpen(true);
        return;
      } else if (cmd === "/logs") {
        setInputPrompt("");
        setIsSlashMenuOpen(false);
        fetchSidePaneData("logs");
        setIsSidePaneOpen(true);
        return;
      } else if (cmd === "/usage") {
        setInputPrompt("");
        setIsSlashMenuOpen(false);
        fetchUsage();
        setIsUsageModalOpen(true);
        return;
      } else if (cmd === "/clear") {
        setIsSlashMenuOpen(false);
        handleCreateNewChat();
        return;
      } else if (cmd === "/model") {
        setInputPrompt("");
        setIsSlashMenuOpen(false);
        setIsModelDropdownOpen(true);
        return;
      }
    }

    // Synchronously guard against rapid double-submits
    if (isGeneratingRef.current) return;
    isGeneratingRef.current = true;
    setIsGenerating(true);

    setInputPrompt("");
    setIsSlashMenuOpen(false);
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    if (!retryAssistantMessageId) {
      const userMessage: Message = {
        id: "usr-" + Date.now(),
        role: "user",
        content: textToSend,
        created_at: Math.floor(Date.now() / 1000),
      };
      setMessages((prev) => [...prev, userMessage]);
    }

    // Safeguard effort & model compatibility
    let modelToSend = activeModel;
    let effortToSend = activeEffort;
    if (activeModel === "gemini-3.8-flash-medium" && (activeEffort === "high" || activeEffort === "max")) {
      modelToSend = "gemini-3.8-flash-high";
    } else if (activeModel === "gemini-3.8-flash-high" && (activeEffort === "low" || activeEffort === "medium")) {
      modelToSend = "gemini-3.8-flash-medium";
    }

    if (currentPromptAbortControllerRef.current) {
      currentPromptAbortControllerRef.current.abort();
    }
    const controller = new AbortController();
    currentPromptAbortControllerRef.current = controller;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          prompt: textToSend,
          conversation_id: activeConversationId,
          model: modelToSend,
          effort: effortToSend,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || data.details || `Server returned error (${res.status})`);
      }

      if (data.conversation_id && !activeConversationId) {
        setActiveConversationId(data.conversation_id);
      }

      if (retryAssistantMessageId) {
        // Turn Branching: add to versions array
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== retryAssistantMessageId) return m;
            const currentVersion: AssistantVersion = {
              content: m.content,
              thinking_content: m.thinking_content,
              model: m.model,
              duration: m.duration,
              created_at: m.created_at,
            };
            const versions = m.versions && m.versions.length > 0 ? m.versions : [currentVersion];
            const newVersion: AssistantVersion = {
              content: data.response || "(Task completed, no output returned)",
              thinking_content: data.thinking,
              model: data.model || modelToSend,
              duration: data.duration,
              created_at: Math.floor(Date.now() / 1000),
            };
            const updated = [...versions, newVersion];
            return {
              ...m,
              content: newVersion.content,
              thinking_content: newVersion.thinking_content,
              model: newVersion.model,
              duration: newVersion.duration,
              versions: updated,
              activeVersionIndex: updated.length - 1,
            };
          })
        );
      } else {
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
      }

      loadConversations();
      fetchUsage();
    } catch (err: any) {
      if (err.name === "AbortError") {
        console.log("Turn aborted by user");
        return;
      }
      const errorMessage: Message = {
        id: "err-" + Date.now(),
        role: "assistant",
        content: "Error communicating with Antigravity: " + err.message,
        created_at: Math.floor(Date.now() / 1000),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      isGeneratingRef.current = false;
      setIsGenerating(false);
    }
  };

  const handleAbort = async () => {
    if (currentPromptAbortControllerRef.current) {
      currentPromptAbortControllerRef.current.abort();
    }
    isGeneratingRef.current = false;
    setIsGenerating(false);

    if (!activeConversationId) return;
    try {
      await fetch("/api/chat/abort", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversation_id: activeConversationId }),
      });
    } catch (e) {
      console.error("Failed to abort turn", e);
    }
  };

  const handleCreateNewChat = () => {
    if (conversationAbortControllerRef.current) {
      conversationAbortControllerRef.current.abort();
    }
    setActiveConversationId(null);
    activeConversationIdRef.current = null;
    setMessages([]);
    setInputPrompt("");
    setIsSidebarOpen(false);
    setIsSlashMenuOpen(false);
  };

  const confirmDeleteConversation = async (cid: string) => {
    setConversationToDelete(null);
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

    setExportNotice(true);
    setTimeout(() => setExportNotice(false), 2000);
  };

  const copyMessageContent = async (msgId: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedMessageId(msgId);
      setTimeout(() => setCopiedMessageId(null), 2000);
    } catch {
      // ignore
    }
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

    let rawHtml = marked.parse(processed) as string;
    // Sanitize output to strip dangerous script tags and inline event handlers
    return rawHtml
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
      .replace(/on\w+\s*=\s*(?:["'][^"']*["']|[^\s>]+)/gi, "")
      .replace(/javascript:/gi, "");
  };

  const currentModelName =
    availableModels.find((m) => m.id === activeModel)?.short_name || "Gemini 3.8 Flash";

  // Loading verification pulse
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-gemini-base flex items-center justify-center">
        <div className="h-10 w-10 rounded-full flex items-center justify-center animate-pulse">
          <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 2C12 7.52285 7.52285 12 2 12C7.52285 12 12 16.4771 12 22C12 16.4771 16.4771 12 22 12C16.4771 12 12 7.52285 12 2Z"
              fill="url(#gemini_grad_auth)"
            />
            <defs>
              <linearGradient id="gemini_grad_auth" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
                <stop stopColor="#4285F4" />
                <stop offset="0.5" stopColor="#9B72CB" />
                <stop offset="1" stopColor="#D96570" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      </div>
    );
  }

  // Gemini Dark Login Screen
  if (isAuthenticated === false) {
    return (
      <div className="min-h-screen bg-gemini-base flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-gemini-surface border border-gemini-border rounded-3xl p-6 sm:p-8 shadow-2xl animate-fadeIn">
          {/* Gemini Gradient Star */}
          <div className="flex flex-col items-center text-center mb-8">
            <div className="h-14 w-14 rounded-2xl bg-gemini-base/80 border border-gemini-border flex items-center justify-center mb-4 shadow-inner">
              <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 2C12 7.52285 7.52285 12 2 12C7.52285 12 12 16.4771 12 22C12 16.4771 16.4771 12 22 12C16.4771 12 12 7.52285 12 2Z"
                  fill="url(#gemini_grad_login)"
                />
                <defs>
                  <linearGradient id="gemini_grad_login" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#4285F4" />
                    <stop offset="0.5" stopColor="#9B72CB" />
                    <stop offset="1" stopColor="#D96570" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <h1 className="text-2xl font-semibold text-white tracking-tight">Antigravity</h1>
            <p className="text-xs text-zinc-400 mt-1.5 font-normal">
              Autonomous agent workspace on Nest
            </p>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-400 font-mono mt-3">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              tanzeemrockz@hackclub.app (24/7 Active)
            </div>
          </div>

          {/* Login Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            {loginError && (
              <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{loginError}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-300">Email</label>
              <input
                type="email"
                required
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full px-4 py-2.5 rounded-2xl bg-gemini-base border border-gemini-border text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-blue-400 transition"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-xs font-medium text-zinc-300">Password</label>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full px-4 py-2.5 pr-11 rounded-2xl bg-gemini-base border border-gemini-border text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-blue-400 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label="Toggle password visibility"
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-white transition"
                >
                  {showPassword ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full mt-2 py-3 rounded-full bg-white hover:bg-zinc-200 text-black font-semibold text-sm transition touch-manipulation min-h-[46px] flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loginLoading ? (
                <>
                  <div className="h-4 w-4 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                  <span>Verifying with Nest...</span>
                </>
              ) : (
                <span>Sign in</span>
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gemini-base text-[#e3e3e3] antialiased select-auto">
      {/* Mobile Sidebar Backdrop */}
      {isSidebarOpen && (
        <div
          onClick={() => setIsSidebarOpen(false)}
          className="fixed inset-0 bg-black/60 z-30 lg:hidden"
        />
      )}

      {/* Top Notification Toast */}
      {exportNotice && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-[#1e1f20] border border-gemini-border text-xs px-3.5 py-1.5 rounded-full shadow-xl text-emerald-400 font-medium animate-fadeIn">
          Conversation exported to Markdown
        </div>
      )}

      {/* Top Navigation Header */}
      <header className="h-14 sm:h-16 border-b border-gemini-border/80 flex items-center justify-between px-3 sm:px-6 z-20 bg-gemini-base/95 backdrop-blur-md safe-top flex-shrink-0">
        <div className="flex items-center gap-1.5 sm:gap-3">
          {/* Menu button */}
          <button
            type="button"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            aria-label="Toggle menu"
            className="p-2 rounded-full text-zinc-400 hover:text-white hover:bg-gemini-surface transition touch-manipulation min-h-[44px] min-w-[44px] flex items-center justify-center"
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
              className="flex items-center gap-2 px-3 sm:px-3.5 py-1.5 rounded-full hover:bg-gemini-surface transition text-left group touch-manipulation min-h-[40px]"
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
              <div className="absolute left-0 mt-2 w-72 sm:w-80 bg-gemini-surface border border-gemini-border rounded-2xl shadow-2xl p-2 z-50 animate-fadeIn">
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
                        className={`w-full p-2.5 rounded-xl cursor-pointer transition text-left flex items-center justify-between touch-manipulation ${
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
                <div className="px-3 pt-2.5 pb-1 border-t border-gemini-border/60 flex items-center justify-between">
                  <span className="text-xs text-zinc-400">Reasoning Effort</span>
                  <div className="flex items-center gap-1">
                    {["low", "medium", "high", "max"].map((eff) => (
                      <button
                        type="button"
                        key={eff}
                        onClick={() => handleSelectEffort(eff)}
                        className={`px-2.5 py-1 rounded text-[11px] font-medium capitalize transition touch-manipulation ${
                          activeEffort === eff
                            ? "bg-gemini-blue text-white"
                            : "text-zinc-400 hover:text-white hover:bg-gemini-border"
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
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Side Pane Drawer Toggle (Files, Stats, Logs) - hidden on mobile for breathing room */}
          <button
            type="button"
            onClick={() => {
              if (!isSidePaneOpen) fetchSidePaneData(sidePaneTab);
              setIsSidePaneOpen(!isSidePaneOpen);
            }}
            title="Inspect Environment"
            className={`hidden sm:flex p-2 rounded-full transition touch-manipulation min-h-[44px] min-w-[44px] items-center justify-center ${
              isSidePaneOpen ? "bg-gemini-border text-blue-400" : "text-zinc-400 hover:text-white hover:bg-gemini-surface"
            }`}
          >
            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
          </button>

          {/* Export conversation - hidden on mobile */}
          {messages.length > 0 && (
            <button
              type="button"
              onClick={handleExportConversation}
              title="Export Conversation"
              className="hidden sm:flex p-2 rounded-full text-zinc-400 hover:text-white hover:bg-gemini-surface transition touch-manipulation min-h-[44px] min-w-[44px] items-center justify-center"
            >
              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </button>
          )}

          {/* Usage Monitor Pill - hidden on small screens */}
          <button
            type="button"
            onClick={() => {
              fetchUsage();
              setIsUsageModalOpen(true);
            }}
            title="View Usage & Limits"
            className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gemini-surface hover:bg-gemini-border border border-gemini-border/60 text-xs text-zinc-300 transition touch-manipulation min-h-[38px]"
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
            className="p-2 rounded-full text-zinc-300 hover:text-white hover:bg-gemini-surface transition touch-manipulation min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </button>

          {/* User Sign Out Button */}
          <button
            type="button"
            onClick={handleLogout}
            title={`Sign out (${currentUser?.email || "tanzeem"})`}
            className="p-2 rounded-full text-zinc-400 hover:text-rose-400 hover:bg-gemini-surface transition touch-manipulation min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </header>

      {/* Main Body */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Collapsible Sidebar */}
        <aside
          aria-hidden={isMobile && !isSidebarOpen}
          inert={isMobile && !isSidebarOpen ? true : undefined}
          className={`fixed lg:static inset-y-0 left-0 z-40 w-80 max-w-[85vw] lg:w-72 bg-[#18191a] border-r border-gemini-border flex flex-col transition-transform duration-300 ${
            isSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
          }`}
        >
          <div className="p-3.5 border-b border-gemini-border/70 flex flex-col gap-3">
            {/* Mobile Header with close button */}
            <div className="flex items-center justify-between lg:hidden pb-1">
              <span className="text-xs font-semibold text-zinc-400">Conversations</span>
              <button
                type="button"
                onClick={() => setIsSidebarOpen(false)}
                className="p-1 rounded-full text-zinc-400 hover:text-white hover:bg-gemini-surface transition min-h-[36px] min-w-[36px] flex items-center justify-center"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <button
              type="button"
              onClick={handleCreateNewChat}
              className="w-full flex items-center justify-between px-4 py-2.5 rounded-full bg-gemini-surface hover:bg-gemini-border text-sm font-medium text-white transition touch-manipulation min-h-[44px]"
            >
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                New Chat
              </span>
              <span className="hidden lg:inline text-[11px] text-zinc-400 font-mono">Ctrl+K</span>
            </button>

            {/* Quick Environment Tools in Sidebar */}
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => {
                  fetchSidePaneData("terminal");
                  setIsSidePaneOpen(true);
                  if (isMobile) setIsSidebarOpen(false);
                }}
                className="px-2 py-1.5 rounded-xl bg-gemini-surface/80 hover:bg-gemini-border text-[11px] text-zinc-300 hover:text-white text-center font-medium transition touch-manipulation min-h-[36px] flex items-center justify-center font-mono"
              >
                Terminal
              </button>
              <button
                type="button"
                onClick={() => {
                  fetchSidePaneData("mcp");
                  setIsSidePaneOpen(true);
                  if (isMobile) setIsSidebarOpen(false);
                }}
                className="px-2 py-1.5 rounded-xl bg-gemini-surface/80 hover:bg-gemini-border text-[11px] text-zinc-300 hover:text-white text-center font-medium transition touch-manipulation min-h-[36px] flex items-center justify-center"
              >
                MCP
              </button>
              <button
                type="button"
                onClick={() => {
                  fetchSidePaneData("skills");
                  setIsSidePaneOpen(true);
                  if (isMobile) setIsSidebarOpen(false);
                }}
                className="px-2 py-1.5 rounded-xl bg-gemini-surface/80 hover:bg-gemini-border text-[11px] text-zinc-300 hover:text-white text-center font-medium transition touch-manipulation min-h-[36px] flex items-center justify-center"
              >
                Skills
              </button>
              <button
                type="button"
                onClick={() => {
                  fetchSidePaneData("stats");
                  setIsSidePaneOpen(true);
                  if (isMobile) setIsSidebarOpen(false);
                }}
                className="px-2 py-1.5 rounded-xl bg-gemini-surface/80 hover:bg-gemini-border text-[11px] text-zinc-300 hover:text-white text-center font-medium transition touch-manipulation min-h-[36px] flex items-center justify-center"
              >
                Stats
              </button>
              <button
                type="button"
                onClick={() => {
                  fetchSidePaneData("files");
                  setIsSidePaneOpen(true);
                  if (isMobile) setIsSidebarOpen(false);
                }}
                className="px-2 py-1.5 rounded-xl bg-gemini-surface/80 hover:bg-gemini-border text-[11px] text-zinc-300 hover:text-white text-center font-medium transition touch-manipulation min-h-[36px] flex items-center justify-center"
              >
                Files
              </button>
              <button
                type="button"
                onClick={() => {
                  fetchSidePaneData("logs");
                  setIsSidePaneOpen(true);
                  if (isMobile) setIsSidebarOpen(false);
                }}
                className="px-2 py-1.5 rounded-xl bg-gemini-surface/80 hover:bg-gemini-border text-[11px] text-zinc-300 hover:text-white text-center font-medium transition touch-manipulation min-h-[36px] flex items-center justify-center"
              >
                Logs
              </button>
            </div>

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
                    className={`group flex items-center justify-between px-3.5 py-2.5 rounded-full text-xs cursor-pointer transition touch-manipulation min-h-[42px] ${
                      isActive ? "bg-gemini-surface text-white font-medium" : "text-zinc-400 hover:bg-gemini-surface hover:text-white"
                    }`}
                  >
                    <span className="truncate flex-1 mr-2">{c.title || "Untitled"}</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setConversationToDelete(c.id);
                      }}
                      title="Delete"
                      className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 p-1.5 text-zinc-400 hover:text-rose-400 transition"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                );
              })}
          </div>

          <div className="p-3.5 border-t border-gemini-border/70 bg-[#161718] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400"></span>
              <span className="text-xs text-zinc-300 font-medium">Nest 24/7 Active</span>
            </div>
            <div className="flex items-center gap-3">
              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    handleExportConversation();
                    if (isMobile) setIsSidebarOpen(false);
                  }}
                  className="text-xs text-zinc-400 hover:text-white py-1 px-1.5"
                >
                  Export
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  fetchUsage();
                  setIsUsageModalOpen(true);
                  if (isMobile) setIsSidebarOpen(false);
                }}
                className="text-xs text-blue-400 hover:underline min-h-[36px] flex items-center"
              >
                Usage
              </button>
            </div>
          </div>
        </aside>

        {/* Chat Feed */}
        <main className="flex-1 flex flex-col h-full bg-gemini-base relative overflow-hidden">
          <div ref={chatContainerRef} className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 sm:py-10 scroll-smooth">
            {/* Welcome view when empty */}
            {messages.length === 0 && (
              <div className="max-w-2xl mx-auto py-8 sm:py-16 flex flex-col items-start">
                <h1 className="text-3xl sm:text-5xl font-semibold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-purple-300 to-rose-300 mb-2">
                  Hello, Tanzeem
                </h1>
                <p className="text-xl sm:text-3xl text-zinc-400 font-normal mb-6 sm:mb-10">
                  How can I help you today?
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
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
                      className="p-5 rounded-2xl bg-gemini-surface hover:bg-[#252628] active:scale-[0.99] border border-gemini-border/70 hover:border-[#3c4043] text-left transition-all duration-200 group touch-manipulation min-h-[92px] flex flex-col justify-between focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/70"
                    >
                      <div className="text-sm font-medium text-white group-hover:text-blue-400 mb-1">{card.title}</div>
                      <div className="text-xs text-zinc-400">{card.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Messages */}
            <div className="max-w-3xl mx-auto w-full space-y-8 sm:space-y-10 pb-44">
              {messages.map((m, idx) => {
                if (m.role === "user") {
                  return (
                    <div key={m.id} className="flex justify-end">
                      <div className="max-w-[90%] sm:max-w-[78%] rounded-[26px] bg-gemini-bubble px-5 py-3.5 text-white shadow-sm group">
                        <div className="whitespace-pre-wrap text-[15px] sm:text-sm leading-relaxed">{m.content}</div>
                        <div className="flex items-center justify-end gap-2 mt-2 pt-1 border-t border-zinc-700/50 text-[10px] text-zinc-400">
                          <span>{new Date(m.created_at * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                          <button
                            type="button"
                            onClick={() => {
                              setInputPrompt(m.content);
                              textareaRef.current?.focus();
                            }}
                            title="Edit prompt"
                            className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 hover:text-white transition p-1"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                } else {
                  return (
                    <div key={m.id} className="flex items-start gap-4 sm:gap-5">
                      <div className="h-7 w-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
                          <path
                            d="M12 2C12 7.52285 7.52285 12 2 12C7.52285 12 12 16.4771 12 22C12 16.4771 16.4771 12 22 12C16.4771 12 12 7.52285 12 2Z"
                            fill="url(#gemini_grad)"
                          />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-2 text-xs text-zinc-400 font-medium">
                          <div className="flex items-center gap-2">
                            <span className="text-white font-medium">{m.model || "Antigravity"}</span>
                            {m.duration && <span className="text-zinc-500 font-mono">· {m.duration}s</span>}
                          </div>

                          {/* Turn Branching Pagination (< 1 / 2 >) */}
                          {m.versions && m.versions.length > 1 && (() => {
                            const vCount = m.versions.length;
                            const currentIdx = m.activeVersionIndex ?? vCount - 1;
                            return (
                              <div className="flex items-center gap-1.5 bg-gemini-surface/90 border border-gemini-border/70 rounded-full px-2.5 py-1 text-[11px] font-mono text-zinc-300">
                                <button
                                  type="button"
                                  disabled={currentIdx === 0}
                                  onClick={() => handleSwitchVersion(m.id, currentIdx - 1)}
                                  className="hover:text-white disabled:opacity-30 p-0.5 transition"
                                  title="Previous version"
                                >
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                                  </svg>
                                </button>
                                <span>
                                  {currentIdx + 1} / {vCount}
                                </span>
                                <button
                                  type="button"
                                  disabled={currentIdx === vCount - 1}
                                  onClick={() => handleSwitchVersion(m.id, currentIdx + 1)}
                                  className="hover:text-white disabled:opacity-30 p-0.5 transition"
                                  title="Next version"
                                >
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                  </svg>
                                </button>
                              </div>
                            );
                          })()}
                        </div>

                        {/* Collapsible Thought Process */}
                        {m.thinking_content && (
                          <details className="mb-4 bg-gemini-surface border border-gemini-border rounded-2xl overflow-hidden group">
                            <summary className="flex items-center gap-2 px-3.5 py-2.5 text-xs font-mono text-zinc-400 hover:text-white cursor-pointer select-none">
                              <svg className="w-3.5 h-3.5 transform transition-transform group-open:rotate-90 text-blue-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                              </svg>
                              <span>Thought process</span>
                            </summary>
                            <div className="p-3.5 text-xs text-zinc-300 font-mono border-t border-gemini-border bg-[#141416] whitespace-pre-wrap leading-relaxed">
                              {m.thinking_content}
                            </div>
                          </details>
                        )}

                        <div
                          className="prose-gemini"
                          dangerouslySetInnerHTML={{ __html: renderFormattedMarkdown(m.content || "") }}
                        />

                        {/* Action buttons */}
                        <div className="flex items-center gap-2 sm:gap-3 mt-4 pt-2.5 text-xs text-zinc-400">
                          {/* Copy */}
                          <button
                            type="button"
                            onClick={() => copyMessageContent(m.id, m.content)}
                            title="Copy text"
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:text-white hover:bg-gemini-surface transition touch-manipulation min-h-[38px]"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                            <span>{copiedMessageId === m.id ? "Copied!" : "Copy"}</span>
                          </button>

                          {/* Audio TTS */}
                          <button
                            type="button"
                            onClick={() => speakText(m.id, m.content)}
                            title="Read aloud"
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition touch-manipulation min-h-[38px] ${
                              speakingMessageId === m.id ? "text-blue-400 animate-pulse font-medium bg-gemini-surface" : "hover:text-white hover:bg-gemini-surface"
                            }`}
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                            </svg>
                            <span>{speakingMessageId === m.id ? "Speaking..." : "Audio"}</span>
                          </button>

                          {/* Retry with turn branching */}
                          {idx > 0 && messages[idx - 1]?.role === "user" && (
                            <button
                              type="button"
                              onClick={() => handleSendPrompt(messages[idx - 1].content, m.id)}
                              title="Retry turn (adds alternate branch)"
                              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:text-white hover:bg-gemini-surface transition touch-manipulation min-h-[38px]"
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
                <div className="flex items-start gap-4 sm:gap-5">
                  <div className="h-7 w-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 animate-pulse">
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
          <div className="flex-shrink-0 w-full bg-gradient-to-t from-gemini-base via-gemini-base/95 to-transparent pt-4 pb-3 px-3 sm:px-6 safe-bottom z-10">
            <div className="max-w-3xl mx-auto w-full relative">
              {/* Slash Commands floating popup */}
              {(isSlashMenuOpen || inputPrompt.startsWith("/")) && (
                <div className="mb-2.5 bg-[#18191b] border border-gemini-border rounded-2xl shadow-2xl p-3 animate-fadeIn flex flex-wrap gap-2 max-w-3xl mx-auto z-20">
                  <div className="w-full px-2 py-1 text-[11px] font-medium text-zinc-400 border-b border-gemini-border/50 flex items-center justify-between">
                    <span>Quick Commands</span>
                    <button
                      type="button"
                      onClick={() => setIsSlashMenuOpen(false)}
                      className="text-zinc-500 hover:text-zinc-300 text-[10px]"
                    >
                      Close
                    </button>
                  </div>
                  {[
                    { cmd: "/terminal", desc: "Interactive Shell", action: () => { setInputPrompt(""); fetchSidePaneData("terminal"); setIsSidePaneOpen(true); setIsSlashMenuOpen(false); } },
                    { cmd: "/mcp", desc: "MCP Servers & Tools", action: () => { setInputPrompt(""); fetchSidePaneData("mcp"); setIsSidePaneOpen(true); setIsSlashMenuOpen(false); } },
                    { cmd: "/skills", desc: "Antigravity Skills", action: () => { setInputPrompt(""); fetchSidePaneData("skills"); setIsSidePaneOpen(true); setIsSlashMenuOpen(false); } },
                    { cmd: "/status", desc: "RAM & Services", action: () => { setInputPrompt(""); fetchSidePaneData("stats"); setIsSidePaneOpen(true); setIsSlashMenuOpen(false); } },
                    { cmd: "/files", desc: "Workspace Tree", action: () => { setInputPrompt(""); fetchSidePaneData("files"); setIsSidePaneOpen(true); setIsSlashMenuOpen(false); } },
                    { cmd: "/logs", desc: "Live Bridge Logs", action: () => { setInputPrompt(""); fetchSidePaneData("logs"); setIsSidePaneOpen(true); setIsSlashMenuOpen(false); } },
                    { cmd: "/usage", desc: "Token Quota", action: () => { setInputPrompt(""); fetchUsage(); setIsUsageModalOpen(true); setIsSlashMenuOpen(false); } },
                    { cmd: "/model", desc: "Switch Model", action: () => { setInputPrompt(""); setIsModelDropdownOpen(true); setIsSlashMenuOpen(false); } },
                    { cmd: "/clear", desc: "New Chat", action: () => { handleCreateNewChat(); setIsSlashMenuOpen(false); } },
                  ].map((item) => (
                    <button
                      type="button"
                      key={item.cmd}
                      onClick={item.action}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-gemini-surface hover:bg-gemini-border border border-gemini-border/60 text-xs text-zinc-300 hover:text-white transition touch-manipulation"
                    >
                      <span className="font-mono text-blue-400 font-semibold">{item.cmd}</span>
                      <span className="text-[11px] text-zinc-400">{item.desc}</span>
                    </button>
                  ))}
                </div>
              )}

              <div className="bg-gemini-surface border border-gemini-border rounded-[28px] p-2.5 sm:p-3.5 shadow-[0_8px_32px_rgba(0,0,0,0.28)] transition-[border-color,box-shadow] duration-200 focus-within:border-[#5f8df7] focus-within:shadow-[0_0_0_1px_rgba(138,180,248,0.18),0_8px_32px_rgba(0,0,0,0.28)]">
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
                  placeholder="Ask Antigravity (or type / for commands)..."
                  aria-label="Message Antigravity"
                  enterKeyHint={isMobile ? "enter" : "send"}
                  className="w-full bg-transparent text-base sm:text-sm text-white placeholder-zinc-500 px-3.5 py-2 resize-none focus:outline-none max-h-48 overflow-y-auto overscroll-contain leading-relaxed"
                />

                <div className="flex items-center justify-between pt-2 px-1">
                  <div className="flex items-center gap-1.5">
                    {/* Slash Command Quick Button */}
                    <button
                      type="button"
                      onClick={() => setIsSlashMenuOpen(!isSlashMenuOpen)}
                      title="Quick Commands"
                      className={`p-2 rounded-full transition touch-manipulation min-h-[40px] min-w-[40px] flex items-center justify-center font-mono text-sm font-semibold ${
                        isSlashMenuOpen ? "bg-blue-600 text-white" : "text-zinc-400 hover:text-white hover:bg-gemini-border"
                      }`}
                    >
                      /
                    </button>

                    {/* Speech Recognition Mic */}
                    <button
                      type="button"
                      onClick={toggleSpeechRecognition}
                      title="Voice input"
                      className={`p-2 rounded-full transition touch-manipulation min-h-[40px] min-w-[40px] flex items-center justify-center ${
                        isListening
                          ? "bg-rose-500 text-white animate-pulse"
                          : "text-zinc-400 hover:text-white hover:bg-gemini-border"
                      }`}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                      </svg>
                    </button>
                    <span className="text-[11px] text-zinc-500 hidden sm:inline ml-1">
                      Enter to send · Shift+Enter for newline
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* Send / Stop button */}
                    <button
                      type="button"
                      onClick={() => (isGenerating ? handleAbort() : handleSendPrompt())}
                      className="h-9 w-9 rounded-full bg-white hover:bg-zinc-200 text-black flex items-center justify-center transition shadow-md touch-manipulation"
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
                <span className={`text-[10px] px-2 py-0.5 rounded-full border font-mono ${
                  statsData ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-zinc-500/10 text-zinc-400 border-zinc-500/20"
                }`}>
                  {sidePaneLoading ? "Loading..." : statsData ? "Connected" : "Offline"}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsSidePaneOpen(false)}
                className="p-1 rounded-full text-zinc-400 hover:text-white min-h-[36px] min-w-[36px] flex items-center justify-center"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gemini-border text-xs overflow-x-auto no-scrollbar">
              {(["terminal", "mcp", "skills", "stats", "files", "logs"] as const).map((t) => (
                <button
                  type="button"
                  key={t}
                  onClick={() => fetchSidePaneData(t)}
                  className={`flex-shrink-0 px-3 py-2.5 font-medium capitalize text-center transition touch-manipulation whitespace-nowrap ${
                    sidePaneTab === t ? "text-blue-400 border-b-2 border-blue-400 bg-gemini-surface/50 font-semibold" : "text-zinc-400 hover:text-white"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* Tab Body */}
            <div className="flex-1 overflow-y-auto p-3 text-xs font-mono">
              {sidePaneLoading && (
                <div className="text-zinc-500 py-8 text-center animate-pulse">
                  Fetching {sidePaneTab}...
                </div>
              )}

              {sidePaneError && (
                <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 text-rose-400 text-xs mb-3">
                  {sidePaneError}
                </div>
              )}

              {/* Terminal Tab */}
              {!sidePaneLoading && !sidePaneError && sidePaneTab === "terminal" && (
                <div className="flex flex-col h-full space-y-3 font-mono text-[11px]">
                  {/* Preset Quick Chips */}
                  <div className="flex flex-wrap gap-1.5 pb-2 border-b border-gemini-border/60">
                    {[
                      "uptime",
                      "free -h",
                      "df -h",
                      "systemctl status slack-dashboard",
                      "agy --version",
                      "ps aux | grep agy",
                    ].map((cmd) => (
                      <button
                        type="button"
                        key={cmd}
                        onClick={() => handleExecuteTerminalCommand(cmd)}
                        className="px-2 py-1 rounded-lg bg-gemini-surface hover:bg-gemini-border border border-gemini-border/60 text-zinc-300 hover:text-white transition touch-manipulation text-[10px]"
                      >
                        {cmd}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setTerminalHistory([])}
                      className="ml-auto px-2 py-1 rounded-lg text-zinc-500 hover:text-zinc-300 text-[10px]"
                    >
                      Clear
                    </button>
                  </div>

                  {/* Terminal Output Window */}
                  <div className="bg-[#101112] border border-gemini-border/80 rounded-2xl p-3 overflow-y-auto space-y-3 max-h-[50vh] min-h-[220px]">
                    {terminalHistory.map((entry, idx) => (
                      <div key={idx} className="space-y-1">
                        <div className="flex items-center justify-between text-zinc-400 text-[10px]">
                          <span className="text-emerald-400">root@tanzeemrockz:~$ <span className="text-white font-semibold">{entry.command}</span></span>
                          <span className="text-zinc-500">{entry.duration}s</span>
                        </div>
                        {entry.stdout && (
                          <div className="text-zinc-200 whitespace-pre-wrap leading-relaxed pl-2 border-l border-zinc-700/60">
                            {entry.stdout}
                          </div>
                        )}
                        {entry.stderr && (
                          <div className="text-rose-400 whitespace-pre-wrap leading-relaxed pl-2 border-l border-rose-500/50">
                            {entry.stderr}
                          </div>
                        )}
                      </div>
                    ))}
                    {isExecutingCommand && (
                      <div className="flex items-center gap-2 text-zinc-400 animate-pulse text-[11px]">
                        <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse"></span>
                        <span>Executing on Nest...</span>
                      </div>
                    )}
                    <div ref={terminalBottomRef} />
                  </div>

                  {/* Terminal Input Bar */}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleExecuteTerminalCommand();
                    }}
                    className="flex items-center gap-1.5 pt-1"
                  >
                    <div className="relative flex-1">
                      <input
                        type="text"
                        value={terminalCommand}
                        onChange={(e) => setTerminalCommand(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "ArrowUp") {
                            e.preventDefault();
                            if (commandHistoryList.length > 0) {
                              const nextIdx = Math.min(historyNavIndex + 1, commandHistoryList.length - 1);
                              setHistoryNavIndex(nextIdx);
                              setTerminalCommand(commandHistoryList[nextIdx]);
                            }
                          } else if (e.key === "ArrowDown") {
                            e.preventDefault();
                            if (historyNavIndex > 0) {
                              const prevIdx = historyNavIndex - 1;
                              setHistoryNavIndex(prevIdx);
                              setTerminalCommand(commandHistoryList[prevIdx]);
                            } else if (historyNavIndex === 0) {
                              setHistoryNavIndex(-1);
                              setTerminalCommand("");
                            }
                          }
                        }}
                        placeholder="Run command on Nest..."
                        className="w-full bg-gemini-surface border border-gemini-border rounded-xl px-3 py-2 text-white placeholder-zinc-500 focus:outline-none focus:border-blue-400 text-xs"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={isExecutingCommand || !terminalCommand.trim()}
                      className="px-3.5 py-2 rounded-xl bg-white hover:bg-zinc-200 text-black font-semibold text-xs disabled:opacity-40 transition touch-manipulation min-h-[36px]"
                    >
                      Run
                    </button>
                  </form>
                </div>
              )}

              {/* MCP Servers Tab */}
              {!sidePaneLoading && !sidePaneError && sidePaneTab === "mcp" && (
                <div className="space-y-2.5">
                  <div className="text-[11px] text-zinc-400 mb-1">
                    Model Context Protocol servers connected to Antigravity
                  </div>
                  {mcpServers.length === 0 ? (
                    <div className="text-zinc-500 py-6 text-center">Loading connected servers...</div>
                  ) : (
                    mcpServers.map((server, i) => (
                      <div key={i} className="bg-gemini-surface border border-gemini-border rounded-2xl p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-emerald-400"></span>
                            <span className="text-white font-medium text-xs font-mono">{server.name}</span>
                          </div>
                          <span className="text-[10px] bg-blue-500/10 border border-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full font-mono">
                            {server.tools_count} tools
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1 pt-1">
                          {(server.tools || []).slice(0, 6).map((tool: string, tIdx: number) => (
                            <span
                              key={tIdx}
                              className="bg-gemini-base border border-gemini-border/70 text-zinc-300 px-2 py-0.5 rounded-md text-[10px] font-mono"
                            >
                              {tool}
                            </span>
                          ))}
                          {(server.tools || []).length > 6 && (
                            <span className="text-zinc-500 text-[10px] self-center">
                              +{server.tools.length - 6} more
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Skills Tab */}
              {!sidePaneLoading && !sidePaneError && sidePaneTab === "skills" && (
                <div className="space-y-2.5">
                  <div className="text-[11px] text-zinc-400 mb-1">
                    Active Antigravity autonomous agent skills
                  </div>
                  {skillsList.length === 0 ? (
                    <div className="text-zinc-500 py-6 text-center">Loading skills catalog...</div>
                  ) : (
                    skillsList.map((skill, i) => (
                      <div key={i} className="bg-gemini-surface border border-gemini-border rounded-2xl p-3 flex flex-col justify-between gap-2">
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-white font-medium text-xs">{skill.name}</span>
                            <span className="text-[10px] bg-purple-500/10 border border-purple-500/20 text-purple-400 px-2 py-0.5 rounded-full font-mono uppercase">
                              {skill.source}
                            </span>
                          </div>
                          <p className="text-[11px] text-zinc-400 line-clamp-2 leading-relaxed font-sans">
                            {skill.description}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setInputPrompt((prev) => (prev ? prev + " " : "") + `@${skill.id} `);
                            setIsSidePaneOpen(false);
                            textareaRef.current?.focus();
                          }}
                          className="self-end px-2.5 py-1 rounded-lg bg-gemini-border hover:bg-zinc-700 text-xs text-zinc-200 hover:text-white transition touch-manipulation font-sans"
                        >
                          Use in prompt
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}

              {!sidePaneLoading && !sidePaneError && sidePaneTab === "stats" && (
                <div className="space-y-3">
                  <div className="bg-gemini-surface border border-gemini-border rounded-xl p-3">
                    <div className="text-zinc-400 text-[11px] mb-1">Server Host</div>
                    <div className="text-white font-semibold">{statsData?.host || "tanzeemrockz@hackclub.app"}</div>
                  </div>
                  <div className="bg-gemini-surface border border-gemini-border rounded-xl p-3">
                    <div className="text-zinc-400 text-[11px] mb-1">RAM (2048 MB limit)</div>
                    <div className="text-emerald-400 font-semibold">{statsData?.memory_used || "Available via active connection"}</div>
                  </div>
                  <div className="bg-gemini-surface border border-gemini-border rounded-xl p-3">
                    <div className="text-zinc-400 text-[11px] mb-1">Systemd Services</div>
                    <div className="text-white space-y-1 text-[11px]">
                      <div>slack-bridge.service: active</div>
                      <div>slack-dashboard.service: active</div>
                      <div>cloudflared-tunnel.service: active</div>
                    </div>
                  </div>
                </div>
              )}

              {!sidePaneLoading && !sidePaneError && sidePaneTab === "files" && (
                <div className="space-y-1">
                  {filesData.length === 0 ? (
                    <div className="text-zinc-500 py-6 text-center">No files in directory.</div>
                  ) : (
                    filesData.map((f, i) => (
                      <div key={i} className="flex items-center gap-2 p-2 rounded hover:bg-gemini-surface text-zinc-300">
                        <svg className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                        <span className="truncate flex-1">{f.name || f}</span>
                        <span className="text-[10px] text-zinc-500 font-mono">{f.size || ""}</span>
                      </div>
                    ))
                  )}
                </div>
              )}

              {!sidePaneLoading && !sidePaneError && sidePaneTab === "logs" && (
                <div className="bg-[#121214] p-2.5 rounded-xl border border-gemini-border text-[11px] text-zinc-300 whitespace-pre-wrap leading-relaxed max-h-full overflow-x-auto">
                  {logsData || "No recent system logs available."}
                </div>
              )}
            </div>
          </aside>
        )}
      </div>

      {/* In-App Delete Confirmation Modal */}
      {conversationToDelete && (
        <div
          onClick={() => setConversationToDelete(null)}
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-gemini-surface border border-gemini-border rounded-2xl w-full max-w-sm p-5 shadow-2xl flex flex-col gap-3 cursor-default animate-fadeIn"
          >
            <h3 className="text-sm font-semibold text-white">Delete chat?</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              This will permanently delete this conversation from your history. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2 pt-2 text-xs">
              <button
                type="button"
                onClick={() => setConversationToDelete(null)}
                className="px-3.5 py-1.5 rounded-full text-zinc-300 hover:text-white hover:bg-gemini-border transition touch-manipulation min-h-[36px]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => confirmDeleteConversation(conversationToDelete)}
                className="px-4 py-1.5 rounded-full bg-rose-600 hover:bg-rose-500 text-white font-medium transition touch-manipulation min-h-[36px]"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Usage Limit & Quota Modal */}
      {isUsageModalOpen && usageData && (
        <div
          onClick={() => setIsUsageModalOpen(false)}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-gemini-surface border border-gemini-border rounded-3xl w-full max-w-lg p-5 shadow-2xl flex flex-col gap-4 cursor-default animate-fadeIn"
          >
            <div className="flex items-center justify-between border-b border-gemini-border pb-3">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400"></span>
                <h3 className="text-base font-semibold text-white">Usage & Quota Monitor</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsUsageModalOpen(false)}
                className="p-1 rounded-full text-zinc-400 hover:text-white min-h-[36px] min-w-[36px] flex items-center justify-center"
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
                className="px-4 py-2 rounded-full bg-white text-black font-medium text-xs hover:bg-zinc-200 transition touch-manipulation min-h-[36px]"
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
