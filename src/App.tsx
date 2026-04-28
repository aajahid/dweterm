import { useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import "./App.css";

function App() {
  const terminalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!terminalRef.current) {
      return;
    }

    let disposed = false;
    let terminalStarted = false;

    const terminal = new Terminal({
      allowProposedApi: true,
      cursorBlink: true,
      fontFamily: "Cascadia Mono, Consolas, monospace",
      fontSize: 14,
      scrollback: 5000,
      theme: {
        background: "#0d1117",
        foreground: "#d6deeb",
        cursor: "#f8fafc",
        selectionBackground: "#334155",
      },
    });
    const fitAddon = new FitAddon();

    terminal.loadAddon(fitAddon);
    terminal.open(terminalRef.current);
    fitAddon.fit();

    const resizeTerminal = () => {
      fitAddon.fit();

      if (!terminalStarted) {
        return;
      }

      invoke("resize_terminal", {
        cols: terminal.cols,
        rows: terminal.rows,
      }).catch((error) => {
        terminal.write(`\r\n[DweTerm] resize failed: ${String(error)}\r\n`);
      });
    };

    const startTerminal = async () => {
      try {
        await invoke("start_terminal", {
          cols: terminal.cols,
          rows: terminal.rows,
        });
        terminalStarted = true;
      } catch (error) {
        terminal.write(`\r\n[DweTerm] failed to start terminal: ${String(error)}\r\n`);
      }
    };

    const outputListener = listen<string>("terminal-output", (event) => {
      terminal.write(event.payload);
    });

    const exitListener = listen("terminal-exit", () => {
      if (!disposed) {
        terminal.write("\r\n[DweTerm] terminal process exited\r\n");
      }
      terminalStarted = false;
    });

    const inputDisposable = terminal.onData((data) => {
      if (!terminalStarted) {
        return;
      }

      invoke("write_terminal", { data }).catch((error) => {
        terminal.write(`\r\n[DweTerm] write failed: ${String(error)}\r\n`);
      });
    });

    const resizeObserver = new ResizeObserver(resizeTerminal);
    resizeObserver.observe(terminalRef.current);
    window.addEventListener("resize", resizeTerminal);
    void startTerminal();

    return () => {
      disposed = true;
      resizeObserver.disconnect();
      window.removeEventListener("resize", resizeTerminal);
      inputDisposable.dispose();
      void outputListener.then((unlisten) => unlisten());
      void exitListener.then((unlisten) => unlisten());
      void invoke("stop_terminal");
      terminal.dispose();
    };
  }, []);

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">DweTerm</p>
          <h1>AI-aware terminal</h1>
        </div>
        <span className="status-pill">PowerShell</span>
      </header>

      <section className="terminal-panel" aria-label="DweTerm terminal">
        <div ref={terminalRef} className="terminal-host" />
      </section>
    </main>
  );
}

export default App;
