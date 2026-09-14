/* motor/pdf.js'i tarayıcı dışında çalıştırıp çıktıyı doğrular. */
import { readFile, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

const kok = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "eklenti");

globalThis.chrome = { runtime: { getURL: (y) => `eklenti://${y}` } };
globalThis.fetch = async (url) => {
  const yol = path.join(kok, String(url).replace("eklenti://", ""));
  const bayt = await readFile(yol);
  return { ok: true, arrayBuffer: async () => bayt.buffer.slice(bayt.byteOffset, bayt.byteOffset + bayt.byteLength) };
};

const { anketiIsaretle } = await import(path.join(kok, "motor/pdf.js"));

const kayit = {
  formSurum: "HHD.FR.19 Rev.01",
  tarih: "2026-09-11", tarihGosterim: "11.09.2026", saat: "14:32",
  uygulayan: "Şenay IŞIK",
  hasta: { hastaId: 482913, adSoyad: "ŞÜKRÜ DOĞAN", telefon: "0532 415 66 08",
           poliklinik: "Ağız, Diş ve Çene Cerrahisi",
           muayeneZamani: "2026-09-10T09:15:00" },
  katilimci: { tur: "Hasta", cinsiyet: "Erkek", yasGrubu: "50-59", egitim: "Lise" },
  cevaplar: { 1: 4, 2: 5, 3: 3, 4: 5, 5: 4, 6: 5, 7: null, 8: 4 },
  tetkikYok: true,
  hastaGorusu: "Randevu saatimde alındım, hiç bekletmediler. Doktor hanım çok " +
               "ilgiliydi, ne yapacağını tek tek anlattı. Yalnız danışmada " +
               "yönlendirme biraz karışıktı, hangi kata gideceğimi bulamadım.",
  pdfDosya: "ŞÜKRÜ DOĞAN - 11.09.2026 14.32.pdf"
};

const bayt = await anketiIsaretle(kayit);
const hedef = process.argv[2] || "/tmp/js-cikti.pdf";
await writeFile(hedef, bayt);
console.log(`yazildi: ${hedef} (${(bayt.length / 1024).toFixed(0)} KB)`);

// Çok uzun görüş: taşan kısım ikinci sayfaya düşmeli, metin kaybolmamalı
const uzun = { ...kayit, tetkikYok: false, cevaplar: { ...kayit.cevaplar, 7: 4 },
  hastaGorusu: Array.from({ length: 14 }, (_, n) =>
    `${n + 1}. Hastanede geçirdiğim süre boyunca dikkatimi çeken bir konu vardı ` +
    "ve bunu ayrıntısıyla anlatmak istiyorum.").join(" ") };
const uzunBayt = await anketiIsaretle(uzun);
const uzunHedef = hedef.replace(/\.pdf$/, "-uzun-gorus.pdf");
await writeFile(uzunHedef, uzunBayt);
console.log(`yazildi: ${uzunHedef} (${(uzunBayt.length / 1024).toFixed(0)} KB)`);

// --- görüş metni kaybolmamalı --------------------------------------------
// Delil niteliğinde olduğu için tek bir kelimesi bile düşmemeli.
const { default: pdfParseYok } = { default: null };
const sayfaMetni = async (bayt) => {
  const { PDFDocument } = await import(path.join(kok, "varliklar/pdf-lib.esm.min.js"));
  const d = await PDFDocument.load(bayt);
  return d.getPageCount();
};
// Görüş forma değil arka sayfaya yazılıyor; kısa da olsa ek sayfa açılır.
assert.equal(await sayfaMetni(bayt), 2, "görüş varsa arka sayfa açılmalı");
assert.ok(await sayfaMetni(uzunBayt) >= 2, "uzun görüş için de ek sayfa");

const gorussuz = { ...kayit, hastaGorusu: "" };
assert.equal(await sayfaMetni(await anketiIsaretle(gorussuz)), 1,
  "görüş yoksa tek sayfa kalmalı");
console.log("✓ görüş arka sayfaya yazılıyor, yoksa sayfa eklenmiyor");

// --- Forma yazılan metinler ----------------------------------------------
/* Metin gömülü altkümeyle çiziliyor: içerikteki baytlar glif kodları, okunur
 * harf değil. Çıktının gerçekten doğru olduğunu görmek için pdf-lib'in yazdığı
 * ToUnicode eşlemesi okunup kodlar harfe geri çevriliyor. */
async function formMetinleri(bayt) {
  const { inflateSync } = await import("node:zlib");
  const { PDFDocument } = await import(path.join(kok, "varliklar/pdf-lib.esm.min.js"));
  const belge = await PDFDocument.load(bayt);
  const ctx = belge.context;
  const ac = (akis) => {
    const ham = Buffer.from(akis.getContents());
    try { return inflateSync(ham).toString("latin1"); }
    catch { return ham.toString("latin1"); }
  };

  const eslesme = new Map();
  for (const [, nesne] of ctx.enumerateIndirectObjects()) {
    const ref = String(nesne).includes("/ToUnicode")
      ? nesne.get?.(ctx.obj("ToUnicode")) : null;
    if (!ref) continue;
    for (const m of ac(ctx.lookup(ref)).matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g)) {
      eslesme.set(m[1].toLowerCase(), String.fromCodePoint(parseInt(m[2].slice(0, 4), 16)));
    }
  }

  const icerik = belge.getPage(0).node.normalizedEntries().Contents;
  const akislar = icerik.asArray ? icerik.asArray().map((r) => ctx.lookup(r)) : [icerik];
  const govde = akislar.map(ac).join("");
  return [...govde.matchAll(/<([0-9a-fA-F]+)>\s*Tj/g)].map((m) => {
    const h = m[1].toLowerCase();
    let cikti = "";
    for (let i = 0; i < h.length; i += 4) cikti += eslesme.get(h.slice(i, i + 4)) ?? "?";
    return cikti;
  });
}

