/* Yapılan anketlerin dökümü.
 *
 * Ay klasöründeki veri dosyalarından üretilir. Ekranda okunur, yazdırılır ya
 * da CSV olarak Excel'e alınır. Rapordan farkı: burada istatistik yok, hangi
 * hastanın ne zaman arandığı var — resmî kayıt niteliğinde bir döküm.
 */

import { GORUSME_SONUCLARI } from "./sorular.js";
import { tarihGoster, saatGoster } from "./zaman.js";
import { xlsxOlustur } from "./xlsx.js";

const SONUC_ADI = new Map(GORUSME_SONUCLARI.map((s) => [s.kod, s.etiket]));

const kacis = (s) => String(s ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;");

export const SUTUNLAR = [
  { baslik: "Sıra",              al: (k, n) => String(n + 1) },
  { baslik: "Ad Soyad",          al: (k) => k.hasta?.adSoyad ?? "" },
  { baslik: "T.C. Kimlik No",    al: (k) => k.hasta?.tcKimlikNo ?? "" },
  { baslik: "Telefon",           al: (k) => k.hasta?.telefon ?? "" },
  { baslik: "Başvurduğu Poliklinik", al: (k) => k.hasta?.poliklinik ?? "" },
  { baslik: "Hekim",             al: (k) => k.hasta?.hekim ?? "" },
  { baslik: "Muayene Tarihi",    al: (k) => tarihGoster(k.hasta?.muayeneZamani ?? k.hasta?.islemTarihi) },
  { baslik: "Muayene Saati",     al: (k) => saatGoster(k.hasta?.muayeneZamani) },
  { baslik: "Aranma Tarihi",     al: (k) => k.tarihGosterim || tarihGoster(k.tarih) },
  { baslik: "Aranma Saati",      al: (k) => k.saat ?? "" },
  { baslik: "Görüşme Sonucu",    al: (k) => SONUC_ADI.get(k.gorusmeSonucu) ?? k.gorusmeSonucu ?? "" },
  { baslik: "Anketi Uygulayan",  al: (k) => k.uygulayan ?? "" }
];

/** Kayıtları aranma zamanına göre eskiden yeniye dizer. */
function sirala(kayitlar) {
  return [...kayitlar].sort((a, b) =>
    String(a.zamanDamgasi ?? "").localeCompare(String(b.zamanDamgasi ?? "")));
}

export function listeSatirlari(kayitlar, sadeceUlasilan = false) {
  const secili = sadeceUlasilan
    ? kayitlar.filter((k) => k.gorusmeSonucu === "ulasildi")
    : kayitlar;
  return sirala(secili).map((k, n) => SUTUNLAR.map((s) => s.al(k, n)));
}

// --- Excel (.xlsx) ----------------------------------------------------------

export const ANKET_BASLIGI = "AVCILAR AĞIZ VE DİŞ SAĞLIĞI MERKEZİ HASTA MEMNUNİYET ANKETİ";

/**
 * Anket listesini gerçek bir .xlsx dosyası olarak üretir. İlk hücrede kurum ve
 * anket adı, altında verilen dönem/gün etiketi, onun altında da tablo yer alır.
 *
 * @param {string} altBaslik  ör. "11.09.2026" (seçilen gün) ya da "Eylül 2026"
 * @returns {Uint8Array} .xlsx dosyasının baytları
 */
export function listeXlsx(altBaslik, kayitlar, sadeceUlasilan = false) {
  const basSutunlari = SUTUNLAR.map((s) => s.baslik);
  const satirlar = listeSatirlari(kayitlar, sadeceUlasilan);
  return xlsxOlustur(ANKET_BASLIGI, altBaslik, basSutunlari, satirlar);
}

// --- HTML -----------------------------------------------------------------

const BICEM = `
* { box-sizing: border-box; }
body { margin: 0; padding: 22px; background: #fff; color: #1b1f2a;
       font: 12px/1.4 "Segoe UI", system-ui, -apple-system, sans-serif; }
.sayfa { max-width: 1180px; margin: 0 auto; }
header { border-bottom: 2px solid #1b1f2a; padding-bottom: 10px; margin-bottom: 14px; }
header .kurum { font-size: 11px; letter-spacing: .06em; text-transform: uppercase; color: #5d6677; }
header h1 { margin: 4px 0 2px; font-size: 18px; font-weight: 650; }
header .donem { font-size: 14px; color: #1a4f8a; font-weight: 600; }
header .uretim { float: right; font-size: 10.5px; color: #5d6677; text-align: right; line-height: 1.6; }
table { width: 100%; border-collapse: collapse; font-size: 11px; }
th, td { border: 1px solid #c9cfd8; padding: 4px 6px; text-align: left; vertical-align: top; }
th { background: #eef1f5; font-weight: 600; font-size: 10.5px; white-space: nowrap; }
td.say, th.say { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
td.orta, th.orta { text-align: center; white-space: nowrap; }
tbody tr:nth-child(even) { background: #fafbfc; }
tbody tr.ulasilamadi { color: #6b7280; font-style: italic; }
.bos { text-align: center; color: #5d6677; font-style: italic; }
footer { margin-top: 14px; font-size: 10.5px; color: #5d6677; }
@media print {
  @page { size: A4 landscape; margin: 10mm; }
  body { padding: 0; }
  table { font-size: 9px; }
  th, td { padding: 2px 4px; }
  thead { display: table-header-group; }
  tr { page-break-inside: avoid; break-inside: avoid; }
  tbody tr:nth-child(even), th { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}`;

const SAY_SUTUNLARI = new Set(["Sıra", "T.C. Kimlik No"]);
const ORTA_SUTUNLARI = new Set(["Muayene Tarihi", "Muayene Saati",
                                "Aranma Tarihi", "Aranma Saati"]);

function sinif(baslik) {
  if (SAY_SUTUNLARI.has(baslik)) return " class=\"say\"";
  if (ORTA_SUTUNLARI.has(baslik)) return " class=\"orta\"";
  return "";
}

/**
 * @param {string} donem   gösterilecek dönem etiketi, ör. "Eylül 2026"
 * @param {object[]} kayitlar
 * @param {boolean} sadeceUlasilan
 * @returns {string} kendi içinde yeterli, yazdırmaya hazır HTML
 */
export function listeHtml(donem, kayitlar, sadeceUlasilan = false) {
  const satirlar = listeSatirlari(kayitlar, sadeceUlasilan);
  const secili = sadeceUlasilan
    ? kayitlar.filter((k) => k.gorusmeSonucu === "ulasildi")
    : kayitlar;
  const siraliKayitlar = sirala(secili);
  const simdi = new Date();

  const bas = SUTUNLAR.map((s) => `<th${sinif(s.baslik)}>${kacis(s.baslik)}</th>`).join("");
  const govde = satirlar.length
    ? satirlar.map((satir, n) => {
        const ulasildi = siraliKayitlar[n]?.gorusmeSonucu === "ulasildi";
        const hucreler = satir
          .map((d, i) => `<td${sinif(SUTUNLAR[i].baslik)}>${kacis(d) || "—"}</td>`).join("");
        return `<tr${ulasildi ? "" : ' class="ulasilamadi"'}>${hucreler}</tr>`;
      }).join("")
    : `<tr><td class="bos" colspan="${SUTUNLAR.length}">Bu dönemde kayıt yok.</td></tr>`;

  const ulasilan = kayitlar.filter((k) => k.gorusmeSonucu === "ulasildi").length;
  const tcsiz = siraliKayitlar.filter((k) => !k.hasta?.tcKimlikNo).length;

  return `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Hasta Memnuniyet Anketi Listesi — ${kacis(donem)}</title>
<style>${BICEM}</style>
</head>
<body>
<div class="sayfa">
  <header>
    <div class="uretim">
      Üretim: ${simdi.toLocaleDateString("tr-TR")} ${simdi.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}<br>
      ${satirlar.length} satır
    </div>
    <div class="kurum">Avcılar Ağız ve Diş Sağlığı Merkezi</div>
    <h1>Hasta Memnuniyet Anketi — Anket Listesi</h1>
    <div class="donem">${kacis(donem)}${sadeceUlasilan ? " · yalnızca ulaşılanlar" : ""}</div>
  </header>

  <table>
    <thead><tr>${bas}</tr></thead>
    <tbody>${govde}</tbody>
  </table>

  <footer>
    Toplam ${kayitlar.length} arama, ${ulasilan} ulaşma.
    ${sadeceUlasilan ? "Ulaşılamayan görüşmeler bu listede yer almıyor."
                     : "Ulaşılamayan görüşmeler soluk yazılmıştır; onlarda anket yapılmamıştır."}
    ${tcsiz ? `${tcsiz} kayıtta T.C. kimlik numarası yok — bu alan sonradan
                eklendiği için daha eski anketlerde boş görünür.` : ""}
    Liste, ay klasöründeki veri dosyalarından üretilmiştir.
  </footer>
</div>
</body>
</html>`;
}
