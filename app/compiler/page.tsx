"use client"

import CodeMirror from "@uiw/react-codemirror"
import { python } from "@codemirror/lang-python"
import { oneDark } from "@codemirror/theme-one-dark"
import { EditorView } from "@codemirror/view"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { PanelGroup, Panel, PanelResizeHandle } from "react-resizable-panels"
import {
  Play,
  Loader2,
  Sun,
  Moon,
  Download,
  RotateCcw,
  Terminal,
  ArrowLeft,
  Plus,
  X,
  Pencil,
  Check,
  FileCode2,
} from "lucide-react"
import "./compiler.css"

// ── Types ───────────────────────────────────────────────────────────────────
type PyodideRuntime = {
  runPythonAsync: (code: string) => Promise<unknown>
  globals: { set: (k: string, v: unknown) => void; delete: (k: string) => void }
}

declare global {
  interface Window {
    loadPyodide?: (opts: { indexURL: string }) => Promise<PyodideRuntime>
    __pyodideScriptPromise?: Promise<void>
  }
}

interface CodeFile {
  id: string
  name: string
  code: string
}

// ── Constants ───────────────────────────────────────────────────────────────
const DEFAULT_CODE = `# cook your dish here

def main():
    print("Hello, World!")

main()`

const FILES_KEY   = "cc:python:files"
const ACTIVE_KEY  = "cc:python:active"
const STDIN_KEY   = "cc:python:stdin"
const THEME_KEY   = "cc:compiler:dark"
const PYODIDE_CDN = "https://cdn.jsdelivr.net/pyodide/v0.29.0/full/"
const TIMEOUT_MS  = 12_000

// ── Helpers ─────────────────────────────────────────────────────────────────
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error("Execution timed out (12 s).")), ms)
    p.then((v) => { clearTimeout(t); res(v) })
     .catch((e) => { clearTimeout(t); rej(e) })
  })
}

function toMessage(e: unknown): string {
  if (e instanceof Error) return e.message
  if (typeof e === "string") return e
  try { return JSON.stringify(e) } catch { return "Unknown error" }
}

function uid() {
  return Math.random().toString(36).slice(2)
}

async function loadPyodideScript(): Promise<void> {
  if (typeof window === "undefined") throw new Error("Browser only.")
  if (window.loadPyodide) return
  if (!window.__pyodideScriptPromise) {
    window.__pyodideScriptPromise = new Promise<void>((res, rej) => {
      const existing = document.querySelector<HTMLScriptElement>('script[data-pyodide="1"]')
      if (existing) {
        if (existing.dataset.loaded) { res(); return }
        existing.addEventListener("load", () => { existing.dataset.loaded = "1"; res() }, { once: true })
        existing.addEventListener("error", () => rej(new Error("CDN load failed")), { once: true })
        return
      }
      const s = document.createElement("script")
      s.src   = `${PYODIDE_CDN}pyodide.js`
      s.async = true
      s.dataset.pyodide = "1"
      s.addEventListener("load",  () => { s.dataset.loaded = "1"; res() }, { once: true })
      s.addEventListener("error", () => rej(new Error("Unable to load Pyodide from CDN.")), { once: true })
      document.head.appendChild(s)
    })
  }
  await window.__pyodideScriptPromise
  if (!window.loadPyodide) throw new Error("Pyodide loader unavailable after script load.")
}

// ── CodeMirror dark theme ────────────────────────────────────────────────────
const darkTheme = EditorView.theme({
  "&": {
    height: "100%",
    fontFamily: "'Fira Code', 'Cascadia Code', Menlo, Consolas, monospace",
    fontSize: "13.5px",
    backgroundColor: "#1a1b26",
  },
  ".cm-content": { padding: "8px 0", caretColor: "#c0caf5" },
  ".cm-cursor, .cm-dropCursor": {
    borderLeftColor: "#c0caf5 !important",
    borderLeftWidth: "2px !important",
  },
  ".cm-gutters": {
    backgroundColor: "#16171f !important",
    color: "#4a4f6a !important",
    border: "none !important",
    borderRight: "1px solid #1e2030 !important",
    minWidth: "44px",
    userSelect: "none",
  },
  ".cm-lineNumbers .cm-gutterElement": {
    padding: "0 10px 0 4px",
    minWidth: "36px",
    textAlign: "right",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "#1e2030 !important",
    color: "#a9b1d6 !important",
  },
  ".cm-activeLine": { backgroundColor: "#1e203055 !important" },
  ".cm-line": { paddingLeft: "12px", paddingRight: "8px" },
  ".cm-selectionBackground, ::selection": {
    backgroundColor: "#264f78 !important",
  },
  ".cm-focused .cm-selectionBackground": {
    backgroundColor: "#264f78 !important",
  },
  ".cm-scroller": { overflow: "auto", lineHeight: "1.65" },
  ".cm-focused": { outline: "none !important" },
}, { dark: true })

