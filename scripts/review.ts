/**
 * Draft-event review CLI (Phase 5, session 2).
 *
 * The parser inserts low-confidence events as status='draft'. This is the local
 * admin tool to list them and publish / hide / edit before they go live.
 *
 * Needs the SERVICE ROLE key (drafts are RLS-hidden and writes are service-only):
 *   SUPABASE_SERVICE_ROLE_KEY=...  (export it or add to a gitignored env)
 *   EXPO_PUBLIC_SUPABASE_URL is read from .env automatically.
 *
 * Usage:
 *   node scripts/review.ts list
 *   node scripts/review.ts show <id>
 *   node scripts/review.ts publish <id>
 *   node scripts/review.ts hide <id>
 *   node scripts/review.ts set <id> <field> <value>
 *     field: category | price_text | starts_at | is_free | title.<lang> | description.<lang>
 *     e.g.  node scripts/review.ts set <id> title.en "Board games night"
 */
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const url = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    'Missing config. Set SUPABASE_SERVICE_ROLE_KEY in your env (and EXPO_PUBLIC_SUPABASE_URL in .env).',
  );
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

type Localized = Record<string, string> | null;
type EventRow = {
  id: string;
  status: string;
  starts_at: string;
  category: string;
  price_text: string | null;
  is_free: boolean;
  source_url: string | null;
  source_ref: string | null;
  title: string;
  description: string | null;
  title_i18n: Localized;
  description_i18n: Localized;
};

const I18N_COLUMN: Record<string, 'title_i18n' | 'description_i18n'> = {
  title: 'title_i18n',
  description: 'description_i18n',
};

async function fetchOne(id: string): Promise<EventRow> {
  const { data, error } = await admin
    .from('events')
    .select(
      'id, status, starts_at, category, price_text, is_free, source_url, source_ref, title, description, title_i18n, description_i18n',
    )
    .eq('id', id)
    .single();
  if (error || !data) throw new Error(`event ${id} not found: ${error?.message}`);
  return data as EventRow;
}

async function list(): Promise<void> {
  const { data, error } = await admin
    .from('events')
    .select('id, status, starts_at, category, price_text, source_ref, title, title_i18n')
    .eq('status', 'draft')
    .order('starts_at', { ascending: true });
  if (error) throw error;
  const rows = (data ?? []) as EventRow[];
  if (!rows.length) {
    console.log('No draft events. 🎉');
    return;
  }
  for (const e of rows) {
    const langs = Object.keys(e.title_i18n ?? {}).join(',') || '—';
    console.log(`\n${e.id}`);
    console.log(`  ${e.title}  [${e.category}]  ${e.starts_at}  ${e.price_text ?? ''}`);
    console.log(`  source ${e.source_ref}  · langs ${langs}`);
  }
  console.log(
    `\n${rows.length} draft(s). publish: node scripts/review.ts publish <id> · hide: ... hide <id>`,
  );
}

async function show(id: string): Promise<void> {
  console.log(JSON.stringify(await fetchOne(id), null, 2));
}

async function setStatus(id: string, status: 'published' | 'hidden'): Promise<void> {
  const { error } = await admin.from('events').update({ status }).eq('id', id);
  if (error) throw error;
  console.log(`${id} → ${status}`);
}

async function setField(id: string, field: string, value: string): Promise<void> {
  // Localized field, e.g. "title.en" / "description.ru".
  if (field.includes('.')) {
    const [base, lang] = field.split('.');
    const column = I18N_COLUMN[base];
    if (!column || !['en', 'ru', 'sr'].includes(lang)) {
      throw new Error(`bad field "${field}" (use title.<en|ru|sr> or description.<en|ru|sr>)`);
    }
    const row = await fetchOne(id);
    const next = { ...(row[column] ?? {}), [lang]: value } as Record<string, string>;
    const update: Record<string, unknown> = { [column]: next };
    // Keep the scalar canonical (en ?? ru ?? sr) in sync — it's the dedup/fallback value.
    const canonical = next.en || next.ru || next.sr || '';
    if (base === 'title') update.title = canonical;
    if (base === 'description') update.description = canonical || null;
    const { error } = await admin.from('events').update(update).eq('id', id);
    if (error) throw error;
    console.log(`${id} ${field} → ${value}`);
    return;
  }

  // Scalar columns.
  const allowed = ['category', 'price_text', 'starts_at'];
  if (field === 'is_free') {
    const { error } = await admin
      .from('events')
      .update({ is_free: value === 'true' })
      .eq('id', id);
    if (error) throw error;
    console.log(`${id} is_free → ${value === 'true'}`);
    return;
  }
  if (!allowed.includes(field)) {
    throw new Error(`unsupported field "${field}" (allowed: ${allowed.join(', ')}, is_free, title.<lang>, description.<lang>)`);
  }
  const { error } = await admin.from('events').update({ [field]: value }).eq('id', id);
  if (error) throw error;
  console.log(`${id} ${field} → ${value}`);
}

async function main(): Promise<void> {
  const [cmd, ...args] = process.argv.slice(2);
  switch (cmd) {
    case 'list':
    case undefined:
      await list();
      break;
    case 'show':
      await show(args[0]);
      break;
    case 'publish':
      await setStatus(args[0], 'published');
      break;
    case 'hide':
      await setStatus(args[0], 'hidden');
      break;
    case 'set':
      await setField(args[0], args[1], args.slice(2).join(' '));
      break;
    default:
      console.error(`Unknown command "${cmd}". Use: list | show | publish | hide | set`);
      process.exit(1);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
