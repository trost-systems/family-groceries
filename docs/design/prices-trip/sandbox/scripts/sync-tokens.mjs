// Copies the Snacklist tokens, fonts and hex masks from site/public into public/synced, so the sandbox
// uses the same generated values as the site and the app (design/tokens/snacklist.tokens.json).
import { cpSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const site = join(here, '../../../../../site/public')
const out = join(here, '../public/synced')
mkdirSync(out, { recursive: true })
cpSync(join(site, 'tokens.css'), join(out, 'tokens.css'))
cpSync(join(site, 'fonts'), join(out, 'fonts'), { recursive: true })
cpSync(join(site, 'hex'), join(out, 'hex'), { recursive: true })
console.log(`synced tokens, fonts and hex masks into ${out}`)