{
  // T.C. kimlik numarası: arşivlenen belgeyi denetimci hasta kimliğiyle
  // eşleştirebilsin diye ad soyad satırının sağına yazılıyor.
  // Muayene günü de HBYS'nin saat taşıyan alanından değil, son işlemin
  // tarihinden geliyor — eskiden damgada gün boş kalıp saat iki kez yazılıyordu.
  const k = {
    ...kayit, hastaGorusu: "Memnun kaldım.",
    hasta: { ...kayit.hasta, tcKimlikNo: "10000000146",
             muayeneZamani: "09:15", sonIslemTarihi: "2026-09-10" }
  };
  const metinler = await formMetinleri(await anketiIsaretle(k));
  assert.ok(metinler.includes("T.C. Kimlik No: 10000000146"),
    `T.C. kimlik no forma yazılmalı — bulunanlar: ${JSON.stringify(metinler)}`);
  const damga = metinler.find((m) => m.startsWith("Muayene:"));
  assert.ok(damga?.startsWith("Muayene: 10.09.2026 09:15"),
    `damgada muayene günü ve saati olmalı — bulunan: ${damga}`);
  assert.ok(damga.includes("Anket: 11.09.2026 14:32"), "damgada anket zamanı da kalmalı");
  console.log("✓ T.C. kimlik no ve muayene günü forma yazılıyor");

  // Ad çok uzunsa T.C. üstüne binmesin: alt damga satırına düşer
  const uzunAd = { ...k, hasta: { ...k.hasta,
    adSoyad: "ABDÜLKERİM MUHAMMEDEMİN KARAHASANOĞLU ÇELİKKANATLIOĞLU" } };
  const ikinci = await formMetinleri(await anketiIsaretle(uzunAd));
  assert.ok(!ikinci.some((m) => m.startsWith("T.C. Kimlik No:")),
    "sığmayan T.C. ad satırına yazılmamalı");
  assert.ok(ikinci.some((m) => m.includes("T.C. 10000000146")),
    "sığmayan T.C. damga satırına düşmeli");
  console.log("✓ uzun adda T.C. damga satırına düşüyor");
}

// --- Hekim adı poliklinikle yan yana ---------------------------------------
/* Formda hekime yer yok; hangi hekimin hangi poliklinikte görüldüğü tek
 * bakışta anlaşılsın diye poliklinik satırının boş kalan sağ yarısına,
 * polikliniğin hemen yanına yazılıyor. */
{
  const k = { ...kayit, hastaGorusu: "",
    hasta: { ...kayit.hasta, hekim: "Dt. Ayşe DEMİR" } };
  const metinler = await formMetinleri(await anketiIsaretle(k));
  assert.ok(metinler.includes("Ağız, Diş ve Çene Cerrahisi"),
    "poliklinik olduğu gibi yazılmalı");
  assert.ok(metinler.includes("Hekim: Dt. Ayşe DEMİR"),
    `hekim adı poliklinikle aynı satırda ayrı bir metin olarak yazılmalı — bulunanlar: ${JSON.stringify(metinler)}`);
  console.log("✓ hekim adı poliklinikle yan yana yazılıyor");

  // Poliklinik + hekim adı birlikte satıra sığmıyorsa damga satırına düşmeli
  const uzun = { ...k, hasta: { ...k.hasta,
    poliklinik: "Ağız, Diş ve Çene Cerrahisi Uzun Bölüm Adı Restoratif Diş Tedavisi",
    hekim: "Dt. Çok Uzun İsimli Hekim Adı Soyadı Sığmayacak Kadar Uzun Bir İsim" } };
  const digeri = await formMetinleri(await anketiIsaretle(uzun));
  const kisaEtiket = `Hekim: ${uzun.hasta.hekim}`;
  assert.ok(!digeri.includes(kisaEtiket),
    "sığmayan hekim adı poliklinik satırına tek başına yazılmamalı");
  const damga = digeri.find((m) => m.includes("Hekim:") && m.includes("Muayene:"));
  assert.ok(damga, "sığmayan hekim adı damga satırına, diğer alanlarla birlikte düşmeli");
  console.log("✓ sığmayan hekim adı damga satırına düşüyor");

  // Poliklinik boşsa hekim satırın başından yazılmalı
  const polsuz = { ...k, hasta: { ...k.hasta, poliklinik: "" } };
  const ucuncu = await formMetinleri(await anketiIsaretle(polsuz));
  assert.ok(ucuncu.includes("Hekim: Dt. Ayşe DEMİR"),
    "poliklinik boşken de hekim adı yazılabilmeli");
  console.log("✓ poliklinik boşken hekim adı yine de yazılıyor");
}
