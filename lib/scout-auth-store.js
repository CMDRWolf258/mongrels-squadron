// Consistent, one-time OAuth state storage. A dedicated D1 binding keeps this
// separate from the squadron's existing KV-based BGS and HUD data.
const initialized = new WeakMap();
async function database(env) {
  const db=env?.SCOUT_AUTH_DB;
  if (!db?.prepare) throw new Error('scout_auth_database_not_bound');
  let promise=initialized.get(db);
  if (!promise) {
    promise=db.prepare('CREATE TABLE IF NOT EXISTS scout_auth_records (id TEXT PRIMARY KEY, payload TEXT NOT NULL, expires_at INTEGER NOT NULL)').run()
      .catch(e=>{initialized.delete(db);throw e;});
    initialized.set(db,promise);
  }
  await promise;
  return db;
}
export const authStorageReady=env=>typeof env?.SCOUT_AUTH_DB?.prepare==='function';
export async function storeRecord(env,id,payload,expiresAt) {
  const db=await database(env);
  await db.prepare('INSERT INTO scout_auth_records (id,payload,expires_at) VALUES (?,?,?)')
    .bind(id,JSON.stringify(payload),expiresAt).run();
  await db.prepare('DELETE FROM scout_auth_records WHERE expires_at < ?').bind(Date.now()).run();
}
export async function readRecord(env,id) {
  const db=await database(env);
  const row=await db.prepare('SELECT payload FROM scout_auth_records WHERE id = ? AND expires_at > ?')
    .bind(id,Date.now()).first();
  return row?.payload ? JSON.parse(row.payload) : null;
}
export async function takeRecord(env,id) {
  const db=await database(env);
  const row=await db.prepare('DELETE FROM scout_auth_records WHERE id = ? RETURNING payload')
    .bind(id).first();
  return row?.payload ? JSON.parse(row.payload) : null;
}
