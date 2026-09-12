/* Hekim–poliklinik eşlemesi.
 *
 * HBYS'de birim bilgisi dağınık: hasta listesi ızgarasında birim sütunu yok,
 * poliklinik adı filtredeki birim seçiminden tahmin ediliyor ve birim grubu
 * seçiliyken yanlış olabiliyor. Bu yüzden hangi hekimin hangi poliklinikte
 * çalıştığı elle giriliyor ve poliklinik oradan çözülüyor.
 *
 * Hekimler poliklinik değiştirebildiği için eşleme dönemlidir: her hekimin
 * bir veya birden çok dönemi olur, her dönemin bir başlangıç tarihi vardır.
 * Bir anketin polikliniği, o anketin muayene tarihinde geçerli olan döneme
 * bakılarak bulunur — hekim sonradan taşınsa bile eski anketler eski
 * poliklinikte kalır.
 *
 * Eşleme ana klasördeki `_ayarlar/hekimler.json` dosyasında durur; böylece
 * ikinci bir bilgisayar da aynı eşlemeyi görür ve rapor yalnızca klasörden
 * üretilebilir. Klasöre ulaşılamıyorsa tarayıcıdaki kopya kullanılır.
 */

import { ayarOku, ayarYaz } from "./kayit.js";
import { zamanaCevir } from "./zaman.js";

const DOSYA = "hekimler.json";
const YEREL_ANAHTAR = "hekimEslemesi";

/** Aynı hekim adının farklı yazımları tek anahtara düşsün. */
export function hekimAnahtari(ad) {
  return String(ad ?? "").trim().replace(/\s+/g, " ").toLocaleUpperCase("tr-TR");
}

