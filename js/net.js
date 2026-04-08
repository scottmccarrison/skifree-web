// Multiplayer session: wraps the WebSocket connection to a Room DO.
//
// Usage:
//   const session = createSession();
//   await session.host();   // or session.join('CODE')
//   session.on('welcome', e => ...);
//   session.on('peerJoined', e => ...);
//   session.on('peerReady', e => ...);
//   session.on('start', e => ...);
//   session.on('state', e => ...);
//   session.on('died', e => ...);
//   session.on('peerLeft', e => ...);
//   session.on('error', e => ...);
//   session.on('close', e => ...);
//   session.sendReady();
//   session.sendState({x,y,state,score,seq});
//   session.sendDied();
//   session.close();

export function createSession() {
  const listeners = {};
  let ws = null;
  let code = null;
  let seed = null;
  let id = null;
  let isHost = false;
  let color = 0;
  let inProgress = false;   // true if we joined a room mid-game
  let peer = null;          // {id, name} of the other player when present
  let roster = [];          // [{id, name, color, isHost, ready}]
  let closed = false;

  function syncPeer() {
    // Backwards-compat: first non-self entry as a synthesized "peer".
    const other = roster.find(p => p.id !== id);
    peer = other ? { id: other.id, name: other.name } : null;
  }

  function emit(event, payload) {
    (listeners[event] || []).forEach(fn => { try { fn(payload); } catch (e) { console.error(e); } });
  }

  // Detect the URL prefix the page is served under (e.g. "/ski" or "/skidev")
  // by taking the first path segment. Empty string if served from root.
  function urlPrefix() {
    const m = location.pathname.match(/^\/[^/]+/);
    return m ? m[0] : '';
  }

  function buildWsUrl(roomCode) {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${location.host}${urlPrefix()}/api/room/${roomCode}`;
  }

  function buildHttpUrl(path) {
    return `${urlPrefix()}${path}`;
  }

  function attachSocket(roomCode) {
    code = roomCode;
    ws = new WebSocket(buildWsUrl(roomCode));
    ws.addEventListener('open', () => {
      const nameEl = document.getElementById('name-input');
      const name = nameEl && nameEl.value ? nameEl.value.trim().slice(0, 16) : '';
      ws.send(JSON.stringify({ type: 'hello', name }));
    });
    ws.addEventListener('message', e => {
      let data;
      try { data = JSON.parse(e.data); } catch { return; }
      switch (data.type) {
        case 'welcome':
          id = data.id;
          isHost = !!data.isHost;
          seed = data.seed;
          if (typeof data.color === 'number') color = data.color;
          inProgress = !!data.inProgress;
          roster = Array.isArray(data.roster) ? data.roster.slice() : [];
          syncPeer();
          emit('welcome', data);
          break;
        case 'peerJoined':
          if (typeof data.id === 'number' && !roster.some(p => p.id === data.id)) {
            roster.push({
              id: data.id,
              name: data.name || `anon${data.id}`,
              color: typeof data.color === 'number' ? data.color : 0,
              isHost: false,
              ready: false,
            });
          }
          syncPeer();
          emit('peerJoined', data);
          break;
        case 'peerReady':
          if (typeof data.id === 'number') {
            const r = roster.find(p => p.id === data.id);
            if (r) r.ready = true;
          }
          emit('peerReady', data);
          break;
        case 'start':
          if (typeof data.seed === 'number') seed = data.seed;
          for (const r of roster) r.ready = false;
          emit('start', data);
          break;
        case 'state':
          emit('state', data);
          break;
        case 'died':
          emit('died', data);
          break;
        case 'peerLeft':
          if (typeof data.id === 'number') {
            roster = roster.filter(p => p.id !== data.id);
          }
          syncPeer();
          emit('peerLeft', data);
          break;
        case 'kicked':
          emit('kicked', data);
          break;
        case 'chat':
          emit('chat', data);
          break;
      }
    });
    ws.addEventListener('error', e => emit('error', e));
    ws.addEventListener('close', e => { closed = true; emit('close', e); });
  }

  return {
    on(event, fn) {
      (listeners[event] = listeners[event] || []).push(fn);
    },
    async host() {
      const resp = await fetch(buildHttpUrl('/api/room'), { method: 'POST' });
      if (!resp.ok) throw new Error('failed to create room');
      const body = await resp.json();
      seed = body.seed;
      attachSocket(body.code);
      return body.code;
    },
    join(roomCode) {
      attachSocket(roomCode);
    },
    sendReady() {
      // Returns true if the message went out, false if the socket is not
      // open. Caller uses this to avoid disabling the ready button on a
      // silent send failure (otherwise the user is stuck unable to ready).
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ready' }));
        return true;
      }
      return false;
    },
    sendState(payload) {
      if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'state', ...payload }));
    },
    sendDied() {
      if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'died' }));
    },
    sendChat(presetId) {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'chat', presetId }));
      }
    },
    sendKick(targetId) {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'kick', targetId }));
      }
    },
    close() {
      if (ws) { try { ws.close(); } catch {} }
    },
    get code() { return code; },
    get seed() { return seed; },
    get id() { return id; },
    get isHost() { return isHost; },
    get color() { return color; },
    get inProgress() { return inProgress; },
    get roster() { return roster.slice(); },
    get peer() { return peer; },
    get closed() { return closed; },
  };
}
