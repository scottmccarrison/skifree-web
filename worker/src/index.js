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

    // Strip the /ski prefix when bound to mccarrison.me/ski/*
    let path = url.pathname;
    if (path.startsWith('/ski')) path = path.slice(4) || '/';

    if (path === '/api/leaderboard' && request.method === 'GET') {
      return getLeaderboard(env);
    }
    if (path === '/api/score' && request.method === 'POST') {
      return postScore(request, env);
    }

    // Static assets - delegate to the [assets] binding.
    return env.ASSETS.fetch(request);
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

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store',
    },
  });
}
