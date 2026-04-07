// skifree-api worker.
// Routes:
//   GET  /ski/api/leaderboard      -> top 10 scores
//   POST /ski/api/score            -> { name, score }
//   *                              -> serves static assets from ../

const MAX_NAME_LEN = 16;
const MAX_SCORE = 10_000_000;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Redirect bare /ski to /ski/ so relative asset paths resolve correctly.
    if (url.pathname === '/ski') {
      return Response.redirect(url.origin + '/ski/', 301);
    }

    // Strip the /ski prefix when bound to mccarrison.me/ski/*
    let path = url.pathname;
    if (path.startsWith('/ski/')) path = path.slice(4) || '/';
    else if (path === '/ski') path = '/';

    if (path === '/api/leaderboard' && request.method === 'GET') {
      return getLeaderboard(env);
    }
    if (path === '/api/score' && request.method === 'POST') {
      return postScore(request, env);
    }
    if (path === '/api/feedback' && request.method === 'POST') {
      return postFeedback(request, env);
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

  return getLeaderboard(env);
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
    const text = await r.text();
    return json({ error: 'github error', status: r.status, detail: text.slice(0, 500) }, 502);
  }
  const data = await r.json();
  return json({ ok: true, url: data.html_url });
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
