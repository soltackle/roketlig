/* Orijinal HHD.FR.19 şablonunun üzerine işaretleme.
 *
 * Şablon yeniden çizilmiyor; boş formun bir kopyası açılıp üzerine X'ler,
 * halkalar ve yazılar konuyor. Çıktı böylece şablonla birebir aynı kalıyor.
 */

import { PDFDocument, rgb } from "../varliklar/pdf-lib.esm.min.js";
import fontkit from "../varliklar/fontkit.esm.js";
import { GEOMETRI } from "./form-geometrisi.js";
import { SORULAR } from "./sorular.js";
import { zamanGoster } from "./zaman.js";

const BOS_FORM = "varliklar/HHD.FR.19-bos-form.pdf";
const YAZI_TIPI = "varliklar/LiberationSerif-Regular.ttf";

const KALEM = rgb(0.05, 0.10, 0.45);   // mavi tükenmez
const SIYAH = rgb(0, 0, 0);

let onbellek = null;

async function varlikYukle(yol) {
  const cevap = await fetch(chrome.runtime.getURL(yol));
  if (!cevap.ok) throw new Error(`${yol} okunamadı`);
  return new Uint8Array(await cevap.arrayBuffer());
}

async function varliklar() {
  if (!onbellek) {
    const [form, font] = await Promise.all([varlikYukle(BOS_FORM), varlikYukle(YAZI_TIPI)]);
    onbellek = { form, font };
  }
  return onbellek;
}

/** Aynı anket her zaman aynı görünsün diye tohumlu, deterministik rastgelelik. */
function rastgele(tohum) {
  let s = 2166136261;
  for (const ch of String(tohum)) {
    s ^= ch.charCodeAt(0);
    s = Math.imul(s, 16777619);
  }
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5;  s >>>= 0;
    return s / 4294967296;
  };
}

/**
 * Seçilen cevabın etrafına kalemle çizilmiş izlenimi veren halka.
 * dikdortgenler: [x0, y0, x1, y1] listesi (sol üst orijin).
 */
function halkaYolu(dikdortgenler, rnd) {
  const x0 = Math.min(...dikdortgenler.map((r) => r[0])) - 3.2;
  const x1 = Math.max(...dikdortgenler.map((r) => r[2])) + 3.0;
  const y0 = Math.min(...dikdortgenler.map((r) => r[1])) - 2.0;
  const y1 = Math.max(...dikdortgenler.map((r) => r[3])) + 1.8;

  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const rx = (x1 - x0) / 2, ry = (y1 - y0) / 2;
  const egim = (rnd() - 0.5) * 0.07;
  const ct = Math.cos(egim), st = Math.sin(egim);

  const parcalar = [];
  for (let k = 0; k <= 48; k += 1) {         // ~1.07 tur: ucu hafif taşsın
    const t = (2 * Math.PI * k) / 45;
    const w = 1 + (rnd() - 0.5) * 0.044;
    const dx = rx * Math.cos(t) * w;
    const dy = ry * Math.sin(t) * w;
    const x = cx + dx * ct - dy * st;
    const y = cy + dx * st + dy * ct;
    parcalar.push(`${k === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`);
  }
  return parcalar.join(" ");
}

const bosMu = (d) => d === null || d === undefined || String(d).trim() === "";

/** Metni verilen genişliğe göre satırlara böler; sığmayan uzun kelimeyi keser. */
function satirlaraBol(metin, font, punto, genislik) {
  const satirlar = [];
  for (const paragraf of String(metin).split(/\r?\n/)) {
    if (!paragraf.trim()) { satirlar.push(""); continue; }
    let satir = "";
    for (const kelime of paragraf.trim().split(/\s+/)) {
      const aday = satir ? `${satir} ${kelime}` : kelime;
      if (font.widthOfTextAtSize(aday, punto) <= genislik) { satir = aday; continue; }
      if (satir) satirlar.push(satir);
      // Tek başına sığmayan kelimeyi harf harf kır
      let parca = "";
      for (const harf of kelime) {
        if (font.widthOfTextAtSize(parca + harf, punto) > genislik && parca) {
          satirlar.push(parca);
          parca = harf;
        } else {
          parca += harf;
        }
      }
      satir = parca;
    }
    if (satir) satirlar.push(satir);
  }
  return satirlar;
}

/**
 * Hastanın görüşünü formun boş orta sütun hücrelerine yazar.
 * Anketin gerçekten yapıldığına dair delil olduğu için metin kaybolmamalı:
 * hücrelere sığmayan kısım çağıran tarafa geri döner, o da ikinci sayfaya taşır.
 *
 * @returns {string[]} yazılamayan satırlar
 */
