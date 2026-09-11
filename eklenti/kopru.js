/* Yalıtılmış dünyada çalışan içerik betiği.
 *
 * Sayfa bağlamındaki okuyucu.js ile yan panel arasında röle görevi görür.
 * Sayfanın DOM'una ya da JavaScript'ine dokunmaz.
 */
(() => {
  "use strict";

  const OKUYUCU = "anket-okuyucu";
  const KOMUT = "anket-kopru";

  // Sayfa -> panel
  window.addEventListener("message", (e) => {
    if (e.source !== window || e.origin !== window.location.origin) return;
    const m = e.data;
    if (!m || m.kaynak !== OKUYUCU) return;
    chrome.runtime
      .sendMessage({ kaynak: "hbys", tip: m.tip, veri: m.veri })
      .catch(() => { /* panel kapalıysa dinleyen yok, sorun değil */ });
  });

  // Panel -> sayfa
  chrome.runtime.onMessage.addListener((mesaj, _gonderen, cevapla) => {
    if (!mesaj || mesaj.kaynak !== "panel") return false;
    window.postMessage(
      { kaynak: KOMUT, tip: mesaj.tip, veri: mesaj.veri },
      window.location.origin
    );
    cevapla({ iletildi: true });
    return false;
  });
})();
