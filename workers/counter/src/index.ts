export class Counter {
  private state: DurableObjectState

  constructor(state: DurableObjectState) {
    this.state = state
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    if (request.method === 'OPTIONS') return withCors(new Response(null, { status: 204 }))

    if (url.pathname === '/get' && request.method === 'GET') {
      const value = (await this.state.storage.get<number>('value')) ?? 0
      return json({ value })
    }

    if (url.pathname === '/hit' && (request.method === 'POST' || request.method === 'GET')) {
      const current = (await this.state.storage.get<number>('value')) ?? 0
      const next = current + 1
      await this.state.storage.put('value', next)
      return json({ value: next })
    }

    return withCors(new Response('Not Found', { status: 404 }))
  }
}

type Env = {
  COUNTER: DurableObjectNamespace
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (request.method === 'OPTIONS') return withCors(new Response(null, { status: 204 }))

    // Routes:
    // - GET  /api/get/<key>
    // - POST /api/hit/<key> (or GET)
    const m = url.pathname.match(/^\/api\/(get|hit)\/(.+)$/)
    if (!m) return withCors(new Response('Not Found', { status: 404 }))

    const action = m[1]
    const keyRaw = m[2]
    const key = normalizeKey(keyRaw)

    const id = env.COUNTER.idFromName(key)
    const stub = env.COUNTER.get(id)

    const forwardUrl = new URL(request.url)
    forwardUrl.pathname = action === 'get' ? '/get' : '/hit'

    const res = await stub.fetch(forwardUrl.toString(), {
      method: action === 'get' ? 'GET' : request.method,
      headers: request.headers
    })

    return withCors(res)
  }
}

function normalizeKey(key: string) {
  const cleaned = String(key || '')
    .trim()
    .slice(0, 120)
    .replace(/[^a-zA-Z0-9._:-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return cleaned || 'global'
}

function withCors(res: Response) {
  const headers = new Headers(res.headers)
  headers.set('Access-Control-Allow-Origin', '*')
  headers.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  headers.set('Access-Control-Allow-Headers', 'Content-Type')
  headers.set('Access-Control-Max-Age', '86400')
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers })
}

function json(data: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers)
  headers.set('Content-Type', 'application/json; charset=utf-8')
  return withCors(new Response(JSON.stringify(data), { ...init, headers }))
}
