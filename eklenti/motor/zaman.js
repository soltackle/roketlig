/* Tarih ve saat biçimleme.
 *
 * HBYS bu alanları tek biçimde vermiyor: kimi zaman ISO metni, kimi zaman
 * "11.09.2026 09:15" gibi hazır biçim, kimi zaman Date nesnesi. Tanıyamadığını
 * uydurmak yerine olduğu gibi bırakırız — raporda "—" görmek, yanlış tarih
 * görmekten iyidir.
 */

const iki = (n) => String(n).padStart(2, "0");

const HAZIR_TARIH = /^(\d{2})\.(\d{2})\.(\d{4})/;
const HAZIR_SAAT = /(\d{2}):(\d{2})/;

/** Girdiyi Date'e çevirmeye çalışır; beceremezse null. */
export function zamanaCevir(ham) {
  if (ham === null || ham === undefined || ham === "") return null;
  if (ham instanceof Date) return Number.isNaN(ham.getTime()) ? null : ham;

  const metin = String(ham).trim();
  const t = HAZIR_TARIH.exec(metin);
  if (t) {
    const s = HAZIR_SAAT.exec(metin.slice(t[0].length));
    const d = new Date(Number(t[3]), Number(t[2]) - 1, Number(t[1]),
                       s ? Number(s[1]) : 0, s ? Number(s[2]) : 0);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(metin);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "11.09.2026" — çevrilemezse ham değeri bozmadan döndürür. */
export function tarihGoster(ham) {
  if (ham === null || ham === undefined || ham === "") return "";
  const d = zamanaCevir(ham);
  if (!d) return String(ham);
  return `${iki(d.getDate())}.${iki(d.getMonth() + 1)}.${d.getFullYear()}`;
}

/** "09:15" — saat bilgisi yoksa boş. */
export function saatGoster(ham) {
  if (ham === null || ham === undefined || ham === "") return "";
  const d = zamanaCevir(ham);
  if (!d) {
    const s = HAZIR_SAAT.exec(String(ham));
    return s ? `${s[1]}:${s[2]}` : "";
  }
  // Yalnızca tarih gelmişse gece yarısını saat diye göstermeyelim
  if (d.getHours() === 0 && d.getMinutes() === 0 && !HAZIR_SAAT.test(String(ham))) return "";
  return `${iki(d.getHours())}:${iki(d.getMinutes())}`;
}

/** "11.09.2026 09:15" ya da saat yoksa yalnızca tarih. */
export function zamanGoster(ham) {
  const tarih = tarihGoster(ham);
  const saat = saatGoster(ham);
  return saat ? `${tarih} ${saat}` : tarih;
}

/** İki zaman arasındaki saat farkı; hesaplanamıyorsa null. */
export function saatFarki(baslangic, bitis) {
  const a = zamanaCevir(baslangic);
  const b = zamanaCevir(bitis);
  if (!a || !b) return null;
  return (b.getTime() - a.getTime()) / 3600000;
}

/** Saat cinsinden süreyi okunur yazar: "2 gün 5 saat", "18 saat", "40 dakika". */
export function sureGoster(saat) {
  if (saat === null || saat === undefined || Number.isNaN(saat)) return "—";
  const toplam = Math.abs(saat);
  if (toplam < 1) return `${Math.round(toplam * 60)} dakika`;
  if (toplam < 24) {
    const s = Math.floor(toplam);
    const dk = Math.round((toplam - s) * 60);
    return dk ? `${s} saat ${dk} dakika` : `${s} saat`;
  }
  const gun = Math.floor(toplam / 24);
  const s = Math.round(toplam - gun * 24);
  return s ? `${gun} gün ${s} saat` : `${gun} gün`;
}
