/* İstatistik ve rapor üretecini tarayıcı dışında sınar. */
import { writeFile } from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

const kok = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "eklenti");
const { hesapla } = await import(path.join(kok, "motor/istatistik.js"));
const { raporUret, BOLUMLER, VARSAYILAN_BOLUMLER } =
  await import(path.join(kok, "motor/rapor.js"));

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
      muayeneZamani: `2026-09-${String((n % 28) + 1).padStart(2, "0")}T09:30:00`,
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

// --- kişi bazlı sayım ve dönüş süresi -------------------------------------
{
  // Aynı hasta üç kez arandı: bu üç arama ama tek kişi.
  const ayniHasta = (n, sonuc) => anket(n, {
    anketId: `x${n}`, gorusmeSonucu: sonuc,
    hasta: { ...anket(1).hasta, hastaId: 7777 },
    cevaplar: sonuc === "ulasildi" ? anket(1).cevaplar : {}
  });
  const i = hesapla([ayniHasta(1, "acmadi"), ayniHasta(2, "acmadi"), ayniHasta(3, "ulasildi")]);
  assert.equal(i.arananlar, 3, "arama sayısı üç");
  assert.equal(i.arananKisi, 1, "kişi sayısı bir");
  assert.equal(i.ulasilanKisi, 1);
  assert.equal(i.kisiUlasilmaOrani, 1, "kişi bazında ulaşılma tam");
  assert.equal(i.ulasilmaOrani, 1 / 3, "arama bazında oran ayrı hesaplanır");
  console.log("✓ kişi bazlı sayım aramadan ayrı");

  const j = hesapla([anket(1, {
    hasta: { ...anket(1).hasta, muayeneZamani: "2026-09-10T09:00:00" },
    zamanDamgasi: "2026-09-11T15:00:00"
  })]);
  assert.equal(j.donusOlculen, 1);
  assert.equal(j.ortalamaDonus, 30, "muayeneden aramaya 30 saat");
  console.log("✓ ortalama dönüş süresi hesaplanıyor");
}

// --- hedef bölümü ---------------------------------------------------------
{
  const kayitlar = Array.from({ length: 12 }, (_, n) => anket(n + 1));
  const hedefli = raporUret("2026-09 Eylul", kayitlar, null, { gelenHasta: 4200, oran: 1 });
  assert.ok(hedefli.includes("Kapsam ve hedef"));
  assert.ok(hedefli.includes("4.200"), "gelen hasta sayısı raporda");
  assert.ok(hedefli.includes("42"), "hedef %1 = 42 kişi");
  assert.ok(hedefli.includes("Ortalama dönüş süresi"));

  const hedefsiz = raporUret("2026-09 Eylul", kayitlar, null, null);
  assert.ok(hedefsiz.includes("girilmediği için hedef hesaplanmamıştır"),
    "hedef yoksa rapor bunu söylemeli");
  // Karşılaştırma dönemi yokken ok işareti basılmamalı
  assert.ok(!/class="fark[^"]*">[^<]*—/.test(hedefsiz),
    "önceki ay yokken fark göstergesi boş kalmalı");
  console.log("✓ hedef bölümü ve eksik hedef uyarısı doğru");
}

// --- bölüm seçimi ---------------------------------------------------------
{
  const kayitlar = Array.from({ length: 14 }, (_, n) => anket(n + 1, n % 6 === 0
    ? { gorusmeSonucu: "numara_hatali", cevaplar: {} } : {}));

  const hepsi = raporUret("2026-09 Eylul", kayitlar, null, null,
                          BOLUMLER.map((b) => b.id));
  for (const b of BOLUMLER) {
    assert.ok(hepsi.includes(b.ad), `"${b.ad}" bölümü üretilmeli`);
  }
  console.log(`✓ ${BOLUMLER.length} bölümün hepsi üretilebiliyor`);

  const azi = raporUret("2026-09 Eylul", kayitlar, null, null, ["sorular", "dof"]);
  assert.ok(azi.includes("Soru bazlı sonuçlar"));
  assert.ok(azi.includes("DÖF"));
  assert.ok(!azi.includes("Katılımcı profili"), "seçilmeyen bölüm çıkmamalı");
  assert.ok(!azi.includes("Saat ve gün analizi"), "seçilmeyen bölüm çıkmamalı");
  console.log("✓ yalnızca seçilen bölümler raporda");

  const bos = raporUret("2026-09 Eylul", kayitlar, null, null, []);
  assert.ok(bos.includes("Kapsam ve hedef"),
    "hiç seçim yoksa varsayılan bölümler gelmeli");
  assert.ok(!bos.includes("Poliklinik × soru matrisi"));
  console.log("✓ seçim boşsa varsayılana düşüyor");

  // Az anketli satır uyarısı
  const tekAnket = raporUret("2026-09 Eylul", [anket(1)], null, null, ["kirilim"]);
  assert.ok(tekAnket.includes("anketten az"), "az örneklemli satır uyarılmalı");
  console.log("✓ az anketli kırılım satırı işaretleniyor");
}

