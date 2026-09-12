/* Yan panel: anketin doldurulduğu, önizlendiği ve kaydedildiği yer.
 *
 * HBYS ile doğrudan konuşmaz; köprü içerik betiği üzerinden haberleşir.
 */

import {
  SORULAR, GORUSME_SONUCLARI, KATILIMCI_TURLERI, CINSIYETLER,
  YAS_GRUPLARI, EGITIM_DURUMLARI, FORM_SURUM, yasGrubu, kapsamDisiMi
} from "../motor/sorular.js";
import { anketiIsaretle } from "../motor/pdf.js";
import * as kayitDeposu from "../motor/kayit.js";
import { raporUret, oncekiAyKlasoru, donemEtiketi } from "../motor/rapor.js";
import { listeHtml, listeCsv } from "../motor/liste.js";
import { tarihGoster, zamanGoster } from "../motor/zaman.js";

const $ = (id) => document.getElementById(id);
const iki = (n) => String(n).padStart(2, "0");

// ── Durum ──────────────────────────────────────────────────

const bosTaslak = () => ({
  gorusmeSonucu: null,
  hasta: { hastaId: null, adSoyad: "", tcKimlikNo: "", telefon: "", poliklinik: "",
           hekim: "", islemTarihi: null, muayeneZamani: null, poliklinikOneri: false },
  katilimci: { tur: null, cinsiyet: null, yasGrubu: null, egitim: null },
  cevaplar: {},
  tetkikYok: false,
  hastaGorusu: ""
});

let taslak = bosTaslak();
let hbysHastasi = null;
let etkinSoru = 1;
let uygulayan = "";
let onizlemeUrl = null;
let hedefOran = 1;                 // aylık hasta sayısının aranacak yüzdesi
let dogrudanIslem = false;         // işlemleri HBYS'ye sorarak getir (varsayılan kapalı)

// ── Yardımcılar ────────────────────────────────────────────

function uyar(tur, baslik, metin) {
  const kutu = document.createElement("div");
  kutu.className = `uyari-kutu ${tur}`;
  kutu.innerHTML = `<strong></strong><span></span>`;
  kutu.querySelector("strong").textContent = baslik;
  kutu.querySelector("span").textContent = metin;
  $("uyariAlani").replaceChildren(kutu);
  return kutu;
}

const uyarilariTemizle = () => $("uyariAlani").replaceChildren();

function rozet(el, metin, sinif) {
  el.textContent = metin;
  el.className = `rozet${sinif ? ` ${sinif}` : ""}`;
}

/** Seçim düğmelerinden oluşan bir grup kurar. */
function secimGrubuKur(kap, secenekler, seciliDeger, secildi) {
  kap.replaceChildren(...secenekler.map((s) => {
    const d = document.createElement("button");
    d.type = "button";
    d.className = "secim";
    d.textContent = s;
    d.setAttribute("aria-pressed", String(s === seciliDeger));
    d.addEventListener("click", () => secildi(s === seciliDeger ? null : s));
    return d;
  }));
}

// ── Sorular ────────────────────────────────────────────────

function sorulariKur() {
  const kap = $("sorular");
  kap.replaceChildren(...SORULAR.map((soru) => {
    const kutu = document.createElement("div");
    kutu.className = "soru";
    kutu.dataset.no = soru.no;

    const ust = document.createElement("div");
    ust.className = "soru-ust";
    ust.innerHTML = `<span class="soru-no">${soru.no}</span><span class="soru-metin"></span>`;
    ust.querySelector(".soru-metin").textContent = soru.metin;
    kutu.append(ust);

    const puanlar = document.createElement("div");
    puanlar.className = "puanlar";
    for (let p = 1; p <= 5; p += 1) {
      const d = document.createElement("button");
      d.type = "button";
      d.className = `puan${soru.kapsamDisiSecenek === p ? " kapsam" : ""}`;
      d.textContent = p;
      d.title = soru.secenekler[p - 1];
      d.addEventListener("click", () => cevapla(soru.no, p));
      puanlar.append(d);
    }
    kutu.append(puanlar);

    const ad = document.createElement("div");
    ad.className = "secenek-adi";
    kutu.append(ad);

    if (soru.kosullu) {
      const satir = document.createElement("div");
      satir.className = "tetkik-satir";
      const d = document.createElement("button");
      d.type = "button";
      d.className = "secim";
      d.id = "btnTetkikYok";
      d.textContent = soru.kosulEtiketi;
      d.addEventListener("click", () => {
        taslak.tetkikYok = !taslak.tetkikYok;
        if (taslak.tetkikYok) delete taslak.cevaplar[soru.no];
        ciz();
        taslagiKaydet();
      });
      satir.append(d);
      kutu.append(satir);
    }

    kutu.addEventListener("click", () => { etkinSoru = soru.no; ciz(); });
    return kutu;
  }));
}

function cevapla(no, puan) {
  const soru = SORULAR.find((s) => s.no === no);
  if (taslak.cevaplar[no] === puan) {
    delete taslak.cevaplar[no];
  } else {
    taslak.cevaplar[no] = puan;
    if (soru.kosullu) taslak.tetkikYok = false;
    const sonraki = SORULAR.find((s) => s.no > no && taslak.cevaplar[s.no] === undefined);
    etkinSoru = sonraki ? sonraki.no : no;
  }
  ciz();
  taslagiKaydet();
}

