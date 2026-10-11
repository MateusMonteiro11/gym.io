export function publicPushConfig(value) {
  if (!value) return { supabaseUrl: null }
  const url = new URL(value)
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/' ||
    !(url.protocol === 'https:' || url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))) {
    throw new Error('VITE_SUPABASE_URL must be an exact Supabase origin')
  }
  return { supabaseUrl: url.origin }
}
export function pushPublicConfigPlugin(value) {
  const source = JSON.stringify(publicPushConfig(value))
  return {
    name: 'gymio-public-push-config',
    configureServer(server) {
      server.middlewares.use('/push-config.json', (request, response) => {
        response.setHeader('Content-Type', 'application/json')
        response.setHeader('Cache-Control', 'no-store')
        if (request.method !== 'GET') { response.statusCode = 405; response.end(); return }
        response.end(source)
      })
    },
    generateBundle() { this.emitFile({ type: 'asset', fileName: 'push-config.json', source }) },
  }
}
