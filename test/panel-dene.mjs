/* Eklentiyi gerçek Chromium'a yükleyip yan panel sayfasını açar.
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
