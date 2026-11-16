import assert from "node:assert/strict";

async function main() {
  process.env.DATABASE_URL = "postgres://localhost/unused";
  process.env.CHAT_EVENTS_DATABASE_URL = "";
  const { pool } = await import("../src/db/client");
  const { emitCommunityUpdate, subscribeCommunityUpdates, subscribeChatEvents } =
    await import("../src/lib/chat-events");
  const calls: unknown[][] = [];
  pool.query = ((...args: unknown[]) => {
    calls.push(args);
    return Promise.resolve({ rows: [] });
  }) as typeof pool.query;

  let communityUpdates = 0;
  let privateEvents = 0;
  const stopCommunity = subscribeCommunityUpdates(() => communityUpdates++);
  const stopPrivate = subscribeChatEvents(() => privateEvents++);
  emitCommunityUpdate();
  assert.equal(communityUpdates, 1);
  assert.equal(privateEvents, 0);
  assert.equal(calls.length, 1);
  const payload = JSON.parse((calls[0][1] as string[])[1]);
  assert.equal(payload.kind, "community.updated");
  assert.deepEqual(Object.keys(payload).sort(), ["kind", "origin"]);
  stopCommunity();
  stopPrivate();
  emitCommunityUpdate();
  assert.equal(communityUpdates, 1);
  await pool.end();
  console.log("Community updates are isolated, content-free, and unsubscribe cleanly.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
