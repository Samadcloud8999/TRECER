import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
// Actual PostgreSQL semantics with Supabase schemas/roles emulated locally.
// Cryptographic extension stubs exist ONLY in this test; production uses pgcrypto.
test("database enforces accounts, friendships, private media, chat and scheduler", async () => {
  const db = new PGlite();
  await db.exec(`
 create role anon;create role authenticated;create role service_role bypassrls;
 create schema auth;create schema storage;create schema extensions;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth,storage,public to authenticated,anon,service_role;grant execute on function auth.uid() to authenticated,anon,service_role;
 create table auth.users(id uuid primary key,email text,raw_app_meta_data jsonb,raw_user_meta_data jsonb);
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
 alter table storage.objects enable row level security;grant select,insert,delete on storage.objects to authenticated;
 create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;
 create function extensions.gen_random_bytes(int) returns bytea language sql as $$select decode(substr(md5(random()::text)||md5(random()::text),1,$1*2),'hex')$$;
 create function extensions.digest(text,text) returns bytea language sql immutable as $$select decode(md5($1),'hex')$$;
 create publication supabase_realtime;
 `);
  const sql = (await readFile("supabase/schema.sql", "utf8")).replace(
    "create extension if not exists pgcrypto with schema extensions;",
    "",
  );
  await db.exec(sql);
  const ids = (
    await db.query(
      "select gen_random_uuid() a,gen_random_uuid() b,gen_random_uuid() c",
    )
  ).rows[0];
  const { a, b, c } = ids;
  const add = async (id, email, provider = "google") =>
    db.query("insert into auth.users values($1,$2,$3,$4)", [
      id,
      email,
      { provider },
      { full_name: email },
    ]);
  await add(a, "alice@example.com");
  await add(b, "bob@example.com");
  await add(c, "cat@example.com");
  await assert.rejects(add(crypto.randomUUID(), "ALICE@example.com"));
  await assert.rejects(add(crypto.randomUUID(), "email@example.com", "email"));
  async function as(id) {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
    await db.exec("set role authenticated");
  }
  await as(a);
  await db.query("select public.update_profile($1,$2)", ["alice", "Alice"]);
  await as(b);
  await assert.rejects(
    db.query("select public.update_profile($1,$2)", ["a1ice", "Imposter"]),
  );
  await assert.rejects(
    db.query("select public.update_profile($1,$2)", ["alicez", "Near name"]),
  );
  await as(a);
  const record = {
    id: crypto.randomUUID(),
    title: "Personal expense",
    kind: "expense",
    amount: 120,
    date: "2026-10-07",
    time: "12:00",
  };
  const spot = {
    id: crypto.randomUUID(),
    title: "Favourite spot",
    kind: "place",
    amount: 0,
    date: "2026-10-07",
    time: "12:00",
    shared: true,
    photo: "cloud:" + a + "/diary/test",
  };
  await db.query("select public.save_diary_delta($1,$2,$3,$4,$5)", [
    [record, spot],
    [],
    [],
    [],
    { goal: 50000 },
  ]);
  await as(b);
  assert.equal((await db.query("select * from public.entries")).rows.length, 0);
  await assert.rejects(
    db.query("insert into public.entries values($1,$2,$3,$4)", [
      crypto.randomUUID(),
      a,
      "expense",
      { ...record, id: crypto.randomUUID() },
    ]),
  );
  await assert.rejects(db.query("select public.admin_users()"));
  await as(a);
  const code = (await db.query("select public.create_invite() code")).rows[0]
    .code;
  await as(b);
  assert.equal(
    (await db.query("select public.join_friend($1) target", [code])).rows[0]
      .target,
    a,
  );
  await assert.rejects(db.query("select public.join_friend($1)", [code]));
  const visible = (await db.query("select * from public.entries")).rows;
  assert.equal(visible.length, 1);
  assert.equal(visible[0].kind, "place");
  await as(a);
  await db.query("insert into storage.objects(bucket_id,name) values($1,$2)", [
    "media",
    a + "/diary/test",
  ]);
  await db.query("insert into storage.objects(bucket_id,name) values($1,$2)", [
    "media",
    a + "/diary/private",
  ]);
  await as(b);
  assert.deepEqual(
    (await db.query("select name from storage.objects")).rows.map(
      (r) => r.name,
    ),
    [a + "/diary/test"],
  );
  const message = crypto.randomUUID();
  await db.query(
    "insert into public.messages(id,sender_id,recipient_id,body) values($1,$2,$3,$4)",
    [message, b, a, "Привет"],
  );
  await assert.rejects(
    db.query(
      "insert into public.messages(sender_id,recipient_id,body) values($1,$2,$3)",
      [b, c, "No friendship"],
    ),
  );
  const future = new Date(Date.now() + 3600000);
  const stamp = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Bishkek",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .format(future)
    .replace(" ", "T");
  const rid = (
    await db.query("select public.remind_friend($1,$2,$3,$4,$5) id", [
      a,
      "Встреча",
      "Напоминание",
      stamp.slice(0, 10),
      stamp.slice(11, 16),
    ])
  ).rows[0].id;
  assert.equal(
    (await db.query("select * from public.reminders")).rows.length,
    0,
  );
  await as(a);
  const reminder = (
    await db.query("select * from public.reminders where id=$1", [rid])
  ).rows[0];
  assert.equal(reminder.created_by, b);
  assert.ok(reminder.next_due);
  await db.query("select public.mark_read($1)", [b]);
  assert.ok(
    (
      await db.query("select read_at from public.messages where id=$1", [
        message,
      ])
    ).rows[0].read_at,
  );
  await as(c);
  assert.equal(
    (await db.query("select * from public.messages")).rows.length,
    0,
  );
  assert.equal(
    (await db.query("select * from storage.objects")).rows.length,
    0,
  );
  // Atomic transaction: invalid reminder must not delete a good expense.
  await as(a);
  await assert.rejects(
    db.query("select public.save_diary_delta($1,$2,$3,$4,$5)", [
      [],
      [record.id],
      [
        {
          id: crypto.randomUUID(),
          title: "bad",
          time: "29:00",
          date: "2026-10-07",
          repeat: "once",
          enabled: true,
        },
      ],
      [],
      null,
    ]),
  );
  assert.equal(
    (await db.query("select id from public.entries where id=$1", [record.id]))
      .rows.length,
    1,
  );
  await db.exec("reset role");
  const pushId = crypto.randomUUID();
  await db.query(
    "insert into public.push_subscriptions(id,owner_id,endpoint,subscription) values($1,$2,$3,$4)",
    [
      pushId,
      a,
      "https://fcm.googleapis.com/test",
      { keys: { auth: "test", p256dh: "test" } },
    ],
  );
  await assert.rejects(
    db.query("update public.push_subscriptions set owner_id=$1 where id=$2", [
      b,
      pushId,
    ]),
  );
  const worker = crypto.randomUUID();
  await db.query(
    "update public.reminders set next_due=now()-interval '1 minute' where id=$1",
    [rid],
  );
  const batch = (
    await db.query("select public.claim_notifications($1) batch", [worker])
  ).rows[0].batch;
  assert.equal(batch.reminders.length, 1);
  assert.equal(batch.messages.length, 1);
  await db.query("select public.complete_notification($1,$2,$3)", [
    worker,
    rid,
    "reminder",
  ]);
  assert.equal(
    (await db.query("select next_due from public.reminders where id=$1", [rid]))
      .rows[0].next_due,
    null,
  );
  assert.equal(
    (await db.query("select enabled from public.reminders where id=$1", [rid]))
      .rows[0].enabled,
    false,
  );
  await as(a);
  await db.query("select public.remove_friend($1)", [b]);
  await as(b);
  assert.equal((await db.query("select * from public.entries")).rows.length, 0);
  assert.equal(
    (await db.query("select name from storage.objects")).rows.length,
    0,
  );
  await db.close();
});
