"use client"

import CodeMirror from "@uiw/react-codemirror"
import { python } from "@codemirror/lang-python"
import { oneDark } from "@codemirror/theme-one-dark"
import { EditorView } from "@codemirror/view"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { PanelGroup, Panel, PanelResizeHandle } from "react-resizable-panels"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import {
  Play,
  Loader2,
  Sun,
  Moon,
  Download,
  RotateCcw,
  Terminal,
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

// ── Constants ───────────────────────────────────────────────────────────────
const DEFAULT_CODE = `# cook your dish here

def main():
    print("Hello, World!")

main()`

const CODE_KEY    = "cc:python:code"
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

// ── CodeMirror dark theme (extends oneDark) ──────────────────────────────────
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

// ── CodeMirror light theme — warm beige to match BSPrep site ───────────────
const lightTheme = EditorView.theme({
  "&": {
    height: "100%",
    fontFamily: "'Fira Code', 'Cascadia Code', Menlo, Consolas, monospace",
    fontSize: "13.5px",
    backgroundColor: "#FFFDF8",
  },
  ".cm-content": { padding: "8px 0", caretColor: "#3d3222" },
  ".cm-cursor, .cm-dropCursor": {
    borderLeftColor: "#3d3222 !important",
    borderLeftWidth: "2px !important",
  },
  ".cm-gutters": {
    backgroundColor: "#F0E9D6 !important",
    color: "#a8967a !important",
    border: "none !important",
    borderRight: "1px solid #D4C8A8 !important",
    minWidth: "44px",
    userSelect: "none",
  },
  ".cm-lineNumbers .cm-gutterElement": {
    padding: "0 10px 0 4px",
    minWidth: "36px",
    textAlign: "right",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "#E8DFC8 !important",
    color: "#5a4a2e !important",
  },
  ".cm-activeLine": { backgroundColor: "#F5EDD8 !important" },
  ".cm-line": { paddingLeft: "12px", paddingRight: "8px" },
  ".cm-selectionBackground, ::selection": {
    backgroundColor: "#D4C5A0 !important",
  },
  ".cm-focused .cm-selectionBackground": {
    backgroundColor: "#D4C5A0 !important",
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

  const [isDark,  setIsDark]  = useState(true)
  const [mounted, setMounted] = useState(false)

  const [authChecked, setAuthChecked] = useState(false)
  const [authed,      setAuthed]      = useState(false)

  const [code,  setCode]  = useState(DEFAULT_CODE)
  const [stdin, setStdin] = useState("")

  type Status = "idle" | "loading-rt" | "running" | "done" | "error"
  const [stdout,  setStdout]  = useState("")
  const [stderr,  setStderr]  = useState("")
  const [status,  setStatus]  = useState<Status>("idle")
  const [rtReady, setRtReady] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!mounted) return
    const dark  = localStorage.getItem(THEME_KEY)
    const saved = localStorage.getItem(CODE_KEY)
    const sin   = localStorage.getItem(STDIN_KEY)
    if (dark === "false") setIsDark(false)
    if (saved) setCode(saved)
    if (sin)   setStdin(sin)
  }, [mounted])

  useEffect(() => { if (mounted) localStorage.setItem(THEME_KEY, String(isDark)) }, [isDark, mounted])
  useEffect(() => { if (mounted) localStorage.setItem(CODE_KEY,  code) },  [code,  mounted])
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
  }, [code, stdin, status, loadRuntime])

  const downloadCode = useCallback(() => {
    const blob = new Blob([code], { type: "text/plain" })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement("a")
    a.href = url; a.download = "solution.py"; a.click()
    URL.revokeObjectURL(url)
  }, [code])

  const resetCode = useCallback(() => {
    setCode(DEFAULT_CODE); setStdout(""); setStderr(""); setStatus("idle")
  }, [])

  const statusLabel: Record<Status, string> = {
    idle:         rtReady ? "Ready" : "Idle",
    "loading-rt": "Loading…",
    running:      "Running…",
    done:         "Done",
    error:        "Error",
  }
  const statusColor: Record<Status, string> = {
    idle:         "#565f89",
    "loading-rt": "#e3b341",
    running:      "#58a6ff",
    done:         "#3fb950",
    error:        "#f85149",
  }

  const extensions = useMemo(() => [python()], [])

  // ── Auth screens
  if (!mounted || !authChecked) {
    return (
      <>
        <Navbar isAuthenticated={false} />
        <div className="cc-auth-screen">
          <Loader2 className="cc-spin" style={{ width: 22, height: 22 }} />
          <span>Checking access…</span>
        </div>
      </>
    )
  }

  if (!authed) {
    return (
      <>
        <Navbar isAuthenticated={false} />
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
      </>
    )
  }

  // ── Main IDE
  return (
    <>
      <Navbar isAuthenticated={authed} />
      <div className={`cc-page ${isDark ? "cc-dark" : "cc-light"}`}>

      {/* ── Compiler toolbar (below site navbar) ── */}
      <div className="cc-toolbar">
        <div className="cc-toolbar-left">
          <div className="cc-lang-pill">
            <span className="cc-lang-dot" />
            Python3
          </div>
        </div>

        <div className="cc-toolbar-right">
          <span className="cc-badge" style={{ color: statusColor[status] }}>
            <span className="cc-badge-dot" style={{ background: statusColor[status] }} />
            {statusLabel[status]}
          </span>

          <button className="cc-icon-btn" title="Download" onClick={downloadCode}>
            <Download size={15} />
          </button>
          <button className="cc-icon-btn" title="Reset" onClick={resetCode}>
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

      {/* ── Editor + IO split ── */}
      <div className="cc-workspace">
        <PanelGroup direction="horizontal" className="cc-panel-group">

          {/* Left: CodeMirror */}
          <Panel defaultSize={58} minSize={25}>
            <div className="cc-editor-shell">
              <CodeMirror
                value={code}
                height="100%"
                theme={isDark ? [oneDark, darkTheme] : lightTheme}
                extensions={extensions}
                onChange={(val) => setCode(val)}
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

          {/* Right: Input on top, Output below */}
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
      <Footer />
    </>
  )
}