// ── Çizim ──────────────────────────────────────────────────

function ciz() {
  // Hasta kartı
  const kart = $("hastaKart");
  if (hbysHastasi?.adSoyad) {
    kart.className = "hasta-kart";
    const satir = (etiket, deger) =>
      deger ? `<dt>${etiket}</dt><dd>${deger.toString().replace(/[<&]/g, "")}</dd>` : "";
    kart.innerHTML =
      `<div class="ad"></div><dl>${
        satir("Yaş", hbysHastasi.yas) + satir("Cinsiyet", hbysHastasi.cinsiyet) +
        satir("Telefon", hbysHastasi.telefon) + satir("Hekim", hbysHastasi.hekim) +
        satir("Muayene", zamanGoster(hbysHastasi.muayeneZamani ?? hbysHastasi.islemTarihi)) +
        satir("İşlem", hbysHastasi.islemDurumu)}</dl>`;
    kart.querySelector(".ad").textContent = hbysHastasi.adSoyad;
  } else if (!kart.classList.contains("bos")) {
    kart.className = "hasta-kart bos";
    kart.innerHTML = '<p class="ipucu">HBYS\'de bir hasta seçin ya da rastgele hasta önertin.</p>';
  }

  $("notPoliklinik").classList.toggle("gizli", !taslak.hasta.poliklinikOneri);

  // Görüşme sonucu
  secimGrubuKur($("sonucSecim"), GORUSME_SONUCLARI.map((s) => s.etiket),
    GORUSME_SONUCLARI.find((s) => s.kod === taslak.gorusmeSonucu)?.etiket ?? null,
    (etiket) => {
      taslak.gorusmeSonucu = GORUSME_SONUCLARI.find((s) => s.etiket === etiket)?.kod ?? null;
      ciz();
      taslagiKaydet();
    });

  const anketVar = GORUSME_SONUCLARI.find((s) => s.kod === taslak.gorusmeSonucu)?.anketVar;
  $("anketGovde").classList.toggle("gizli", !anketVar);
  $("btnOnizle").disabled = !anketVar;

  // Katılımcı
  secimGrubuKur($("katilanSecim"), KATILIMCI_TURLERI, taslak.katilimci.tur, (s) => {
    taslak.katilimci.tur = s;
    // Formda "Cinsiyetiniz" diye soruluyor: telefonu hasta yakını açtıysa
    // HBYS'den gelen cinsiyet ve yaş artık görüşülen kişiyi tanımlamıyor.
    if (s === "Hasta yakını") {
      taslak.katilimci.cinsiyet = null;
      taslak.katilimci.yasGrubu = null;
    } else if (s === "Hasta") {
      hbysOnerileriniUygula();
    }
    ciz();
    taslagiKaydet();
  });
  $("yakinUyari").classList.toggle("gizli", taslak.katilimci.tur !== "Hasta yakını");

  const kur = (kapId, secenekler, anahtar) =>
    secimGrubuKur($(kapId), secenekler, taslak.katilimci[anahtar], (s) => {
      taslak.katilimci[anahtar] = s;
      ciz();
      taslagiKaydet();
    });
  kur("cinsiyetSecim", CINSIYETLER, "cinsiyet");
  kur("yasSecim", YAS_GRUPLARI, "yasGrubu");
  kur("egitimSecim", EGITIM_DURUMLARI, "egitim");

  // Sorular
  for (const kutu of $("sorular").children) {
    const no = Number(kutu.dataset.no);
    const soru = SORULAR.find((s) => s.no === no);
    const cevap = taslak.cevaplar[no] ?? null;
    const tetkikYok = soru.kosullu && taslak.tetkikYok;

    kutu.classList.toggle("etkin", no === etkinSoru);
    kutu.classList.toggle("cevapli", cevap !== null && !kapsamDisiMi(no, cevap, taslak.tetkikYok));
    kutu.classList.toggle("kapsam-disi", tetkikYok || kapsamDisiMi(no, cevap, taslak.tetkikYok));

    [...kutu.querySelectorAll(".puan")].forEach((d, n) =>
      d.setAttribute("aria-pressed", String(cevap === n + 1)));

    const tetkikDugme = kutu.querySelector("#btnTetkikYok");
    if (tetkikDugme) tetkikDugme.setAttribute("aria-pressed", String(taslak.tetkikYok));

    kutu.querySelector(".secenek-adi").textContent =
      tetkikYok ? `${soru.kosulEtiketi} — ortalamaya katılmaz`
      : cevap === null ? ""
      : kapsamDisiMi(no, cevap, taslak.tetkikYok)
        ? `${soru.secenekler[cevap - 1]} — ortalamaya katılmaz`
        : soru.secenekler[cevap - 1];
  }

  $("btnOnayla").disabled = !taslak.gorusmeSonucu || !taslak.hasta.adSoyad;
}

function hbysOnerileriniUygula() {
  if (!hbysHastasi || taslak.katilimci.tur === "Hasta yakını") return;
  if (!taslak.katilimci.cinsiyet && hbysHastasi.cinsiyet) {
    taslak.katilimci.cinsiyet = hbysHastasi.cinsiyet;
  }
  if (!taslak.katilimci.yasGrubu && Number.isFinite(hbysHastasi.yas)) {
    taslak.katilimci.yasGrubu = yasGrubu(hbysHastasi.yas);
  }
}

