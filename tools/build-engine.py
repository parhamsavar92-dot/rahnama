#!/usr/bin/env python3
"""ساخت src/engine.js از public/assets/hk-server.js
(منطق پنل و کلاس یک‌بار نوشته می‌شود و هم در مرورگر و هم روی سرور اجرا می‌شود.)"""
import re, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
t = (root / "public/assets/hk-server.js").read_text(encoding="utf-8")

def sub1(old, new, rx=False):
    global t
    if rx:
        t2 = re.sub(old, lambda m: new, t, count=1, flags=re.S)
        assert t2 != t, old[:60]
        t = t2
    else:
        assert old in t, old[:60]
        t = t.replace(old, new, 1)

sub1('(function () {\n  "use strict";\n\n  var W = window, D = document, LS = W.localStorage;',
     'export function createEngine(LS, CFG) {\n  "use strict";\n  var W = {}, D = {};')
sub1(r'var OWNER_EMAIL = "[^"]*";',
     'var OWNER_EMAIL = String((CFG && CFG.ownerEmail) || "").toLowerCase();', rx=True)
sub1('function setPass(u, pw) { u.ph = hashPass(u.email, pw); delete u.pass; }',
     'function setPass(u, pw) { u._np = String(pw); delete u.ph; delete u.pass; }')
sub1('String(body.staffCode || "").trim() !== "rahnama-hamkaran"',
     '(!(CFG && CFG.staffCode) || String(body.staffCode || "").trim() !== CFG.staffCode)')
sub1('if (seg[0] === "ai") return', 'if (seg[0] === "ai-local") return')
# موتور سرور هر درخواست نسخهٔ تازهٔ پایگاه را می‌خواند؛ ادغام لازم ندارد و
# اگر انجام شود، رکوردهای حذف‌شده را دوباره زنده می‌کند.
sub1('var MERGE_ON_SAVE = true;', 'var MERGE_ON_SAVE = false;')
s = t.index('  /* ------------------------------------------------------------ نصب */')
t = t[:s] + (
    "  return {\n"
    "    handle: handle,\n"
    "    db: db,\n"
    "    defaults: function () { return clone(DEFAULT_SETTINGS); },\n"
    "    pub: pub,\n"
    "    roleFa: ROLE_FA\n"
    "  };\n"
    "}\n")
hdr = "// فایل تولیدشده از public/assets/hk-server.js با tools/build-engine.py — دستی ویرایش نکنید.\n/* eslint-disable */\n"
(root / "src/engine.js").write_text(hdr + t, encoding="utf-8")
print("engine.js written", len(t))
