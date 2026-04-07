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
  let peer = null;          // {id, name} of the other player when present
  let closed = false;

  function emit(event, payload) {
    (listeners[event] || []).forEach(fn => { try { fn(payload); } catch (e) { console.error(e); } });
  }

  function buildWsUrl(roomCode) {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const base = location.pathname.startsWith('/ski/') || location.pathname === '/ski'
      ? '/ski'
      : '';
    return `${proto}//${location.host}${base}/api/room/${roomCode}`;
  }

  function buildHttpUrl(path) {
    const base = location.pathname.startsWith('/ski/') || location.pathname === '/ski'
      ? '/ski'
      : '';
    return `${base}${path}`;
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
          if (data.peers && data.peers.length > 0) peer = data.peers[0];
          emit('welcome', data);
          break;
        case 'peerJoined':
          peer = { id: data.id, name: data.name };
          emit('peerJoined', data);
          break;
        case 'peerReady':
          emit('peerReady', data);
          break;
        case 'start':
          if (typeof data.seed === 'number') seed = data.seed;
          emit('start', data);
          break;
        case 'state':
          emit('state', data);
          break;
        case 'died':
          emit('died', data);
          break;
        case 'peerLeft':
          peer = null;
          emit('peerLeft', data);
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
      if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'ready' }));
    },
    sendState(payload) {
      if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'state', ...payload }));
    },
    sendDied() {
      if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'died' }));
    },
    close() {
      if (ws) { try { ws.close(); } catch {} }
    },
    get code() { return code; },
    get seed() { return seed; },
    get id() { return id; },
    get isHost() { return isHost; },
    get peer() { return peer; },
    get closed() { return closed; },
  };
}
