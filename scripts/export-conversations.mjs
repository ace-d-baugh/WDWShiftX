// One-off export: dumps every in-app conversation as a plain-text transcript
// (display name + message body, ordered chronologically) for manual review.
// Run with: node --env-file=.env.local scripts/export-conversations.mjs
import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'node:fs';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  const { data: conversations, error: convErr } = await supabase
    .from('conversations')
    .select('id, created_at')
    .order('created_at');
  if (convErr) throw convErr;

  const { data: participants, error: partErr } = await supabase
    .from('conversation_participants')
    .select('conversation_id, users(display_name)');
  if (partErr) throw partErr;

  const { data: messages, error: msgErr } = await supabase
    .from('messages')
    .select('conversation_id, body, created_at, users(display_name)')
    .order('created_at');
  if (msgErr) throw msgErr;

  const namesByConv = new Map();
  for (const p of participants) {
    const list = namesByConv.get(p.conversation_id) ?? [];
    list.push(p.users?.display_name ?? 'Unknown user');
    namesByConv.set(p.conversation_id, list);
  }

  const messagesByConv = new Map();
  for (const m of messages) {
    const list = messagesByConv.get(m.conversation_id) ?? [];
    list.push(m);
    messagesByConv.set(m.conversation_id, list);
  }

  let out = '';
  conversations.forEach((c, i) => {
    const names = (namesByConv.get(c.id) ?? []).join(' & ');
    const msgs = messagesByConv.get(c.id) ?? [];
    out += `===== Conversation ${i + 1}: ${names} =====\n`;
    out += `Started: ${c.created_at}  |  Messages: ${msgs.length}\n\n`;
    for (const m of msgs) {
      out += `${m.users?.display_name ?? 'Unknown user'}: ${m.body}\n`;
    }
    out += '\n\n';
  });

  if (conversations.length === 0) {
    out = 'No conversations found.\n';
  }

  writeFileSync('conversations_export.txt', out, 'utf8');
  console.log(`Wrote conversations_export.txt — ${conversations.length} conversations, ${messages.length} messages.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
