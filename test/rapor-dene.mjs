/* İstatistik ve rapor üretecini tarayıcı dışında sınar. */
import { writeFile } from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

const kok = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "eklenti");
const { hesapla } = await import(path.join(kok, "motor/istatistik.js"));
const { raporUret } = await import(path.join(kok, "motor/rapor.js"));

const FORM = "HHD.FR.19 Rev.01";

function anket(n, ek = {}) {
  return {
    anketId: `a${n}`, surum: 1, formSurum: FORM,
    gorusmeSonucu: "ulasildi",
    tarih: `2026-09-${String((n % 28) + 1).padStart(2, "0")}`,
    tarihGosterim: `${String((n % 28) + 1).padStart(2, "0")}.09.2026`,
    saat: "14:32", zamanDamgasi: `2026-09-${String((n % 28) + 1).padStart(2, "0")}T14:32:00`,
    uygulayan: "Şenay IŞIK",
    hasta: {
      hastaId: 1000 + n, adSoyad: `HASTA ${n}`, telefon: "0532 000 00 00",
      poliklinik: n % 2 ? "Ağız, Diş ve Çene Cerrahisi" : "Restoratif Diş Tedavisi",
      hekim: n % 3 ? "Dt. Ayşe DEMİR" : "Dt. Şükrü DOĞAN"
    },
    katilimci: {
      tur: n % 4 ? "Hasta" : "Hasta yakını",
      cinsiyet: n % 2 ? "Erkek" : "Kadın",
      yasGrubu: n % 2 ? "50-59" : "30-39",
      egitim: n % 2 ? "Lise" : "Üniversite"
    },
    cevaplar: { 1: 4, 2: 5, 3: 4, 4: 5, 5: 4, 6: 5, 7: 4, 8: 4 },
    tetkikYok: false,
    hastaGorusu: "",
    dosyaTabani: `HASTA ${n} - 11.09.2026 14.32`,
    kilitli: true,
    ...ek
  };
}

// --- kapsam dışı cevaplar ortalamaya girmemeli ----------------------------
{
  const kayitlar = [
    anket(1, { cevaplar: { 1: 5, 2: 5, 3: 5, 4: 3, 5: 5, 6: 3, 7: 5, 8: 5 } }),
    anket(2, { cevaplar: { 1: 5, 2: 5, 3: 5, 4: 5, 5: 5, 6: 5, 7: 5, 8: 5 } })
  ];
  const i = hesapla(kayitlar);
  const s4 = i.sorular.find((s) => s.no === 4);
  const s6 = i.sorular.find((s) => s.no === 6);

  assert.equal(s4.puanli, 1, '4. soruda "Bilgi istemedim" ortalamaya girmemeli');
  assert.equal(s4.kapsamDisi, 1);
  assert.equal(s4.ortalama, 5, "kalan tek cevap 5 olduğuna göre ortalama 5 olmalı");
  assert.equal(s4.dagilim[2], 1, "kapsam dışı cevap dağılımda yine görünmeli");
  assert.equal(s6.puanli, 1);
  assert.equal(s6.kapsamDisi, 1);
  assert.equal(i.genelOrtalama, 5, "kapsam dışı çıkınca genel ortalama 5 kalmalı");
  console.log("✓ kapsam dışı cevaplar ortalamaya girmiyor");
}

// --- tetkik yapılmayan 7. soru --------------------------------------------
{
  const kayitlar = [anket(1, { cevaplar: { 1: 4, 2: 4, 3: 4, 4: 4, 5: 4, 6: 4, 7: null, 8: 4 }, tetkikYok: true })];
  const i = hesapla(kayitlar);
  const s7 = i.sorular.find((s) => s.no === 7);
  assert.equal(s7.puanli, 0, "tetkik yoksa 7. soru puanlanmamalı");
  assert.equal(s7.kapsamDisi, 1);
  assert.equal(s7.ortalama, null);
  assert.equal(i.genelOrtalama, 4, "diğer 7 soru 4 puan, genel ortalama 4 olmalı");
  console.log("✓ tetkik yapılmayan 7. soru kapsam dışı");
}

