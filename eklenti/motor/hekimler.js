/* Hekim–poliklinik eşlemesi.
 *
 * HBYS'de birim bilgisi dağınık: hasta listesi ızgarasında birim sütunu yok,
 * poliklinik adı filtredeki birim seçiminden tahmin ediliyor ve birim grubu
 * seçiliyken yanlış olabiliyor. Bu yüzden hangi hekimin hangi poliklinikte
 * çalıştığı elle giriliyor ve poliklinik oradan çözülüyor.
 *
 * Eşleme ana klasördeki `_ayarlar/hekimler.json` dosyasında durur; böylece
 * ikinci bir bilgisayar da aynı eşlemeyi görür ve rapor yalnızca klasörden
 * üretilebilir. Klasöre ulaşılamıyorsa tarayıcıdaki kopya kullanılır.
 */

import { ayarOku, ayarYaz } from "./kayit.js";

const DOSYA = "hekimler.json";
const YEREL_ANAHTAR = "hekimEslemesi";

const bosEsleme = () => ({ surum: 1, guncelleme: null, eslesme: {} });

/** Aynı hekim adının farklı yazımları tek anahtara düşsün. */
export function hekimAnahtari(ad) {
  return String(ad ?? "").trim().replace(/\s+/g, " ").toLocaleUpperCase("tr-TR");
}

function duzenle(ham) {
  if (!ham || typeof ham !== "object") return bosEsleme();
  const eslesme = {};
  for (const [ad, poliklinik] of Object.entries(ham.eslesme ?? {})) {
    const anahtar = hekimAnahtari(ad);
    if (anahtar && poliklinik) eslesme[anahtar] = String(poliklinik).trim();
  }
  return { surum: 1, guncelleme: ham.guncelleme ?? null, eslesme };
}

/** Klasördeki eşlemeyi okur; yoksa tarayıcıdaki kopyaya düşer. */
export async function eslemeOku() {
  const klasordeki = await ayarOku(DOSYA);
  if (klasordeki) {
    const temiz = duzenle(klasordeki);
    await chrome.storage.local.set({ [YEREL_ANAHTAR]: temiz });
    return { ...temiz, kaynak: "klasor" };
  }
  const kutu = await chrome.storage.local.get(YEREL_ANAHTAR);
  return { ...duzenle(kutu[YEREL_ANAHTAR]), kaynak: "yerel" };
}

/**
 * Eşlemeyi hem klasöre hem tarayıcıya yazar.
 * @returns {Promise<{klasoreYazildi: boolean}>}
 */
export async function eslemeYaz(eslesme) {
  const nesne = duzenle({ eslesme, guncelleme: new Date().toISOString() });
  await chrome.storage.local.set({ [YEREL_ANAHTAR]: nesne });
  return { klasoreYazildi: await ayarYaz(DOSYA, nesne) };
}

/** Bir hekim adı için poliklinik; eşleme yoksa null. */
export function poliklinikBul(eslesme, hekim) {
  const anahtar = hekimAnahtari(hekim);
  return anahtar && eslesme ? (eslesme[anahtar] ?? null) : null;
}

/**
 * Kayıtlardaki poliklinik alanını eşlemeye göre düzeltir.
 *
 * Eşleme varsa o kazanır: kayıttaki değer anket sırasında birim filtresinden
 * tahmin edilmiş olabilir, eşleme ise elle girilmiş kesin bilgidir. Eşleme
 * yoksa kayıttaki değer olduğu gibi kalır.
 */
export function kayitlariEsle(kayitlar, eslesme) {
  if (!eslesme || !Object.keys(eslesme).length) return kayitlar;
  return kayitlar.map((k) => {
    const bulunan = poliklinikBul(eslesme, k.hasta?.hekim);
    if (!bulunan || bulunan === k.hasta?.poliklinik) return k;
    return { ...k, hasta: { ...k.hasta, poliklinik: bulunan, poliklinikEslemeden: true } };
  });
}

/** Kayıtlarda geçen, henüz eşlenmemiş hekimleri çıkarır. */
export function eksikHekimler(kayitlar, eslesme) {
  const sayac = new Map();
  for (const k of kayitlar) {
    const ad = k.hasta?.hekim;
    if (!ad) continue;
    const anahtar = hekimAnahtari(ad);
    if (eslesme?.[anahtar]) continue;
    if (!sayac.has(anahtar)) sayac.set(anahtar, { ad: String(ad).trim(), adet: 0 });
    sayac.get(anahtar).adet += 1;
  }
  return [...sayac.values()].sort((a, b) => b.adet - a.adet);
}

/** Eşlemede geçen poliklinik adları — girişte öneri listesi olur. */
export function poliklinikAdlari(eslesme) {
  return [...new Set(Object.values(eslesme ?? {}))].sort((a, b) => a.localeCompare(b, "tr"));
}