// --- yeni ölçüler ---------------------------------------------------------
{
  const saatli = (n, saat, sonuc) => anket(n, {
    anketId: `s${n}`, saat, gorusmeSonucu: sonuc,
    zamanDamgasi: `2026-09-11T${saat}:00`,
    hasta: { ...anket(n).hasta, hastaId: 8000 + n },
    cevaplar: sonuc === "ulasildi" ? anket(1).cevaplar : {}
  });
  const i = hesapla([
    saatli(1, "09:10", "acmadi"), saatli(2, "09:40", "acmadi"),
    saatli(3, "15:10", "ulasildi"), saatli(4, "15:40", "ulasildi")
  ]);
  const sabah = i.saatDilimleri.find((d) => d.etiket === "08:00–10:00");
  const oglen = i.saatDilimleri.find((d) => d.etiket === "14:00–16:00");
  assert.equal(sabah.arama, 2);
  assert.equal(sabah.oran, 0, "sabah hiç ulaşılmamış");
  assert.equal(oglen.oran, 1, "öğleden sonra hepsine ulaşılmış");
  assert.equal(i.netMemnuniyet !== null, true);
  console.log("✓ saat dilimi ve net memnuniyet hesaplanıyor");
}

// --- hekim – poliklinik eşlemesi ------------------------------------------
{
  const { kayitlariEsle, poliklinikBul, eksikHekimler, hekimAnahtari } =
    await import(path.join(kok, "motor/hekimler.js"));

  // Eski biçim (düz metin) da okunabilmeli
  const esleme = { [hekimAnahtari("Dt. Ayşe DEMİR")]:
                     [{ poliklinik: "Ortodonti", baslangic: null }] };

  assert.equal(poliklinikBul(esleme, "dt. ayşe  demir"), "Ortodonti",
    "ad yazımı farklı olsa da eşleşmeli");
  assert.equal(poliklinikBul(esleme, "Dt. Bilinmeyen"), null);

  const kayitlar = [
    anket(1, { hasta: { ...anket(1).hasta, hekim: "Dt. Ayşe DEMİR",
                        poliklinik: "Yanlış Birim" } }),
    anket(2, { hasta: { ...anket(2).hasta, hekim: "Dt. Şükrü DOĞAN",
                        poliklinik: "Restoratif Diş Tedavisi" } })
  ];
  const eslenmis = kayitlariEsle(kayitlar, esleme);
  assert.equal(eslenmis[0].hasta.poliklinik, "Ortodonti",
    "eşleme HBYS tahminini ezmeli");
  assert.equal(eslenmis[0].hasta.poliklinikEslemeden, true);
  assert.equal(eslenmis[1].hasta.poliklinik, "Restoratif Diş Tedavisi",
    "eşleme yoksa kayıttaki değer korunmalı");
  assert.equal(kayitlar[0].hasta.poliklinik, "Yanlış Birim",
    "özgün kayıt değiştirilmemeli");

  const eksik = eksikHekimler(kayitlar, esleme);
  assert.equal(eksik.length, 1, "yalnızca eşlenmemiş hekim listelenmeli");
  assert.equal(eksik[0].ad, "Dt. Şükrü DOĞAN");

  // Eşleme raporda gerçekten kullanılıyor mu
  const rapor = raporUret("2026-09 Eylul", eslenmis, null, null, ["kirilim"]);
  assert.ok(rapor.includes("Ortodonti"), "eşlenen poliklinik raporda görünmeli");
  assert.ok(!rapor.includes("Yanlış Birim"), "eski değer raporda kalmamalı");
  console.log("✓ hekim eşlemesi polikliniği düzeltiyor");
}

// --- hekim poliklinik değiştirince ----------------------------------------
{
  const { kayitlariEsle, poliklinikBul, hekimAnahtari } =
    await import(path.join(kok, "motor/hekimler.js"));

  // 01.10.2026'da Ortodonti'den Periodontoloji'ye geçmiş bir hekim
  const esleme = {
    [hekimAnahtari("Dt. Ayşe DEMİR")]: [
      { poliklinik: "Ortodonti", baslangic: null },
      { poliklinik: "Periodontoloji", baslangic: "2026-10-01" }
    ]
  };

  assert.equal(poliklinikBul(esleme, "Dt. Ayşe DEMİR", "2026-09-20"), "Ortodonti",
    "geçişten önceki tarih eski polikliniği vermeli");
  assert.equal(poliklinikBul(esleme, "Dt. Ayşe DEMİR", "2026-10-01"), "Periodontoloji",
    "geçiş günü yeni poliklinik");
  assert.equal(poliklinikBul(esleme, "Dt. Ayşe DEMİR", "2026-11-05"), "Periodontoloji");
  assert.equal(poliklinikBul(esleme, "Dt. Ayşe DEMİR"), "Periodontoloji",
    "tarih verilmezse en güncel dönem");

  const eylul = anket(1, { hasta: { ...anket(1).hasta, hekim: "Dt. Ayşe DEMİR",
    muayeneZamani: "2026-09-20T09:00:00", poliklinik: "Yanlış" } });
  const ekim = anket(2, { hasta: { ...anket(2).hasta, hekim: "Dt. Ayşe DEMİR",
    muayeneZamani: "2026-10-14T09:00:00", poliklinik: "Yanlış" } });
  const eslenmis = kayitlariEsle([eylul, ekim], esleme);

  assert.equal(eslenmis[0].hasta.poliklinik, "Ortodonti",
    "eski anket hekim taşınsa da eski poliklinikte kalmalı");
  assert.equal(eslenmis[1].hasta.poliklinik, "Periodontoloji");
  console.log("✓ hekim poliklinik değiştirince eski anketler yerinde kalıyor");
}

console.log("\nTüm sınamalar geçti.");