// ── HBYS ───────────────────────────────────────────────────

function hbysYolla(tip, veri) {
  chrome.tabs.query({ active: true, currentWindow: true }).then(([sekme]) => {
    if (!sekme) return;
    chrome.tabs.sendMessage(sekme.id, { kaynak: "panel", tip, veri }).catch(() => {
      rozet($("rozetHbys"), "HBYS yok", "kotu");
    });
  });
}

async function hastayiAl(hasta, kaynak = "hbys") {
  hbysHastasi = hasta;
  if (!hasta) {
    rozet($("rozetHbys"), "Hasta seçili değil", "uyari");
    return;
  }
  rozet($("rozetHbys"), kaynak === "rastgele" ? "Rastgele önerildi" : "HBYS bağlı", "iyi");

  taslak.hasta = {
    hastaId: hasta.hastaId,
    adSoyad: hasta.adSoyad ?? "",
    tcKimlikNo: hasta.tcKimlikNo ? String(hasta.tcKimlikNo).trim() : "",
    telefon: hasta.telefon ?? "",
    poliklinik: hasta.poliklinik ?? "",
    hekim: hasta.hekim ?? "",
    islemTarihi: hasta.islemTarihi ?? null,
    muayeneZamani: hasta.muayeneZamani ?? hasta.islemTarihi ?? null,
    poliklinikOneri: Boolean(hasta.poliklinik)
  };
  $("alanAd").value = taslak.hasta.adSoyad;
  $("alanTc").value = taslak.hasta.tcKimlikNo;
  $("alanTelefon").value = taslak.hasta.telefon;
  $("alanPoliklinik").value = taslak.hasta.poliklinik;
  $("alanHekim").value = taslak.hasta.hekim;

  if (!hasta.telefon) {
    uyar("hata", "Telefon numarası yok",
      "Bu hastanın kaydında cep ya da ev telefonu bulunmuyor. Numarayı elle girin.");
  } else {
    uyarilariTemizle();
  }

  hbysOnerileriniUygula();

  const varOlan = await kayitDeposu.ayIcindeVarMi(hasta.hastaId);
  if (varOlan) {
    uyar("uyari", "Bu hasta bu ay zaten arandı",
      `${varOlan.tarih} tarihinde kayıt var (${varOlan.gorusmeSonucu}). ` +
      "Yine de devam edebilirsiniz.");
  }

  await taslagiYukle(hasta.hastaId);
  ciz();
}

chrome.runtime.onMessage.addListener((m) => {
  if (m?.kaynak === "arkaplan" && m.tip === "kuyrugu-dene") { kuyrugaBak(); return; }
  if (m?.kaynak !== "hbys") return;

  if (m.tip === "hasta") { hastayiAl(m.veri); return; }
  if (m.tip === "hazir" || m.tip === "liste") {
    rozet($("rozetHbys"), "HBYS bağlı", "iyi");
    return;
  }
  if (m.tip === "islemler") { islemleriGoster(m.veri); return; }

  if (m.tip === "rastgele") {
    if (m.veri?.hasta) { hastayiAl(m.veri.hasta, "rastgele"); return; }
    uyar("uyari", "Rastgele hasta önerilemedi",
      m.veri?.hata === "liste-yanlis"
        ? 'HBYS\'de "İşlemi Bitenler" listesi seçili olmalı.'
        : "Listede telefonu olan uygun hasta bulunamadı.");
    return;
  }
  if (m.tip === "hata") {
    rozet($("rozetHbys"), "HBYS okunamadı", "kotu");
  }
});

// ── Taslak ─────────────────────────────────────────────────

const taslakAnahtari = (hastaId) => `taslak:${hastaId ?? "genel"}`;

let taslakZaman = null;
function taslagiKaydet() {
  clearTimeout(taslakZaman);
  taslakZaman = setTimeout(async () => {
    await chrome.storage.local.set({
      [taslakAnahtari(taslak.hasta.hastaId)]: { ...taslak, guncelleme: Date.now() }
    });
    const s = new Date();
    $("taslakNot").textContent =
      `Taslak kaydedildi · ${iki(s.getHours())}:${iki(s.getMinutes())}:${iki(s.getSeconds())}`;
  }, 300);
}

async function taslagiYukle(hastaId) {
  const anahtar = taslakAnahtari(hastaId);
  const kutu = await chrome.storage.local.get(anahtar);
  const kayitli = kutu[anahtar];
  if (!kayitli) return;
  taslak = {
    ...bosTaslak(), ...kayitli,
    hasta: { ...taslak.hasta, ...kayitli.hasta },
    katilimci: { ...bosTaslak().katilimci, ...kayitli.katilimci },
    cevaplar: { ...kayitli.cevaplar }
  };
  // Taslakta elle düzeltilmiş alanlar HBYS'den geleni ezmeli, tersi değil.
  $("alanAd").value = taslak.hasta.adSoyad ?? "";
  $("alanTc").value = taslak.hasta.tcKimlikNo ?? "";
  $("alanTelefon").value = taslak.hasta.telefon ?? "";
  $("alanPoliklinik").value = taslak.hasta.poliklinik ?? "";
  $("alanHekim").value = taslak.hasta.hekim ?? "";
  $("alanGorus").value = taslak.hastaGorusu ?? "";
  $("taslakNot").textContent = "Kayıtlı taslak yüklendi.";
}

