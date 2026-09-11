/* HBYS sayfasının kendi JavaScript bağlamında (MAIN world) çalışır.
 *
 * Tek işi okumak: App.* nesnelerinden hasta bilgisini alıp köprüye yollar.
 * Sayfaya hiçbir şey yazmaz, hiçbir ağ isteği atmaz. HBYS'nin kendi
 * yüklediği store dışında bir kaynağa dokunmaz.
 */
(() => {
  "use strict";

  const KAYNAK = "anket-okuyucu";
  const KOMUT = "anket-kopru";
  const ISLEMI_BITENLER = "3";

  const yolla = (tip, veri) =>
    window.postMessage({ kaynak: KAYNAK, tip, veri }, window.location.origin);

  // --- ExtJS'e ulaşma ------------------------------------------------------

  const izgara = () => window.App && window.App.GridHastaListesi;

  /** App bileşenleri sayfa yüklenirken sonradan oluşuyor; oluşana kadar bekler. */
  function bekle(kosul, sure = 30000, aralik = 250) {
    return new Promise((tamam, hata) => {
      const baslangic = Date.now();
      (function dene() {
        let sonuc;
        try { sonuc = kosul(); } catch { sonuc = null; }
        if (sonuc) return tamam(sonuc);
        if (Date.now() - baslangic > sure) return hata(new Error("bileşen bulunamadı"));
        setTimeout(dene, aralik);
      })();
    });
  }

  // --- Kayıttan veri çıkarma ----------------------------------------------

  const al = (kayit, alan) => {
    try {
      const d = kayit && (kayit.get ? kayit.get(alan) : kayit.data && kayit.data[alan]);
      return d === undefined || d === null || d === "" ? null : d;
    } catch { return null; }
  };

  /** HBYS'nin cinsiyet gösterimi sürümden sürüme değişebiliyor; tanımadığını
   *  uydurmak yerine null döner, panel o zaman boş bırakıp sorar. */
  function cinsiyet(ham) {
    if (ham === null) return null;
    const s = String(ham).trim().toLocaleUpperCase("tr-TR");
    if (["E", "ERKEK", "1", "BAY"].includes(s)) return "Erkek";
    if (["K", "KADIN", "2", "BAYAN"].includes(s)) return "Kadın";
    return null;
  }

  function yasHesapla(kayit) {
    const yas = al(kayit, "H_YASI");
    if (yas !== null) {
      const n = parseInt(String(yas).match(/\d+/)?.[0] ?? "", 10);
      if (Number.isFinite(n)) return n;
    }
    const dt = al(kayit, "DOGUM_TARIHI");
    if (!dt) return null;
    const d = dt instanceof Date ? dt : new Date(dt);
    if (Number.isNaN(d.getTime())) return null;
    const bugun = new Date();
    let n = bugun.getFullYear() - d.getFullYear();
    const ayFark = bugun.getMonth() - d.getMonth();
    if (ayFark < 0 || (ayFark === 0 && bugun.getDate() < d.getDate())) n -= 1;
    return n >= 0 && n < 130 ? n : null;
  }

  function birimAdi() {
    try {
      const c = window.App && window.App.CmbHastaListesiBirimler;
      if (!c) return null;
      const ad = (c.getRawValue && c.getRawValue()) || null;
      return ad && String(ad).trim() ? String(ad).trim() : null;
    } catch { return null; }
  }

  function hastaCikar(kayit) {
    if (!kayit) return null;
    const telefon = al(kayit, "CEP_TELEFONU") || al(kayit, "EV_TELEFONU");
    return {
      hastaId: al(kayit, "HASTA_ID"),
      muracaatId: al(kayit, "MURACAAT_ID"),
      adSoyad: al(kayit, "HASTA_ADI"),
      // Anket listesi resmî kayıt olduğu için T.C. kimlik numarası da alınıyor.
      // Ekrandaki başlık yıldızlı gösteriyor; açık hâli ızgara kaydında.
      tcKimlikNo: al(kayit, "TC_KIMLIK_NO"),
      telefon: telefon ? String(telefon).trim() : null,
      cepVarMi: al(kayit, "CEP_TELEFONU") !== null,
      cinsiyet: cinsiyet(al(kayit, "CINSIYETI")),
      yas: yasHesapla(kayit),
      hekim: al(kayit, "DOKTOR_ADI"),
      hekimId: al(kayit, "DOKTOR_ID"),
      poliklinik: birimAdi(),
      islemTarihi: al(kayit, "TARIHI"),
      muayeneBitis: al(kayit, "MUAYENE_BITIS_ZAMANI"),
      islemDurumu: al(kayit, "HASTA_ISLEM_DURUM_BASLIK")
    };
  }

  // --- Liste sorguları -----------------------------------------------------

  function listeTuru() {
    try {
      const g = window.App && window.App.RgHastaListesiTur;
      const s = g && g.getValue && g.getValue();
      const v = s && s["App.RgHastaListesiTur_Group"];
      return v === undefined || v === null ? null : String(v);
    } catch { return null; }
  }

  function listeTarihi() {
    try {
      const d = window.App && window.App.DfHastalarTarih;
      const v = d && d.getValue && d.getValue();
      if (!v) return null;
      const t = v instanceof Date ? v : new Date(v);
      return Number.isNaN(t.getTime()) ? null : t.toISOString().slice(0, 10);
    } catch { return null; }
  }

  function kayitlar() {
    const g = izgara();
    const store = g && g.getStore && g.getStore();
    if (!store) return [];
    const dizi = [];
    store.each((k) => { dizi.push(k); });
    return dizi;
  }

  function seciliKayit() {
    try {
      const g = izgara();
      const sm = g && g.getSelectionModel && g.getSelectionModel();
      const secili = sm && sm.getSelection && sm.getSelection();
      return secili && secili.length ? secili[0] : null;
    } catch { return null; }
  }

  /** Telefonu olan, işlemi bitmiş hastalar arasından rastgele biri. */
  function rastgeleHasta(haricHastaIdleri = []) {
    const haric = new Set(haricHastaIdleri.map(String));
    const uygun = kayitlar()
      .map(hastaCikar)
      .filter((h) => h && h.adSoyad && h.telefon && !haric.has(String(h.hastaId)));
    if (!uygun.length) return null;
    const dizin = Math.floor(Math.random() * uygun.length);
    return uygun[dizin];
  }

  // --- Olaylara bağlanma ---------------------------------------------------

  let sonGonderilen = null;

  function seciliYolla(zorla = false) {
    const hasta = hastaCikar(seciliKayit());
    const imza = hasta ? JSON.stringify(hasta) : null;
    if (!zorla && imza === sonGonderilen) return;
    sonGonderilen = imza;
    yolla("hasta", hasta);
  }

  let bagli = null;

  async function bagla() {
    const g = await bekle(izgara);
    if (bagli === g) return;
    bagli = g;
    const sm = g.getSelectionModel();
    sm.on("selectionchange", () => seciliYolla());
    g.getStore().on("load", () => {
      sonGonderilen = null;          // liste değişti, seçim de değişmiş olabilir
      yolla("liste", { tur: listeTuru(), tarih: listeTarihi(), adet: kayitlar().length });
      seciliYolla(true);
    });
    g.on("destroy", () => { bagli = null; setTimeout(bagla, 500); });
    yolla("hazir", { tur: listeTuru(), tarih: listeTarihi(), adet: kayitlar().length });
    seciliYolla(true);
  }

  window.addEventListener("message", (e) => {
    if (e.source !== window || e.origin !== window.location.origin) return;
    const m = e.data;
    if (!m || m.kaynak !== KOMUT) return;

    if (m.tip === "seciliHasta") return seciliYolla(true);

    if (m.tip === "durum") {
      return yolla("durum", {
        tur: listeTuru(),
        islemiBitenlerMi: listeTuru() === ISLEMI_BITENLER,
        tarih: listeTarihi(),
        adet: kayitlar().length,
        poliklinik: birimAdi()
      });
    }

    if (m.tip === "rastgele") {
      if (listeTuru() !== ISLEMI_BITENLER) {
        return yolla("rastgele", { hata: "liste-yanlis", tur: listeTuru() });
      }
      const hasta = rastgeleHasta(m.veri && m.veri.haric);
      return yolla("rastgele", hasta ? { hasta } : { hata: "uygun-hasta-yok" });
    }
  });

  bagla().catch(() => yolla("hata", { mesaj: "HBYS hasta listesi bulunamadı" }));
})();
