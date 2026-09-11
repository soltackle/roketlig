/* motor/pdf.js'i tarayıcı dışında çalıştırıp çıktıyı doğrular. */
import { readFile, writeFile } from "node:fs/promises";
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
           poliklinik: "Ağız, Diş ve Çene Cerrahisi" },
  katilimci: { tur: "Hasta", cinsiyet: "Erkek", yasGrubu: "50-59", egitim: "Lise" },
  cevaplar: { 1: 4, 2: 5, 3: 3, 4: 5, 5: 4, 6: 5, 7: null, 8: 4 },
  tetkikYok: true,
  pdfDosya: "ŞÜKRÜ DOĞAN - 11.09.2026 14.32.pdf"
};

const bayt = await anketiIsaretle(kayit);
const hedef = process.argv[2] || "/tmp/js-cikti.pdf";
await writeFile(hedef, bayt);
console.log(`yazildi: ${hedef} (${(bayt.length / 1024).toFixed(0)} KB)`);
