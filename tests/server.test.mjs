import { D1Shim } from "./d1-shim.mjs";
import worker from "../src/worker.js";

const env = { DB: new D1Shim(), OWNER_EMAIL: "parham.savar92@gmail.com", OWNER_PASSWORD: "Parham2273", ASSETS: { fetch: () => new Response("asset") } };
const ctxw = { waitUntil() {} };
class Jar { constructor(envx) { this.c = ""; this.env = envx || env; }
  async call(method, path, body, hdr) {
    const h = { "Content-Type": "application/json", Host: "x.test", ...(hdr || {}) };
    if (this.c) h.Cookie = this.c;
    const r = await worker.fetch(new Request("https://x.test" + path, { method, headers: h, body: body ? JSON.stringify(body) : undefined }), this.env, ctxw);
    const sc = r.headers.get("Set-Cookie");
    if (sc) { const m = /^hk_sid=([^;]*)/.exec(sc); if (m) this.c = m[1] ? "hk_sid=" + m[1] : ""; }
    const txt = await r.text(); let j = null; try { j = JSON.parse(txt); } catch (e) {}
    return { s: r.status, j, txt, sc };
  } }
let fails = 0; const t = (n, c) => { console.log((c ? "PASS " : "FAIL ") + n); if (!c) fails++; };

const owner = new Jar(), stu = new Jar(), anon = new Jar();
let r = await anon.call("GET", "/api/__status"); t("status reports d1 + owner ready", r.s === 200 && r.j.server === "d1" && r.j.ownerReady === true);
r = await owner.call("POST", "/api/auth/login", { email: "Parham.savar92@gmail.com", password: "Parham2273" });
t("owner login", r.s === 200 && r.j.user.role === "owner" && r.j.user.verified && r.j.user.isOwner);
t("cookie is HttpOnly+Secure+SameSite", /HttpOnly/.test(r.sc) && /Secure/.test(r.sc) && /SameSite=Lax/.test(r.sc));
t("no hash in login response", !/p1\$|"ph"|"pass"/.test(r.txt));
r = await owner.call("GET", "/api/auth/me"); t("auth/me with cookie", r.j.user && r.j.user.isOwner);
r = await anon.call("GET", "/api/auth/me"); t("auth/me anonymous -> null", r.j.user === null);
r = await owner.call("GET", "/api/admin/stats"); t("owner opens admin stats", r.s === 200 && r.j.stats.users.total === 1);
r = await anon.call("GET", "/api/admin/stats"); t("anonymous blocked from admin", r.s === 401);

r = await stu.call("POST", "/api/auth/register", { name: "علی", email: "ali@test.com", password: "abc12345", grade: "8" });
t("register student", r.s === 200 && r.j.user.role === "student" && !r.j.user.verified);
const aliId = r.j.user.id;
r = await stu.call("POST", "/api/auth/register", { name: "x", email: "ali@test.com", password: "abc12345" }); t("duplicate email rejected", r.s === 400);
r = await anon.call("POST", "/api/auth/register", { name: "x", email: "parham.savar92@gmail.com", password: "abc12345" }); t("owner email cannot be registered", r.s === 400);
r = await anon.call("POST", "/api/auth/register", { name: "x", email: "bad", password: "abc12345" }); t("bad email rejected", r.s === 400);
r = await anon.call("POST", "/api/auth/register", { name: "x", email: "a@b.co", password: "123" }); t("short password rejected", r.s === 400);
r = await stu.call("GET", "/api/admin/stats"); t("student blocked from admin", r.s === 403);
r = await stu.call("GET", "/api/admin/users"); t("student cannot list users", r.s === 403);
r = await stu.call("POST", "/api/me/profile", { role: "admin" }); t("student cannot self-promote to admin", r.s === 403);
r = await stu.call("POST", "/api/me/profile", { name: "علی رضایی", city: "تهران" }); t("student edits profile", r.s === 200 && r.j.user.city === "تهران");
r = await stu.call("POST", "/api/me/sync", { data: { lessons: { a: 1 } } }); t("me/sync ok", r.s === 200);
r = await stu.call("GET", "/api/me/data"); t("me/data persisted in D1", r.j.data && r.j.data.lessons && r.j.data.lessons.a === 1);

r = await owner.call("POST", "/api/admin/verify", { id: aliId, verified: true }); t("owner gives blue tick", r.s === 200 && r.j.user.verified === true);
r = await stu.call("GET", "/api/auth/me"); t("student sees blue tick", r.j.user.verified === true);
r = await owner.call("GET", "/api/admin/users"); t("admin/users lists 2, no hashes", r.j.total === 2 && !/p1\$|"ph"/.test(r.txt));
r = await owner.call("POST", "/api/admin/user", { id: aliId, role: "admin" }); t("owner makes admin", r.s === 200 && r.j.user.role === "admin");
r = await stu.call("POST", "/api/admin/verify", { id: aliId, verified: false }); t("admin cannot touch blue tick", r.s === 403);
r = await stu.call("GET", "/api/admin/stats"); t("new admin can open panel", r.s === 200);
r = await stu.call("GET", "/api/admin/backup"); t("admin cannot take backup (owner only)", r.s === 403);
r = await owner.call("GET", "/api/admin/backup"); t("owner can take backup", r.s === 200 && !/p1\$/.test(r.txt));
r = await owner.call("POST", "/api/admin/user", { id: aliId, role: "student" });

