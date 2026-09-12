/* Servis işçisi.
 *
 * Chrome 109 uyarlaması — iki şey yeni sürümlerden farklı çözülüyor:
 *
 * 1) Yan panel API'si (chrome.sidePanel) Chrome 114'te geldi. Burada panel,
 *    eklenti simgesine tıklanınca tarayıcı penceresinin sağına yaslanan ayrı
 *    bir pencerede açılır; panel kapanınca tarayıcı penceresi eski boyutuna
 *    döner (yerleşimi panel/pencere.js yapar).
 *
 * 2) Manifestte "world": "MAIN" Chrome 111'de geldi. okuyucu.js HBYS'nin kendi
 *    JavaScript bağlamında çalışmak zorunda (App.* nesnelerini okuyor); bu
 *    yüzden buradan dinamik içerik betiği olarak kaydediliyor
 *    (chrome.scripting, "world" alanı Chrome 102+).
 */
"use strict";

const HBYS_DESENI = "http://10.212.200.215:8090/Poliklinik/*";
const PANEL_ADRESI = "panel/panel.html";
const VARSAYILAN_GENISLIK = 390;

// --- okuyucu.js: sayfanın kendi bağlamında (MAIN world) ---------------------

const OKUYUCU = {
  id: "okuyucu",
  matches: [HBYS_DESENI],
  js: ["okuyucu.js"],
  runAt: "document_idle",
  world: "MAIN",
  persistAcrossSessions: true
};

let kayitZinciri = Promise.resolve();

/** Kayıt yoksa yapar. tazele=true ise (kurulum/güncelleme) eskisini silip
 *  yeniden yazar. Çağrılar sıraya girer; aynı kimlik iki kez kaydedilmez. */
function okuyucuyuKaydet(tazele = false) {
  kayitZinciri = kayitZinciri
    .then(async () => {
      const kayitli = await chrome.scripting.getRegisteredContentScripts({ ids: [OKUYUCU.id] });
      if (kayitli.length && !tazele) return;
      if (kayitli.length) await chrome.scripting.unregisterContentScripts({ ids: [OKUYUCU.id] });
      await chrome.scripting.registerContentScripts([OKUYUCU]);
    })
    .catch((e) => console.error("okuyucu.js kaydedilemedi:", e));
  return kayitZinciri;
}

// --- Kuyruk dürtüsü ----------------------------------------------------------

/* Ağ klasörü erişilemediğinde bekleyen kayıtlar için panele dürtü.
 * Alarm tarayıcı yeniden açılınca silinmiş olabilir; yoksa yeniden kurulur. */
function alarmiKur() {
  chrome.alarms.get("kuyruk", (alarm) => {
    if (!alarm) chrome.alarms.create("kuyruk", { periodInMinutes: 5 });
  });
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== "kuyruk") return;
  chrome.runtime.sendMessage({ kaynak: "arkaplan", tip: "kuyrugu-dene" }).catch(() => {});
});

// --- Panel penceresi ---------------------------------------------------------

let acilis = null;

/** Panel açıksa öne getirir, değilse simgeye tıklanan pencerenin sağında açar. */
async function paneliAc(sekme) {
  const { panelPenceresi } = await chrome.storage.session.get("panelPenceresi");
  if (panelPenceresi !== undefined) {
    try {
      await chrome.windows.update(panelPenceresi, { focused: true });
      return;
    } catch { /* pencere kapanmış; yenisi açılacak */ }
  }

  let hedef = null;
  try {
    if (sekme && sekme.windowId !== undefined) hedef = await chrome.windows.get(sekme.windowId);
  } catch { /* hedefsiz açılır */ }

  const { panelGenisligi } = await chrome.storage.local.get("panelGenisligi");
  const genislik = panelGenisligi || VARSAYILAN_GENISLIK;

  const secenekler = {
    url: `${PANEL_ADRESI}?pencere=1${hedef ? `&hedef=${hedef.id}` : ""}`,
    type: "popup",
    focused: true,
    width: genislik
  };
  // Kesin yerleşimi panelin kendisi yapar (ekran ölçüsünü o bilir); burada
  // yalnızca aynı monitörde, pencerenin sağ kenarında açılması sağlanır.
  if (hedef && hedef.state !== "minimized") {
    secenekler.left = hedef.left + Math.max(0, hedef.width - genislik);
    secenekler.top = hedef.top;
    secenekler.height = hedef.height;
  }

  const pencere = await chrome.windows.create(secenekler);
  await chrome.storage.session.set({ panelPenceresi: pencere.id });
}

chrome.action.onClicked.addListener((sekme) => {
  if (acilis) return;
  acilis = paneliAc(sekme)
    .catch((e) => console.error("Panel açılamadı:", e))
    .finally(() => { acilis = null; });
});

/** Panel kapanınca, panele yer açmak için daraltılan tarayıcı penceresini
 *  eski hâline getirir — kullanıcı o arada pencereyi kendisi değiştirmediyse. */
chrome.windows.onRemoved.addListener(async (kapananId) => {
  const { panelPenceresi, yerlesim } =
    await chrome.storage.session.get(["panelPenceresi", "yerlesim"]);
  if (kapananId !== panelPenceresi) return;
  await chrome.storage.session.remove(["panelPenceresi", "yerlesim"]);
  if (!yerlesim) return;

  try {
    const { hedefId, onceki, verilen } = yerlesim;
    const p = await chrome.windows.get(hedefId);
    const yakin = (a, b) => Math.abs(a - b) <= 20;
    if (p.state !== "normal" || !yakin(p.left, verilen.left) || !yakin(p.width, verilen.width)) return;
    if (onceki.state === "maximized") {
      await chrome.windows.update(hedefId, { state: "maximized" });
    } else {
      await chrome.windows.update(hedefId, {
        left: onceki.left, top: onceki.top, width: onceki.width, height: onceki.height
      });
    }
  } catch { /* tarayıcı penceresi de kapanmış */ }
});

// --- Başlangıç ---------------------------------------------------------------

// Servis işçisi her uyandığında: eksik olan varsa tamamla.
okuyucuyuKaydet();
alarmiKur();

chrome.runtime.onInstalled.addListener(() => {
  okuyucuyuKaydet(true);
  alarmiKur();
});

chrome.runtime.onStartup.addListener(() => {
  okuyucuyuKaydet();
  alarmiKur();
});
