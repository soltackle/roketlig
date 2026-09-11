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

const $ = (id) => document.getElementById(id);
const iki = (n) => String(n).padStart(2, "0");

// ── Durum ──────────────────────────────────────────────────

const bosTaslak = () => ({
  gorusmeSonucu: null,
  hasta: { hastaId: null, adSoyad: "", telefon: "", poliklinik: "", hekim: "",
           islemTarihi: null, poliklinikOneri: false },
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
    telefon: hasta.telefon ?? "",
    poliklinik: hasta.poliklinik ?? "",
    hekim: hasta.hekim ?? "",
    islemTarihi: hasta.islemTarihi ?? null,
    poliklinikOneri: Boolean(hasta.poliklinik)
  };
  $("alanAd").value = taslak.hasta.adSoyad;
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
      telefon: $("alanTelefon").value.trim(),
      poliklinik: $("alanPoliklinik").value.trim(),
      hekim: $("alanHekim").value.trim(),
      islemTarihi: taslak.hasta.islemTarihi
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
  } else if (aylar.includes(oncekiSecim)) {
    secim.value = oncekiSecim;
  }
  $("btnRapor").disabled = !aylar.length;
}

async function raporCikar() {
  const ay = $("aySecim").value;
  if (!ay) return;
  const durum = $("raporDurum");
  durum.textContent = "Veri dosyaları okunuyor…";
  try {
    const { kayitlar, bozuk } = await kayitDeposu.ayKayitlariniOku(ay);
    let onceki = null;
    const oncekiAd = oncekiAyKlasoru(ay);
    if (oncekiAd) {
      try { onceki = (await kayitDeposu.ayKayitlariniOku(oncekiAd)).kayitlar; } catch { onceki = null; }
    }

    const html = raporUret(ay, kayitlar, onceki);
    const url = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
    await chrome.tabs.create({ url });

    durum.textContent = `${kayitlar.length} kayıttan rapor üretildi` +
      (bozuk.length ? ` · ${bozuk.length} dosya okunamadı: ${bozuk.join(", ")}` : "") +
      (onceki ? ` · ${donemEtiketi(oncekiAd)} ile karşılaştırıldı` : " · karşılaştırma yok");
  } catch (e) {
    durum.textContent = `Rapor üretilemedi: ${e.message ?? e}`;
  }
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

  for (const [id, anahtar] of [["alanAd", "adSoyad"], ["alanTelefon", "telefon"],
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

  $("btnKlasorSec").addEventListener("click", async () => {
    try {
      await kayitDeposu.klasorSec();
      await durumuTazele();
      await kuyrugaBak();
    } catch (e) {
      if (e?.name !== "AbortError") uyar("hata", "Klasör seçilemedi", String(e.message ?? e));
    }
  });
  $("btnIzinIste").addEventListener("click", async () => {
    if (await kayitDeposu.izinIste()) await kuyrugaBak();
    await durumuTazele();
  });
  $("btnKuyruk").addEventListener("click", kuyrugaBak);

  $("btnRapor").addEventListener("click", raporCikar);
  $("btnAylariYenile").addEventListener("click", aylariYukle);

  $("alanUygulayan").addEventListener("input", () => {
    uygulayan = $("alanUygulayan").value.trim();
    chrome.storage.local.set({ uygulayan });
  });
}

async function baslat() {
  sorulariKur();
  baglaniklariKur();

  const ayarlar = await chrome.storage.local.get("uygulayan");
  uygulayan = ayarlar.uygulayan ?? "";
  $("alanUygulayan").value = uygulayan;

  ciz();
  await durumuTazele();
  await kuyrugaBak();
  hbysYolla("seciliHasta");
  hbysYolla("durum");
}

baslat();
