// شبیه‌ساز ساده D1 روی node:sqlite برای تست محلی (فقط برای تست؛ روی Cloudflare از D1 واقعی استفاده می‌شود)
import { DatabaseSync } from "node:sqlite";
class Stmt {
  constructor(db, sql) { this.db = db; this.sql = sql; this.args = []; }
  bind(...a) { this.args = a; return this; }
  _s() { return this.db.prepare(this.sql); }
  _isSel() { return /^\s*select/i.test(this.sql); }
  async first() { const r = this._s().get(...this.args); return r ? { ...r } : null; }
  async all() { return { results: this._s().all(...this.args).map((r) => ({ ...r })), success: true }; }
  async run() { const r = this._s().run(...this.args); return { success: true, meta: { changes: r.changes } }; }
  _exec() { return this._isSel() ? this.all() : this.run(); }
}
export class D1Shim {
  constructor() { this.db = new DatabaseSync(":memory:"); }
  prepare(sql) { return new Stmt(this.db, sql); }
  async batch(stmts) {
    this.db.exec("BEGIN");
    try { const out = []; for (const s of stmts) out.push(await s._exec()); this.db.exec("COMMIT"); return out; }
    catch (e) { this.db.exec("ROLLBACK"); throw e; }
  }
}
