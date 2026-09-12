/* Eklentiyi gerçek Chromium'a yükleyip panel sayfasını açar.
 *
 * Amaç: modüllerin yüklendiğini, panelin çizildiğini ve konsola hata
 * düşmediğini doğrulamak. HBYS bağlantısı bu ortamda yok; panelin
 * hastasız durumu sınanır.
 */
import path from "node:path";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const kok = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const eklenti = path.join(kok, "eklenti");
const CHROME = process.env.CHROME_YOLU || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const cikti = process.argv[2] || "/tmp/panel.png";

const baglam = await chromium.launchPersistentContext("", {
  executablePath: CHROME,
  headless: false,
  args: [
    "--headless=new",
    `--disable-extensions-except=${eklenti}`,
    `--load-extension=${eklenti}`
  ]
});

try {
  // Servis işçisi ayağa kalkınca eklenti kimliğini verir.
  let sw = baglam.serviceWorkers()[0];
  if (!sw) sw = await baglam.waitForEvent("serviceworker", { timeout: 15000 });
  const kimlik = new URL(sw.url()).host;
  console.log(`✓ servis işçisi çalışıyor · eklenti kimliği ${kimlik}`);

  // okuyucu.js manifestten değil servis işçisinden kaydediliyor: manifestteki
  // "world": "MAIN" Chrome 111+ ister, chrome.scripting ile aynı şey 102+.
  // Kayıt düşerse HBYS'den hiçbir veri gelmez, panel sessizce boş kalır.
  const okuyucu = await sw.evaluate(async () => {
    for (let i = 0; i < 40; i += 1) {
      const [k] = await chrome.scripting.getRegisteredContentScripts({ ids: ["okuyucu"] });
      if (k) return k;
      await new Promise((c) => setTimeout(c, 250));
    }
    return null;
  });
  assert.ok(okuyucu, "okuyucu.js içerik betiği kaydedilmeli");
  assert.equal(okuyucu.world, "MAIN", "okuyucu.js sayfanın kendi bağlamında çalışmalı");
  assert.deepEqual(okuyucu.js, ["okuyucu.js"]);
  console.log("✓ okuyucu.js MAIN bağlamına kaydedildi");

  const sayfa = await baglam.newPage();
  const hatalar = [];
  sayfa.on("console", (m) => { if (m.type() === "error") hatalar.push(m.text()); });
  sayfa.on("pageerror", (e) => hatalar.push(String(e)));

  await sayfa.setViewportSize({ width: 420, height: 900 });
  await sayfa.goto(`chrome-extension://${kimlik}/panel/panel.html`);
  // Sorular #anketGovde içinde; görüşme sonucu seçilene kadar gizli duruyorlar.
  await sayfa.waitForSelector("#sorular .soru", { state: "attached", timeout: 10000 });

  const soruSayisi = await sayfa.locator("#sorular .soru").count();
  assert.equal(soruSayisi, 8, "8 soru çizilmeli");
  console.log("✓ 8 soru çizildi");

  // Anket listesi için gereken hasta alanları
  const alanlar = await sayfa.locator(".alanlar label").allTextContents();
  assert.ok(alanlar.some((a) => a.includes("T.C. kimlik no")),
    "T.C. kimlik no alanı olmalı");
  console.log("✓ T.C. kimlik no alanı yerinde");

  const sonuclar = await sayfa.locator("#sonucSecim .secim").allTextContents();
  assert.deepEqual(sonuclar, ["Ulaşıldı", "Açmadı", "Numara hatalı", "Görüşmeyi istemedi"]);
  console.log("✓ görüşme sonucu seçenekleri yerinde");

  // Anket gövdesi, "Ulaşıldı" seçilene kadar kapalı olmalı.
  assert.ok(await sayfa.locator("#anketGovde").isHidden(), "gövde başta kapalı olmalı");
  await sayfa.locator("#sonucSecim .secim", { hasText: "Ulaşıldı" }).click();
  await sayfa.waitForSelector("#anketGovde:not(.gizli)");
  console.log('✓ "Ulaşıldı" seçilince anket gövdesi açılıyor');

  // Klavyeyle cevap: 1. soru etkin, "4" basınca 4 puan işaretlenmeli.
  await sayfa.locator("#sorular .soru[data-no='1']").click();
  await sayfa.keyboard.press("4");
  const basili = await sayfa.locator("#sorular .soru[data-no='1'] .puan[aria-pressed='true']")
    .textContent();
  assert.equal(basili, "4", "klavyeyle verilen cevap işaretlenmeli");
  const etkin = await sayfa.locator("#sorular .soru.etkin").getAttribute("data-no");
  assert.equal(etkin, "2", "cevaptan sonra sıradaki soruya geçmeli");
  console.log("✓ 1–5 tuşları çalışıyor ve sonraki soruya geçiyor");

  // Kapsam dışı seçenek: 4. soruda 3 puan "ortalamaya katılmaz" demeli.
  await sayfa.locator("#sorular .soru[data-no='4'] .puan").nth(2).click();
  const not4 = await sayfa.locator("#sorular .soru[data-no='4'] .secenek-adi").textContent();
  assert.match(not4, /ortalamaya katılmaz/, '4/3 kapsam dışı olarak işaretlenmeli');
  console.log("✓ kapsam dışı seçenek panelde uyarıyor");

  // Tetkik yok düğmesi 7. soruyu kapsam dışına almalı.
  await sayfa.locator("#btnTetkikYok").click();
  const not7 = await sayfa.locator("#sorular .soru[data-no='7'] .secenek-adi").textContent();
  assert.match(not7, /Tetkik yaptırmadı/);
  console.log('✓ "tetkik yok" 7. soruyu kapsam dışına alıyor');

  // Klasör seçilmemişken Anket sekmesinde uyarı ve düğme görünmeli.
  assert.ok(await sayfa.locator("#klasorUyari").isVisible(),
    "klasör yokken Anket sekmesinde uyarı görünmeli");
  assert.equal(
    (await sayfa.locator("#btnKlasorUyariEylem").textContent()).trim(),
    "Ana klasörü seç");
  console.log("✓ klasör uyarısı ve düğmesi Anket sekmesinde görünüyor");

  // Hedef: kuruma gelen hasta sayısı girilince %1'i hedef olmalı
  await sayfa.locator('.sekme[data-sekme="rapor"]').click();
  assert.ok(await sayfa.locator("#alanGelenHasta").isVisible(),
    "gelen hasta sayısı kutusu Rapor sekmesinde olmalı");
  assert.ok(await sayfa.locator("#btnIslemler").count() === 1,
    "işlemler düğmesi olmalı");
  console.log("✓ hedef kutusu ve işlemler düğmesi yerinde");
  await sayfa.locator('.sekme[data-sekme="anket"]').click();

  // Anketi uygulayan adı girilmemişse uyarı çıkmalı
  assert.ok(await sayfa.locator("#uygulayanUyari").isVisible(),
    "uygulayan adı boşken uyarı görünmeli");
  await sayfa.locator("#alanUygulayanKisa").fill("Şenay IŞIK");
  await sayfa.waitForSelector("#uygulayanUyari", { state: "hidden" });
  console.log("✓ anketi uygulayan adı uyarısı ve hızlı girişi çalışıyor");

  // Rapor bölümleri ve hekim eşlemesi
  await sayfa.locator('.sekme[data-sekme="ayarlar"]').click();
  assert.equal(await sayfa.locator("#alanUygulayan").inputValue(), "Şenay IŞIK",
    "ad iki kutuda da aynı olmalı");
  const bolumSayisi = await sayfa.locator("#bolumSecim label").count();
  assert.ok(bolumSayisi >= 12, `bölüm tikleri listelenmeli (bulunan: ${bolumSayisi})`);
  const isaretli = await sayfa.locator("#bolumSecim input:checked").count();
  assert.ok(isaretli > 0 && isaretli < bolumSayisi,
    "varsayılanda bir kısmı işaretli olmalı");
  console.log(`✓ ${bolumSayisi} rapor bölümü seçilebiliyor`);

  // Önce poliklinik listesi girilir; hekim eşlemesi bu listeden seçer
  await sayfa.locator("#alanPoliklinikler")
    .fill("Ortodonti\nPeriodontoloji\nRestoratif Diş Tedavisi");
  await sayfa.locator("#btnPoliklinikKaydet").click();
  await sayfa.waitForFunction(() =>
    document.getElementById("poliklinikDurum").textContent.includes("3 poliklinik"));
  console.log("✓ poliklinik listesi kaydediliyor");

  await sayfa.locator("#alanYeniHekim").fill("Dt. Ayşe DEMİR");
  await sayfa.locator("#btnHekimEkle").click();
  await sayfa.waitForSelector(".hekim-kutu");
  assert.equal(await sayfa.locator(".hekim-kutu").count(), 1);
  assert.equal(await sayfa.locator(".hekim-kutu .ad.eksik").count(), 1,
    "polikliniği girilmemiş hekim işaretlenmeli");
  assert.ok(await sayfa.locator("#hekimEksikUyari").isVisible(),
    "eksik poliklinik uyarısı görünmeli");

  // Seçenekler poliklinik listesinden gelmeli
  const secenekAdlari = await sayfa.locator(".hekim-satir select option")
    .allTextContents();
  assert.deepEqual(secenekAdlari,
    ["— seçilmedi —", "Ortodonti", "Periodontoloji", "Restoratif Diş Tedavisi"],
    "hekim satırı tanımlı poliklinikleri listelemeli");

  // İlk seçim sorusuz uygulanmalı
  await sayfa.locator(".hekim-satir select").selectOption("Ortodonti");
  await sayfa.waitForSelector(".hekim-kutu .ad.eksik", { state: "detached" });
  assert.equal(await sayfa.locator(".hekim-kutu .secim-sor").count(), 0,
    "ilk girişte soru sorulmamalı");
  await sayfa.waitForSelector("#hekimEksikUyari", { state: "hidden" });
  console.log("✓ hekim eklenip polikliniği tek adımda giriliyor");

  // Atanmış polikliniği değiştirince taşınma mı yanlış atama mı diye sorulmalı
  await sayfa.locator(".hekim-satir select").selectOption("Periodontoloji");
  await sayfa.waitForSelector(".hekim-kutu .secim-sor");
  const secenekler = await sayfa.locator(".hekim-kutu .secim-sor button")
    .allTextContents();
  assert.deepEqual(secenekler, ["Yanlış atanmış", "Taşındı"]);

  await sayfa.locator(".hekim-kutu .secim-sor button", { hasText: "Taşındı" })
    .click();
  await sayfa.waitForSelector(".hekim-kutu .gecmis");
  const gecmis = await sayfa.locator(".hekim-kutu .gecmis").textContent();
  assert.match(gecmis, /Ortodonti/, "eski poliklinik geçmişte görünmeli");
  assert.equal(await sayfa.locator(".hekim-satir select").inputValue(),
    "Periodontoloji", "güncel poliklinik yeni olmalı");
  console.log("✓ taşınmada eski poliklinik geçmişte tutuluyor");

  // Doğrudan sorgu ayarı: varsayılan kapalı, açılınca kalıcı olmalı
  const kutu = sayfa.locator("#cbDogrudanIslem");
  assert.ok(await kutu.isVisible(), "doğrudan sorgu tiki Ayarlar'da olmalı");
  assert.equal(await kutu.isChecked(), false, "varsayılan kapalı olmalı");
  await kutu.check();
  await sayfa.reload();
  await sayfa.waitForSelector("#sorular .soru", { state: "attached" });
  await sayfa.locator('.sekme[data-sekme="ayarlar"]').click();
  assert.equal(await sayfa.locator("#cbDogrudanIslem").isChecked(), true,
    "tik yeniden açılışta hatırlanmalı");
  await sayfa.locator("#cbDogrudanIslem").uncheck();
  console.log("✓ doğrudan sorgu ayarı kapalı geliyor ve hatırlanıyor");
  await sayfa.locator('.sekme[data-sekme="anket"]').click();
  // Yeniden yükleme formu sıfırladı; kalan sınamalar için gövdeyi tekrar aç
  await sayfa.locator("#sonucSecim .secim", { hasText: "Ulaşıldı" }).click();
  await sayfa.waitForSelector("#anketGovde:not(.gizli)");

  // Hasta seçilmeden işlemler istenirse uyarmalı
  await sayfa.locator("#btnIslemler").click();
  await sayfa.waitForSelector("#uyariAlani .uyari-kutu");
  assert.match(await sayfa.locator("#uyariAlani .uyari-kutu").textContent(),
    /Hasta seçilmedi/);
  console.log("✓ hasta seçilmeden işlem istenince uyarıyor");

  // Hasta yakını seçilince cinsiyet ve yaş boşalmalı.
  await sayfa.locator("#cinsiyetSecim .secim", { hasText: "Erkek" }).click();
  await sayfa.locator("#katilanSecim .secim", { hasText: "Hasta yakını" }).click();
  const cinsiyetBasili = await sayfa
    .locator("#cinsiyetSecim .secim[aria-pressed='true']").count();
  assert.equal(cinsiyetBasili, 0, "hasta yakını seçilince cinsiyet boşalmalı");
  assert.ok(await sayfa.locator("#yakinUyari").isVisible(), "uyarı görünmeli");
  console.log("✓ hasta yakını seçilince cinsiyet ve yaş boşaltılıyor");

  await sayfa.screenshot({ path: cikti, fullPage: true });
  console.log(`✓ ekran görüntüsü: ${cikti}`);

  const gercekHatalar = hatalar.filter((h) => !/favicon|net::ERR_FILE_NOT_FOUND/.test(h));
  assert.deepEqual(gercekHatalar, [], `konsolda hata var:\n${gercekHatalar.join("\n")}`);
  console.log("✓ konsolda hata yok");

  console.log("\nPanel sınamaları geçti.");
} finally {
  await baglam.close();
}
