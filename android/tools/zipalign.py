#!/usr/bin/env python3
"""
هم‌ترازی APK (جایگزین zipalign) + فشرده‌نکردن resources.arsc و *.dex
--------------------------------------------------------------------
اندروید ۱۱ به بالا (targetSdk 30+) اجازه نمی‌دهد resources.arsc فشرده باشد و
می‌خواهد همان فایل روی مرز ۴ بایت هم‌تراز باشد. این اسکریپت:
  ۱) entries را از APK ورودی می‌خواند،
  ۲) resources.arsc و *.dex را بدون فشرده‌سازی (STORED) می‌نویسد،
  ۳) با افزودن یک فیلد اضافی (extra field) داده را روی مضرب ۴ می‌نشاند.

استفاده:  python zipalign.py in.apk out.apk [align]
"""
import sys
import struct
import zipfile

ALIGN = 4


def aligned_extra(header_start, name_len, align):
    """طول فیلد اضافی لازم تا داده روی مضرب align بنشیند (همیشه >= 4)."""
    base = header_start + 30 + name_len
    need = (-base) % align
    total = need + 4 if need else 4
    body = total - 4
    return b"\x00\x00" + struct.pack("<H", body) + b"\x00" * body


def main():
    src, dst = sys.argv[1], sys.argv[2]
    align = int(sys.argv[3]) if len(sys.argv) > 3 else ALIGN

    zin = zipfile.ZipFile(src, "r")
    zout = zipfile.ZipFile(dst, "w", zipfile.ZIP_DEFLATED, compresslevel=9)

    for info in zin.infolist():
        name = info.filename
        data = zin.read(name)
        nlen = len(name.encode("utf-8"))
        store = name == "resources.arsc" or name.endswith(".dex") or name.startswith("lib/")

        zi = zipfile.ZipInfo(name, info.date_time)
        zi.internal_attr = info.internal_attr
        zi.external_attr = info.external_attr
        zi.create_system = info.create_system
        zi.compress_type = zipfile.ZIP_STORED if store else zipfile.ZIP_DEFLATED

        if store:
            start = zout.fp.tell()
            zi.extra = aligned_extra(start, nlen, align)
        else:
            zi.extra = b""

        zout.writestr(zi, data, compress_type=zi.compress_type)

    zout.close()
    zin.close()
    print("aligned ->", dst)


if __name__ == "__main__":
    main()