async function taslagiSil() {
  await chrome.storage.local.remove(taslakAnahtari(taslak.hasta.hastaId));
  const hastaId = taslak.hasta.hastaId;
  taslak = bosTaslak();
  etkinSoru = 1;
  $("alanGorus").value = "";
  if (hbysHastasi) await hastayiAl(hbysHastasi);
  else taslak.hasta.hastaId = hastaId;
  ciz();
  $("taslakNot").textContent = "Taslak silindi.";
}

// ── Kayıt ──────────────────────────────────────────────────

function kayitKur() {
  const simdi = new Date();
  const gun = `${iki(simdi.getDate())}.${iki(simdi.getMonth() + 1)}.${simdi.getFullYear()}`;
  const cevaplar = {};
  for (const soru of SORULAR) {
    cevaplar[soru.no] = taslak.cevaplar[soru.no] ?? null;
  }
  const anketVar = GORUSME_SONUCLARI.find((s) => s.kod === taslak.gorusmeSonucu)?.anketVar;

  return {
    surum: 1,
    formSurum: FORM_SURUM,
    anketId: `${taslak.hasta.hastaId ?? "x"}-${simdi.getTime()}`,
    gorusmeSonucu: taslak.gorusmeSonucu,
    tarih: `${simdi.getFullYear()}-${iki(simdi.getMonth() + 1)}-${iki(simdi.getDate())}`,
    tarihGosterim: gun,
    saat: `${iki(simdi.getHours())}:${iki(simdi.getMinutes())}`,
    zamanDamgasi: simdi.toISOString(),
    uygulayan,
    hasta: {
      hastaId: taslak.hasta.hastaId,
      adSoyad: $("alanAd").value.trim(),
      tcKimlikNo: $("alanTc").value.replace(/\D/g, ""),
      telefon: $("alanTelefon").value.trim(),
      poliklinik: $("alanPoliklinik").value.trim(),
      hekim: $("alanHekim").value.trim(),
      islemTarihi: taslak.hasta.islemTarihi,
      muayeneZamani: taslak.hasta.muayeneZamani
    },
    katilimci: anketVar ? { ...taslak.katilimci } : { tur: null, cinsiyet: null, yasGrubu: null, egitim: null },
    cevaplar: anketVar ? cevaplar : {},
    tetkikYok: anketVar ? taslak.tetkikYok : false,
    hastaGorusu: anketVar ? $("alanGorus").value.trim() : "",
    dosyaTabani: kayitDeposu.anketDosyaAdi($("alanAd").value.trim(), simdi),
    pdfDosya: null,
    kilitli: true
  };
  // T.C. kimlik numarası kayda girmiyor; mükerrer denetimi hastaId ile yapılıyor.
}

async function onizle() {
  const kayit = kayitKur();
  kayit.pdfDosya = `${kayit.dosyaTabani}.pdf`;
  try {
    const bayt = await anketiIsaretle(kayit);
    if (onizlemeUrl) URL.revokeObjectURL(onizlemeUrl);
    onizlemeUrl = URL.createObjectURL(new Blob([bayt], { type: "application/pdf" }));
    $("onizlemeCerceve").src = onizlemeUrl;
    $("onizleme").classList.remove("gizli");
  } catch (e) {
    uyar("hata", "Önizleme üretilemedi", String(e.message ?? e));
  }
}

async function onayla() {
  const kayit = kayitKur();
  if (!kayit.hasta.adSoyad) {
    uyar("hata", "Ad soyad boş", "Kayıt için hastanın adı gerekli.");
    return;
  }
  const anketVar = GORUSME_SONUCLARI.find((s) => s.kod === kayit.gorusmeSonucu)?.anketVar;
  const cevapli = Object.values(kayit.cevaplar).filter((c) => c !== null).length;
  if (anketVar && cevapli === 0 &&
      !confirm("Hiçbir soru cevaplanmadı. Yine de kaydedilsin mi?")) return;

  $("btnOnayla").disabled = true;
  try {
    let pdfBaytlari = null;
    if (anketVar) {
      kayit.pdfDosya = `${kayit.dosyaTabani}.pdf`;
      pdfBaytlari = await anketiIsaretle(kayit);
    }
    const sonuc = await kayitDeposu.anketiKaydet(kayit, pdfBaytlari);

    if (sonuc.yazildi) {
      uyar("basari", "Kaydedildi",
        `${kayit.dosyaTabani} · ${sonuc.klasor}${anketVar ? "" : " (ulaşılamadı, PDF yok)"}`);
    } else {
      uyar("uyari", "Klasöre şimdi yazılamadı",
        "Anket eklentide bekliyor, bağlantı gelince yazılacak. " +
        `Neden: ${sonuc.neden}`);
    }
    await chrome.storage.local.remove(taslakAnahtari(taslak.hasta.hastaId));
    taslak = bosTaslak();
    etkinSoru = 1;
    $("alanGorus").value = "";
    hbysHastasi = null;
    ciz();
    await durumuTazele();
  } catch (e) {
    uyar("hata", "Kaydedilemedi", String(e.message ?? e));
  } finally {
    $("btnOnayla").disabled = false;
  }
}

// ── Klasör ve kuyruk ───────────────────────────────────────