r = await owner.call("POST", "/api/admin/user/password", { id: aliId }); const temp = r.j && r.j.password;
t("owner resets user password", r.s === 200 && temp && temp.length >= 8);
const s2 = new Jar();
r = await s2.call("POST", "/api/auth/login", { email: "ali@test.com", password: "abc12345" }); t("old password stops working", r.s === 401);
r = await s2.call("POST", "/api/auth/login", { email: "ali@test.com", password: temp }); t("temp password works (PBKDF2 stored)", r.s === 200);

r = await s2.call("POST", "/api/me/password", { current: "wrong", password: "NewPass99" }); t("wrong current password rejected", r.s === 403);
const s3 = new Jar(); await s3.call("POST", "/api/auth/login", { email: "ali@test.com", password: temp });
r = await s2.call("POST", "/api/me/password", { current: temp, password: "NewPass99" }); t("change own password", r.s === 200);
r = await s3.call("GET", "/api/auth/me"); t("other devices signed out after password change", r.j.user === null);
r = await s2.call("GET", "/api/auth/me"); t("current device stays signed in", r.j.user && r.j.user.email === "ali@test.com");

// class flow
r = await owner.call("POST", "/api/class/create", { name: "ریاضی هشتم", grade: "8", subject: "ریاضی" }); const cls = r.j.class; t("create class", r.s === 200 && cls && cls.code);
r = await s2.call("POST", "/api/class/join", { code: cls.code }); t("student joins class", r.s === 200 && r.j.session && r.j.session.id);
const sid = r.j.session.id;
r = await s2.call("POST", "/api/class/chat", { sessionId: sid, text: "سلام" }); t("class chat", r.s === 200);
r = await owner.call("GET", "/api/class/room?session=" + sid); t("room has chat message", r.j.room && r.j.room.msgs.some((m) => m.text === "سلام"));
r = await owner.call("POST", "/api/class/board", { sessionId: sid, board: "x²" });
r = await s2.call("GET", "/api/class/stream?session=" + sid + "&rev=0"); t("stream sees board + rev bump", r.j.room.board === "x²" && r.j.rev >= 2);
r = await owner.call("GET", "/api/class/overview"); t("class overview", r.j.kpis.classes === 1 && r.j.kpis.live === 1);

// ban
r = await owner.call("POST", "/api/admin/user", { id: aliId, banned: true }); t("ban user", r.s === 200);
r = await s2.call("GET", "/api/auth/me"); t("banned user's session is dead", r.j.user === null);
r = await new Jar().call("POST", "/api/auth/login", { email: "ali@test.com", password: "NewPass99" }); t("banned user cannot log in", r.s === 403);
r = await owner.call("POST", "/api/admin/user", { id: aliId, banned: false });

// settings + announcements + events
r = await owner.call("POST", "/api/admin/announce", { active: true, level: "info", text: "سلام" }); t("announce saved", r.s === 200);
r = await anon.call("GET", "/api/site/status"); t("site/status shows announcement + user count", r.j.announcement.active === true && r.j.users === 2 && r.j.server === "d1");
r = await owner.call("GET", "/api/admin/events"); t("events recorded", r.j.events.some((e) => e.type === "login") && r.j.events.some((e) => e.type === "register"));
r = await owner.call("GET", "/api/admin/audit"); t("audit recorded", r.j.audit.length > 3);

// safety
r = await owner.call("POST", "/api/admin/user/delete", { email: "parham.savar92@gmail.com" }); t("owner cannot be deleted", r.s === 403);
r = await owner.call("POST", "/api/admin/user/delete", { id: aliId }); t("owner deletes user", r.s === 200);
r = await new Jar().call("POST", "/api/auth/login", { email: "ali@test.com", password: "NewPass99" }); t("deleted user cannot log in", r.s === 401);
r = await owner.call("POST", "/api/auth/logout"); t("logout", r.s === 200 && /Max-Age=0/.test(r.sc));
r = await owner.call("GET", "/api/admin/stats"); t("session dead after logout", r.s === 401);
r = await anon.call("POST", "/api/auth/login", { email: "parham.savar92@gmail.com", password: "x" }, { Origin: "https://evil.test" }); t("foreign Origin blocked", r.s === 403);
r = await anon.call("POST", "/api/ai/chat/completions", { messages: [{ role: "user", content: "سلام" }] }); t("AI requires login", r.s === 401);
const o2 = new Jar(); await o2.call("POST", "/api/auth/login", { email: "parham.savar92@gmail.com", password: "Parham2273" });
r = await o2.call("POST", "/api/ai/chat/completions", { messages: [{ role: "user", content: "سلام" }] }); t("AI 503 when no key configured", r.s === 503);
// brute force
const bf = new Jar(); let last;
for (let i = 0; i < 12; i++) last = await bf.call("POST", "/api/auth/login", { email: "ali2@test.com", password: "nope" + i });
t("login rate-limited after repeated failures", last.s === 429);