// ── CodeMirror light theme — clean white like Programiz/CodeChef ─────────────
const lightTheme = EditorView.theme({
  "&": {
    height: "100%",
    fontFamily: "'Fira Code', 'Cascadia Code', Menlo, Consolas, monospace",
    fontSize: "13.5px",
    backgroundColor: "#ffffff",
  },
  ".cm-content": { padding: "8px 0", caretColor: "#1a1a2e" },
  ".cm-cursor, .cm-dropCursor": {
    borderLeftColor: "#1a1a2e !important",
    borderLeftWidth: "2px !important",
  },
  ".cm-gutters": {
    backgroundColor: "#f3f4f6 !important",
    color: "#9ca3af !important",
    border: "none !important",
    borderRight: "1px solid #e5e7eb !important",
    minWidth: "44px",
    userSelect: "none",
  },
  ".cm-lineNumbers .cm-gutterElement": {
    padding: "0 10px 0 4px",
    minWidth: "36px",
    textAlign: "right",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "#e9ecf0 !important",
    color: "#374151 !important",
  },
  ".cm-activeLine": { backgroundColor: "#f0f4f8 !important" },
  ".cm-line": { paddingLeft: "12px", paddingRight: "8px" },
  ".cm-selectionBackground, ::selection": {
    backgroundColor: "#bfdbfe !important",
  },
  ".cm-focused .cm-selectionBackground": {
    backgroundColor: "#bfdbfe !important",
  },
  ".cm-scroller": { overflow: "auto", lineHeight: "1.65" },
  ".cm-focused": { outline: "none !important" },
}, { dark: false })


