/* Panel penceresi — Chrome 109 uyarlaması.
 *
 * Chrome 114 öncesinde yan panel (chrome.sidePanel) yok. Panel bunun yerine
 * eklenti simgesiyle ayrı bir pencerede açılır ve açılırken yan paneli taklit
 * eder: kendisi ekranın sağ kenarında tam boy durur, tarayıcı penceresi soluna
 * daralır. Panel kapanınca tarayıcı penceresini arkaplan.js eski hâline getirir.
 */

const PARAMETRE = new URLSearchParams(location.search);

/** Panel, eklenti simgesiyle açılan ayrı pencerede mi çalışıyor? */
export const PENCEREDE = PARAMETRE.has("pencere");

const VARSAYILAN_GENISLIK = 390;
const EN_DAR = 320;
const TARAYICI_EN_DAR = 480;   // bundan dara sıkıştırmaktansa dokunmamak iyi

const sinirlar = (p) => ({ state: p.state, left: p.left, top: p.top, width: p.width, height: p.height });

/** Paneli ekranın sağ kenarına, tarayıcı penceresini de soluna yerleştirir. */
export async function yanYanaDiz() {
  if (!PENCEREDE) return;
  try {
    const ben = await chrome.windows.getCurrent();
    const { panelGenisligi } = await chrome.storage.local.get("panelGenisligi");

    const alan = {
      x: screen.availLeft ?? 0,
      y: screen.availTop ?? 0,
      w: screen.availWidth,
      h: screen.availHeight
    };
    const gen = Math.round(Math.max(EN_DAR,
      Math.min(panelGenisligi || VARSAYILAN_GENISLIK, alan.w * 0.45)));
    const panelSol = alan.x + alan.w - gen;

    await chrome.windows.update(ben.id, { left: panelSol, top: alan.y, width: gen, height: alan.h });
    await chrome.storage.session.remove("yerlesim");

    const hedefId = Number(PARAMETRE.get("hedef"));
    if (!Number.isInteger(hedefId) || hedefId <= 0) return;
    let hedef;
    try { hedef = await chrome.windows.get(hedefId); } catch { return; }

    let yeni = null;
    if (hedef.state === "maximized" && panelSol - alan.x >= TARAYICI_EN_DAR) {
      yeni = { state: "normal", left: alan.x, top: alan.y, width: panelSol - alan.x, height: alan.h };
    } else if (hedef.state === "normal" && hedef.left < panelSol &&
               hedef.left + hedef.width > panelSol &&
               panelSol - hedef.left >= TARAYICI_EN_DAR) {
      yeni = { width: panelSol - hedef.left };      // yalnızca sağ kenarı panele dayansın
    }
    // Küçültülmüş, tam ekran, zaten çakışmıyor ya da ekran çok dar: dokunma.
    if (!yeni) return;

    const sonra = await chrome.windows.update(hedef.id, yeni);
    await chrome.storage.session.set({
      yerlesim: { hedefId: hedef.id, onceki: sinirlar(hedef), verilen: sinirlar(sonra) }
    });
    // Windows, büyütülmüş pencereyi eski boyutuna alırken onu öne getirir.
    await chrome.windows.update(ben.id, { focused: true });
  } catch (e) {
    console.warn("Panel penceresi yerleştirilemedi:", e);
  }
}

/** Kullanıcı panel penceresini genişletir/daraltırsa bir sonraki açılışta aynı genişlik. */
export function genisligiHatirla() {
  if (!PENCEREDE) return;
  let zaman = null;
  window.addEventListener("resize", () => {
    clearTimeout(zaman);
    zaman = setTimeout(() => {
      const g = window.outerWidth;
      if (g >= EN_DAR && g <= 900) chrome.storage.local.set({ panelGenisligi: g });
    }, 1000);
  });
}

/** Rapor ve liste gibi sayfaları normal bir tarayıcı penceresinde yeni sekmede
 *  açar. Panel penceresi "popup" türünde, kendisi sekme taşıyamaz. */
export async function sekmeAc(url) {
  let windowId = null;
  try {
    windowId = (await chrome.windows.getLastFocused({ windowTypes: ["normal"] })).id;
  } catch { /* normal pencere yoksa Chrome kendisi açar */ }
  const sekme = await chrome.tabs.create(windowId === null ? { url } : { url, windowId });
  chrome.windows.update(sekme.windowId, { focused: true }).catch(() => {});
  return sekme;
}
