export async function onRequestPost(context) {
  const { request, env } = context
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  try {
    const { prompt } = await request.json()
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${env.GROQ_API_KEY}` },
      body: JSON.stringify({ model: 'llama-3.1-8b-instant', messages: [{ role: 'user', content: prompt }], max_tokens: 150, temperature: 0.3 })
    })
    if (!res.ok) throw new Error('Groq error')
    const data = await res.json()
    return new Response(JSON.stringify({ text: data.choices?.[0]?.message?.content || 'Analisis tidak tersedia.' }), { headers })
  } catch (e) {
    return new Response(JSON.stringify({ text: 'AI tidak tersedia. Gunakan analisis lokal.' }), { headers })
  }
}
export async function onRequestOptions() {
  return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } })
}