// ── Component ────────────────────────────────────────────────────────────────
export default function CompilerPage() {
  const supabase  = useMemo(() => createClient(), [])
  const router    = useRouter()
  const pyRef     = useRef<PyodideRuntime | null>(null)
  const signInRef = useRef(false)

  // Default to LIGHT mode
  const [isDark,  setIsDark]  = useState(false)
  const [mounted, setMounted] = useState(false)

  const [authChecked, setAuthChecked] = useState(false)
  const [authed,      setAuthed]      = useState(false)

  // ── Multi-file state ────────────────────────────────────────────────────
  const [files, setFiles] = useState<CodeFile[]>([
    { id: uid(), name: "main.py", code: DEFAULT_CODE },
  ])
  const [activeId, setActiveId] = useState<string>(() => files[0].id)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState("")

  const activeFile = files.find(f => f.id === activeId) ?? files[0]

  const [stdin, setStdin] = useState("")

  type Status = "idle" | "loading-rt" | "running" | "done" | "error"
  const [stdout,  setStdout]  = useState("")
  const [stderr,  setStderr]  = useState("")
  const [status,  setStatus]  = useState<Status>("idle")
  const [rtReady, setRtReady] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!mounted) return
    const dark    = localStorage.getItem(THEME_KEY)
    const saved   = localStorage.getItem(FILES_KEY)
    const active  = localStorage.getItem(ACTIVE_KEY)
    const sin     = localStorage.getItem(STDIN_KEY)
    // Only override if explicitly stored; default stays false (light)
    if (dark === "true")  setIsDark(true)
    if (dark === "false") setIsDark(false)
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as CodeFile[]
        if (Array.isArray(parsed) && parsed.length) {
          setFiles(parsed)
          setActiveId(active ?? parsed[0].id)
        }
      } catch {}
    }
    if (sin) setStdin(sin)
  }, [mounted])

  useEffect(() => { if (mounted) localStorage.setItem(THEME_KEY, String(isDark)) }, [isDark, mounted])
  useEffect(() => { if (mounted) localStorage.setItem(FILES_KEY,  JSON.stringify(files)) }, [files, mounted])
  useEffect(() => { if (mounted) localStorage.setItem(ACTIVE_KEY, activeId) }, [activeId, mounted])
  useEffect(() => { if (mounted) localStorage.setItem(STDIN_KEY, stdin) }, [stdin, mounted])

  useEffect(() => {
    let alive = true
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!alive) return
      setAuthed(!!session)
      setAuthChecked(true)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setAuthed(!!session)
    })
    return () => { alive = false; subscription.unsubscribe() }
  }, [supabase])

  useEffect(() => {
    if (!authChecked || authed || signInRef.current) return
    signInRef.current = true
    setTimeout(() => router.replace("/"), 2500)
  }, [authChecked, authed, router])

  // ── File management ──────────────────────────────────────────────────────
  const addFile = useCallback(() => {
    const newId = uid()
    const newName = `file${files.length + 1}.py`
    setFiles(prev => [...prev, { id: newId, name: newName, code: "" }])
    setActiveId(newId)
  }, [files.length])

  const removeFile = useCallback((id: string) => {
    if (files.length === 1) return // must keep at least 1
    setFiles(prev => {
      const next = prev.filter(f => f.id !== id)
      if (activeId === id) setActiveId(next[0].id)
      return next
    })
  }, [files.length, activeId])

  const startRename = useCallback((file: CodeFile) => {
    setEditingId(file.id)
    setEditingName(file.name)
  }, [])

  const commitRename = useCallback(() => {
    if (!editingId) return
    const trimmed = editingName.trim()
    if (trimmed) {
      setFiles(prev => prev.map(f =>
        f.id === editingId ? { ...f, name: trimmed.endsWith(".py") ? trimmed : trimmed + ".py" } : f
      ))
    }
    setEditingId(null)
  }, [editingId, editingName])

  const updateCode = useCallback((val: string) => {
    setFiles(prev => prev.map(f => f.id === activeId ? { ...f, code: val } : f))
  }, [activeId])

  // ── Runtime ──────────────────────────────────────────────────────────────
  const loadRuntime = useCallback(async (): Promise<PyodideRuntime> => {
    if (pyRef.current) return pyRef.current
    setStatus("loading-rt")
    try {
      await loadPyodideScript()
      const rt = await window.loadPyodide!({ indexURL: PYODIDE_CDN })
      pyRef.current = rt
      setRtReady(true)
      return rt
    } catch (e) {
      setStatus("error"); setStderr(toMessage(e)); throw e
    }
  }, [])

  const runCode = useCallback(async () => {
    if (status === "running" || status === "loading-rt") return
    const code = activeFile.code
    if (!code.trim()) { setStderr("No code to run."); return }

    setStdout(""); setStderr(""); setStatus("running")

    const harness = `
import builtins, contextlib, io, json, traceback
_out = io.StringIO(); _err = io.StringIO()
_lines = __stdin_text.splitlines(); _idx = 0

def _input(prompt=""):
    global _idx
    if _idx >= len(_lines): raise EOFError("No more input.")
    v = _lines[_idx]; _idx += 1; return v

builtins.input = _input
try:
    with contextlib.redirect_stdout(_out), contextlib.redirect_stderr(_err):
        exec(__user_code, {})
except Exception:
    _err.write(traceback.format_exc())
finally:
    builtins.input = input

json.dumps({"stdout": _out.getvalue(), "stderr": _err.getvalue()})
`
    let rt: PyodideRuntime | null = null
    try {
      rt = await loadRuntime()
      rt.globals.set("__user_code",  code)
      rt.globals.set("__stdin_text", stdin)
      const raw    = await withTimeout(rt.runPythonAsync(harness), TIMEOUT_MS)
      const parsed = JSON.parse(String(raw)) as { stdout: string; stderr: string }
      setStdout(parsed.stdout)
      setStderr(parsed.stderr)
      setStatus(parsed.stderr ? "error" : "done")
    } catch (e) {
      setStderr(toMessage(e)); setStatus("error")
    } finally {
      if (rt) {
        try { rt.globals.delete("__user_code"); rt.globals.delete("__stdin_text") } catch {}
      }
      setStatus((s) => (s === "running" ? "done" : s))
    }
  }, [activeFile.code, stdin, status, loadRuntime])

  const downloadCode = useCallback(() => {
    const blob = new Blob([activeFile.code], { type: "text/plain" })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement("a")
    a.href = url; a.download = activeFile.name; a.click()
    URL.revokeObjectURL(url)
  }, [activeFile])

  const resetCode = useCallback(() => {
    setFiles(prev => prev.map(f => f.id === activeId ? { ...f, code: DEFAULT_CODE } : f))
    setStdout(""); setStderr(""); setStatus("idle")
  }, [activeId])

  const statusLabel: Record<Status, string> = {
    idle:         rtReady ? "Ready" : "Idle",
    "loading-rt": "Loading…",
    running:      "Running…",
    done:         "Done",
    error:        "Error",
  }
  const statusColor: Record<Status, string> = {
    idle:         isDark ? "#565f89" : "#6b7280",
    "loading-rt": "#e3b341",
    running:      "#3b82f6",
    done:         "#22c55e",
    error:        "#ef4444",
  }

  const extensions = useMemo(() => [python()], [])

  // ── Auth screens ──────────────────────────────────────────────────────────
  if (!mounted || !authChecked) {
    return (
      <div className="cc-auth-screen">
        <Loader2 className="cc-spin" style={{ width: 22, height: 22 }} />
        <span>Checking access…</span>
      </div>
    )
  }

  if (!authed) {
    return (
      <div className="cc-auth-screen">
        <div className="cc-auth-card">
          <div className="cc-auth-icon"><Terminal size={30} /></div>
          <h1 className="cc-auth-title">Sign in required</h1>
          <p className="cc-auth-desc">
            You need to be signed in to use the Python Compiler.
            Redirecting you to the home page…
          </p>
          <div className="cc-auth-dots">
            <span /><span /><span />
          </div>
        </div>
      </div>
    )
  }

  // ── Main IDE ─────────────────────────────────────────────────────────────
  return (
    <div className={`cc-page ${isDark ? "cc-dark" : "cc-light"}`}>

      {/* ── Top bar ── */}
      <div className="cc-topbar">
        {/* Left: Back button */}
        <div className="cc-topbar-left">
          <button className="cc-back-btn" onClick={() => router.push("/dashboard")}>
            <ArrowLeft size={14} />
            Back to Dashboard
          </button>
          <div className="cc-lang-pill">
            <FileCode2 size={13} />
            Python 3
          </div>
        </div>

        {/* Right: controls */}
        <div className="cc-topbar-right">
          <span className="cc-badge" style={{ color: statusColor[status] }}>
            <span className="cc-badge-dot" style={{ background: statusColor[status] }} />
            {statusLabel[status]}
          </span>

          <button className="cc-icon-btn" title="Download active file" onClick={downloadCode}>
            <Download size={15} />
          </button>
          <button className="cc-icon-btn" title="Reset to default" onClick={resetCode}>
            <RotateCcw size={15} />
          </button>
          <button
            className="cc-icon-btn"
            title={isDark ? "Light mode" : "Dark mode"}
            onClick={() => setIsDark((d) => !d)}
          >
            {isDark ? <Sun size={15} /> : <Moon size={15} />}
          </button>

          <button
            id="run-code-btn"
            className="cc-run-btn"
            onClick={runCode}
            disabled={status === "running" || status === "loading-rt"}
          >
            {(status === "running" || status === "loading-rt")
              ? <Loader2 size={13} className="cc-spin" />
              : <Play    size={13} fill="currentColor" />}
            {status === "loading-rt" ? "Loading…"
              : status === "running"  ? "Running…"
              : "Run"}
          </button>
        </div>
      </div>

      {/* ── File tabs ── */}
      <div className="cc-tabs-bar">
        <div className="cc-tabs-list">
          {files.map(file => (
            <div
              key={file.id}
              className={`cc-tab ${activeId === file.id ? "cc-tab-active" : ""}`}
              onClick={() => setActiveId(file.id)}
            >
              {editingId === file.id ? (
                <input
                  className="cc-tab-input"
                  value={editingName}
                  autoFocus
                  onChange={e => setEditingName(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={e => {
                    if (e.key === "Enter") commitRename()
                    if (e.key === "Escape") setEditingId(null)
                  }}
                  onClick={e => e.stopPropagation()}
                />
              ) : (
                <span className="cc-tab-name">{file.name}</span>
              )}

              {activeId === file.id && (
                <>
                  {editingId === file.id ? (
                    <button
                      className="cc-tab-action"
                      onClick={e => { e.stopPropagation(); commitRename() }}
                      title="Confirm rename"
                    >
                      <Check size={11} />
                    </button>
                  ) : (
                    <button
                      className="cc-tab-action"
                      onClick={e => { e.stopPropagation(); startRename(file) }}
                      title="Rename file"
                    >
                      <Pencil size={11} />
                    </button>
                  )}
                  {files.length > 1 && (
                    <button
                      className="cc-tab-action cc-tab-close"
                      onClick={e => { e.stopPropagation(); removeFile(file.id) }}
                      title="Close file"
                    >
                      <X size={11} />
                    </button>
                  )}
                </>
              )}
            </div>
          ))}

          {/* + New file — inline after last tab, like VS Code */}
          <button className="cc-tab-add" onClick={addFile} title="New file (Ctrl+Shift+N)">
            <Plus size={13} />
          </button>
        </div>
      </div>

      {/* ── Editor + IO split ── */}
      <div className="cc-workspace">
        <PanelGroup direction="horizontal" className="cc-panel-group">

          {/* Left: CodeMirror */}
          <Panel defaultSize={58} minSize={25}>
            <div className="cc-editor-shell">
              <CodeMirror
                key={activeId}
                value={activeFile.code}
                height="100%"
                theme={isDark ? [oneDark, darkTheme] : lightTheme}
                extensions={extensions}
                onChange={(val) => updateCode(val)}
                basicSetup={{
                  lineNumbers:             true,
                  foldGutter:              false,
                  dropCursor:              true,
                  allowMultipleSelections: false,
                  indentOnInput:           true,
                  bracketMatching:         true,
                  closeBrackets:           true,
                  autocompletion:          true,
                  highlightActiveLine:     true,
                  highlightSelectionMatches: true,
                  tabSize:                 4,
                }}
                style={{ height: "100%" }}
              />
            </div>
          </Panel>

          {/* Drag handle */}
          <PanelResizeHandle className="cc-resize-handle">
            <div className="cc-grip">
              <span /><span /><span /><span /><span /><span />
            </div>
          </PanelResizeHandle>

          {/* Right: Input + Output */}
          <Panel defaultSize={42} minSize={20}>
            <div className="cc-io-panel">

              {/* Input section */}
              <div className="cc-input-section">
                <textarea
                  className="cc-stdin"
                  value={stdin}
                  onChange={(e) => setStdin(e.target.value)}
                  placeholder="Enter Input here"
                  spellCheck={false}
                />
              </div>

              {/* Hint */}
              <div className="cc-hint">
                If your code takes input,{" "}
                <span className="cc-hint-link">add it</span>{" "}
                in the above box before running.
              </div>

              {/* Output section */}
              <div className="cc-output-section">
                <div className="cc-output-label">Output</div>
                <div className="cc-output-content">
                  {status === "running" || status === "loading-rt" ? (
                    <div className="cc-io-running">
                      <Loader2 size={15} className="cc-spin" />
                      <span>
                        {status === "loading-rt"
                          ? "Loading Python runtime — first run ~10s…"
                          : "Executing…"}
                      </span>
                    </div>
                  ) : stdout || stderr ? (
                    <>
                      {stdout && <pre className="cc-pre cc-stdout">{stdout}</pre>}
                      {stderr && <pre className="cc-pre cc-stderr">{stderr}</pre>}
                    </>
                  ) : null}
                </div>
              </div>

            </div>
          </Panel>
        </PanelGroup>
      </div>
    </div>
  )
}
