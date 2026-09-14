/* Anketlerin ağ klasörüne yazılması.
 *
 * Kullanıcı bir kez ana klasörü gösterir; eklenti ay klasörlerini kendisi
 * açar. Klasör tanıtıcısı IndexedDB'de saklanır — chrome.storage bu nesneyi
 * tutamaz. Klasöre o an ulaşılamazsa anket kuyrukta bekler.
 */

const VT_ADI = "hhd-fr-19";
const VT_SURUM = 1;
const D_AYAR = "ayar";       // klasör tanıtıcısı gibi tekil kayıtlar
const D_KUYRUK = "kuyruk";   // yazılamamış anketler
const D_DIZIN = "dizin";     // mükerrer denetimi için hafif dizin

/* Klasör ve dosya adları ASCII.
 *
 * Sebebi kozmetik değil: adında Türkçe karakter olan klasör ve dosyalar
 * oluşuyor ama tarayıcının dizin listelemesinde (entries()) hiç görünmüyor.
 * Böyle bir adla yazılan anket diske düşer, sonra bulunamaz — ay listesi boş
 * çıkar ve rapor üretilemez. Görünen adlar (panel, rapor) yine tam Türkçe;
 * yalnızca diskteki adlar sadeleştirilir. */
const AYLAR = ["Ocak", "Subat", "Mart", "Nisan", "Mayis", "Haziran",
               "Temmuz", "Agustos", "Eylul", "Ekim", "Kasim", "Aralik"];


const CEVRIM = { ş: "s", Ş: "S", ğ: "g", Ğ: "G", ı: "i", İ: "I",
                 ö: "o", Ö: "O", ü: "u", Ü: "U", ç: "c", Ç: "C" };

/** Türkçe harfleri ASCII karşılığına çevirir, kalan ASCII dışı işaretleri atar. */
export function asciiye(metin) {
  return String(metin ?? "")
    .replace(/[şŞğĞıİöÖüÜçÇ]/g, (h) => CEVRIM[h])
    .normalize("NFD").replace(/[̀-ͯ]/g, "")   // kalan aksanları ayıkla
    .replace(/[^\x20-\x7e]/g, "");
}

export const ANA_KLASOR = "HHD.FR.19 Anketleri";
export const VERI_KLASORU = "_veri";

// --- IndexedDB ------------------------------------------------------------

let vtSozu = null;

function vt() {
  if (vtSozu) return vtSozu;
  vtSozu = new Promise((tamam, hata) => {
    const istek = indexedDB.open(VT_ADI, VT_SURUM);
    istek.onupgradeneeded = () => {
      const db = istek.result;
      if (!db.objectStoreNames.contains(D_AYAR)) db.createObjectStore(D_AYAR);
      if (!db.objectStoreNames.contains(D_KUYRUK)) db.createObjectStore(D_KUYRUK, { keyPath: "id" });
      if (!db.objectStoreNames.contains(D_DIZIN)) db.createObjectStore(D_DIZIN, { keyPath: "id" });
    };
    istek.onsuccess = () => tamam(istek.result);
    istek.onerror = () => hata(istek.error);
  });
  return vtSozu;
}

function islem(depo, mod, is) {
  return vt().then((db) => new Promise((tamam, hata) => {
    const t = db.transaction(depo, mod);
    const istek = is(t.objectStore(depo));
    t.oncomplete = () => tamam(istek ? istek.result : undefined);
    t.onerror = () => hata(t.error);
    t.onabort = () => hata(t.error);
  }));
}

const oku = (depo, anahtar) => islem(depo, "readonly", (d) => d.get(anahtar));
const yazVt = (depo, deger, anahtar) => islem(depo, "readwrite", (d) => d.put(deger, anahtar));
const silVt = (depo, anahtar) => islem(depo, "readwrite", (d) => d.delete(anahtar));
const hepsi = (depo) => islem(depo, "readonly", (d) => d.getAll());

// --- Klasör izni ----------------------------------------------------------

/** Kullanıcının seçtiği ana klasörü ister. Kullanıcı hareketi gerektirir. */
export async function klasorSec() {
  const tanitici = await window.showDirectoryPicker({ mode: "readwrite", id: "hhdfr19" });
  await yazVt(D_AYAR, tanitici, "anaKlasor");
  return tanitici;
}

export async function anaKlasor() {
  return (await oku(D_AYAR, "anaKlasor")) || null;
}

/** "verildi" | "sorulmali" | "yok" */
export async function izinDurumu() {
  const t = await anaKlasor();
  if (!t) return "yok";
  try {
    return (await t.queryPermission({ mode: "readwrite" })) === "granted" ? "verildi" : "sorulmali";
  } catch {
    return "sorulmali";
  }
}

