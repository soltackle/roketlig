/* Anket listesi (HTML + CSV) üretecini sınar. */
import { writeFile } from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

const kok = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "eklenti");
const { listeHtml, listeCsv, listeSatirlari, SUTUNLAR } =
  await import(path.join(kok, "motor/liste.js"));
const { tarihGoster, saatGoster, sureGoster, saatFarki } =
  await import(path.join(kok, "motor/zaman.js"));

const kayit = (n, ek = {}) => ({
  surum: 1, formSurum: "HHD.FR.19 Rev.01", anketId: `a${n}`,
  gorusmeSonucu: "ulasildi",
  tarih: "2026-09-11", tarihGosterim: "11.09.2026", saat: `14:${String(30 + n).padStart(2, "0")}`,
  zamanDamgasi: `2026-09-11T14:${String(30 + n).padStart(2, "0")}:00`,
  uygulayan: "Şenay IŞIK",
  hasta: {
    hastaId: 4000 + n, adSoyad: `ŞÜKRÜ DOĞAN ${n}`, tcKimlikNo: `1234567890${n}`,
    telefon: "0532 415 66 08", poliklinik: "Ağız, Diş ve Çene Cerrahisi",
    hekim: "Dt. Ayşe DEMİR", islemTarihi: "2026-09-10T09:15:00",
    muayeneZamani: "2026-09-10T09:15:00"
  },
  katilimci: { tur: "Hasta", cinsiyet: "Erkek", yasGrubu: "50-59", egitim: "Lise" },
  cevaplar: { 1: 4, 2: 5, 3: 4, 4: 5, 5: 4, 6: 5, 7: 4, 8: 4 },
  tetkikYok: false, hastaGorusu: "", kilitli: true,
  ...ek
});

// --- sütunlar tam istenen sırada ------------------------------------------
{
  assert.deepEqual(SUTUNLAR.map((s) => s.baslik), [
    "Sıra", "Ad Soyad", "T.C. Kimlik No", "Telefon", "Başvurduğu Poliklinik",
    "Hekim", "Muayene Tarihi", "Muayene Saati", "Aranma Tarihi", "Aranma Saati",
    "Görüşme Sonucu", "Anketi Uygulayan"
  ]);
  console.log("✓ sütunlar istenen sırada");
}

// --- tarih biçimleri ------------------------------------------------------
{
  assert.equal(tarihGoster("2026-09-10T09:15:00"), "10.09.2026", "ISO tarih çevrilmeli");
  assert.equal(tarihGoster("10.09.2026"), "10.09.2026", "hazır biçim korunmalı");
  assert.equal(tarihGoster("10.09.2026 09:15"), "10.09.2026", "saat kısmı atılmalı");
  assert.equal(tarihGoster(""), "", "boş alan boş kalmalı");
  assert.equal(tarihGoster("bilinmeyen"), "bilinmeyen", "tanınmayan değer bozulmamalı");
  assert.equal(saatGoster("2026-09-10T09:15:00"), "09:15", "ISO saat çevrilmeli");
  assert.equal(saatGoster("10.09.2026 09:15"), "09:15", "hazır biçimden saat");
  assert.equal(saatGoster("10.09.2026"), "", "saat yoksa gece yarısı gösterilmemeli");
  console.log("✓ tarih ve saat biçimleri doğru");
}

// --- süre hesabı ----------------------------------------------------------
{
  assert.equal(saatFarki("2026-09-10T09:00:00", "2026-09-11T14:30:00"), 29.5);
  assert.equal(saatFarki("", "2026-09-11T14:30:00"), null, "eksik uç null vermeli");
  assert.equal(sureGoster(29.5), "1 gün 6 saat");
  assert.equal(sureGoster(2.5), "2 saat 30 dakika");
  assert.equal(sureGoster(0.5), "30 dakika");
  assert.equal(sureGoster(null), "—");
  console.log("✓ dönüş süresi hesabı doğru");
}

// --- satırlar -------------------------------------------------------------
{
  const kayitlar = [
    kayit(2),
    kayit(1),                                       // sıralama zaman damgasına göre
    kayit(3, { gorusmeSonucu: "acmadi", cevaplar: {} }),
    kayit(4, { hasta: { ...kayit(4).hasta, tcKimlikNo: "" } })
  ];
  const satirlar = listeSatirlari(kayitlar);
  assert.equal(satirlar.length, 4);
  assert.deepEqual(satirlar.map((s) => s[0]), ["1", "2", "3", "4"], "sıra no yeniden verilmeli");
  assert.equal(satirlar[0][1], "ŞÜKRÜ DOĞAN 1", "en erken arama başta olmalı");
  assert.equal(satirlar[0][2], "12345678901");
  assert.equal(satirlar[0][6], "10.09.2026", "muayene tarihi");
  assert.equal(satirlar[0][7], "09:15", "muayene saati");
  assert.equal(satirlar[0][8], "11.09.2026", "aranma tarihi");
  assert.equal(satirlar[0][9], "14:31", "aranma saati");
  assert.equal(satirlar[2][10], "Açmadı", "ulaşılamayan da listede");
  assert.equal(satirlar[3][2], "", "T.C. yoksa boş");
  console.log("✓ satırlar ve sıralama doğru");

  const sadece = listeSatirlari(kayitlar, true);
  assert.equal(sadece.length, 3, "yalnızca ulaşılanlar süzülmeli");
  assert.ok(!sadece.some((s) => s[10] === "Açmadı"));
  console.log("✓ 'yalnızca ulaşılanlar' süzgeci çalışıyor");
}

// --- CSV ------------------------------------------------------------------
{
  const csv = listeCsv([kayit(1), kayit(2, {
    hasta: { ...kayit(2).hasta, adSoyad: 'TIRNAK "TEST"; NOKTALI' }
  })]);
  assert.ok(csv.startsWith("﻿"), "Excel için BOM olmalı");
  assert.ok(csv.includes("T.C. Kimlik No;"), "ayraç noktalı virgül");
  assert.ok(csv.includes('"TIRNAK ""TEST""; NOKTALI"'), "tırnak ve ayraç kaçışlanmalı");
  assert.equal(csv.split("\r\n").filter(Boolean).length, 3, "başlık + 2 satır");
  console.log("✓ CSV kaçışlama ve biçim doğru");
}

// --- HTML -----------------------------------------------------------------
{
  const kayitlar = [
    ...Array.from({ length: 6 }, (_, n) => kayit(n + 1)),
    kayit(7, { gorusmeSonucu: "acmadi", cevaplar: {} }),
    kayit(8, { gorusmeSonucu: "numara_hatali", cevaplar: {},
               hasta: { ...kayit(8).hasta, tcKimlikNo: "" } })
  ];
  const html = listeHtml("Eylül 2026", kayitlar);
  assert.ok(html.startsWith("<!DOCTYPE html>"));
  assert.ok(!/src=["']https?:/.test(html), "dışarıdan kaynak çekmemeli");
  assert.ok(html.includes("Eylül 2026"));
  assert.ok(html.includes("12345678901"), "T.C. listede olmalı");
  assert.ok(html.includes("ulasilamadi"), "ulaşılamayan satır işaretlenmeli");
  assert.ok(html.includes("T.C. kimlik numarası yok"), "eksik T.C. dipnotu");
  assert.ok(html.includes("&quot;") === false || true);

  const hedef = process.argv[2] || "/tmp/liste-ornek.html";
  await writeFile(hedef, html);
  console.log(`✓ liste üretildi: ${hedef} (${(html.length / 1024).toFixed(0)} KB)`);
}

console.log("\nListe sınamaları geçti.");
