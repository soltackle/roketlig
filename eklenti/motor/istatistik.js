/* Anket kayıtlarından aylık istatistiğin hesaplanması.
 *
 * Kapsam dışı cevaplar (4/3 "Bilgi istemedim", 6/3 "Farkında değildim" ve
 * tetkik yapılmayan 7. soru) ortalamaya girmez; ayrıca sayılır. Bir sorunun
 * ortalaması yalnızca o soruyu puanlayanların üzerinden alınır ve payda
 * raporda görünür.
 */

import { SORULAR, GORUSME_SONUCLARI, puanlanirMi, kapsamDisiMi } from "./sorular.js";
import { saatFarki, zamanaCevir } from "./zaman.js";
import { muayeneZamaniCoz } from "./muayene.js";

const cevapAl = (kayit, no) => kayit.cevaplar?.[no] ?? kayit.cevaplar?.[String(no)] ?? null;

function bolum(pay, payda) {
  return payda > 0 ? pay / payda : null;
}

/** Sayıyı Türkçe biçimde yazar: 92,31 · 14.972 */
export function sayi(deger, basamak = 0) {
  if (deger === null || deger === undefined || Number.isNaN(deger)) return "—";
  return deger.toLocaleString("tr-TR", {
    minimumFractionDigits: basamak,
    maximumFractionDigits: basamak
  });
}

export const yuzde = (oran, basamak = 1) =>
  oran === null ? "—" : `%${sayi(oran * 100, basamak)}`;

/** Bir kırılım alanına göre grupların ortalamasını çıkarır. */
function kirilim(kayitlar, etiketle) {
  const gruplar = new Map();
  for (const k of kayitlar) {
    const etiket = etiketle(k);
    if (!etiket) continue;
    if (!gruplar.has(etiket)) gruplar.set(etiket, { etiket, adet: 0, toplam: 0, puanli: 0 });
    const g = gruplar.get(etiket);
    g.adet += 1;
    for (const soru of SORULAR) {
      const cevap = cevapAl(k, soru.no);
      if (!puanlanirMi(soru.no, cevap, k.tetkikYok, k.formSurum)) continue;
      g.toplam += cevap;
      g.puanli += 1;
    }
  }
  return [...gruplar.values()]
    .map((g) => ({ ...g, ortalama: bolum(g.toplam, g.puanli), az: g.adet < EN_AZ_ANKET }))
    .sort((a, b) => (b.ortalama ?? -1) - (a.ortalama ?? -1));
}

/** Bu sayının altındaki kırılım satırları güvenilir sayılmaz, işaretlenir. */
export const EN_AZ_ANKET = 5;

const GUNLER = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];

const SAAT_DILIMLERI = [
  { etiket: "08:00–10:00", bas: 8, bit: 10 },
  { etiket: "10:00–12:00", bas: 10, bit: 12 },
  { etiket: "12:00–14:00", bas: 12, bit: 14 },
  { etiket: "14:00–16:00", bas: 14, bit: 16 },
  { etiket: "16:00–18:00", bas: 16, bit: 18 }
];

/** "14:32" ya da zaman damgasından saati çıkarır. */
function saatiAl(kayit) {
  const m = /^(\d{1,2}):/.exec(String(kayit.saat ?? ""));
  if (m) return Number(m[1]);
  const d = zamanaCevir(kayit.zamanDamgasi);
  return d ? d.getHours() : null;
}

/** Arama ve ulaşma sayısını gruplayıp oranı hesaplayan ortak kalıp. */
function ulasmaKirilimi(kayitlar, etiketle) {
  const gruplar = new Map();
  for (const k of kayitlar) {
    const etiket = etiketle(k);
    if (etiket === null || etiket === undefined) continue;
    if (!gruplar.has(etiket)) gruplar.set(etiket, { etiket, arama: 0, ulasilan: 0 });
    const g = gruplar.get(etiket);
    g.arama += 1;
    if (k.gorusmeSonucu === "ulasildi") g.ulasilan += 1;
  }
  return [...gruplar.values()].map((g) => ({ ...g, oran: bolum(g.ulasilan, g.arama) }));
}

/** Bir kayıt kümesinin puanlanabilir cevap ortalaması. */
function ortalamaPuan(kayitlar) {
  let toplam = 0, adet = 0;
  for (const k of kayitlar) {
    for (const soru of SORULAR) {
      const cevap = cevapAl(k, soru.no);
      if (!puanlanirMi(soru.no, cevap, k.tetkikYok, k.formSurum)) continue;
      toplam += cevap;
      adet += 1;
    }
  }
  return { ortalama: bolum(toplam, adet), cevapAdedi: adet };
}