// ------------------------------------------------------------------ نسخهٔ ۶٫۰
// سلامت سیستم، هدرهای امنیتی، حریم داده در site/status
r = await anon.call("GET", "/api/health");
t("health reports db ok + version 6.0", r.s === 200 && r.j.ok === true && r.j.version === "6.0" && r.j.db.ok === true && r.j.db.users >= 1);

const hres = await worker.fetch(new Request("https://x.test/api/site/status"), env, ctxw);
t("security headers on api responses",
  hres.headers.get("X-Content-Type-Options") === "nosniff" &&
  hres.headers.get("X-Frame-Options") === "SAMEORIGIN" &&
  !!hres.headers.get("Strict-Transport-Security") &&
  !!hres.headers.get("Permissions-Policy"));
const hresA = await worker.fetch(new Request("https://x.test/index.html"), env, ctxw);
t("security headers on static assets", hresA.headers.get("X-Content-Type-Options") === "nosniff");

const stPub = await (await worker.fetch(new Request("https://x.test/api/site/status"), env, ctxw)).json();
t("site/status v6 + hides admin-only settings", stPub.version === "6.0" && stPub.settings.broadcast === undefined);

r = await anon.call("GET", "/api/admin/ai-usage");
t("ai-usage blocked for anonymous", r.s === 401);

// ------------------------------------------------- چند ارائه‌دهنده + پخش زنده
const env2 = { ...env, ANTHROPIC_API_KEY: "test-key" };
const oai = new Jar(env2);
await oai.call("POST", "/api/auth/login", { email: "parham.savar92@gmail.com", password: "Parham2273" });
const realFetch = globalThis.fetch;
const calls = [];
globalThis.fetch = async (u, opt) => {
  calls.push({ u: String(u), opt: opt || {} });
  const b = JSON.parse((opt && opt.body) || "{}");
  if (b.stream) {
    const s = new ReadableStream({
      start(c) {
        c.enqueue(new TextEncoder().encode('data: {"type":"content_block_delta","delta":{"text":"سلام"}}\n\n'));
        c.close();
      }
    });
    return new Response(s, { status: 200, headers: { "content-type": "text/event-stream" } });
  }
  return new Response(JSON.stringify({ content: [{ type: "text", text: "پاسخ آزمایشی" }] }), { status: 200, headers: { "content-type": "application/json" } });
};

let aiRes, aiTxt;
try {
  aiRes = await worker.fetch(new Request("https://x.test/api/ai/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Host: "x.test", Cookie: oai.c },
    body: JSON.stringify({ messages: [{ role: "user", content: "سلام" }], context: "متن جزوهٔ آزمایشی", grade: "8" })
  }), env2, ctxw);
  aiTxt = await aiRes.json();
} finally { globalThis.fetch = realFetch; }
t("AI uses configured provider and returns text", aiRes.status === 200 && aiTxt.choices[0].message.content === "پاسخ آزمایشی" && aiRes.headers.get("X-AI-Provider") === "anthropic");
t("AI calls provider base url with key", calls.length === 1 && calls[0].u.indexOf("api.anthropic.com") > -1 && calls[0].opt.headers["x-api-key"] === "test-key");
t("AI system prompt is grounded in lesson context", JSON.parse(calls[0].opt.body).system.indexOf("متن جزوهٔ آزمایشی") > -1);

globalThis.fetch = async (u, opt) => {
  const b = JSON.parse((opt && opt.body) || "{}");
  const s = new ReadableStream({
    start(c) {
      c.enqueue(new TextEncoder().encode('data: {"type":"content_block_delta","delta":{"text":"سلام"}}\n\n'));
      c.close();
    }
  });
  return new Response(s, { status: 200, headers: { "content-type": "text/event-stream" } });
};
let sseTxt = "";
try {
  const sres = await worker.fetch(new Request("https://x.test/api/ai/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Host: "x.test", Cookie: oai.c },
    body: JSON.stringify({ messages: [{ role: "user", content: "سلام" }], stream: true })
  }), env2, ctxw);
  t("AI streaming returns event-stream", (sres.headers.get("Content-Type") || "").indexOf("text/event-stream") === 0);
  sseTxt = await sres.text();
} finally { globalThis.fetch = realFetch; }
t("AI stream is OpenAI-compatible SSE", sseTxt.indexOf('"delta":{"content":"سلام"}') > -1 && sseTxt.indexOf("data: [DONE]") > -1);

r = await oai.call("GET", "/api/admin/ai-usage");
t("admin sees AI usage stats", r.s === 200 && r.j.total >= 2 && r.j.providers.indexOf("anthropic") > -1);

r = await anon.call("GET", "/api/admin/ai-usage");
t("ai-usage blocked for anonymous (after work)", r.s === 401);

console.log(fails ? "FAILED " + fails : "ALL PASSED");
process.exit(fails ? 1 : 0);
