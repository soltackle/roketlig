/* Ay sonu raporu.
 *
 * Kaynak her zaman ay klasöründeki veri dosyalarıdır; eklentinin kendi
 * belleği değil. Çıktı kendi içinde yeterli tek bir HTML: dışarıdan yazı
 * tipi, betik ya da görsel çekmez. Ekranda okunur, tarayıcıdan
 * Yazdır → PDF ile A4'e basılır.
 */

import { hesapla, karsilastir, sayi, yuzde } from "./istatistik.js";
import { sureGoster } from "./zaman.js";

const AY_ADLARI = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
                   "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

const kacis = (s) => String(s ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;");

/** "2026-09 Eylül" -> "Eylül 2026" */
export function donemEtiketi(ayKlasoru) {
  const m = /^(\d{4})-(\d{2})/.exec(String(ayKlasoru));
  if (!m) return String(ayKlasoru);
  return `${AY_ADLARI[Number(m[2]) - 1] ?? m[2]} ${m[1]}`;
}

export function oncekiAyKlasoru(ayKlasoru) {
  const m = /^(\d{4})-(\d{2})/.exec(String(ayKlasoru));
  if (!m) return null;
  let yil = Number(m[1]);
  let ay = Number(m[2]) - 1;
  if (ay === 0) { ay = 12; yil -= 1; }
  return `${yil}-${String(ay).padStart(2, "0")} ${AY_ADLARI[ay - 1]}`;
}

// --- Parçalar -------------------------------------------------------------

function kart(etiket, deger, altYazi = "") {
  return `<div class="kart">
    <div class="kart-deger">${deger}</div>
    <div class="kart-etiket">${kacis(etiket)}</div>
    ${altYazi ? `<div class="kart-alt">${altYazi}</div>` : ""}
  </div>`;
}

function fark(deger, basamak = 2, birim = "") {
  // Karşılaştırma dönemi yoksa deger NaN gelebilir; ok işaretiyle "—" basmayalım.
  if (deger === null || deger === undefined || Number.isNaN(deger)
      || Math.abs(deger) < 5e-3) return "";
  const yon = deger > 0 ? "artis" : "azalis";
  const ok = deger > 0 ? "▲" : "▼";
  return `<span class="fark ${yon}">${ok} ${sayi(Math.abs(deger), basamak)}${birim}</span>`;
}

function tablo(basliklar, satirlar, siniflar = []) {
  const bas = basliklar.map((b, n) =>
    `<th${siniflar[n] ? ` class="${siniflar[n]}"` : ""}>${kacis(b)}</th>`).join("");
  const govde = satirlar.length
    ? satirlar.map((s) => `<tr>${s.map((h, n) =>
        `<td${siniflar[n] ? ` class="${siniflar[n]}"` : ""}>${h ?? "—"}</td>`).join("")}</tr>`).join("")
    : `<tr><td class="bos" colspan="${basliklar.length}">Bu dönemde kayıt yok.</td></tr>`;
  return `<table><thead><tr>${bas}</tr></thead><tbody>${govde}</tbody></table>`;
}

/** 1-5 dağılımını hücre içinde yatay çubuk olarak gösterir. */
function dagilimCubugu(dagilim) {
  const toplam = dagilim.reduce((t, d) => t + d, 0);
  if (!toplam) return '<div class="dagilim bos-dagilim">—</div>';
  const parcalar = dagilim.map((d, n) => {
    if (!d) return "";
    const pay = (d / toplam) * 100;
    return `<span class="p p${n + 1}" style="width:${pay.toFixed(2)}%" ` +
           `title="${n + 1} puan: ${d} cevap">${pay >= 12 ? d : ""}</span>`;
  }).join("");
  return `<div class="dagilim">${parcalar}</div>`;
}

function bolum(baslik, icerik, aciklama = "") {
  return `<section>
    <h2>${kacis(baslik)}</h2>
    ${aciklama ? `<p class="aciklama">${aciklama}</p>` : ""}
    ${icerik}
  </section>`;
}

function kirilimTablosu(baslik, satirlar) {
  return tablo(
    [baslik, "Anket", "Ortalama", "Memnuniyet"],
    satirlar.map((g) => [
      kacis(g.etiket),
      sayi(g.adet),
      g.ortalama === null ? "—" : sayi(g.ortalama, 2),
      g.ortalama === null ? "—" : yuzde(g.ortalama / 5)
    ]),
    ["", "say", "say", "say"]
  );
}

// --- Biçem ----------------------------------------------------------------

const BICEM = `
:root {
  --murekkep: #1b1f2a;
  --soluk: #5d6677;
  --cizgi: #d4d9e2;
  --zemin: #f4f6f9;
  --vurgu: #1a4f8a;
  --iyi: #1f7a4d;
  --kotu: #a8322a;
}
* { box-sizing: border-box; }
body {
  margin: 0; padding: 24px;
  font: 13px/1.45 "Segoe UI", system-ui, -apple-system, sans-serif;
  color: var(--murekkep); background: #fff;
}
.sayfa { max-width: 1040px; margin: 0 auto; }

header { border-bottom: 2px solid var(--murekkep); padding-bottom: 12px; margin-bottom: 20px; }
header .kurum { font-size: 12px; letter-spacing: .06em; text-transform: uppercase; color: var(--soluk); }
header h1 { margin: 4px 0 2px; font-size: 21px; font-weight: 650; }
header .donem { font-size: 15px; color: var(--vurgu); font-weight: 600; }
header .uretim { float: right; font-size: 11px; color: var(--soluk); text-align: right; line-height: 1.6; }

.kartlar { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 22px; }
.kart {
  flex: 1 1 140px; border: 1px solid var(--cizgi); border-radius: 6px;
  padding: 10px 12px; background: var(--zemin);
}
.kart-deger { font-size: 22px; font-weight: 650; line-height: 1.1; }
.kart-etiket { font-size: 11px; color: var(--soluk); margin-top: 3px; }
.kart-alt { font-size: 11px; color: var(--soluk); margin-top: 4px; }

.fark { font-size: 11px; font-weight: 600; margin-left: 5px; white-space: nowrap; }
.fark.artis { color: var(--iyi); }
.fark.azalis { color: var(--kotu); }

section { margin-bottom: 26px; break-inside: auto; }
h2 {
  font-size: 14px; font-weight: 650; margin: 0 0 8px;
  padding-bottom: 5px; border-bottom: 1px solid var(--cizgi);
}
.aciklama { margin: 0 0 10px; font-size: 12px; color: var(--soluk); }

table { width: 100%; border-collapse: collapse; font-size: 12px; }
th, td { border: 1px solid var(--cizgi); padding: 5px 7px; text-align: left; vertical-align: top; }
th { background: var(--zemin); font-weight: 600; font-size: 11px; white-space: nowrap; }
td.say, th.say { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
td.bos { text-align: center; color: var(--soluk); font-style: italic; }
tbody tr:nth-child(even) { background: #fbfcfd; }

.dagilim { display: flex; height: 15px; border-radius: 3px; overflow: hidden; min-width: 120px; background: #eceff3; }
.dagilim .p { font-size: 9px; color: #fff; text-align: center; line-height: 15px; }
.dagilim .p1 { background: #a8322a; }
.dagilim .p2 { background: #cc7a33; }
.dagilim .p3 { background: #9aa3b0; }
.dagilim .p4 { background: #4b87c4; }
.dagilim .p5 { background: #1f7a4d; }
.bos-dagilim { background: none; color: var(--soluk); font-size: 11px; }

.gosterge { display: flex; gap: 12px; font-size: 11px; color: var(--soluk); margin-top: 6px; }
.gosterge span::before {
  content: ""; display: inline-block; width: 9px; height: 9px;
  border-radius: 2px; margin-right: 4px; vertical-align: -1px;
}
.gosterge .g1::before { background: #a8322a; }
.gosterge .g2::before { background: #cc7a33; }
.gosterge .g3::before { background: #9aa3b0; }
.gosterge .g4::before { background: #4b87c4; }
.gosterge .g5::before { background: #1f7a4d; }

.ikili { display: flex; gap: 16px; flex-wrap: wrap; }
.ikili > div { flex: 1 1 300px; min-width: 0; }
.ikili h3 { font-size: 12px; font-weight: 600; margin: 0 0 6px; color: var(--soluk); }

footer { margin-top: 28px; padding-top: 10px; border-top: 1px solid var(--cizgi);
         font-size: 11px; color: var(--soluk); }

@media print {
  @page { size: A4 portrait; margin: 12mm; }
  body { padding: 0; font-size: 10.5px; }
  header .uretim { font-size: 9px; }
  table { font-size: 9.5px; }
  th, td { padding: 3px 5px; }
  th { font-size: 9px; }
  section { page-break-inside: avoid; break-inside: avoid; }
  thead { display: table-header-group; }
  tr { page-break-inside: avoid; break-inside: avoid; }
  .kart { background: var(--zemin) !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .dagilim, .dagilim .p, .gosterge span::before {
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
}`;

// --- Rapor ----------------------------------------------------------------

/**
 * @param {string} ayKlasoru   "2026-09 Eylül"
 * @param {object[]} kayitlar  bu ayın veri kayıtları
 * @param {object[]|null} oncekiKayitlar  önceki ayın kayıtları (varsa)
 * @param {{gelenHasta:number, oran:number}|null} hedef  kuruma gelen hasta
 *        sayısı ve aranması gereken oran (elle girilir)
 * @returns {string} kendi içinde yeterli, yazdırmaya hazır HTML
 */
export function raporUret(ayKlasoru, kayitlar, oncekiKayitlar = null, hedef = null) {
  const donem = donemEtiketi(ayKlasoru);
  const i = hesapla(kayitlar);
  const onceki = oncekiKayitlar && oncekiKayitlar.length ? hesapla(oncekiKayitlar) : null;
  const k = karsilastir(i, onceki);
  const simdi = new Date();

  const bolumler = [];

  // --- Özet kartları
  bolumler.push(`<div class="kartlar">
    ${kart("Aranan kişi", sayi(i.arananKisi),
           i.arananlar !== i.arananKisi ? `${sayi(i.arananlar)} arama` :
           (k ? `önceki ay ${sayi(onceki.arananKisi)}` : ""))}
    ${kart("Ulaşılan", `${sayi(i.ulasilanlar)} ${fark(k?.ulasilanlar ?? null, 0)}`,
           `ulaşılma oranı ${yuzde(i.ulasilmaOrani)}`)}
    ${kart("Tamamlanan anket", sayi(i.tamamlananlar),
           `ulaşılanların ${yuzde(i.tamamlanmaOrani)}'i`)}
    ${kart("Genel ortalama",
           i.genelOrtalama === null ? "—"
             : `${sayi(i.genelOrtalama, 2)}<span class="kart-alt" style="display:inline"> / 5</span> ${fark(k?.genelOrtalama ?? null)}`,
           `${sayi(i.puanliCevapAdedi)} puanlanan cevap`)}
    ${kart("Memnuniyet (ortalama/5)", yuzde(i.genelMemnuniyet))}
    ${kart("Memnuniyet (4-5 verenler)",
           `${yuzde(i.genelDortBesOrani)} ${fark(
             k?.genelDortBesOrani == null ? null : k.genelDortBesOrani * 100, 1, " puan")}`)}
    ${kart("Ortalama dönüş süresi",
           i.ortalamaDonus === null ? "—" : sureGoster(i.ortalamaDonus),
           i.ortalamaDonus === null ? "muayene saati olan kayıt yok"
             : `ortanca ${sureGoster(i.ortancaDonus)} · ${sayi(i.donusOlculen)} kayıt`)}
  </div>`);

  // --- Hedef ve kapsam
  const oran = hedef?.oran ?? 1;
  const gereken = hedef?.gelenHasta ? Math.ceil(hedef.gelenHasta * oran / 100) : null;
  const hedefTablosu = tablo(
    ["Kuruma gelen hasta", `Aranması gereken (%${sayi(oran, oran % 1 ? 1 : 0)})`,
     "Aranan kişi", "Ulaşılan kişi", "Gerçekleşme"],
    [[
      hedef?.gelenHasta ? sayi(hedef.gelenHasta) : "—",
      gereken === null ? "—" : sayi(gereken),
      sayi(i.arananKisi),
      sayi(i.ulasilanKisi),
      gereken ? yuzde(i.arananKisi / gereken) : "—"
    ]],
    ["say", "say", "say", "say", "say"]
  );

  bolumler.push(bolum("Kapsam ve hedef",
    hedefTablosu + `<div style="margin-top:14px">${tablo(
      ["Görüşme sonucu", "Adet", "Oran"],
      i.sonucDagilimi.map((s) => [
        kacis(s.etiket), sayi(s.adet), i.arananlar ? yuzde(s.adet / i.arananlar) : "—"
      ]),
      ["", "say", "say"]
    )}</div>`,
    (gereken === null
      ? "Kuruma gelen hasta sayısı girilmediği için hedef hesaplanmamıştır; " +
        "panelin Rapor sekmesinden girilebilir. "
      : `Aylık hasta sayısının %${sayi(oran, oran % 1 ? 1 : 0)}'i aranmalıdır. `) +
    "Hedef kişi üzerinden ölçülür: aynı hastayı birden çok kez aramak tek kişi " +
    "sayılır. Sonuç tablosundaki adetler ise arama sayısıdır — ulaşılamayan bir " +
    "hasta tekrar arandığında iki satır oluşur. Ulaşılamayan görüşmeler PDF'siz " +
    "kayıt olarak tutulur; tekrar aranacaklar listesi bu kayıtlardan çıkar."));

  // --- Soru bazlı
  const soruSatirlari = i.sorular.map((s) => {
    const f = k?.sorular.find((x) => x.no === s.no)?.fark ?? null;
    return [
      sayi(s.no),
      kacis(s.metin),
      dagilimCubugu(s.dagilim),
      sayi(s.puanli),
      s.kapsamDisi ? sayi(s.kapsamDisi) : "—",
      s.ortalama === null ? "—" : `${sayi(s.ortalama, 2)} ${fark(f)}`,
      yuzde(s.dortBesOrani)
    ];
  });

  bolumler.push(bolum("Soru bazlı sonuçlar",
    tablo(
      ["No", "Soru", "1-5 dağılımı", "Puanlanan", "Kapsam dışı", "Ortalama", "4-5 oranı"],
      soruSatirlari,
      ["say", "", "", "say", "say", "say", "say"]
    ) + `<div class="gosterge">
      <span class="g1">1 puan</span><span class="g2">2 puan</span>
      <span class="g3">3 puan</span><span class="g4">4 puan</span><span class="g5">5 puan</span>
    </div>`,
    "Ortalama yalnızca o soruyu puanlayanlar üzerinden alınır; payda " +
    '"Puanlanan" sütununda görünür. 4. sorunun "Bilgi istemedim", 6. sorunun ' +
    '"Farkında değildim" seçenekleri ile tetkik yaptırmamış hastaların 7. soru ' +
    "cevapsızlığı memnuniyet ölçmediği için ortalamaya katılmaz; dağılım " +
    "çubuğunda ise işaretlendiği gibi görünür."));

  // --- Kırılımlar
  bolumler.push(bolum("Poliklinik ve hekim kırılımı", `<div class="ikili">
    <div><h3>Poliklinik</h3>${kirilimTablosu("Poliklinik", i.kirilimlar.poliklinik)}</div>
    <div><h3>Hekim</h3>${kirilimTablosu("Hekim", i.kirilimlar.hekim)}</div>
  </div>`, "Anket sayısı düşük birimlerde ortalama tek bir cevaptan etkilenebilir; " +
           "kırılımlar anket sayısıyla birlikte okunmalıdır."));

  bolumler.push(bolum("Katılımcı profili", `<div class="ikili">
    <div><h3>Katılımcı türü</h3>${kirilimTablosu("Tür", i.kirilimlar.katilimciTuru)}</div>
    <div><h3>Cinsiyet</h3>${kirilimTablosu("Cinsiyet", i.kirilimlar.cinsiyet)}</div>
  </div><div class="ikili" style="margin-top:14px">
    <div><h3>Yaş grubu</h3>${kirilimTablosu("Yaş grubu", i.kirilimlar.yasGrubu)}</div>
    <div><h3>Eğitim durumu</h3>${kirilimTablosu("Eğitim", i.kirilimlar.egitim)}</div>
  </div>`, "Cinsiyet, yaş ve eğitim ankete katılanın beyanıdır. Telefonu hasta " +
           "yakını açtığında bu bilgiler hasta kaydından değil, görüşülen kişiden alınır."));

  // --- DÖF
  bolumler.push(bolum("DÖF — 2 ve altı puan verilen cevaplar", tablo(
    ["Tarih", "Hasta", "Poliklinik", "Hekim", "Soru", "Puan", "Verilen cevap", "Hasta görüşü"],
    i.dof.map((d) => [
      kacis(d.tarih), kacis(d.adSoyad), kacis(d.poliklinik), kacis(d.hekim),
      sayi(d.soruNo), sayi(d.puan), kacis(d.secenek), kacis(d.gorus)
    ]),
    ["", "", "", "", "say", "say", "", ""]
  ), i.dof.length
    ? `Toplam ${sayi(i.dof.length)} cevapta 2 ve altı puan verilmiştir.`
    : "Bu dönemde 2 ve altı puan verilen cevap bulunmamaktadır."));

  // --- Görüşler ve tekrar aranacaklar
  bolumler.push(bolum("Hastaların serbest görüşleri", tablo(
    ["Tarih", "Hasta", "Poliklinik", "Görüş"],
    i.gorusler.map((g) => [kacis(g.tarih), kacis(g.adSoyad), kacis(g.poliklinik), kacis(g.gorus)])
  ), "Anket formunda serbest görüş alanı bulunmadığı için hastanın söyledikleri " +
     "PDF'e değil veri kaydına alınır ve burada listelenir."));

  bolumler.push(bolum("Tekrar aranacaklar", tablo(
    ["Tarih", "Hasta", "Telefon", "Poliklinik", "Görüşme sonucu"],
    i.tekrarAranacaklar.map((t) => [
      kacis(t.tarih), kacis(t.adSoyad), kacis(t.telefon), kacis(t.poliklinik), kacis(t.sonuc)
    ])
  ), "Telefonu açmayan hastalar. Numarası hatalı olanlar ve görüşmeyi istemeyenler " +
     "bu listeye alınmaz."));

  const oncekiNot = onceki
    ? `Karşılaştırma dönemi: ${kacis(donemEtiketi(oncekiAyKlasoru(ayKlasoru)))} ` +
      `(${sayi(onceki.arananlar)} arama, ${sayi(onceki.ulasilanlar)} ulaşma).`
    : "Önceki döneme ait kayıt bulunamadığı için karşılaştırma yapılmamıştır.";

  return `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Hasta Memnuniyet Anketi Raporu — ${kacis(donem)}</title>
<style>${BICEM}</style>
</head>
<body>
<div class="sayfa">
  <header>
    <div class="uretim">
      Üretim: ${simdi.toLocaleDateString("tr-TR")} ${simdi.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}<br>
      Kaynak: ${kacis(ayKlasoru)}/_veri<br>
      ${sayi(kayitlar.length)} kayıt
    </div>
    <div class="kurum">Avcılar Ağız ve Diş Sağlığı Merkezi</div>
    <h1>Hasta Memnuniyet Anketi — Aylık Rapor</h1>
    <div class="donem">${kacis(donem)}</div>
  </header>

  ${bolumler.join("\n")}

  <footer>
    Rapor, ay klasöründeki veri dosyalarından üretilmiştir; istenildiği an
    yeniden üretilebilir. ${oncekiNot}
    Form: HHD.FR.19 Hasta Memnuniyet Anketi (Rev.01).
  </footer>
</div>
</body>
</html>`;
}

export { hesapla };
