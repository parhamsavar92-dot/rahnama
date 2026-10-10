#!/usr/bin/env python3
"""
افزودن classes.dex و کل پوشهٔ assets به APK خام تولیدشده توسط aapt2
-------------------------------------------------------------------
چرا خودمان این کار را می‌کنیم؟ چون aapt2 روی ویندوز نام مسیرها را داخل APK با
«\\» می‌نویسد و همان APK با استاندارد ZIP (که «/» می‌خواهد) خوانده نمی‌شود.
اینجا همهٔ مسیرها با «/» نوشته می‌شوند.

استفاده:
   python pack.py <base.apk> <out.apk> <assets_dir> <dex_file> [more-dex...]
"""
import os
import sys
import zipfile


def add_tree(z, root, arc_prefix):
    n = 0
    for dp, _dn, fn in os.walk(root):
        for f in fn:
            full = os.path.join(dp, f)
            rel = os.path.relpath(full, root).replace("\\", "/")
            z.write(full, arc_prefix + "/" + rel, zipfile.ZIP_DEFLATED)
            n += 1
    return n


def main():
    base, out, assets_dir = sys.argv[1], sys.argv[2], sys.argv[3]
    dexes = sys.argv[4:]

    # base.apk را بازنویسی می‌کنیم تا نام‌های خراب ویندوزی هم اصلاح شوند
    zin = zipfile.ZipFile(base, "r")
    zout = zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED, compresslevel=9)

    # ۱) محتوای خود aapt2 (منابع + مانیفست) — با نام‌های اصلاح‌شده
    seen = set()
    for info in zin.infolist():
        name = info.filename.replace("\\", "/")
        if name in seen:
            continue
        seen.add(name)
        try:
            data = zin.read(info.filename)
        except Exception:
            try:
                data = zin.read(info)
            except Exception:
                continue
        zi = zipfile.ZipInfo(name, info.date_time)
        zi.external_attr = info.external_attr
        zi.internal_attr = info.internal_attr
        zi.create_system = info.create_system
        zout.writestr(zi, data, zipfile.ZIP_DEFLATED)
    zin.close()
    print("  aapt2 entries:", len(seen))

    # ۲) کل سایت
    n = add_tree(zout, assets_dir, "assets")
    print("  assets files:", n)

    # ۳) کد اپ
    for d in dexes:
        zout.write(d, os.path.basename(d), zipfile.ZIP_DEFLATED)
        print("  dex:", os.path.basename(d))

    zout.close()
    print("packed ->", out)


if __name__ == "__main__":
    main()
