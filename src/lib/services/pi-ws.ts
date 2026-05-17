/**
 * Pi WebSocket Client (pipane-style exact match)
 */
export class PiWebSocketClient {
  private ws: WebSocket | null = null;
  private listeners: Map<string, Function[]> = new Map();
  private connected = false;

  connect(url: string = 'ws://localhost:8643') {
    if (this.ws) this.disconnect();
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      console.log('[pi-ws] Connected');
      this.connected = true;
      this.emit('open');
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'stream' && msg.data) {
          this.handlePiEvent(msg.data);
        }
      } catch (e) {
        console.warn('[pi-ws] Parse error');
      }
    };

    this.ws.onclose = () => {
      console.log('[pi-ws] Disconnected');
      this.connected = false;
      this.emit('close');
    };

    this.ws.onerror = (err) => {
      console.error('[pi-ws] Error:', err);
    };
  }

  /**
   * Exact pipane-style event handling
   */
  private handlePiEvent(data: any) {
    if (!data) return;

    // === Streaming deltas (this is what pipane listens for) ===
    if (data.type === 'message_update' && data.assistantMessageEvent) {
      const ev = data.assistantMessageEvent;

      if (ev.type === 'text_delta' && ev.delta) {
        this.emit('stream', { type: 'text', content: ev.delta });
        return;
      }

      if (ev.type === 'text_start') {
        this.emit('status', { type: 'text_start' });
        return;
      }

      if (ev.type === 'text_end') {
        this.emit('status', { type: 'text_end' });
        return;
      }
    }

    // Final turn / agent end → commit the message (pipane does this)
    if (data.type === 'agent_end' || data.type === 'turn_end') {
      this.emit('done');
      return;
    }

    // Other status events
    if (['agent_start', 'turn_start', 'message_start', 'message_end'].includes(data.type)) {
      this.emit('status', { type: data.type });
    }
  }

  sendPrompt(text: string, options: any = {}) {
    if (this.ws?.readyState === 1) {
      this.ws.send(JSON.stringify({
        type: 'prompt',
        text,
        model: options.model,
        sessionId: options.sessionId
      }));
    }
  }

  stop() {
    if (this.ws?.readyState === 1) {
      this.ws.send(JSON.stringify({ type: 'stop' }));
    }
  }

  on(event: string, cb: Function) {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event)!.push(cb);
  }

  off(event: string, cb?: Function) {
    if (!this.listeners.has(event)) return;
    if (cb) {
      const arr = this.listeners.get(event)!;
      const i = arr.indexOf(cb);
      if (i > -1) arr.splice(i, 1);
    } else {
      this.listeners.delete(event);
    }
  }

  private emit(event: string, data?: any) {
    const cbs = this.listeners.get(event) || [];
    cbs.forEach(cb => {
      try { cb(data); } catch (e) {}
    });
  }

  isConnected() {
    return this.connected && this.ws?.readyState === 1;
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
  }
}

export const piWs = new PiWebSocketClient();