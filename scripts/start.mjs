import path from 'node:path'
// The generated server changes cwd; retain the operator's media path first.
process.env.MEDIA_DIR = path.resolve(process.env.MEDIA_DIR || 'media')
await import('../.next/standalone/server.js')
