/* En küçük halinde bir .xlsx (OOXML) yazıcısı.
 *
 * Eklenti internete çıkmıyor, bu yüzden hazır bir kütüphane (SheetJS vb.)
 * gömmek yerine format elle üretiliyor: sıkıştırmasız (STORED) bir ZIP içinde
 * gerekli birkaç XML parçası. Veri hep satır-içi metin (inlineStr) olarak
 * yazılır — T.C. kimlik no ve telefon gibi alanlar Excel'in sayı sanıp
 * biçimini bozmasın diye.
 */

const CRC_TABLOSU = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? (0xedb88320 ^ (c >>> 1)) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(baytlar) {
  let c = 0xffffffff;
  for (let i = 0; i < baytlar.length; i += 1) {
    c = CRC_TABLOSU[(c ^ baytlar[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

const u16 = (n) => new Uint8Array([n & 0xff, (n >>> 8) & 0xff]);
const u32 = (n) => new Uint8Array([n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff]);

function birlestir(parcalar) {
  const toplam = parcalar.reduce((a, p) => a + p.length, 0);
  const sonuc = new Uint8Array(toplam);
  let konum = 0;
  for (const p of parcalar) { sonuc.set(p, konum); konum += p.length; }
  return sonuc;
}

/** Sıkıştırmasız (STORED) bir ZIP paketi kurar. */
function zipOlustur(dosyalar) {
  const kodlayici = new TextEncoder();
  const yerelParcalar = [];
  const merkezParcalar = [];
  let ofset = 0;

  for (const { ad, icerik } of dosyalar) {
    const adBaytlari = kodlayici.encode(ad);
    const crc = crc32(icerik);
    const boyut = icerik.length;

    const yerelBaslik = birlestir([
      u32(0x04034b50), u16(20), u16(0), u16(0),
      u16(0), u16(0x21),                      // saat 0, tarih 1980-01-01
      u32(crc), u32(boyut), u32(boyut),
      u16(adBaytlari.length), u16(0),
      adBaytlari
    ]);
    yerelParcalar.push(yerelBaslik, icerik);

    merkezParcalar.push(birlestir([
      u32(0x02014b50), u16(20), u16(20), u16(0), u16(0),
      u16(0), u16(0x21),
      u32(crc), u32(boyut), u32(boyut),
      u16(adBaytlari.length), u16(0), u16(0), u16(0), u16(0), u32(0),
      u32(ofset),
      adBaytlari
    ]));

    ofset += yerelBaslik.length + icerik.length;
  }

  const merkezBaslangic = ofset;
  const merkezBoyut = merkezParcalar.reduce((a, p) => a + p.length, 0);
  const sonKayit = birlestir([
    u32(0x06054b50), u16(0), u16(0),
    u16(dosyalar.length), u16(dosyalar.length),
    u32(merkezBoyut), u32(merkezBaslangic), u16(0)
  ]);

  return birlestir([...yerelParcalar, ...merkezParcalar, sonKayit]);
}

// --- XML parçaları ----------------------------------------------------------

const ICERIK_TURLERI = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;

const PAKET_ILISKILERI = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

const CALISMA_KITABI = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
          xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="Anket Listesi" sheetId="1" r:id="rId1"/></sheets>
</workbook>`;

const CALISMA_KITABI_ILISKILERI = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

/* Stil dizinleri (cellXfs sırasıyla, 0'dan başlar):
 * 0 varsayılan, 1 başlık (14pt kalın, ortalı), 2 alt başlık (11pt kalın, ortalı),
 * 3 sütun başlığı (kalın, gri dolgu, çerçeve), 4 veri hücresi (çerçeve). */
const STILLER = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="3">
<font><sz val="11"/><name val="Calibri"/></font>
<font><b/><sz val="11"/><name val="Calibri"/></font>
<font><b/><sz val="14"/><name val="Calibri"/></font>
</fonts>
<fills count="3">
<fill><patternFill patternType="none"/></fill>
<fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFE9EDF2"/><bgColor indexed="64"/></patternFill></fill>
</fills>
<borders count="2">
<border><left/><right/><top/><bottom/><diagonal/></border>
<border><left style="thin"><color indexed="64"/></left><right style="thin"><color indexed="64"/></right><top style="thin"><color indexed="64"/></top><bottom style="thin"><color indexed="64"/></bottom><diagonal/></border>
</borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="5">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
</cellXfs>
</styleSheet>`;

/* XML 1.0'da geçerli olmayan denetim karakterleri (sekme/satırbaşı/yeni satır
 * hariç) atılır; yoksa Excel dosyayı bozuk sayıp açmayı reddeder. Regex yerine
 * kod noktasına bakılıyor ki kaynakta görünmez karakter taşımaya gerek kalmasın. */
function geçersizDenetimKarakteri(kod) {
  if (kod === 9 || kod === 10 || kod === 13) return false;   // tab, LF, CR serbest
  return kod < 32;
}

const xmlKacis = (s) => Array.from(String(s ?? ""))
  .filter((ch) => !geçersizDenetimKarakteri(ch.codePointAt(0)))
  .join("")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** 0 tabanlı sütun indeksini "A", "B", ... "AA" biçimine çevirir. */
function sutunHarfi(n) {
  let s = "";
  let k = n + 1;
  while (k > 0) {
    const kalan = (k - 1) % 26;
    s = String.fromCharCode(65 + kalan) + s;
    k = Math.floor((k - 1) / 26);
  }
  return s;
}

/**
 * Üstte başlık ve alt başlık satırı olan tek sayfalık bir .xlsx üretir.
 *
 * @param {string} baslik      en üstte, tüm sütunlara yayılan hücre
 * @param {string} altBaslik   onun altında, yine tüm sütunlara yayılan hücre
 *                             (ör. seçilen günün tarihi ya da dönem etiketi)
 * @param {string[]} basSutunlari  tablo başlık satırı
 * @param {string[][]} satirlar    veri satırları
 * @returns {Uint8Array} .xlsx dosyasının baytları
 */
export function xlsxOlustur(baslik, altBaslik, basSutunlari, satirlar) {
  const sutunSayisi = basSutunlari.length;
  const sonSutun = sutunHarfi(sutunSayisi - 1);

  const hucre = (r, c, metin, stil) =>
    `<c r="${sutunHarfi(c)}${r}" t="inlineStr" s="${stil}"><is><t xml:space="preserve">${xmlKacis(metin)}</t></is></c>`;

  const satirXml = [];
  const birlesmeler = [];
  let r = 1;

  satirXml.push(`<row r="${r}">${hucre(r, 0, baslik, 1)}</row>`);
  birlesmeler.push(`A${r}:${sonSutun}${r}`);
  r += 1;

  satirXml.push(`<row r="${r}">${hucre(r, 0, altBaslik, 2)}</row>`);
  birlesmeler.push(`A${r}:${sonSutun}${r}`);
  r += 1;

  satirXml.push(`<row r="${r}">${basSutunlari.map((b, c) => hucre(r, c, b, 3)).join("")}</row>`);
  r += 1;

  if (satirlar.length) {
    for (const satir of satirlar) {
      satirXml.push(`<row r="${r}">${satir.map((d, c) => hucre(r, c, d, 4)).join("")}</row>`);
      r += 1;
    }
  } else {
    satirXml.push(`<row r="${r}">${hucre(r, 0, "Bu tarih aralığında kayıt yok.", 4)}</row>`);
    birlesmeler.push(`A${r}:${sonSutun}${r}`);
    r += 1;
  }

  const sonSatir = r - 1;
  const genislikler = basSutunlari.map((b) => Math.min(40, Math.max(10, b.length + 4)));
  const colsXml = `<cols>${genislikler.map((g, i) =>
    `<col min="${i + 1}" max="${i + 1}" width="${g}" customWidth="1"/>`).join("")}</cols>`;

  const sayfaXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<dimension ref="A1:${sonSutun}${sonSatir}"/>
<sheetViews><sheetView workbookViewId="0"/></sheetViews>
<sheetFormatPr defaultRowHeight="15"/>
${colsXml}
<sheetData>${satirXml.join("")}</sheetData>
<mergeCells count="${birlesmeler.length}">${birlesmeler.map((m) => `<mergeCell ref="${m}"/>`).join("")}</mergeCells>
</worksheet>`;

  const kodlayici = new TextEncoder();
  return zipOlustur([
    { ad: "[Content_Types].xml", icerik: kodlayici.encode(ICERIK_TURLERI) },
    { ad: "_rels/.rels", icerik: kodlayici.encode(PAKET_ILISKILERI) },
    { ad: "xl/workbook.xml", icerik: kodlayici.encode(CALISMA_KITABI) },
    { ad: "xl/_rels/workbook.xml.rels", icerik: kodlayici.encode(CALISMA_KITABI_ILISKILERI) },
    { ad: "xl/styles.xml", icerik: kodlayici.encode(STILLER) },
    { ad: "xl/worksheets/sheet1.xml", icerik: kodlayici.encode(sayfaXml) }
  ]);
}