/** Tarayıcı yeniden açıldığında tek düğmelik onay. Kullanıcı hareketi ister. */
export async function izinIste() {
  const t = await anaKlasor();
  if (!t) return false;
  return (await t.requestPermission({ mode: "readwrite" })) === "granted";
}

export async function klasoruUnut() {
  await silVt(D_AYAR, "anaKlasor");
}

// --- Dosya adı ------------------------------------------------------------

// Windows'un dosya adında kabul etmedikleri: \ / : * ? " < > | ve denetim karakterleri
const YASAK = new RegExp('[\\\\/:*?"<>|' + "\\u0000-\\u001f]", "g");
const AYRILMIS = /^(CON|PRN|AUX|NUL|COM\d|LPT\d)$/i;

/** Yasak karakterleri temizler ve adı ASCII'ye indirir (bkz. AYLAR notu). */
export function dosyaAdiTemizle(ham, yedek = "isimsiz") {
  let s = asciiye(ham).replace(YASAK, " ").replace(/\s+/g, " ").trim();
  s = s.replace(/[. ]+$/, "");                 // Windows sonda nokta/boşluk sevmez
  if (AYRILMIS.test(s)) s = `_${s}`;
  if (s.length > 80) s = s.slice(0, 80).trim();
  return s || yedek;
}

const iki = (n) => String(n).padStart(2, "0");

export function ayKlasoruAdi(tarih) {
  const d = tarih instanceof Date ? tarih : new Date(tarih);
  return `${d.getFullYear()}-${iki(d.getMonth() + 1)} ${AYLAR[d.getMonth()]}`;
}

/**
 * Bir muayene gününe ait anketlerin bulunabileceği ay klasörleri.
 *
 * Anket muayeneden sonra yapılıyor: ayın son günlerinde muayene olan hastanın
 * anketi ertesi ayın klasörüne düşebilir. Bu yüzden muayene gününe göre arama
 * iki klasöre birden bakar.
 *
 * @param {string} gun "YYYY-MM-DD"
 * @returns {string[]} ör. ["2026-09 Eylul", "2026-10 Ekim"]
 */
export function gunKlasorleri(gun) {
  const d = new Date(`${gun}T00:00:00`);
  if (Number.isNaN(d.getTime())) return [];
  const sonraki = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  return [...new Set([ayKlasoruAdi(d), ayKlasoruAdi(sonraki)])];
}

/** Ada göre arama YALNIZCA ASCII adlarla yapılır — gerekçesi AYLAR notunda. */
function ayKlasorAdi(yil, ay) {
  return `${yil}-${iki(ay)} ${AYLAR[ay - 1]}`;
}

const asciiMi = (s) => /^[\x20-\x7e]*$/.test(String(s));

/** "AHMET YILMAZ - 11.09.2026 14.32" — saatte ":" yerine "." çünkü Windows. */
export function anketDosyaAdi(adSoyad, tarih) {
  const d = tarih instanceof Date ? tarih : new Date(tarih);
  const gun = `${iki(d.getDate())}.${iki(d.getMonth() + 1)}.${d.getFullYear()}`;
  const saat = `${iki(d.getHours())}.${iki(d.getMinutes())}`;
  return `${dosyaAdiTemizle(adSoyad)} - ${gun} ${saat}`;
}

// --- Yazma ----------------------------------------------------------------

async function dosyayaYaz(klasor, ad, icerik) {
  const dosya = await klasor.getFileHandle(ad, { create: true });
  const akis = await dosya.createWritable();
  try {
    await akis.write(icerik);
  } finally {
    await akis.close();
  }
}

async function ayKlasoru(tanitici, tarih) {
  const ana = await tanitici.getDirectoryHandle(ANA_KLASOR, { create: true });
  const ay = await ana.getDirectoryHandle(ayKlasoruAdi(tarih), { create: true });
  const veri = await ay.getDirectoryHandle(VERI_KLASORU, { create: true });
  return { ay, veri };
}

async function isiYaz(is) {
  const tanitici = await anaKlasor();
  if (!tanitici) return { yazildi: false, kuyrukta: true, neden: "klasor-secilmedi" };

  try {
    if ((await tanitici.queryPermission({ mode: "readwrite" })) !== "granted") {
      return { yazildi: false, kuyrukta: true, neden: "izin-yok" };
    }
    const { kayit, pdf } = is;
    const { ay, veri } = await ayKlasoru(tanitici, kayit.zamanDamgasi);
    const taban = kayit.dosyaTabani;

    if (pdf) await dosyayaYaz(ay, `${taban}.pdf`, pdf);
    await dosyayaYaz(veri, `${taban}.json`, JSON.stringify(kayit, null, 1));

    return { yazildi: true, kuyrukta: false, klasor: ayKlasoruAdi(kayit.zamanDamgasi) };
  } catch (e) {
    return { yazildi: false, kuyrukta: true, neden: e?.name || "yazilamadi", hata: String(e) };
  }
}

