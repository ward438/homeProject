import * as dotenv from 'dotenv'
import { readFileSync } from 'fs'
import { join } from 'path'
import postgres from 'postgres'

dotenv.config({ path: '.env.local' })

async function run() {
  const sql = postgres(process.env.DATABASE_URL!, {
    ssl: false,
    prepare: false
  })

  const raw = readFileSync(
    join(process.cwd(), 'drizzle', 'apply_invoices.sql'),
    'utf8'
  )

  const statements = raw
    .replace(/--.*$/gm, '')
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0)

  console.log(`Applying ${statements.length} statements...`)

  for (const stmt of statements) {
    try {
      await sql.unsafe(stmt)
      console.log(`OK: ${stmt.slice(0, 80).replace(/\s+/g, ' ')}`)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('already exists') || msg.includes('does not exist')) {
        console.log(`SKIP: ${stmt.slice(0, 60).replace(/\s+/g, ' ')}`)
      } else {
        console.error(`FAIL: ${stmt.slice(0, 80)}`)
        console.error(msg)
      }
    }
  }

  await sql.end()
  console.log('Done.')
}

run().catch(e => {
  console.error(e)
  process.exit(1)
})