function gorusuYaz(sayfa, yukseklik, gorus, font, tetkikYok) {
  const { punto, satir_yuksekligi: satirY, etiket } =
    GEOMETRI.serbest_alanlar.gorus_basligi;
  const DEVAM = "(devamı arka sayfada)";

  const hucreler = GEOMETRI.gorus_hucreleri
    .filter((h) => !(h.soru === 7 && tetkikYok));   // o hücrede tetkik notu duruyor

  // Hücrelerin taşıdığı taban çizgileri, yukarıdan aşağıya
  const yerler = [];
  for (const h of hucreler) {
    for (let y = h.y0 + punto; y <= h.y1; y += satirY) yerler.push({ x: h.x0, y });
  }

  const genislik = hucreler[0].x1 - hucreler[0].x0;
  const satirlar = [etiket, ...satirlaraBol(gorus, font, punto, genislik)];
  const tasiyor = satirlar.length > yerler.length;
  // Taşıyorsa son satır, okuyucuyu arka sayfaya yönlendiren nota ayrılır.
  const yazilacak = tasiyor ? satirlar.slice(0, yerler.length - 1) : satirlar;

  yazilacak.forEach((satir, n) => {
    if (!satir) return;
    sayfa.drawText(satir, {
      x: yerler[n].x, y: yukseklik - yerler[n].y, size: punto, font, color: KALEM
    });
  });

  if (!tasiyor) return [];

  const son = yerler[yazilacak.length];
  sayfa.drawText(DEVAM, {
    x: son.x, y: yukseklik - son.y, size: punto, font, color: KALEM
  });
  return satirlar.slice(yazilacak.length);
}

/**
 * Sığmayan görüş satırları için ek sayfa(lar). Şablonun 1. sayfası değişmez.
 * Metin delil olduğu için kırpılmaz: kaç sayfa gerekiyorsa o kadar açılır.
 */
function gorusDevamSayfalari(belge, font, kayit, satirlar) {
  const gen = GEOMETRI.sayfa.genislik;
  const yuk = GEOMETRI.sayfa.yukseklik;
  const KENAR = 34;
  const punto = 9.5;
  const satirY = 12.5;
  const ilkSatir = 102;
  const sonSatir = yuk - 52;                 // damga satırının üstünde kalsın
  const damga = GEOMETRI.serbest_alanlar.damga_satiri;

  // 1. sayfadaki dar sütuna göre bölünmüş satırlar burada yeniden akıtılıyor.
  const akan = satirlaraBol(satirlar.join(" "), font, punto, gen - 2 * KENAR);
  const sayfaBasina = Math.max(1, Math.floor((sonSatir - ilkSatir) / satirY) + 1);
  const toplamSayfa = Math.ceil(akan.length / sayfaBasina);

  for (let n = 0; n < toplamSayfa; n += 1) {
    const sayfa = belge.addPage([gen, yuk]);
    const yaz = (metin, x, tabanY, p, renk = SIYAH) =>
      sayfa.drawText(String(metin), { x, y: yuk - tabanY, size: p, font, color: renk });

    const basSonu = toplamSayfa > 1 ? ` (${n + 1}/${toplamSayfa})` : "";
    yaz(`HHD.FR.19 HASTA MEMNUNİYET ANKETİ — HASTA GÖRÜŞÜ (devamı)${basSonu}`,
        KENAR, 60, 11);
    yaz(`${kayit.hasta?.adSoyad ?? ""} · ${kayit.hasta?.poliklinik ?? ""}`, KENAR, 76, 9.5);
    sayfa.drawLine({
      start: { x: KENAR, y: yuk - 84 }, end: { x: gen - KENAR, y: yuk - 84 },
      thickness: 0.7, color: SIYAH
    });

    let y = ilkSatir;
    for (const satir of akan.slice(n * sayfaBasina, (n + 1) * sayfaBasina)) {
      yaz(satir, KENAR, y, punto, KALEM);
      y += satirY;
    }

    const muayene = zamanGoster(kayit.hasta?.muayeneZamani ?? kayit.hasta?.islemTarihi);
    yaz(
      (muayene ? `Muayene: ${muayene} · ` : "") +
      `Anket: ${kayit.tarihGosterim || kayit.tarih} ${kayit.saat} · ` +
      `Anketi uygulayan: ${kayit.uygulayan || "—"}`,
      KENAR, damga.taban_y, damga.punto
    );
  }
  return toplamSayfa;
}

/**
 * @param {object} kayit  Anket veri kaydı (bkz. motor/kayit.js)
 * @returns {Promise<Uint8Array>} işaretlenmiş PDF
 */