/**
 * Anketi diske yazar. Klasöre ulaşılamazsa kuyruğa alır ve
 * { yazildi: false, kuyrukta: true } döner.
 */
export async function anketiKaydet(kayit, pdfBaytlari) {
  await dizineEkle(kayit);
  const is = {
    id: kayit.anketId,
    kayit,
    pdf: pdfBaytlari ? new Blob([pdfBaytlari], { type: "application/pdf" }) : null,
    eklenme: new Date().toISOString()
  };

  const sonuc = await isiYaz(is);
  if (!sonuc.yazildi) await yazVt(D_KUYRUK, is);
  return sonuc;
}

export async function kuyrukSayisi() {
  return (await hepsi(D_KUYRUK)).length;
}

/** Bekleyen anketleri yeniden yazmayı dener. */
export async function kuyrugaBak() {
  const isler = await hepsi(D_KUYRUK);
  let yazilan = 0;
  for (const is of isler) {
    const sonuc = await isiYaz(is);
    if (sonuc.yazildi) {
      await silVt(D_KUYRUK, is.id);
      yazilan += 1;
    } else if (sonuc.neden === "klasor-secilmedi" || sonuc.neden === "izin-yok") {
      break;                                   // sıra bizde değil, boşuna denemeyelim
    }
  }
  return { yazilan, kalan: await kuyrukSayisi() };
}

// --- Mükerrer denetimi ----------------------------------------------------

const dizinAnahtari = (hastaId, ay) => `${ay}|${hastaId}`;

async function dizineEkle(kayit) {
  if (!kayit.hasta?.hastaId) return;
  const ay = kayit.tarih.slice(0, 7);
  await yazVt(D_DIZIN, {
    id: dizinAnahtari(kayit.hasta.hastaId, ay),
    hastaId: kayit.hasta.hastaId,
    ay,
    adSoyad: kayit.hasta.adSoyad,
    tarih: kayit.tarih,
    gorusmeSonucu: kayit.gorusmeSonucu,
    dosyaTabani: kayit.dosyaTabani     // listelemede görünmeyen dosyaları açmak için
  });
}

/** Bu hasta bu ay zaten arandı mı? Yereldeki dizinden bakar. */
export async function ayIcindeVarMi(hastaId, tarih = new Date()) {
  if (!hastaId) return null;
  const d = tarih instanceof Date ? tarih : new Date(tarih);
  const ay = `${d.getFullYear()}-${iki(d.getMonth() + 1)}`;
  return (await oku(D_DIZIN, dizinAnahtari(hastaId, ay))) || null;
}

export async function ayinDizini(ay) {
  return (await hepsi(D_DIZIN)).filter((k) => k.ay === ay);
}

// --- Okuma (rapor için) ---------------------------------------------------

/**
 * Bir ayın veri dosyalarını klasörden okur. Rapor her zaman buradan üretilir;
 * eklentinin kendi belleğinden değil.
 */
export async function ayKayitlariniOku(ayEtiketi) {
  const tanitici = await anaKlasor();
  if (!tanitici) throw new Error("Ana klasör seçilmemiş");

  const ana = await tanitici.getDirectoryHandle(ANA_KLASOR, { create: false });
  const ay = await ana.getDirectoryHandle(ayEtiketi, { create: false });
  const veri = await ay.getDirectoryHandle(VERI_KLASORU, { create: false });

  const kayitlar = [];
  const bozuk = [];
  const gorulen = new Set();
  for await (const [ad, tanit] of veri.entries()) {
    gorulen.add(ad);
    if (!ad.toLowerCase().endsWith(".json") || tanit.kind !== "file") continue;
    try {
      kayitlar.push(JSON.parse(await (await tanit.getFile()).text()));
    } catch {
      bozuk.push(ad);
    }
  }

  // Eski sürümler veri dosyalarını Türkçe adla yazıyordu; o adlar listelemede
  // görünmüyor. Yereldeki dizinden hangi anketlerin beklendiğini bilip
  // dosyalarını tek tek açmayı deneriz.
  const ay7 = ayEtiketi.slice(0, 7);
  const eksik = [];
  for (const kalem of await ayinDizini(ay7)) {
    if (!kalem.dosyaTabani || gorulen.has(`${kalem.dosyaTabani}.json`)) continue;
    if (!asciiMi(kalem.dosyaTabani)) { eksik.push(kalem.dosyaTabani); continue; }
    try {
      const t = await veri.getFileHandle(`${kalem.dosyaTabani}.json`, { create: false });
      kayitlar.push(JSON.parse(await (await t.getFile()).text()));
    } catch {
      eksik.push(kalem.dosyaTabani);
    }
  }

  return { kayitlar, bozuk, eksik };
}