async function klasorSecdir() {
  try {
    await kayitDeposu.klasorSec();
    await durumuTazele();
    await kuyrugaBak();
  } catch (e) {
    if (e?.name !== "AbortError") uyar("hata", "Klasör seçilemedi", String(e.message ?? e));
  }
}

// ── Ay hedefi ──────────────────────────────────────────────

const hedefAnahtari = (ay) => `hedef:${String(ay).slice(0, 7)}`;

async function gelenHastaOku(ay) {
  const anahtar = hedefAnahtari(ay);
  const kutu = await chrome.storage.local.get(anahtar);
  const deger = kutu[anahtar];
  return Number.isFinite(deger) ? deger : null;
}

const arananHedefi = (gelenHasta) =>
  gelenHasta ? Math.ceil((gelenHasta * hedefOran) / 100) : null;

/** Üst çubuktaki "Bu ay" rozeti: kaç kişi arandı, hedef neyse ona göre. */
async function ayRozetiniTazele() {
  const ay = kayitDeposu.buAyinKlasoru();
  const ozet = await kayitDeposu.ayOzeti(ay);
  const gereken = arananHedefi(await gelenHastaOku(ay));

  const el = $("rozetAy");
  if (!ozet.okundu) {
    rozet(el, "Bu ay: —", null);
    el.title = "Ay klasörü okunamadı";
    return;
  }
  if (gereken) {
    rozet(el, `Bu ay: ${ozet.aranan}/${gereken} kişi`,
          ozet.aranan >= gereken ? "iyi" : "uyari");
    el.title = `${ozet.aranan} kişi arandı, ${ozet.ulasilan} kişiye ulaşıldı · ` +
               `hedef ${gereken} kişi (aylık hastanın %${hedefOran}'i)`;
  } else {
    rozet(el, `Bu ay: ${ozet.aranan} kişi`, null);
    el.title = `${ozet.aranan} kişi arandı, ${ozet.ulasilan} kişiye ulaşıldı · ` +
               "hedef için Rapor sekmesine gelen hasta sayısını girin";
  }
}

/** Rapor sekmesindeki hedef kutusu ve altındaki açıklama. */
async function hedefKutusunuTazele() {
  const ay = $("aySecim").value;
  const not = $("hedefNot");
  const kutu = $("alanGelenHasta");

  if (!ay) {
    kutu.value = "";
    kutu.disabled = true;
    not.textContent = "";
    return;
  }
  kutu.disabled = false;
  const gelenHasta = await gelenHastaOku(ay);
  kutu.value = gelenHasta ?? "";

  const gereken = arananHedefi(gelenHasta);
  if (!gereken) {
    not.textContent = `Girilirse bu sayının %${hedefOran}'i hedef olarak alınır ` +
                      "ve rapora yazılır.";
    return;
  }
  const ozet = await kayitDeposu.ayOzeti(ay);
  not.textContent =
    `Hedef ${gereken} kişi (%${hedefOran}). Bu ay ${ozet.aranan} kişi arandı, ` +
    `${ozet.ulasilan} kişiye ulaşıldı.` +
    (ozet.aranan >= gereken ? " Hedef tamamlandı." : ` ${gereken - ozet.aranan} kişi kaldı.`);
}

async function durumuTazele() {
  const durum = await kayitDeposu.izinDurumu();
  const el = $("rozetKlasor");
  if (durum === "verildi") rozet(el, "Klasör hazır", "iyi");
  else if (durum === "sorulmali") rozet(el, "Klasör izni bekliyor", "uyari");
  else rozet(el, "Klasör yok", "kotu");

  $("klasorDurum").textContent =
    durum === "verildi" ? "Klasör seçili ve yazma izni var."
    : durum === "sorulmali" ? "Klasör seçili ama tarayıcı yeniden açıldığı için izin tazelenmeli."
    : "Henüz bir klasör seçilmedi.";
  $("btnIzinIste").classList.toggle("gizli", durum !== "sorulmali");

  // Anket sekmesindeki uyarı: klasör olmadan kayıt yazılamaz, düğme elin altında dursun
  const uyariKutu = $("klasorUyari");
  uyariKutu.classList.toggle("gizli", durum === "verildi");
  if (durum === "yok") {
    $("klasorUyariBaslik").textContent = "Kayıt klasörü seçilmedi";
    $("klasorUyariMetin").textContent =
      "Anketler kaydedilemez. Anketlerin tutulacağı klasörü bir kez gösterin; " +
      "ay klasörlerini eklenti kendisi açar.";
    $("btnKlasorUyariEylem").textContent = "Ana klasörü seç";
    $("btnKlasorUyariEylem").onclick = klasorSecdir;
  } else if (durum === "sorulmali") {
    $("klasorUyariBaslik").textContent = "Klasör izni tazelenmeli";
    $("klasorUyariMetin").textContent =
      "Tarayıcı yeniden açıldığı için Chrome izni yeniden soruyor. Tek tık yeter.";
    $("btnKlasorUyariEylem").textContent = "İzni onayla";
    $("btnKlasorUyariEylem").onclick = async () => {
      if (await kayitDeposu.izinIste()) await kuyrugaBak();
      await durumuTazele();
    };
  }

  await ayRozetiniTazele();

  const bekleyen = await kayitDeposu.kuyrukSayisi();
  const kuyrukRozeti = $("rozetKuyruk");
  kuyrukRozeti.classList.toggle("gizli", bekleyen === 0);
  if (bekleyen) rozet(kuyrukRozeti, `${bekleyen} bekliyor`, "uyari");
  $("kuyrukDurum").textContent = bekleyen
    ? `${bekleyen} anket yazılmayı bekliyor.`
    : "Bekleyen kayıt yok.";

  await aylariYukle();
}

