"""HHD.FR.19 anket formunu orijinal PDF uzerine isaretleyen dogrulama prototipi.

Amac: form-geometrisi.json icindeki koordinatlarin dogrulugunu gorsel olarak
kanitlamak. Uretim kodu eklentide JavaScript (pdf-lib) ile yazilacak; koordinat
tablosu birebir aynidir.

Kullanim:  python3 isaretleme-prototipi.py <bos-form.pdf> <cikti.pdf>
"""
import json
import math
import os
import random
import sys

import pymupdf

GEO = json.load(open(os.path.join(os.path.dirname(__file__), "form-geometrisi.json"), encoding="utf-8"))
KALEM = (0.05, 0.10, 0.45)
YAZI_TIPI = "/usr/share/fonts/truetype/liberation/LiberationSerif-Regular.ttf"


def halka(sayfa, dikdortgenler, rnd):
    """Secilen cevabin etrafina kalemle cizilmis izlenimi veren halka."""
    x0 = min(r[0] for r in dikdortgenler) - 3.2
    x1 = max(r[2] for r in dikdortgenler) + 3.0
    y0 = min(r[1] for r in dikdortgenler) - 2.0
    y1 = max(r[3] for r in dikdortgenler) + 1.8
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    rx, ry = (x1 - x0) / 2, (y1 - y0) / 2
    egim = rnd.uniform(-0.035, 0.035)
    ct, st = math.cos(egim), math.sin(egim)
    noktalar = []
    for k in range(49):                      # ~1.08 tur: ucu hafif tassin
        t = 2 * math.pi * k / 45
        w = 1 + rnd.uniform(-0.022, 0.022)
        dx, dy = rx * math.cos(t) * w, ry * math.sin(t) * w
        noktalar.append((cx + dx * ct - dy * st, cy + dx * st + dy * ct))
    sayfa.draw_polyline(noktalar, color=KALEM, width=0.9, lineCap=1, lineJoin=1)


def isaretle(kaynak, hedef, v, tohum=7):
    rnd = random.Random(tohum)
    doc = pymupdf.open(kaynak)
    sayfa = doc[0]
    alan = GEO["serbest_alanlar"]

    for anahtar, deger in (("ad_soyad", v.get("ad_soyad")),
                           ("telefon", v.get("telefon")),
                           ("poliklinik", v.get("poliklinik"))):
        if deger:
            a = alan[anahtar]
            sayfa.insert_text((a["x"], a["taban_y"]), deger, fontname="TR",
                              fontfile=YAZI_TIPI, fontsize=a["punto"], color=KALEM)

    for grup, kutular in GEO["parantez_kutulari"].items():
        secim = v.get(grup)
        if not secim:
            continue
        x0, x1, cy = kutular[secim]
        sayfa.insert_text(((x0 + x1) / 2 - 2.6, cy + 3.2), "X", fontname="TR",
                          fontfile=YAZI_TIPI, fontsize=9.5, color=KALEM)

    for soru, cevap in v.get("cevaplar", {}).items():
        if cevap is None:                    # cevaplanmadi / tetkik yok
            continue
        halka(sayfa, GEO["secenek_kutulari"][str(soru)][str(cevap)], rnd)

    if v.get("tetkik_yok"):
        a = alan["tetkik_yok_notu"]
        sayfa.insert_text((a["x"], a["taban_y"]), "Tetkik yaptırmadı", fontname="TR",
                          fontfile=YAZI_TIPI, fontsize=a["punto"], color=KALEM)

    a = alan["damga_satiri"]
    sayfa.insert_text((a["x"], a["taban_y"]),
                      f"Anket tarihi: {v['tarih']} · Saat: {v['saat']} · "
                      f"Anketi uygulayan: {v['uygulayan']}",
                      fontname="TR", fontfile=YAZI_TIPI, fontsize=a["punto"], color=(0, 0, 0))
    doc.save(hedef)
    doc.close()


if __name__ == "__main__":
    kaynak = sys.argv[1] if len(sys.argv) > 1 else "form.pdf"
    hedef = sys.argv[2] if len(sys.argv) > 2 else "dolu-ornek.pdf"
    isaretle(kaynak, hedef, dict(
        ad_soyad="ŞÜKRÜ DOĞAN", telefon="0532 415 66 08",
        poliklinik="Ağız, Diş ve Çene Cerrahisi",
        katilan="Hasta", cinsiyet="Erkek", yas="50-59", egitim="Lise",
        cevaplar={1: 4, 2: 5, 3: 3, 4: 5, 5: 4, 6: 5, 7: None, 8: 4},
        tetkik_yok=True, tarih="11.09.2026", saat="14:32", uygulayan="Şenay IŞIK"))
    print(f"yazildi: {hedef}")