export const AYAR_KLASORU = "_ayarlar";

/**
 * Ana klasördeki ortak ayar dosyaları.
 *
 * Hekim–poliklinik eşlemesi gibi şeyler buraya yazılıyor, chrome.storage'a
 * değil: iki ayrı bilgisayardan anket yapıldığında ikisi de aynı eşlemeyi
 * görsün ve rapor klasörden tek başına üretilebilsin diye.
 */
export async function ayarOku(ad) {
  const tanitici = await anaKlasor();
  if (!tanitici) return null;
  try {
    const ana = await tanitici.getDirectoryHandle(ANA_KLASOR, { create: false });
    const klasor = await ana.getDirectoryHandle(AYAR_KLASORU, { create: false });
    const dosya = await klasor.getFileHandle(ad, { create: false });
    return JSON.parse(await (await dosya.getFile()).text());
  } catch {
    return null;                                // yok ya da okunamıyor
  }
}

export async function ayarYaz(ad, nesne) {
  const tanitici = await anaKlasor();
  if (!tanitici) return false;
  try {
    const ana = await tanitici.getDirectoryHandle(ANA_KLASOR, { create: true });
    const klasor = await ana.getDirectoryHandle(AYAR_KLASORU, { create: true });
    await dosyayaYaz(klasor, ad, JSON.stringify(nesne, null, 1));
    return true;
  } catch {
    return false;
  }
}

/**
 * Bir ayın özeti: kaç kişi arandı, kaçına ulaşıldı.
 *
 * Sayım hasta üzerinden yapılır, arama üzerinden değil: aynı hastayı üç kez
 * aramak "üç kişi arandı" demek değildir. Kaynak klasördeki veri dosyalarıdır,
 * böylece iki ayrı bilgisayardan yapılan anketler de sayıya girer.
 */
export async function ayOzeti(ayEtiketi) {
  let kayitlar = [];
  try {
    ({ kayitlar } = await ayKayitlariniOku(ayEtiketi));
  } catch {
    return { okundu: false, aranan: 0, ulasilan: 0, kayit: 0 };
  }

  const aranan = new Set();
  const ulasilan = new Set();
  for (const k of kayitlar) {
    const kimlik = k.hasta?.hastaId ?? k.anketId;
    if (kimlik === undefined || kimlik === null) continue;
    aranan.add(String(kimlik));
    if (k.gorusmeSonucu === "ulasildi") ulasilan.add(String(kimlik));
  }
  return { okundu: true, aranan: aranan.size, ulasilan: ulasilan.size, kayit: kayitlar.length };
}

/** Bugünün ayına karşılık gelen klasör adı. */
export function buAyinKlasoru(tarih = new Date()) {
  return ayKlasoruAdi(tarih);
}

/**
 * Ana klasördeki ay klasörlerini listeler.
 *
 * Önce klasörü gezer. Gezme hiçbir şey vermezse son GERIYE_BAK ayın adını tek
 * tek dener — klasör var ama listelenemiyorsa yine de bulunur. Deneme yalnızca
 * ASCII adlarla yapılır: Türkçe adlı olmayan bir klasör "varmış gibi" açılıyor,
 * öyle bir denemenin sonucu hayalet ay listesi olurdu.
 */
const GERIYE_BAK = 24;

export async function aylariListele() {
  const tanitici = await anaKlasor();
  if (!tanitici) return [];

  let ana;
  try {
    ana = await tanitici.getDirectoryHandle(ANA_KLASOR, { create: false });
  } catch {
    return [];                                  // ana klasör henüz oluşmamış
  }

  const bulunan = new Set();
  try {
    for await (const [ad, tanit] of ana.entries()) {
      if (tanit.kind === "directory" && /^\d{4}-\d{2} /.test(ad)) bulunan.add(ad);
    }
  } catch { /* gezilemedi; aşağıdaki deneme iş görür */ }

  if (!bulunan.size) {
    const simdi = new Date();
    for (let n = 0; n < GERIYE_BAK; n += 1) {
      const d = new Date(simdi.getFullYear(), simdi.getMonth() - n, 1);
      const aday = ayKlasorAdi(d.getFullYear(), d.getMonth() + 1);
      try {
        await ana.getDirectoryHandle(aday, { create: false });
        bulunan.add(aday);
      } catch { /* o ay yok */ }
    }
  }

  // "2026-09 ..." önekine göre yeniden eskiye
  return [...bulunan].sort((a, b) => b.slice(0, 7).localeCompare(a.slice(0, 7)) ||
                                     a.localeCompare(b));
}
