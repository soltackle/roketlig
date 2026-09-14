/* Kayıt katmanını gerçek Chromium'da uçtan uca sınar.
 *
 * Anket yaz → ay klasörlerini listele → veri dosyalarını oku → rapor üret.
 * Klasör olarak OPFS (kaynak-özel dosya sistemi) kullanılıyor: gerçek
 * FileSystemDirectoryHandle, gerçek IndexedDB saklama. Tek fark, seçiciden
 * gelen tanıtıcıdaki izin yöntemleri OPFS'te bulunmadığı için test sayfasında
 * eklenmesi.
 */
import path from "node:path";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const kok = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const eklenti = path.join(kok, "eklenti");
const CHROME = process.env.CHROME_YOLU || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

const baglam = await chromium.launchPersistentContext("", {
  executablePath: CHROME,
  headless: false,
  args: ["--headless=new", `--disable-extensions-except=${eklenti}`, `--load-extension=${eklenti}`]
});

try {
  let sw = baglam.serviceWorkers()[0];
  if (!sw) sw = await baglam.waitForEvent("serviceworker", { timeout: 15000 });
  const kimlik = new URL(sw.url()).host;

  const sayfa = await baglam.newPage();
  const hatalar = [];
  sayfa.on("pageerror", (e) => hatalar.push(String(e)));
  await sayfa.goto(`chrome-extension://${kimlik}/panel/panel.html`);
  await sayfa.waitForSelector("#sorular .soru", { state: "attached" });

  const sonuc = await sayfa.evaluate(async () => {
    // Seçiciden gelen tanıtıcılarda olan, OPFS'te olmayan izin yöntemleri
    FileSystemDirectoryHandle.prototype.queryPermission = async () => "granted";
    FileSystemDirectoryHandle.prototype.requestPermission = async () => "granted";

    const kok = await navigator.storage.getDirectory();

    // Tanıtıcıyı, klasör seçiciden gelmiş gibi eklentinin veritabanına koy
    await new Promise((tamam, hata) => {
      const istek = indexedDB.open("hhd-fr-19", 1);
      istek.onupgradeneeded = () => {
        const db = istek.result;
        if (!db.objectStoreNames.contains("ayar")) db.createObjectStore("ayar");
        if (!db.objectStoreNames.contains("kuyruk")) db.createObjectStore("kuyruk", { keyPath: "id" });
        if (!db.objectStoreNames.contains("dizin")) db.createObjectStore("dizin", { keyPath: "id" });
      };
      istek.onsuccess = () => {
        const db = istek.result;
        const t = db.transaction("ayar", "readwrite");
        t.objectStore("ayar").put(kok, "anaKlasor");
        t.oncomplete = () => tamam();
        t.onerror = () => hata(t.error);
      };
      istek.onerror = () => hata(istek.error);
    });

    const kayitDeposu = await import("../motor/kayit.js");
    const { anketiIsaretle } = await import("../motor/pdf.js");
    const { raporUret } = await import("../motor/rapor.js");

    const anket = (n, gun, ay = "09") => {
      const zaman = `2026-${ay}-${String(gun).padStart(2, "0")}T14:${String(30 + n).padStart(2, "0")}:00`;
      const d = new Date(zaman);
      return {
        surum: 1, formSurum: "HHD.FR.19 Rev.01",
        anketId: `t-${ay}-${n}`,
        gorusmeSonucu: n % 5 === 0 ? "acmadi" : "ulasildi",
        tarih: `2026-${ay}-${String(gun).padStart(2, "0")}`,
        tarihGosterim: `${String(gun).padStart(2, "0")}.${ay}.2026`,
        saat: `14:${String(30 + n).padStart(2, "0")}`,
        zamanDamgasi: zaman,
        uygulayan: "Şenay IŞIK",
        hasta: { hastaId: 5000 + n, adSoyad: `TEST HASTA ${n}`, telefon: "0532 000 00 00",
                 poliklinik: "Ağız, Diş ve Çene Cerrahisi", hekim: "Dt. Ayşe DEMİR",
                 islemTarihi: null },
        katilimci: n % 5 === 0 ? {} : { tur: "Hasta", cinsiyet: "Erkek",
                                        yasGrubu: "50-59", egitim: "Lise" },
        cevaplar: n % 5 === 0 ? {} : { 1: 4, 2: 5, 3: 4, 4: 5, 5: 4, 6: 5, 7: 4, 8: 4 },
        tetkikYok: false,
        hastaGorusu: n === 1 ? "Memnun kaldım." : "",
        dosyaTabani: kayitDeposu.anketDosyaAdi(`TEST HASTA ${n}`, d),
        pdfDosya: null, kilitli: true
      };
    };

    const yazmalar = [];
    for (const [n, gun, ay] of [[1, 3, "09"], [2, 11, "09"], [5, 12, "09"], [3, 20, "08"]]) {
      const k = anket(n, gun, ay);
      let pdf = null;
      if (k.gorusmeSonucu === "ulasildi") {
        k.pdfDosya = `${k.dosyaTabani}.pdf`;
        pdf = await anketiIsaretle(k);
      }
      yazmalar.push(await kayitDeposu.anketiKaydet(k, pdf));
    }

    const aylar = await kayitDeposu.aylariListele();
    const eylul = await kayitDeposu.ayKayitlariniOku("2026-09 Eylul");

    // Klasörde gerçekten ne var?
    const agac = {};
    const ana = await kok.getDirectoryHandle("HHD.FR.19 Anketleri");
    for await (const [ad, t] of ana.entries()) {
      if (t.kind !== "directory") { agac[ad] = "dosya"; continue; }
      const icerik = [];
      for await (const [ad2, t2] of t.entries()) {
        if (t2.kind === "directory") {
          const veri = [];
          for await (const [ad3] of t2.entries()) veri.push(ad3);
          icerik.push(`${ad2}/ (${veri.length} dosya)`);
        } else icerik.push(ad2);
      }
      agac[ad] = icerik.sort();
    }

    const rapor = raporUret("2026-09 Eylul", eylul.kayitlar, null);

    return {
      yazmalar,
      aylar,
      eylulKayitSayisi: eylul.kayitlar.length,
      bozuk: eylul.bozuk,
      eksik: eylul.eksik,
      dosyaTabanlari: eylul.kayitlar.map((k) => k.dosyaTabani).sort(),
      agac,
      raporUzunluk: rapor.length,
      kuyruk: await kayitDeposu.kuyrukSayisi()
    };
  });

  console.log("klasör ağacı:", JSON.stringify(sonuc.agac, null, 1));
  console.log("yazma sonuçları:", JSON.stringify(sonuc.yazmalar));
  console.log("listelenen aylar:", sonuc.aylar);
  console.log("kuyrukta bekleyen:", sonuc.kuyruk);

  assert.ok(sonuc.yazmalar.every((y) => y.yazildi), "her anket yazılmalı");
  assert.equal(sonuc.kuyruk, 0, "kuyrukta kayıt kalmamalı");
  assert.deepEqual(sonuc.aylar, ["2026-09 Eylul", "2026-08 Agustos"],
    "aylar yeniden eskiye sıralı listelenmeli");
  assert.equal(sonuc.eylulKayitSayisi, 3, "Eylül'de 3 kayıt olmalı");
  assert.deepEqual(sonuc.bozuk, [], "okunamayan dosya olmamalı");
  assert.ok(sonuc.raporUzunluk > 5000, "rapor üretilmeli");

  console.log("\n✓ anketler yazıldı, aylar listelendi, rapor üretildi");

  // Muayene gününe göre arama iki klasöre birden bakmalı: ayın sonunda muayene
  // olan hastanın anketi ertesi ayın klasörüne düşebiliyor.
  const { gunKlasorleri } = await import(path.join(eklenti, "motor/kayit.js"));
  assert.deepEqual(gunKlasorleri("2026-09-30"), ["2026-09 Eylul", "2026-10 Ekim"]);
  assert.deepEqual(gunKlasorleri("2026-12-31"), ["2026-12 Aralik", "2027-01 Ocak"],
    "yıl sonunda ertesi yıla geçmeli");
  assert.deepEqual(gunKlasorleri("bos"), [], "geçersiz gün klasör üretmemeli");
  console.log("✓ muayene günü iki ay klasörüne birden bakıyor");
  assert.deepEqual(hatalar, [], `sayfa hatası:\n${hatalar.join("\n")}`);
  console.log("Kayıt sınamaları geçti.");
} finally {
  await baglam.close();
}
