import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

/**
 * Drop-in replacement for the two WebSockets the old app used:
 *
 *   new WebSocket(".../api/system/ws")            -> new TauriStream("stats")
 *   new WebSocket(".../api/system/commands/ws")   -> new TauriStream("command")
 *
 * Mirrors the WebSocket surface actually used by components:
 * onopen / onmessage / onclose / onerror / send() / close().
 */

export type StreamKind = "stats" | "command";

interface FrameLike {
  data: string;
}

export class TauriStream {
  onopen: ((ev?: unknown) => void) | null = null;
  onmessage: ((ev: FrameLike) => void) | null = null;
  onclose: ((ev?: unknown) => void) | null = null;
  onerror: ((ev?: unknown) => void) | null = null;

  private id: string | null = null;
  private unlisten: UnlistenFn | null = null;
  private closed = false;

  constructor(
    private kind: StreamKind,
    private payload?: Record<string, unknown>,
  ) {
    void this.connect();
  }

  private async connect() {
    try {
      this.id = await invoke<string>("stream_start", {
        kind: this.kind,
        payload: this.payload ?? null,
      });
    } catch (err) {
      this.onerror?.();
      this.closed = true;
      this.onclose?.();
      return;
    }

    this.unlisten = await listen<string>(`stream:${this.id}`, (event) => {
      const payload = event.payload as string;

      // Control frame emitted at PTY EOF
      if (payload.includes('"__close__"')) {
        try {
          const parsed = JSON.parse(payload);
          if (parsed.type === "__close__") {
            this.handleClose();
            return;
          }
        } catch {
          /* not a control frame */
        }
      }

      this.onmessage?.({ data: payload });
    });

    // Emit open asynchronously like a real socket handshake
    setTimeout(() => this.onopen?.(), 0);
  }

  private handleClose() {
    if (this.closed) return;
    this.closed = true;
    this.cleanup();
    this.onclose?.();
  }

  send(data: string) {
    if (!this.id || this.closed) return;
    void invoke("stream_input", { id: this.id, data }).catch((err) => {
      console.warn("stream_input failed:", err);
    });
  }

  close() {
    if (!this.id || this.closed) return;
    this.closed = true;
    const id = this.id;
    this.cleanup();
    void invoke("stream_stop", { id }).catch(() => undefined);
    this.onclose?.();
  }

  private cleanup() {
    this.unlisten?.();
    this.unlisten = null;
    this.id = null;
  }
}
