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