export async function anketiIsaretle(kayit) {
  const { form, font: fontBaytlari } = await varliklar();

  const belge = await PDFDocument.load(form);
  belge.registerFontkit(fontkit);
  const font = await belge.embedFont(fontBaytlari, { subset: true });

  const sayfa = belge.getPage(0);
  const yukseklik = sayfa.getHeight();
  const rnd = rastgele(kayit.pdfDosya || `${kayit.hasta?.hastaId}-${kayit.tarih}-${kayit.saat}`);

  // Sol üst orijinli koordinatlar için ortak yardımcılar
  const yaz = (metin, x, tabanY, punto, renk = KALEM) =>
    sayfa.drawText(String(metin), {
      x, y: yukseklik - tabanY, size: punto, font, color: renk
    });

  const ciz = (yol) =>
    sayfa.drawSvgPath(yol, {
      x: 0, y: yukseklik,
      borderColor: KALEM, borderWidth: 0.9,
      borderLineCap: 1
    });

  const alanlar = GEOMETRI.serbest_alanlar;

  // 1) İki noktaların yanına yazılar
  const serbest = [
    ["ad_soyad", kayit.hasta?.adSoyad],
    ["telefon", kayit.hasta?.telefon],
    ["poliklinik", kayit.hasta?.poliklinik]
  ];
  for (const [anahtar, deger] of serbest) {
    if (bosMu(deger)) continue;
    const a = alanlar[anahtar];
    yaz(deger, a.x, a.taban_y, a.punto);
  }

  // 2) Parantez kutularına X
  const katilimci = kayit.katilimci || {};
  const secimler = {
    katilan: katilimci.tur,
    cinsiyet: katilimci.cinsiyet,
    yas: katilimci.yasGrubu,
    egitim: katilimci.egitim
  };
  for (const [grup, secim] of Object.entries(secimler)) {
    if (bosMu(secim)) continue;
    const kutu = GEOMETRI.parantez_kutulari[grup]?.[secim];
    if (!kutu) continue;                       // tanımadığı seçimi uydurmaz
    const [x0, x1, cy] = kutu;
    yaz("X", (x0 + x1) / 2 - 2.6, cy + 3.2, 9.5);
  }

  // 3) Seçilen cevapların etrafına halka
  for (const soru of SORULAR) {
    const cevap = kayit.cevaplar?.[soru.no] ?? kayit.cevaplar?.[String(soru.no)];
    if (cevap === null || cevap === undefined) continue;
    const kutular = GEOMETRI.secenek_kutulari[String(soru.no)]?.[String(cevap)];
    if (!kutular) continue;
    ciz(halkaYolu(kutular, rnd));
  }

  // 4) Tetkik yapılmadıysa 7. sorunun boş orta sütununa not
  if (kayit.tetkikYok) {
    const a = alanlar.tetkik_yok_notu;
    yaz(SORULAR.find((s) => s.no === 7).kosulEtiketi, a.x, a.taban_y, a.punto);
  }

  // 5) Hastanın görüşü — anketin yapıldığına dair delil olduğu için forma
  //    da düşer. Boş orta sütuna sığmayan kısım ikinci sayfaya taşar.
  const tasan = bosMu(kayit.hastaGorusu)
    ? []
    : gorusuYaz(sayfa, yukseklik, kayit.hastaGorusu.trim(), font, kayit.tetkikYok);

  // 6) Onay damgası. Muayene ile anket zamanı yan yana durur; anketin hangi
  //    ziyarete ait olduğu formun kendisinden okunabilsin diye.
  const d = alanlar.damga_satiri;
  const muayene = zamanGoster(kayit.hasta?.muayeneZamani ?? kayit.hasta?.islemTarihi);
  const parcalar = [
    muayene ? `Muayene: ${muayene}` : null,
    `Anket: ${kayit.tarihGosterim || kayit.tarih} ${kayit.saat}`,
    `Anketi uygulayan: ${kayit.uygulayan || "—"}`
  ].filter(Boolean);

  const tek = parcalar.join(" · ");
  const enGenis = GEOMETRI.sayfa.genislik - d.x - 14;
  if (font.widthOfTextAtSize(tek, d.punto) <= enGenis) {
    yaz(tek, d.x, d.taban_y, d.punto, SIYAH);
  } else {
    // Tek satıra sığmıyor: tabloyla sayfa sonu arasındaki boşluk iki satır alır
    yaz(parcalar.slice(0, -1).join(" · "), d.x, d.taban_y - 5.5, d.punto, SIYAH);
    yaz(parcalar.at(-1), d.x, d.taban_y + 5.5, d.punto, SIYAH);
  }

  if (tasan.length) gorusDevamSayfalari(belge, font, kayit, tasan);

  belge.setTitle(`HHD.FR.19 Hasta Memnuniyet Anketi — ${kayit.hasta?.adSoyad ?? ""}`.trim());
  belge.setSubject(GEOMETRI.kaynak);
  belge.setCreator("HHD.FR.19 Anket Eklentisi");
  belge.setProducer("HHD.FR.19 Anket Eklentisi");

  return belge.save();
}
