/* Anket kayıtlarından aylık istatistiğin hesaplanması.
 *
 * Kapsam dışı cevaplar (4/3 "Bilgi istemedim", 6/3 "Farkında değildim" ve
 * tetkik yapılmayan 7. soru) ortalamaya girmez; ayrıca sayılır. Bir sorunun
 * ortalaması yalnızca o soruyu puanlayanların üzerinden alınır ve payda
 * raporda görünür.
 */

import { SORULAR, GORUSME_SONUCLARI, puanlanirMi, kapsamDisiMi } from "./sorular.js";

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
    .map((g) => ({ ...g, ortalama: bolum(g.toplam, g.puanli) }))
    .sort((a, b) => (b.ortalama ?? -1) - (a.ortalama ?? -1));
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

  return {
    arananlar,
    ulasilanlar,
    tamamlananlar,
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
    tekrarAranacaklar
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
