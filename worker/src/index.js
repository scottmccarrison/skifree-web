// skifree-api worker (also used by skidev-api via wrangler.dev.toml).
// Path prefix is read from env.PATH_PREFIX (defaults to "/ski") so the same
// code can serve mccarrison.me/ski (prod) and mccarrison.me/skidev (dev).
// Routes (relative to the prefix):
//   GET  /api/leaderboard      -> top 10 scores
//   POST /api/score            -> { name, score }
//   *                          -> serves static assets from ../

export { Room } from './room.js';

const MAX_NAME_LEN = 16;
const MAX_SCORE = 100_000;

// Per-IP rate limiter using D1 for persistence across isolates.
async function rateLimit(db, ip, bucket, maxHits, windowMs) {
  const now = Date.now();
  const cutoff = now - windowMs;
  const key = `${bucket}:${ip}`;
  // Count recent hits
  const row = await db.prepare(
    `SELECT COUNT(*) as cnt FROM rate_limits WHERE key = ? AND ts > ?`
  ).bind(key, cutoff).first();
  if (row && row.cnt >= maxHits) return false;
  // Record this hit
  await db.prepare(
    `INSERT INTO rate_limits (key, ts) VALUES (?, ?)`
  ).bind(key, now).run();
  return true;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const prefix = (env.PATH_PREFIX || '/ski');

    // Redirect bare prefix to prefix + '/' so relative asset paths resolve.
    if (url.pathname === prefix) {
      return Response.redirect(url.origin + prefix + '/', 301);
    }

    // Strip the configured prefix when bound to mccarrison.me/<prefix>/*
    let path = url.pathname;
    if (path.startsWith(prefix + '/')) path = path.slice(prefix.length) || '/';

    if (path === '/api/leaderboard' && request.method === 'GET') {
      return getLeaderboard(env);
    }
    if (path === '/api/leaderboard/v2' && request.method === 'GET') {
      return getLeaderboardV2(env);
    }
    if (path === '/api/score' && request.method === 'POST') {
      const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
      if (!await rateLimit(env.DB, ip, 'score', 6, 60_000)) {
        return json({ error: 'too many scores, slow down' }, 429);
      }
      return postScore(request, env);
    }
    if (path === '/api/feedback' && request.method === 'POST') {
      const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
      if (!await rateLimit(env.DB, ip, 'feedback', 2, 3600_000)) {
        return json({ error: 'feedback rate limited, try again later' }, 429);
      }
      return postFeedback(request, env);
    }

    if (path === '/api/room' && request.method === 'POST') {
      const code = generateRoomCode();
      const seed = crypto.getRandomValues(new Uint32Array(1))[0];
      const id = env.ROOMS.idFromName(code);
      const stub = env.ROOMS.get(id);
      await stub.fetch('https://room/init', {
        method: 'POST',
        body: JSON.stringify({ seed }),
        headers: { 'content-type': 'application/json' }
      });
      return new Response(JSON.stringify({ code, seed }), {
        headers: { 'content-type': 'application/json' }
      });
    }

    const roomMatch = path.match(/^\/api\/room\/([A-Z]{4})$/);
    if (roomMatch && request.headers.get('Upgrade') === 'websocket') {
      const code = roomMatch[1];
      const id = env.ROOMS.idFromName(code);
      const stub = env.ROOMS.get(id);
      return stub.fetch(request);
    }

    // Static assets - rewrite the request URL so the asset bundle (which
    // has files at /js/main.js, /css/style.css, etc.) is asked for the
    // stripped path, not the /ski-prefixed one.
    const assetUrl = new URL(request.url);
    assetUrl.pathname = path;
    return env.ASSETS.fetch(new Request(assetUrl.toString(), request));
  },
};

async function getLeaderboard(env) {
  const { results } = await env.DB.prepare(
    `SELECT name, score, created_at
       FROM scores
      ORDER BY score DESC
      LIMIT 10`
  ).all();
  return json({ scores: results || [] });
}

// v2: returns daily (since UTC midnight), all-time top 10, persistent
// top score ever, and the next reset timestamp.
async function getLeaderboardV2(env) {
  const now = new Date();
  const utcMidnight = Date.UTC(
    now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()
  );
  const nextResetMs = utcMidnight + 24 * 60 * 60 * 1000;

  const [dailyRes, allRes, topRes] = await Promise.all([
    env.DB.prepare(
      `SELECT name, score, created_at FROM scores
        WHERE created_at >= ?
        ORDER BY score DESC LIMIT 10`
    ).bind(utcMidnight).all(),
    env.DB.prepare(
      `SELECT name, score, created_at FROM scores
        ORDER BY score DESC LIMIT 10`
    ).all(),
    env.DB.prepare(
      `SELECT name, score, created_at FROM scores
        ORDER BY score DESC LIMIT 1`
    ).all(),
  ]);

  return json({
    // v1 compat: old clients read `scores` and ignore the rest.
    scores: allRes.results || [],
    daily: dailyRes.results || [],
    alltime: allRes.results || [],
    topEver: (topRes.results && topRes.results[0]) || null,
    resetsAt: nextResetMs,
    serverNow: Date.now(),
  });
}

async function postScore(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid json' }, 400);
  }

  const name = String(body.name ?? '').trim().slice(0, MAX_NAME_LEN) || 'anon';
  const score = Math.floor(Number(body.score));
  if (!Number.isFinite(score) || score < 0 || score > MAX_SCORE) {
    return json({ error: 'invalid score' }, 400);
  }

  await env.DB.prepare(
    `INSERT INTO scores (name, score, created_at) VALUES (?, ?, ?)`
  ).bind(name, score, Date.now()).run();

  return getLeaderboardV2(env);
}

async function postFeedback(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid json' }, 400);
  }

  const message = String(body.message ?? '').trim().slice(0, 4000);
  if (message.length < 3) {
    return json({ error: 'message too short' }, 400);
  }
  const meta = String(body.meta ?? '').slice(0, 500);

  if (!env.GITHUB_TOKEN) {
    return json({ error: 'feedback not configured' }, 500);
  }

  const firstLine = message.split('\n')[0].slice(0, 60);
  const title = `feedback: ${firstLine}`;
  const issueBody =
    `${message}\n\n---\n${meta}\n\n_submitted via in-game feedback button_`;

  const r = await fetch(
    'https://api.github.com/repos/scottmccarrison/skifree-web/issues',
    {
      method: 'POST',
      headers: {
        'authorization': `Bearer ${env.GITHUB_TOKEN}`,
        'accept': 'application/vnd.github+json',
        'user-agent': 'skifree-web-feedback',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ title, body: issueBody, labels: ['feedback'] }),
    }
  );

  if (!r.ok) {
    return json({ error: 'could not submit feedback, try again later' }, 502);
  }
  const data = await r.json();
  return json({ ok: true, url: data.html_url });
}

function generateRoomCode() {
  const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const buf = crypto.getRandomValues(new Uint8Array(4));
  let s = '';
  for (let i = 0; i < 4; i++) s += ALPHABET[buf[i] % ALPHABET.length];
  return s;
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store',
    },
  });
}
