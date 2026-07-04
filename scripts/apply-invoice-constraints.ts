import * as dotenv from 'dotenv'
import postgres from 'postgres'

dotenv.config({ path: '.env.local' })

async function run() {
  const sql = postgres(process.env.DATABASE_URL!, {
    ssl: false,
    prepare: false
  })

  const safeExec = async (label: string, stmt: string) => {
    try {
      await sql.unsafe(stmt)
      console.log(`OK: ${label}`)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      if (
        msg.includes('already exists') ||
        msg.includes('does not exist') ||
        msg.includes('duplicate')
      ) {
        console.log(`SKIP (already applied): ${label}`)
      } else {
        console.error(`FAIL: ${label} — ${msg}`)
      }
    }
  }

  // Foreign key constraint
  await safeExec(
    'invoices FK to documents',
    `ALTER TABLE "invoices" ADD CONSTRAINT "invoices_exported_document_id_documents_id_fk"
     FOREIGN KEY ("exported_document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action`
  )

  // RLS policies
  await safeExec(
    'RLS policy: clients',
    `CREATE POLICY "users_manage_own_clients" ON "clients"
     AS PERMISSIVE FOR ALL TO public
     USING (user_id = (select current_setting('app.current_user_id', true)))
     WITH CHECK (user_id = (select current_setting('app.current_user_id', true)))`
  )

  await safeExec(
    'RLS policy: invoice_sequences',
    `CREATE POLICY "users_manage_own_invoice_sequences" ON "invoice_sequences"
     AS PERMISSIVE FOR ALL TO public
     USING (user_id = (select current_setting('app.current_user_id', true)))
     WITH CHECK (user_id = (select current_setting('app.current_user_id', true)))`
  )

  await safeExec(
    'RLS policy: invoices',
    `CREATE POLICY "users_manage_own_invoices" ON "invoices"
     AS PERMISSIVE FOR ALL TO public
     USING (user_id = (select current_setting('app.current_user_id', true)))
     WITH CHECK (user_id = (select current_setting('app.current_user_id', true)))`
  )

  await sql.end()
  console.log('Done.')
}

run().catch(e => {
  console.error(e)
  process.exit(1)
})
