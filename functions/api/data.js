async function getFile(path, env) {
  const res = await fetch(`https://api.github.com/repos/${env.GITHUB_REPO}/contents/${path}`, {
    headers: { Authorization: `token ${env.GITHUB_TOKEN}`, 'User-Agent': 'RoyalTrack' }
  })
  if (!res.ok) return null
  const data = await res.json()
  return { data: JSON.parse(atob(data.content.replace(/\n/g, ''))), sha: data.sha }
}

async function putFile(path, content, sha, env) {
  const body = { message: `Update ${path}`, content: btoa(JSON.stringify(content, null, 2)), branch: env.GITHUB_BRANCH || 'main' }
  if (sha) body.sha = sha
  await fetch(`https://api.github.com/repos/${env.GITHUB_REPO}/contents/${path}`, {
    method: 'PUT',
    headers: { Authorization: `token ${env.GITHUB_TOKEN}`, 'Content-Type': 'application/json', 'User-Agent': 'RoyalTrack' },
    body: JSON.stringify(body)
  })
}

export async function onRequestPost(context) {
  const { request, env } = context
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  try {
    const body = await request.json()
    const filePath = `data/sessions.json`
    const file = await getFile(filePath, env)
    const sessions = file?.data || []
    const idx = sessions.findIndex(s => s.sesi === body.sesi && s.game === body.game)
    if (idx >= 0) sessions[idx] = body
    else sessions.push(body)
    // Keep only last 100 sessions
    const trimmed = sessions.slice(-100)
    await putFile(filePath, trimmed, file?.sha, env)
    return new Response(JSON.stringify({ ok: true }), { headers })
  } catch (e) {
    return new Response(JSON.stringify({ ok: false }), { headers })
  }
}

export async function onRequestGet(context) {
  const { env } = context
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  try {
    const file = await getFile('data/sessions.json', env)
    return new Response(JSON.stringify({ sessions: file?.data || [] }), { headers })
  } catch {
    return new Response(JSON.stringify({ sessions: [] }), { headers })
  }
}

export async function onRequestOptions() {
  return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } })
}
