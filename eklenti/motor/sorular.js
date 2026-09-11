/* HHD.FR.19 formunun soru ve seçenek tanımları ile puanlama kuralları.
 *
 * Puanlama kuralı form sürümüne bağlı. Form revize edilip "Bilgi istemedim"
 * gibi seçenekler düzeltilirse yeni bir sürüm eklenir; eski kayıtlar kendi
 * sürümlerinin kurallarıyla hesaplanmaya devam eder.
 */

export const FORM_SURUM = "HHD.FR.19 Rev.01";

export const SORULAR = [
  {
    no: 1,
    metin: "Hasta kayıt işlemleri için çok beklediniz mi?",
    olcek: '1 "çok fazla bekledim", 5 "hiç beklemedim"',
    secenekler: ["Çok fazla bekledim", "Biraz bekledim", "Normal bir süre bekledim",
                 "Beklemedim", "Hiç beklemedim"]
  },
  {
    no: 2,
    metin: "Danışma ve yönlendirme hizmetleri iyi miydi?",
    olcek: '1 "çok kötüydü", 5 "çok iyiydi"',
    secenekler: ["Çok kötüydü", "Biraz kötüydü", "Normaldi", "İyiydi", "Çok iyiydi"]
  },
  {
    no: 3,
    metin: "Doktorunuzun size ayırdığı süreyi yeterli buluyor musunuz?",
    olcek: '"çok yetersiz" – "fazlasıyla yeterli"',
    secenekler: ["Çok yetersizdi", "Yetersizdi", "Normaldi", "Yeterliydi",
                 "Fazlasıyla yeterliydi"],
    // Şablonda ölçek "0 çok yetersiz" diye yazılmış ama seçenekler 1-5.
    sablonNotu: "Ölçek metni 0'dan başlıyor, seçenekler 1-5."
  },
  {
    no: 4,
    metin: "Sizi muayene eden doktor hastalığınız konusunda size yeterli bilgi verdi mi?",
    olcek: '1 "hiçbir bilgi vermedi", 5 "tam bilgi verdi"',
    secenekler: ["Hiç bilgi vermedi", "Biraz bilgi verdi", "Bilgi istemedim",
                 "Bilgi verdi", "Fazlasıyla bilgi verdi"],
    kapsamDisiSecenek: 3   // memnuniyet değil, "fikrim yok"
  },
  {
    no: 5,
    metin: "Hastanenin genel olarak temizliği iyi miydi?",
    olcek: '1 "çok kötüydü", 5 "çok iyiydi"',
    secenekler: ["Çok kötüydü", "Kötüydü", "Normaldi", "İyiydi", "Çok iyiydi"]
  },
  {
    no: 6,
    metin: "Muayene edilirken kişisel mahremiyetinize özen gösterildi mi?",
    olcek: '1 "hiç gösterilmedi", 5 "çok dikkat edildi"',
    secenekler: ["Hiç özen gösterilmedi", "Özen gösterilmedi",
                 "Farkında değildim, bilmiyorum, vb", "Özen gösterildi",
                 "Fazlasıyla özen gösterildi"],
    kapsamDisiSecenek: 3
  },
  {
    no: 7,
    metin: "Tahlil ya da tetkik yaptırdıysanız sonuçlarını size belirtilen sürede alabildiniz mi?",
    olcek: '1 "çok bekledim", 5 "hiç beklemedim"',
    secenekler: ["Çok fazla bekledim", "Biraz bekledim", "Normal bir süre bekledim",
                 "Beklemedim", "Hiç beklemedim"],
    kosullu: true,         // "tetkik yaptırmadım" seçeneği formda yok
    kosulEtiketi: "Tetkik yaptırmadı"
  },
  {
    no: 8,
    metin: "Gittiğiniz hastanenin hizmet kalitesi sizce iyi miydi?",
    olcek: '1 "çok kötüydü", 5 "çok iyiydi"',
    secenekler: ["Çok kötüydü", "Kötüydü", "Normaldi", "İyiydi", "Çok iyiydi"],
    sablonNotu: 'Ölçek metninde 5 için "iyiydi" yazıyor, seçenek "Çok iyiydi".'
  }
];

export const GORUSME_SONUCLARI = [
  { kod: "ulasildi",      etiket: "Ulaşıldı",             anketVar: true  },
  { kod: "acmadi",        etiket: "Açmadı",               anketVar: false },
  { kod: "numara_hatali", etiket: "Numara hatalı",        anketVar: false },
  { kod: "istemedi",      etiket: "Görüşmeyi istemedi",   anketVar: false }
];

export const KATILIMCI_TURLERI = ["Hasta", "Hasta yakını"];
export const CINSIYETLER = ["Kadın", "Erkek"];
export const YAS_GRUPLARI = ["20 altı", "20-29", "30-39", "40-49", "50-59", "60 üstü"];
export const EGITIM_DURUMLARI = ["Okuryazar değil", "Okuryazar", "İlkokul", "Ortaokul",
                                 "Lise", "Üniversite", "Yüksek Lisans", "Doktora"];

/** Yaşı formun yaş grubu kutularına eşler. */
export function yasGrubu(yas) {
  if (!Number.isFinite(yas)) return null;
  if (yas < 20) return "20 altı";
  if (yas < 30) return "20-29";
  if (yas < 40) return "30-39";
  if (yas < 50) return "40-49";
  if (yas < 60) return "50-59";
  return "60 üstü";
}

/**
 * Bir cevabın ortalamaya girip girmediğini söyler.
 * Kapsam dışı olanlar PDF'te işaretlenir ama ortalamaya katılmaz.
 */
export function puanlanirMi(soruNo, cevap, tetkikYok, formSurum = FORM_SURUM) {
  if (formSurum !== FORM_SURUM) {
    // İleride başka sürüm eklenirse buraya dallanacak.
    // Bilinmeyen sürümü sessizce bugünün kuralıyla hesaplamak yanlış olur.
    throw new Error(`Bilinmeyen form sürümü: ${formSurum}`);
  }
  if (cevap === null || cevap === undefined) return false;
  if (soruNo === 7 && tetkikYok) return false;
  const soru = SORULAR.find((s) => s.no === soruNo);
  if (!soru) return false;
  return soru.kapsamDisiSecenek !== cevap;
}

/** Kapsam dışı mı, yoksa hiç cevaplanmamış mı — raporda ayrı sayılırlar. */
export function kapsamDisiMi(soruNo, cevap, tetkikYok) {
  if (soruNo === 7 && tetkikYok) return true;
  const soru = SORULAR.find((s) => s.no === soruNo);
  return Boolean(soru && cevap !== null && soru.kapsamDisiSecenek === cevap);
}