// --- ulaşılamayanlar ------------------------------------------------------
{
  const kayitlar = [
    anket(1),
    anket(2, { gorusmeSonucu: "acmadi", cevaplar: {}, hastaGorusu: "" }),
    anket(3, { gorusmeSonucu: "numara_hatali", cevaplar: {} }),
    anket(4, { gorusmeSonucu: "istemedi", cevaplar: {} })
  ];
  const i = hesapla(kayitlar);
  assert.equal(i.arananlar, 4);
  assert.equal(i.ulasilanlar, 1);
  assert.equal(i.tamamlananlar, 1);
  assert.equal(i.ulasilmaOrani, 0.25);
  assert.equal(i.tekrarAranacaklar.length, 1, "yalnızca açmayanlar tekrar aranır");
  assert.equal(i.tekrarAranacaklar[0].adSoyad, "HASTA 2");
  console.log("✓ ulaşılamayanlar PDF'siz sayılıyor, tekrar aranacaklar doğru");
}

// --- DÖF ------------------------------------------------------------------
{
  const kayitlar = [anket(1, {
    cevaplar: { 1: 1, 2: 2, 3: 3, 4: 3, 5: 4, 6: 5, 7: 2, 8: 5 },
    hastaGorusu: "Kayıtta çok bekledim."
  })];
  const i = hesapla(kayitlar);
  assert.equal(i.dof.length, 3, "1, 2 ve 2 puanlar DÖF'e girmeli");
  assert.equal(i.dof[0].puan, 1);
  assert.ok(!i.dof.some((d) => d.soruNo === 4), '4. sorunun "Bilgi istemedim"i DÖF değil');
  assert.equal(i.gorusler.length, 1);
  console.log("✓ DÖF listesi ve serbest görüşler doğru");
}

// --- bilinmeyen form sürümü sessizce hesaplanmamalı ------------------------
{
  assert.throws(
    () => hesapla([anket(1, { formSurum: "HHD.FR.19 Rev.02" })]),
    /Bilinmeyen form sürümü/,
    "tanımadığı sürümü bugünün kuralıyla hesaplamamalı"
  );
  console.log("✓ bilinmeyen form sürümü reddediliyor");
}

// --- rapor üretimi --------------------------------------------------------
{
  const buAy = Array.from({ length: 24 }, (_, n) => anket(n + 1, n % 5 === 0
    ? { cevaplar: { 1: 2, 2: 3, 3: 4, 4: 3, 5: 2, 6: 5, 7: null, 8: 3 }, tetkikYok: true,
        hastaGorusu: "Danışmada yönlendirme yetersizdi." }
    : {}));
  buAy.push(anket(90, { gorusmeSonucu: "acmadi", cevaplar: {} }));
  buAy.push(anket(91, { gorusmeSonucu: "numara_hatali", cevaplar: {} }));

  const oncekiAy = Array.from({ length: 18 }, (_, n) =>
    anket(n + 1, { cevaplar: { 1: 3, 2: 4, 3: 4, 4: 4, 5: 4, 6: 4, 7: 3, 8: 4 } }));

  const html = raporUret("2026-09 Eylül", buAy, oncekiAy);
  assert.ok(html.startsWith("<!DOCTYPE html>"));
  assert.ok(!/src=["']https?:/.test(html), "rapor dışarıdan kaynak çekmemeli");
  assert.ok(html.includes("Eylül 2026"));
  assert.ok(html.includes("Tekrar aranacaklar"));

  const hedef = process.argv[2] || "/tmp/rapor-ornek.html";
  await writeFile(hedef, html);
  console.log(`✓ rapor üretildi: ${hedef} (${(html.length / 1024).toFixed(0)} KB)`);
}

console.log("\nTüm sınamalar geçti.");
