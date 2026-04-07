// Room: Durable Object that relays WebSocket messages between up to 2 clients.
// Hibernatable WS so the DO sleeps between messages.
//
// Message protocol (JSON):
//   client -> DO: { type: 'hello', name?: string }
//   DO -> client: { type: 'welcome', id, isHost, seed, peers: [{id, name}] }
//   DO -> peers : { type: 'peerJoined', id, name }
//   client -> DO: { type: 'ready' }
//   DO -> all   : { type: 'peerReady', id }
//   DO -> all   : { type: 'start', countdownMs: 3000 }   (when all ready)
//   client -> DO: { type: 'state', ... }   (relayed verbatim to peers, with id added)
//   client -> DO: { type: 'died' }         (relayed verbatim to peers, with id added)
//   DO -> peers : { type: 'peerLeft', id, wasHost }   (on close)

const MAX_CLIENTS = 2;
const IDLE_TTL_MS = 10 * 60 * 1000; // 10 min before first start
const EMPTY_TTL_MS = 60 * 1000;     // 60s after empty

export class Room {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.seed = null;
    this.hostId = null;
    this.nextId = 1;
    this.started = false;
  }

  async fetch(request) {
    const url = new URL(request.url);

    // Internal init endpoint: POST /init { seed }
    if (url.pathname.endsWith('/init') && request.method === 'POST') {
      const body = await request.json();
      const seed = (body.seed >>> 0);
      await this.state.storage.put('seed', seed);
      await this.state.storage.setAlarm(Date.now() + IDLE_TTL_MS);
      this.seed = seed;
      return new Response(JSON.stringify({ ok: true }), {
        headers: { 'content-type': 'application/json' }
      });
    }

    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('expected websocket', { status: 426 });
    }

    // Lazy-load seed
    if (this.seed === null) {
      this.seed = await this.state.storage.get('seed');
      if (this.seed == null) {
        return new Response('room not initialized', { status: 404 });
      }
    }
    if (this.hostId === null) {
      this.hostId = (await this.state.storage.get('hostId')) ?? null;
    }
    if (this.nextId === 1) {
      this.nextId = (await this.state.storage.get('nextId')) ?? 1;
    }

    const existing = this.state.getWebSockets();
    if (existing.length >= MAX_CLIENTS) {
      return new Response('room full', { status: 409 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    const id = this.nextId++;
    await this.state.storage.put('nextId', this.nextId);
    if (this.hostId === null) {
      this.hostId = id;
      await this.state.storage.put('hostId', id);
    }

    this.state.acceptWebSocket(server);
    server.serializeAttachment({ id, name: null, ready: false, isHost: id === this.hostId });

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws, msg) {
    let data;
    try { data = JSON.parse(msg); } catch { return; }

    const meta = ws.deserializeAttachment() || {};

    if (this.hostId === null) {
      this.hostId = (await this.state.storage.get('hostId')) ?? null;
    }
    if (this.seed === null) {
      this.seed = await this.state.storage.get('seed');
    }

    switch (data.type) {
      case 'hello': {
        let name = (typeof data.name === 'string' && data.name.trim())
          ? data.name.trim().slice(0, 16)
          : null;
        if (!name) name = `anon${meta.id}`;
        meta.name = name;
        ws.serializeAttachment(meta);

        const peers = this.peers().filter(p => p.id !== meta.id).map(p => ({ id: p.id, name: p.name }));
        ws.send(JSON.stringify({
          type: 'welcome',
          id: meta.id,
          isHost: meta.isHost,
          seed: this.seed,
          peers,
        }));
        this.broadcastExcept(meta.id, { type: 'peerJoined', id: meta.id, name });
        break;
      }
      case 'ready': {
        meta.ready = true;
        ws.serializeAttachment(meta);
        this.broadcast({ type: 'peerReady', id: meta.id });
        const all = this.peers();
        if (all.length >= 2 && all.every(p => p.ready)) {
          // Reset ready flags so a future rematch can fire 'start' again
          for (const sock of this.state.getWebSockets()) {
            const m = sock.deserializeAttachment() || {};
            m.ready = false;
            sock.serializeAttachment(m);
          }
          // Generate a NEW seed for this run (each rematch is a fresh hill)
          const newSeed = crypto.getRandomValues(new Uint32Array(1))[0];
          this.seed = newSeed;
          await this.state.storage.put('seed', newSeed);
          this.started = true;
          await this.state.storage.deleteAlarm();
          this.broadcast({ type: 'start', countdownMs: 3000, seed: newSeed });
        }
        break;
      }
      case 'state':
      case 'died': {
        const payload = { ...data, id: meta.id };
        this.broadcastExcept(meta.id, payload);
        break;
      }
      default:
        break;
    }
  }

  async webSocketClose(ws, code, reason, wasClean) {
    const meta = ws.deserializeAttachment() || {};
    const wasHost = meta.isHost === true;
    try { ws.close(); } catch {}
    this.broadcast({ type: 'peerLeft', id: meta.id, wasHost });
    if (this.state.getWebSockets().length === 0) {
      await this.state.storage.setAlarm(Date.now() + EMPTY_TTL_MS);
    }
  }

  async webSocketError(ws, err) {
    try { ws.close(); } catch {}
  }

  async alarm() {
    if (this.state.getWebSockets().length === 0) {
      await this.state.storage.deleteAll();
    }
  }

  peers() {
    return this.state.getWebSockets().map(ws => {
      const m = ws.deserializeAttachment() || {};
      return { id: m.id, name: m.name, ready: !!m.ready, isHost: !!m.isHost, ws };
    });
  }
  broadcast(obj) {
    const msg = JSON.stringify(obj);
    for (const ws of this.state.getWebSockets()) {
      try { ws.send(msg); } catch {}
    }
  }
  broadcastExcept(excludeId, obj) {
    const msg = JSON.stringify(obj);
    for (const p of this.peers()) {
      if (p.id !== excludeId) {
        try { p.ws.send(msg); } catch {}
      }
    }
  }
}
