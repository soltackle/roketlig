/* Muayene zamanının çözülmesi.
 *
 * Muayene günü ile muayene saati aynı alandan gelmiyor:
 *
 * - HBYS'nin MUAYENE_BASLAMA_ZAMANI alanı çoğu kayıtta yalnızca saat taşıyor
 *   ("09:15"). Tek başına kullanılınca formda ve listede gün boş kalıyor,
 *   yerine saat iki kez yazılıyordu.
 * - Muayene günü aslında hastaya **son yapılan işlemin tarihidir**: hasta o
 *   gün gelmiş, işlemler o gün yapılmıştır. Bu tarih, işlem listesi
 *   okunduğunda kayda `sonIslemTarihi` olarak düşer.
 *
 * Bu yüzden gün ve saat ayrı ayrı çözülüp birleştirilir. Hiçbir kaynak
 * tarih vermiyorsa uydurulmaz: gün boş kalır.
 *
 * Kaynak sırası (gün): sonIslemTarihi → islemTarihi (ızgaradaki TARIHI) →
 * muayeneZamani (tarih taşıyorsa).
 * Kaynak sırası (saat): muayeneZamani → sonIslemZamani → islemTarihi.
 */

import { zamanaCevir, tarihGoster, saatGoster } from "./zaman.js";

const iki = (n) => String(n).padStart(2, "0");

/** Bir alan gerçekten gün bilgisi taşıyor mu? ("09:15" taşımaz) */
function gunTasiyorMu(ham) {
  if (ham === null || ham === undefined || ham === "") return false;
  return zamanaCevir(ham) !== null;
}

/** Muayene günü — "YYYY-MM-DD", bulunamazsa null. */
export function muayeneGunu(hasta) {
  for (const ham of [hasta?.sonIslemTarihi, hasta?.islemTarihi, hasta?.muayeneZamani]) {
    if (!gunTasiyorMu(ham)) continue;
    const d = zamanaCevir(ham);
    return `${d.getFullYear()}-${iki(d.getMonth() + 1)}-${iki(d.getDate())}`;
  }
  return null;
}

/** Muayene saati — "09:15", bulunamazsa boş. */
export function muayeneSaati(hasta) {
  for (const ham of [hasta?.muayeneZamani, hasta?.sonIslemZamani, hasta?.islemTarihi]) {
    const s = saatGoster(ham);
    if (s) return s;
  }
  return "";
}

/** Muayene günü — "11.09.2026", bulunamazsa boş. */
export function muayeneTarihiGoster(hasta) {
  const gun = muayeneGunu(hasta);
  return gun ? tarihGoster(gun) : "";
}

/** "11.09.2026 09:15" · gün yoksa yalnızca saat, ikisi de yoksa boş. */
export function muayeneGosterimi(hasta) {
  return [muayeneTarihiGoster(hasta), muayeneSaati(hasta)].filter(Boolean).join(" ");
}

/**
 * Dönüş süresi hesabı için tek bir zaman damgası.
 * Gün bir kaynaktan, saat başka kaynaktan gelmiş olabilir; ikisi burada
 * birleştirilir. Gün yoksa süre hesaplanamaz — null döner.
 */
export function muayeneZamaniCoz(hasta) {
  const gun = muayeneGunu(hasta);
  if (!gun) return null;
  const saat = muayeneSaati(hasta);
  return saat ? `${gun}T${saat}:00` : `${gun}T00:00:00`;
}

/**
 * İşlem listesindeki en yeni günü bulur — muayene günü budur.
 * @param {{tarih?: string}[]} satirlar
 * @returns {string|null} "YYYY-MM-DD"
 */
export function sonIslemGunu(satirlar) {
  let enYeni = null;
  for (const s of satirlar ?? []) {
    const d = zamanaCevir(s?.tarih ?? s?.kayitZamani);
    if (!d) continue;
    if (!enYeni || d > enYeni) enYeni = d;
  }
  if (!enYeni) return null;
  return `${enYeni.getFullYear()}-${iki(enYeni.getMonth() + 1)}-${iki(enYeni.getDate())}`;
}
