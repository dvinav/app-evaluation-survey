import { cpSync, existsSync, mkdirSync } from 'node:fs'
cpSync('.next/static', '.next/standalone/.next/static', { recursive: true })
mkdirSync('.next/standalone/public', { recursive: true })
if (existsSync('public'))
  cpSync('public', '.next/standalone/public', { recursive: true })