/** "2026-10-01" ya da "01.10.2026" kabul eder; geçersizse null. */
export function tariheCevir(ham) {
  if (!ham) return null;
  const d = zamanaCevir(ham);
  if (!d) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-` +
         `${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Eski biçim (`{"AD": "Poliklinik"}`) dönemli biçime çevrilir.
 * Dönemler başlangıç tarihine göre eskiden yeniye sıralanır; tarihsiz dönem
 * "başından beri" demektir ve en başa gelir.
 */
function duzenle(ham) {
  // Kurumda birkaç poliklinik var; adları bir kez girilip listeden seçiliyor.
  // Böylece yazım farkı ("Ortodont" / "Ortodonti") kırılımı ikiye bölmüyor.
  const poliklinikler = [...new Set(
    (Array.isArray(ham?.poliklinikler) ? ham.poliklinikler : [])
      .map((a) => String(a ?? "").trim())
      .filter(Boolean)
  )].sort((a, b) => a.localeCompare(b, "tr"));

  const eslesme = {};
  for (const [ad, deger] of Object.entries(ham?.eslesme ?? {})) {
    const anahtar = hekimAnahtari(ad);
    if (!anahtar) continue;

    const ham_donemler = typeof deger === "string"
      ? [{ poliklinik: deger, baslangic: null }]
      : Array.isArray(deger) ? deger : [];

    const donemler = ham_donemler
      .map((d) => ({
        poliklinik: String(d?.poliklinik ?? "").trim(),
        baslangic: tariheCevir(d?.baslangic)
      }))
      .filter((d) => d.poliklinik)
      .sort((a, b) => (a.baslangic ?? "").localeCompare(b.baslangic ?? ""));

    if (donemler.length) eslesme[anahtar] = donemler;
  }
  return { surum: 3, guncelleme: ham?.guncelleme ?? null, poliklinikler, eslesme };
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

export async function eslemeYaz(eslesme, poliklinikler) {
  const nesne = duzenle({
    eslesme, poliklinikler, guncelleme: new Date().toISOString()
  });
  await chrome.storage.local.set({ [YEREL_ANAHTAR]: nesne });
  return {
    klasoreYazildi: await ayarYaz(DOSYA, nesne),
    esleme: nesne.eslesme,
    poliklinikler: nesne.poliklinikler
  };
}

/**
 * Bir hekimin verilen tarihteki polikliniği.
 * @param {string|Date|null} tarih  boşsa en son dönem kullanılır
 */
export function poliklinikBul(eslesme, hekim, tarih = null) {
  const donemler = eslesme?.[hekimAnahtari(hekim)];
  if (!donemler || !donemler.length) return null;

  const gun = tariheCevir(tarih);
  if (!gun) return donemler[donemler.length - 1].poliklinik;

  let secili = null;
  for (const d of donemler) {
    if (d.baslangic === null || d.baslangic <= gun) secili = d;
    else break;
  }
  // Hepsi anketten sonra başlıyorsa en eski dönem en yakın tahmindir.
  return (secili ?? donemler[0]).poliklinik;
}

/** Anketin ait olduğu ziyaretin tarihi — poliklinik onun üzerinden çözülür. */
const kayitTarihi = (k) =>
  k.hasta?.muayeneZamani ?? k.hasta?.islemTarihi ?? k.tarih ?? null;

/**
 * Kayıtlardaki poliklinik alanını eşlemeye göre düzeltir.
 *
 * Eşleme varsa o kazanır: kayıttaki değer anket sırasında birim filtresinden
 * tahmin edilmiş olabilir, eşleme ise elle girilmiş kesin bilgidir. Diskteki
 * kayda dokunulmaz, düzeltme yalnızca okurken yapılır.
 */
export function kayitlariEsle(kayitlar, eslesme) {
  if (!eslesme || !Object.keys(eslesme).length) return kayitlar;
  return kayitlar.map((k) => {
    const bulunan = poliklinikBul(eslesme, k.hasta?.hekim, kayitTarihi(k));
    if (!bulunan || bulunan === k.hasta?.poliklinik) return k;
    return { ...k, hasta: { ...k.hasta, poliklinik: bulunan, poliklinikEslemeden: true } };
  });
}

const bugun = () => tariheCevir(new Date());

/**
 * Bir hekimin polikliniğini günceller.
 *
 * İki ayrı durum var ve karıştırılırsa geçmiş bozulur:
 *
 * - **Düzeltme** (`gecmiseUygula: true`): yanlış ya da eksik girilmiş bir adı
 *   düzeltiyoruz. Hekim hep orada çalışıyordu, bütün dönemler yeni adla
 *   değiştirilir; eski anketler de düzelir.
 * - **Taşınma** (`gecmiseUygula: false`): hekim gerçekten poliklinik
 *   değiştirdi. Bugünden başlayan yeni bir dönem açılır, eski dönem yerinde
 *   kalır; o tarihten önceki anketler eski poliklinikte kalır.
 *
 * @returns {object} yeni eşleme (özgün nesne değiştirilmez)
 */
export function poliklinigiGuncelle(eslesme, hekim, poliklinik, { gecmiseUygula }) {
  const anahtar = hekimAnahtari(hekim);
  if (!anahtar) return eslesme;

  const ad = String(poliklinik ?? "").trim();
  const yeni = { ...eslesme };

  if (!ad) {                                    // boşaltmak = eşlemeyi kaldır
    delete yeni[anahtar];
    return yeni;
  }

  const oncekiler = eslesme?.[anahtar] ?? [];
  if (gecmiseUygula || !oncekiler.length) {
    yeni[anahtar] = [{ poliklinik: ad, baslangic: null }];
    return yeni;
  }

  const gun = bugun();
  // Aynı gün ikinci kez taşınmışsa yeni dönem açmak yerine üstüne yaz
  const donemler = oncekiler.filter((d) => d.baslangic !== gun);
  yeni[anahtar] = [...donemler, { poliklinik: ad, baslangic: gun }]
    .sort((a, b) => (a.baslangic ?? "").localeCompare(b.baslangic ?? ""));
  return yeni;
}

/** Hekimin bugünkü polikliniği ve varsa önceki dönemleri. */
export function hekimOzeti(eslesme, hekim) {
  const donemler = eslesme?.[hekimAnahtari(hekim)] ?? [];
  return {
    guncel: donemler.length ? donemler[donemler.length - 1].poliklinik : "",
    gecmis: donemler.slice(0, -1)
  };
}

/** Kayıtlarda geçen, henüz eşlenmemiş hekimleri çıkarır. */
export function eksikHekimler(kayitlar, eslesme) {
  const sayac = new Map();
  for (const k of kayitlar) {
    const ad = k.hasta?.hekim;
    if (!ad) continue;
    const anahtar = hekimAnahtari(ad);
    if (eslesme?.[anahtar]?.length) continue;
    if (!sayac.has(anahtar)) sayac.set(anahtar, { ad: String(ad).trim(), adet: 0 });
    sayac.get(anahtar).adet += 1;
  }
  return [...sayac.values()].sort((a, b) => b.adet - a.adet);
}

/**
 * Seçim listesi: tanımlı poliklinikler, artı eşlemede geçip listede olmayanlar.
 * İkincisi, liste sonradan daraltılsa bile eski atamaların kaybolmaması için.
 */
export function poliklinikAdlari(eslesme, tanimli = []) {
  const adlar = new Set(tanimli);
  for (const donemler of Object.values(eslesme ?? {})) {
    for (const d of donemler) adlar.add(d.poliklinik);
  }
  return [...adlar].filter(Boolean).sort((a, b) => a.localeCompare(b, "tr"));
}