async function kuyrugaBak() {
  const sonuc = await kayitDeposu.kuyrugaBak();
  if (sonuc.yazilan) {
    uyar("basari", "Bekleyen kayıtlar yazıldı", `${sonuc.yazilan} anket klasöre alındı.`);
  }
  await durumuTazele();
}

// ── Rapor ──────────────────────────────────────────────────

async function aylariYukle() {
  const aylar = await kayitDeposu.aylariListele();
  const secim = $("aySecim");
  const oncekiSecim = secim.value;
  secim.replaceChildren(...aylar.map((a) => {
    const o = document.createElement("option");
    o.value = a;
    o.textContent = donemEtiketi(a);
    return o;
  }));
  if (!aylar.length) {
    const o = document.createElement("option");
    o.textContent = "Kayıtlı ay yok";
    o.value = "";
    secim.replaceChildren(o);
    // Boş liste iki ayrı şeyi gizleyebilir; hangisi olduğunu söyle.
    $("raporDurum").textContent = (await kayitDeposu.izinDurumu()) === "verildi"
      ? "Seçili klasörde ay klasörü bulunamadı. Henüz onaylanmış anket yoksa " +
        "normaldir; varsa Ayarlar'dan klasörü doğrulayın."
      : "Kayıt klasörü seçilmedi ya da izni tazelenmedi — Ayarlar sekmesine bakın.";
  } else if (aylar.includes(oncekiSecim)) {
    secim.value = oncekiSecim;
  }
  $("btnRapor").disabled = !aylar.length;
  await hedefKutusunuTazele();
}

async function raporCikar() {
  const ay = $("aySecim").value;
  if (!ay) return;
  const durum = $("raporDurum");
  durum.textContent = "Veri dosyaları okunuyor…";
  try {
    const { kayitlar, bozuk, eksik } = await kayitDeposu.ayKayitlariniOku(ay);
    let onceki = null;
    const oncekiAd = oncekiAyKlasoru(ay);
    if (oncekiAd) {
      try { onceki = (await kayitDeposu.ayKayitlariniOku(oncekiAd)).kayitlar; } catch { onceki = null; }
    }

    const gelenHasta = await gelenHastaOku(ay);
    const html = raporUret(ay, kayitlar, onceki,
                           gelenHasta ? { gelenHasta, oran: hedefOran } : null);
    const url = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
    await chrome.tabs.create({ url });

    durum.textContent = `${kayitlar.length} kayıttan rapor üretildi` +
      (bozuk.length ? ` · ${bozuk.length} dosya okunamadı: ${bozuk.join(", ")}` : "") +
      (eksik?.length ? ` · ${eksik.length} eski kayıt açılamadı (Türkçe adlı dosyalar)` : "") +
      (onceki ? ` · ${donemEtiketi(oncekiAd)} ile karşılaştırıldı` : " · karşılaştırma yok");
  } catch (e) {
    durum.textContent = `Rapor üretilemedi: ${e.message ?? e}`;
  }
}

// ── Son gelişte yapılan işlemler ───────────────────────────

/* Anketçi hastayı aramadan önce ne yapıldığına bakıyor; bu yüzden pencere
 * hasta kartından, görüşme başlamadan açılıyor. Veri yalnızca gösteriliyor:
 * sağlık bilgisi ne kayda ne PDF'e yazılıyor. */

function islemTablosu(satirlar) {
  if (!satirlar.length) return '<p class="bos">İşlem kaydı bulunamadı.</p>';
  const hucre = (d, sinif = "") =>
    `<td${sinif ? ` class="${sinif}"` : ""}>${String(d ?? "—").replace(/[<&]/g, "")}</td>`;
  const govde = satirlar.map((s) => `<tr>
    ${hucre(s.ad)}${hucre(s.dis || "—", "orta")}${hucre(s.hekim)}
  </tr>`).join("");
  return `<table><thead><tr>
    <th>İşlem</th><th class="orta">Diş</th><th>Hekim</th>
  </tr></thead><tbody>${govde}</tbody></table>`;
}