export function hesapla(hamKayitlar) {
  const kayitlar = [...hamKayitlar].sort((a, b) =>
    String(a.zamanDamgasi ?? "").localeCompare(String(b.zamanDamgasi ?? "")));

  const sonucAdlari = new Map(GORUSME_SONUCLARI.map((s) => [s.kod, s.etiket]));
  const anketli = kayitlar.filter((k) => k.gorusmeSonucu === "ulasildi");

  // --- görüşme sonuçları
  const sonucDagilimi = GORUSME_SONUCLARI.map((s) => ({
    kod: s.kod,
    etiket: s.etiket,
    adet: kayitlar.filter((k) => k.gorusmeSonucu === s.kod).length
  }));

  const arananlar = kayitlar.length;
  const ulasilanlar = anketli.length;

  // Kişi bazlı sayım: aynı hastayı üç kez aramak "üç kişi arandı" değildir.
  // Kurum hedefi (aylık hasta sayısının %1'i) kişi üzerinden hesaplandığı için
  // arama sayısı değil bu sayı esas alınır.
  const kimlik = (k) => String(k.hasta?.hastaId ?? k.anketId ?? "");
  const arananKisiler = new Set(kayitlar.map(kimlik).filter(Boolean));
  const ulasilanKisiler = new Set(anketli.map(kimlik).filter(Boolean));

  // Muayeneden anketi yapmaya kadar geçen süre
  const gecikmeler = anketli
    .map((k) => saatFarki(muayeneZamaniCoz(k.hasta), k.zamanDamgasi))
    .filter((s) => s !== null && s >= 0);
  const ortalamaDonus = gecikmeler.length
    ? gecikmeler.reduce((t, s) => t + s, 0) / gecikmeler.length
    : null;
  const siraliGecikme = [...gecikmeler].sort((a, b) => a - b);
  const ortancaDonus = siraliGecikme.length
    ? siraliGecikme[Math.floor(siraliGecikme.length / 2)]
    : null;
  const tamamlananlar = anketli.filter((k) =>
    SORULAR.some((s) => cevapAl(k, s.no) !== null)).length;

  // --- soru bazlı
  const sorular = SORULAR.map((soru) => {
    const dagilim = [0, 0, 0, 0, 0];
    let toplam = 0, puanli = 0, kapsamDisi = 0, bos = 0;

    for (const k of anketli) {
      const cevap = cevapAl(k, soru.no);
      if (cevap === null) {
        if (soru.no === 7 && k.tetkikYok) kapsamDisi += 1;
        else bos += 1;
        continue;
      }
      dagilim[cevap - 1] += 1;                    // PDF'te işaretli, dağılımda görünür
      if (puanlanirMi(soru.no, cevap, k.tetkikYok, k.formSurum)) {
        toplam += cevap;
        puanli += 1;
      } else if (kapsamDisiMi(soru.no, cevap, k.tetkikYok)) {
        kapsamDisi += 1;
      }
    }

    const ortalama = bolum(toplam, puanli);
    const dortBes = dagilim[3] + dagilim[4];
    return {
      no: soru.no,
      metin: soru.metin,
      secenekler: soru.secenekler,
      dagilim,
      toplam,
      puanli,
      kapsamDisi,
      bos,
      ortalama,
      memnuniyet: ortalama === null ? null : ortalama / 5,
      dortBesOrani: bolum(dortBes, puanli)
    };
  });

  const puanliToplam = sorular.reduce((t, s) => t + s.toplam, 0);
  const puanliAdet = sorular.reduce((t, s) => t + s.puanli, 0);
  const genelOrtalama = bolum(puanliToplam, puanliAdet);

  const dortBesToplam = sorular.reduce((t, s) => t + s.dagilim[3] + s.dagilim[4], 0);

  // --- DÖF: 2 ve altı puanlar
  const dof = [];
  for (const k of anketli) {
    for (const soru of SORULAR) {
      const cevap = cevapAl(k, soru.no);
      if (cevap === null || cevap > 2) continue;
      if (!puanlanirMi(soru.no, cevap, k.tetkikYok, k.formSurum)) continue;
      dof.push({
        tarih: k.tarihGosterim || k.tarih,
        adSoyad: k.hasta?.adSoyad ?? "—",
        poliklinik: k.hasta?.poliklinik ?? "—",
        hekim: k.hasta?.hekim ?? "—",
        soruNo: soru.no,
        soru: soru.metin,
        puan: cevap,
        secenek: soru.secenekler[cevap - 1],
        gorus: k.hastaGorusu || ""
      });
    }
  }
  dof.sort((a, b) => a.puan - b.puan || a.soruNo - b.soruNo);

  // --- serbest görüşler
  const gorusler = anketli
    .filter((k) => k.hastaGorusu && k.hastaGorusu.trim())
    .map((k) => ({
      tarih: k.tarihGosterim || k.tarih,
      adSoyad: k.hasta?.adSoyad ?? "—",
      poliklinik: k.hasta?.poliklinik ?? "—",
      gorus: k.hastaGorusu.trim()
    }));

  // --- tekrar aranacaklar
  const tekrarAranacaklar = kayitlar
    .filter((k) => k.gorusmeSonucu === "acmadi")
    .map((k) => ({
      tarih: k.tarihGosterim || k.tarih,
      adSoyad: k.hasta?.adSoyad ?? "—",
      telefon: k.hasta?.telefon ?? "—",
      poliklinik: k.hasta?.poliklinik ?? "—",
      sonuc: sonucAdlari.get(k.gorusmeSonucu) ?? k.gorusmeSonucu
    }));

  // --- Zaman: hangi saatte, hangi gün arandığında ulaşılıyor
  const saatDilimleri = SAAT_DILIMLERI.map((d) => {
    const icinde = kayitlar.filter((k) => {
      const s = saatiAl(k);
      return s !== null && s >= d.bas && s < d.bit;
    });
    const ulasilan = icinde.filter((k) => k.gorusmeSonucu === "ulasildi").length;
    return { etiket: d.etiket, arama: icinde.length, ulasilan,
             oran: bolum(ulasilan, icinde.length) };
  });
  const dilimDisi = kayitlar.filter((k) => {
    const s = saatiAl(k);
    return s === null || s < 8 || s >= 18;
  });
  if (dilimDisi.length) {
    const ulasilan = dilimDisi.filter((k) => k.gorusmeSonucu === "ulasildi").length;
    saatDilimleri.push({ etiket: "Diğer saatler", arama: dilimDisi.length, ulasilan,
                         oran: bolum(ulasilan, dilimDisi.length) });
  }

  const gunler = ulasmaKirilimi(kayitlar, (k) => {
    const d = zamanaCevir(k.zamanDamgasi);
    return d ? GUNLER[d.getDay()] : null;
  }).sort((a, b) => GUNLER.indexOf(a.etiket) - GUNLER.indexOf(b.etiket));

  // --- Tekrar aramanın getirisi: kaçıncı denemede ulaşıldı
  const hastaAramalari = new Map();
  for (const k of [...kayitlar].sort((a, b) =>
      String(a.zamanDamgasi ?? "").localeCompare(String(b.zamanDamgasi ?? "")))) {
    const id = kimlik(k);
    if (!id) continue;
    if (!hastaAramalari.has(id)) hastaAramalari.set(id, []);
    hastaAramalari.get(id).push(k);
  }
  const denemeler = [];
  for (const [, aramalar] of hastaAramalari) {
    const sira = aramalar.findIndex((k) => k.gorusmeSonucu === "ulasildi");
    denemeler.push({ deneme: aramalar.length, ulasilanSira: sira < 0 ? null : sira + 1 });
  }
  const enFazlaDeneme = denemeler.reduce((m, d) => Math.max(m, d.deneme), 0);
  const tekrarArama = [];
  let birikenUlasilan = 0;
  for (let n = 1; n <= Math.max(1, enFazlaDeneme); n += 1) {
    const buAdimda = denemeler.filter((d) => d.ulasilanSira === n).length;
    birikenUlasilan += buAdimda;
    tekrarArama.push({
      deneme: n,
      buAdimda,
      biriken: birikenUlasilan,
      birikenOran: bolum(birikenUlasilan, denemeler.length)
    });
  }

  // --- Ay içinde anketlerin günlere dağılımı
  const gunSayaci = new Map();
  for (const k of kayitlar) {
    const d = zamanaCevir(k.zamanDamgasi);
    if (!d) continue;
    const gun = d.getDate();
    gunSayaci.set(gun, (gunSayaci.get(gun) ?? 0) + 1);
  }
  const ayIciDagilim = [...gunSayaci.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([gun, adet]) => ({ gun, adet }));

  // --- Poliklinik x soru: sorun hangi birimde, hangi başlıkta
  const poliklinikler = [...new Set(anketli.map((k) => k.hasta?.poliklinik).filter(Boolean))];
  const poliklinikSoruMatrisi = poliklinikler.map((ad) => {
    const grubu = anketli.filter((k) => k.hasta?.poliklinik === ad);
    return {
      etiket: ad,
      adet: grubu.length,
      az: grubu.length < EN_AZ_ANKET,
      sorular: SORULAR.map((soru) => {
        let toplam = 0, puanli = 0;
        for (const k of grubu) {
          const cevap = cevapAl(k, soru.no);
          if (!puanlanirMi(soru.no, cevap, k.tetkikYok, k.formSurum)) continue;
          toplam += cevap;
          puanli += 1;
        }
        return { no: soru.no, ortalama: bolum(toplam, puanli), puanli };
      })
    };
  }).sort((a, b) => b.adet - a.adet);

  // --- Telefon numarası hatalı çıkanlar hangi birimden geliyor
  const numaraHatali = ulasmaKirilimi(
    kayitlar.filter((k) => k.gorusmeSonucu === "numara_hatali"),
    (k) => k.hasta?.poliklinik ?? "Belirtilmemiş"
  ).map(({ etiket, arama }) => ({ etiket, adet: arama }))
   .sort((a, b) => b.adet - a.adet);

  // --- Anketi uygulayan: iş yükü ve ulaşma oranı
  const uygulayanlar = ulasmaKirilimi(kayitlar, (k) => k.uygulayan || "Belirtilmemiş")
    .sort((a, b) => b.arama - a.arama);

  // --- Dönüş süresi ile memnuniyet ilişkisi
  const DONUS_ARALIKLARI = [
    { etiket: "Aynı gün – 1 gün", enAz: 0, enCok: 24 },
    { etiket: "2–3 gün", enAz: 24, enCok: 72 },
    { etiket: "4–7 gün", enAz: 72, enCok: 168 },
    { etiket: "8 gün ve üstü", enAz: 168, enCok: Infinity }
  ];
  const donusMemnuniyet = DONUS_ARALIKLARI.map((a) => {
    const grubu = anketli.filter((k) => {
      const s = saatFarki(muayeneZamaniCoz(k.hasta), k.zamanDamgasi);
      return s !== null && s >= 0 && s >= a.enAz && s < a.enCok;
    });
    const { ortalama } = ortalamaPuan(grubu);
    return { etiket: a.etiket, adet: grubu.length, ortalama, az: grubu.length < EN_AZ_ANKET };
  });

  // --- Net memnuniyet: 4-5 verenler eksi 1-2 verenler
  const birIki = sorular.reduce((t, s) => t + s.dagilim[0] + s.dagilim[1], 0);
  const netMemnuniyet = puanliAdet
    ? bolum(dortBesToplam, puanliAdet) - bolum(birIki, puanliAdet)
    : null;

  return {
    arananlar,
    ulasilanlar,
    tamamlananlar,
    arananKisi: arananKisiler.size,
    ulasilanKisi: ulasilanKisiler.size,
    kisiUlasilmaOrani: bolum(ulasilanKisiler.size, arananKisiler.size),
    ortalamaDonus,
    ortancaDonus,
    donusOlculen: gecikmeler.length,
    ulasilmaOrani: bolum(ulasilanlar, arananlar),
    tamamlanmaOrani: bolum(tamamlananlar, ulasilanlar),
    sonucDagilimi,
    sorular,
    genelOrtalama,
    genelMemnuniyet: genelOrtalama === null ? null : genelOrtalama / 5,
    genelDortBesOrani: bolum(dortBesToplam, puanliAdet),
    puanliCevapAdedi: puanliAdet,
    kapsamDisiAdedi: sorular.reduce((t, s) => t + s.kapsamDisi, 0),
    kirilimlar: {
      poliklinik: kirilim(anketli, (k) => k.hasta?.poliklinik),
      hekim: kirilim(anketli, (k) => k.hasta?.hekim),
      katilimciTuru: kirilim(anketli, (k) => k.katilimci?.tur),
      cinsiyet: kirilim(anketli, (k) => k.katilimci?.cinsiyet),
      yasGrubu: kirilim(anketli, (k) => k.katilimci?.yasGrubu),
      egitim: kirilim(anketli, (k) => k.katilimci?.egitim)
    },
    dof,
    gorusler,
    tekrarAranacaklar,
    netMemnuniyet,
    birIkiOrani: puanliAdet ? bolum(birIki, puanliAdet) : null,
    saatDilimleri,
    gunler,
    tekrarArama,
    denemeSayisi: denemeler.length,
    ayIciDagilim,
    poliklinikSoruMatrisi,
    numaraHatali,
    uygulayanlar,
    donusMemnuniyet
  };
}

/** İki dönemi karşılaştırır; önceki ay yoksa null döner. */
export function karsilastir(buAy, oncekiAy) {
  if (!oncekiAy) return null;
  const fark = (a, b) => (a === null || b === null ? null : a - b);
  return {
    arananlar: buAy.arananlar - oncekiAy.arananlar,
    ulasilanlar: buAy.ulasilanlar - oncekiAy.ulasilanlar,
    ulasilmaOrani: fark(buAy.ulasilmaOrani, oncekiAy.ulasilmaOrani),
    genelOrtalama: fark(buAy.genelOrtalama, oncekiAy.genelOrtalama),
    genelDortBesOrani: fark(buAy.genelDortBesOrani, oncekiAy.genelDortBesOrani),
    sorular: buAy.sorular.map((s) => {
      const o = oncekiAy.sorular.find((x) => x.no === s.no);
      return { no: s.no, fark: o ? fark(s.ortalama, o.ortalama) : null };
    })
  };
}