function islemleriGoster(veri) {
  const govde = $("islemlerGovde");
  const baslik = $("islemlerBaslik");

  const sorguDustu = veri && veri.sorguHatasi
    ? `Doğrudan sorgu çalışmadı (${veri.sorguHatasi}); ekranda açık olan liste ` +
      "kullanıldı. Ayarlardan kapatabilirsiniz."
    : null;

  if (!veri || !veri.yuklu) {
    baslik.textContent = "Yapılan işlemler";
    govde.innerHTML = '<p class="bos"></p>';
    govde.querySelector(".bos").textContent = sorguDustu
      ? `${sorguDustu} Ekranda da açık değil: hastayı Tedavi-Plan sekmesinde açın.`
      : "İşlem listesi HBYS'de açık değil. Hastayı Tedavi-Plan sekmesinde açıp " +
        "yeniden deneyin.";
    $("islemler").classList.remove("gizli");
    return;
  }

  // Doğrudan sorguda kayıtlar zaten istenen hastaya ait; ızgarada değilse
  // ekranda başka hasta açık olabilir.
  const secili = veri.kaynak === "sorgu" ? null : taslak.hasta.hastaId;
  if (secili && veri.hastaId && String(veri.hastaId) !== String(secili)) {
    baslik.textContent = "Yapılan işlemler";
    govde.innerHTML = '<p class="bos"></p>';
    govde.querySelector(".bos").textContent =
      "HBYS'de başka bir hastanın işlemleri açık. Anket yaptığınız hastayı " +
      "Tedavi-Plan sekmesinde açıp yeniden deneyin.";
    $("islemler").classList.remove("gizli");
    return;
  }

  // Tarihe göre grupla, en yeni gün başta
  const gruplar = new Map();
  for (const s of veri.satirlar) {
    const gun = tarihGoster(s.tarih) || "Tarihsiz";
    if (!gruplar.has(gun)) gruplar.set(gun, []);
    gruplar.get(gun).push(s);
  }
  const gunler = [...gruplar.keys()].sort((a, b) => {
    const p = (g) => g.split(".").reverse().join("");
    return p(b).localeCompare(p(a));
  });

  baslik.textContent = veri.basvuruyaGore
    ? "Son gelişinde yapılan işlemler"
    : "Yapılan işlemler (tüm gelişler)";

  govde.innerHTML = gunler.map((gun) =>
    `<div class="grup"><h4></h4>${islemTablosu(gruplar.get(gun))}</div>`).join("")
    || '<p class="bos">İşlem kaydı bulunamadı.</p>';
  govde.querySelectorAll(".grup h4").forEach((h, n) => {
    h.textContent = `${gunler[n]} · ${gruplar.get(gunler[n]).length} işlem`;
  });

  if (!veri.basvuruyaGore && veri.satirlar.length) {
    const not = document.createElement("p");
    not.className = "not";
    not.textContent =
      "Bu anketin ait olduğu başvuruya ait işlem ayırt edilemedi; hastanın " +
      "tüm işlemleri listelendi.";
    govde.append(not);
  }

  if (sorguDustu) {
    const not = document.createElement("p");
    not.className = "not uyari";
    not.textContent = sorguDustu;
    govde.prepend(not);
  } else if (veri.kaynak === "sorgu") {
    const not = document.createElement("p");
    not.className = "not";
    not.textContent = "HBYS'den doğrudan getirildi.";
    govde.append(not);
  }

  $("islemler").classList.remove("gizli");
}

function islemleriIste() {
  if (!taslak.hasta.hastaId) {
    uyar("uyari", "Hasta seçilmedi", "Önce HBYS'den bir hasta seçin.");
    return;
  }
  hbysYolla("islemler", {
    hastaId: taslak.hasta.hastaId,
    muracaatId: hbysHastasi?.muracaatId ?? null,
    dogrudan: dogrudanIslem
  });
}

// ── Anket listesi ──────────────────────────────────────────

/** Seçili ayın kayıtlarını okur; başaramazsa sebebini panele yazar. */
async function ayinKayitlari(durumEl) {
  const ay = $("aySecim").value;
  if (!ay) return null;
  durumEl.textContent = "Veri dosyaları okunuyor…";
  try {
    const { kayitlar, bozuk, eksik } = await kayitDeposu.ayKayitlariniOku(ay);
    return { ay, kayitlar, bozuk, eksik };
  } catch (e) {
    durumEl.textContent = `Okunamadı: ${e.message ?? e}`;
    return null;
  }
}

const listeNotu = (sonuc, ek = "") =>
  `${sonuc.kayitlar.length} kayıt${ek}` +
  (sonuc.bozuk.length ? ` · ${sonuc.bozuk.length} dosya okunamadı` : "") +
  (sonuc.eksik?.length ? ` · ${sonuc.eksik.length} eski kayıt açılamadı` : "");

async function listeyiAc() {
  const durum = $("listeDurum");
  const sonuc = await ayinKayitlari(durum);
  if (!sonuc) return;

  const sadece = $("cbSadeceUlasilan").checked;
  const html = listeHtml(donemEtiketi(sonuc.ay), sonuc.kayitlar, sadece);
  const url = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
  await chrome.tabs.create({ url });
  durum.textContent = listeNotu(sonuc, " listelendi");
}

async function listeyiIndir() {
  const durum = $("listeDurum");
  const sonuc = await ayinKayitlari(durum);
  if (!sonuc) return;

  const sadece = $("cbSadeceUlasilan").checked;
  const csv = listeCsv(sonuc.kayitlar, sadece);
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const bag = document.createElement("a");
  bag.href = url;
  bag.download = `${kayitDeposu.dosyaAdiTemizle(sonuc.ay)} anket listesi.csv`;
  document.body.append(bag);
  bag.click();
  bag.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
  durum.textContent = listeNotu(sonuc, " CSV olarak indirildi");
}

// ── Klavye ─────────────────────────────────────────────────

document.addEventListener("keydown", (e) => {
  if (e.ctrlKey || e.altKey || e.metaKey) return;
  const hedef = e.target;
  if (hedef instanceof HTMLInputElement || hedef instanceof HTMLTextAreaElement ||
      hedef instanceof HTMLSelectElement) return;
  if ($("anketGovde").classList.contains("gizli")) return;

  if (e.key >= "1" && e.key <= "5") {
    e.preventDefault();
    cevapla(etkinSoru, Number(e.key));
    return;
  }
  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    e.preventDefault();
    const yon = e.key === "ArrowDown" ? 1 : -1;
    etkinSoru = Math.min(SORULAR.length, Math.max(1, etkinSoru + yon));
    ciz();
    $("sorular").querySelector(`[data-no="${etkinSoru}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }
});

// ── Bağlama ────────────────────────────────────────────────

function sekmeyeGec(ad) {
  for (const d of document.querySelectorAll(".sekme")) {
    d.classList.toggle("secili", d.dataset.sekme === ad);
  }
  for (const s of document.querySelectorAll(".sekme-icerik")) {
    s.classList.toggle("gizli", s.id !== `sekme${ad[0].toLocaleUpperCase("tr-TR")}${ad.slice(1)}`);
  }
}

function baglaniklariKur() {
  for (const d of document.querySelectorAll(".sekme")) {
    d.addEventListener("click", () => sekmeyeGec(d.dataset.sekme));
  }

  $("btnRastgele").addEventListener("click", () => {
    uyarilariTemizle();
    hbysYolla("rastgele", { haric: taslak.hasta.hastaId ? [taslak.hasta.hastaId] : [] });
  });
  $("btnYenile").addEventListener("click", () => hbysYolla("seciliHasta"));

  for (const [id, anahtar] of [["alanAd", "adSoyad"], ["alanTc", "tcKimlikNo"],
                               ["alanTelefon", "telefon"],
                               ["alanPoliklinik", "poliklinik"], ["alanHekim", "hekim"]]) {
    $(id).addEventListener("input", () => {
      taslak.hasta[anahtar] = $(id).value;
      if (anahtar === "poliklinik") {
        taslak.hasta.poliklinikOneri = false;
        $("notPoliklinik").classList.add("gizli");
      }
      taslagiKaydet();
    });
  }

  $("alanGorus").addEventListener("input", () => {
    taslak.hastaGorusu = $("alanGorus").value;
    taslagiKaydet();
  });

  $("btnOnizle").addEventListener("click", onizle);
  $("btnOnayla").addEventListener("click", onayla);
  $("btnTemizle").addEventListener("click", taslagiSil);
  $("btnOnizlemeKapat").addEventListener("click", () => $("onizleme").classList.add("gizli"));

  $("btnKlasorSec").addEventListener("click", klasorSecdir);
  $("btnIzinIste").addEventListener("click", async () => {
    if (await kayitDeposu.izinIste()) await kuyrugaBak();
    await durumuTazele();
  });
  $("btnKuyruk").addEventListener("click", kuyrugaBak);

  $("btnRapor").addEventListener("click", raporCikar);
  $("btnAylariYenile").addEventListener("click", aylariYukle);
  $("btnIslemler").addEventListener("click", islemleriIste);
  $("btnIslemlerKapat").addEventListener("click",
    () => $("islemler").classList.add("gizli"));

  $("aySecim").addEventListener("change", hedefKutusunuTazele);
  $("alanGelenHasta").addEventListener("change", async () => {
    const ay = $("aySecim").value;
    if (!ay) return;
    const ham = $("alanGelenHasta").value.trim();
    const sayi = ham === "" ? null : Math.max(0, Math.round(Number(ham)));
    if (ham !== "" && !Number.isFinite(sayi)) return;
    if (sayi === null) await chrome.storage.local.remove(hedefAnahtari(ay));
    else await chrome.storage.local.set({ [hedefAnahtari(ay)]: sayi });
    await hedefKutusunuTazele();
    await ayRozetiniTazele();
  });

  $("cbDogrudanIslem").addEventListener("change", async () => {
    dogrudanIslem = $("cbDogrudanIslem").checked;
    await chrome.storage.local.set({ dogrudanIslem });
  });

  $("alanHedefOran").addEventListener("change", async () => {
    const deger = Number($("alanHedefOran").value);
    hedefOran = Number.isFinite(deger) && deger > 0 ? deger : 1;
    $("alanHedefOran").value = hedefOran;
  dogrudanIslem = Boolean(ayarlar.dogrudanIslem);
  $("cbDogrudanIslem").checked = dogrudanIslem;
    await chrome.storage.local.set({ hedefOran });
    await hedefKutusunuTazele();
    await ayRozetiniTazele();
  });

  $("btnListe").addEventListener("click", listeyiAc);
  $("btnListeCsv").addEventListener("click", listeyiIndir);

  $("alanUygulayan").addEventListener("input", () => {
    uygulayan = $("alanUygulayan").value.trim();
    chrome.storage.local.set({ uygulayan });
  });
}

async function baslat() {
  sorulariKur();
  baglaniklariKur();

  const ayarlar = await chrome.storage.local.get(
    ["uygulayan", "hedefOran", "dogrudanIslem"]);
  uygulayan = ayarlar.uygulayan ?? "";
  $("alanUygulayan").value = uygulayan;
  hedefOran = Number.isFinite(ayarlar.hedefOran) && ayarlar.hedefOran > 0
    ? ayarlar.hedefOran : 1;
  $("alanHedefOran").value = hedefOran;
  dogrudanIslem = Boolean(ayarlar.dogrudanIslem);
  $("cbDogrudanIslem").checked = dogrudanIslem;

  ciz();
  await durumuTazele();
  await kuyrugaBak();
  hbysYolla("seciliHasta");
  hbysYolla("durum");
}

baslat();
