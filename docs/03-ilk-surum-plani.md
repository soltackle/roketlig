# İlk sürüm planı

Kararlar: ana klasör izni · "fikrim yok" cevapları ortalama dışı · rapor
eklentinin kendi düzeninde.

## Mimari

Chrome eklentisi, Manifest V3. Beş parça:

```
manifest.json
  arkaplan.js        servis isçisi — yan paneli açar, kuyruğu tetikler
  koprü.js           içerik betiği (yalıtılmış) — sayfa ile panel arasında röle
  okuyucu.js         içerik betiği (MAIN) — App.* nesnelerini okur
  panel/             yan panel: form, önizleme, rapor
  motor/             PDF işaretleme, kayıt, rapor hesabı
  varliklar/         boş form PDF'i + Türkçe TTF
```

### HBYS'den okuma

`App.*` nesneleri sayfanın kendi JavaScript bağlamında yaşıyor; yalıtılmış
dünyadaki içerik betiği bunlara erişemez. Bu yüzden `okuyucu.js` manifestte
`"world": "MAIN"` ile tanımlanacak (Chrome 111+; yan panel zaten 114+ istiyor).

`okuyucu.js` yalnızca okur, sayfaya yazmaz, ek ağ isteği atmaz:

- `App.GridHastaListesi.getSelectionModel()` üzerindeki `selectionchange`
  olayına bağlanır, seçili kaydın alanlarını gönderir
- "Rastgele hasta öner" istendiğinde, hâlihazırda yüklü store'dan
  `hastaListesiTurId = 3` (İşlemi Bitenler) kayıtları arasından seçer
- Poliklinik önerisini `App.CmbHastaListesiBirimler` seçiminden alır

Akış: `okuyucu.js` → `window.postMessage` → `koprü.js` →
`chrome.runtime.sendMessage` → panel.

`App` sayfa yüklenirken hazır olmadığı için okuyucu, `Ext.onReady` ve kısa bir
yoklama ile bileşenlerin oluşmasını bekler; ızgara yeniden oluşturulduğunda
olay bağını tazeler.

### Panel penceresi

> 0.10.0'da değişti: plan `chrome.sidePanel` üzerineydi, o API Chrome 114'te
> geldi ve hastanedeki makineler 109'da. Panel artık eklenti simgesiyle açılan
> ayrı bir pencerede (`type: "popup"`) çalışıyor; ekranın sağına tam boy
> yaslanıyor, tarayıcı penceresi soluna daralıyor, panel kapanınca eski
> boyutuna dönüyor. Yerleşim `panel/pencere.js`, açılış `arkaplan.js` içinde.

Panel ayrı pencerede açık kaldığı için HBYS'ye tıklamak cevapları
kaybettirmez. HBYS komutları, etkin sekmeye değil, adresinden bulunan HBYS
sekmesine gider.

## Panel akışı

1. **Görüşme sonucu** — ulaşıldı · açmadı · numara hatalı · görüşmeyi istemedi.
   İlk üç dışındaki seçenekler formu atlar, PDF'siz kayıt yazar.
2. **Hasta kartı** — HBYS'den gelen ad, telefon, poliklinik, hekim. Hepsi
   elle düzeltilebilir; poliklinik birim grubu seçiliyken yanlış olabileceği
   için öneri olarak işaretlenir.
3. **Mükerrer uyarısı** — aynı `HASTA_ID` o ay içinde zaten kayıtlıysa panel
   uyarır, kullanıcı yine de devam edebilir.
4. **Katılımcı** — "Hasta yakını" seçildiği anda cinsiyet ve yaş grubu
   **boşaltılır**; bunlar ankete katılanın bilgisi, hastanın değil.
5. **8 soru** — klavyede 1–5 ile cevap, otomatik sonraki soruya geçiş.
   7. soruda ayrıca "tetkik yok" düğmesi.
6. **Hastanın görüşü** — serbest metin. Hem veri kaydına girer hem de formun
   boş orta sütununa yazılır; anketin yapıldığına dair delil.
7. **Önizleme** — doldurulmuş PDF panelde gösterilir.
8. **Onay** — en alta damga satırı düşer, kayıt kilitlenir.

Her seçimde taslak `chrome.storage.local` içine yazılır; panel kapanıp
açılsa da kaldığı yerden devam eder.

## PDF işaretleme

`pdf-lib` + `@pdf-lib/fontkit`, ikisi de pakete gömülü. Boş form
`varliklar/` altında duruyor; her ankette bir kopyası açılıp üzerine çiziliyor.

Koordinatlar `arastirma/form-geometrisi.json` dosyasından geliyor; seçenek
metinleri çalışma anında ayrıştırılmıyor (gerekçesi:
[docs/02](02-form-analizi.md)).

- Parantezlere `X`
- Seçilen cevabın etrafına kalemle çizilmiş izlenimi veren halka
- Ad-soyad, telefon, poliklinik iki noktanın yanına
- Tetkik yoksa 7. sorunun boş orta sütununa not
- Hastanın görüşü, boş orta sütun hücrelerine; sığmazsa ek sayfaya
- En alta: `Anket tarihi: … · Saat: … · Anketi uygulayan: …`

Türkçe TTF gömülü ve `subset: true` ile alt kümeleniyor.

## Kayıt

Kullanıcı bir kez ana klasörü gösterir (`showDirectoryPicker`, yazma izniyle).
Tanıtıcı IndexedDB'de saklanır — `chrome.storage` bu nesneyi tutamaz.
Tarayıcı yeniden açıldığında `queryPermission` `"prompt"` dönerse panel tek
düğmelik bir onay gösterir.

```
HHD.FR.19 Anketleri/
  2026-09 Eylul/
    AHMET YILMAZ - 11.09.2026 14.32.pdf
    _veri/
      AHMET YILMAZ - 11.09.2026 14.32.json
```

Ay klasörlerini eklenti kendisi açar. Windows dosya adında kabul etmediği
karakterler (`\ / : * ? " < > |`) temizlenir; saat `14.32` biçiminde yazılır.
Aynı gün aranan iki "Mehmet Yılmaz" birbirinin üzerine yazmaz.

**Diskteki adlar ASCII.** `Eylül` yerine `Eylul`, `ŞÜKRÜ DOĞAN` yerine
`SUKRU DOGAN`. Sebebi kozmetik değil: adında Türkçe karakter olan klasör ve
dosyalar oluşuyor ama tarayıcının dizin listelemesinde hiç görünmüyor — öyle
bir adla yazılan anket diske düşer, sonra bulunamaz ve rapor üretilemez.
Ayrıca olmayan bir Türkçe adlı klasör "varmış gibi" açılabildiği için ada göre
arama da yalnızca ASCII adlarla yapılır. Panelde ve raporda görünen her şey
(`Eylül 2026`, hastanın tam adı) yine tam Türkçe; değişen sadece dosya adı.

Ortak bir Excel dosyasına satır eklenmiyor: her anket kendi PDF'i ve kendi
veri dosyası. Dosya bozulması ve iki bilgisayarın aynı anda yazması riski
böylece ortadan kalkıyor.

**Ağ klasörü erişilemezse** anket IndexedDB'deki kuyrukta bekler; panel her
açıldığında ve periyodik olarak yeniden denenir. Panelde bekleyen kayıt
sayısı görünür.

### Veri kaydının biçimi

```json
{
  "surum": 1,
  "formSurum": "HHD.FR.19 Rev.01",
  "gorusmeSonucu": "ulasildi",
  "tarih": "2026-09-11",
  "saat": "14:32",
  "uygulayan": "Şenay IŞIK",
  "hasta": {
    "hastaId": 482913,
    "adSoyad": "AHMET YILMAZ",
    "tcKimlikNo": "12345678901",
    "telefon": "0532 415 66 08",
    "poliklinik": "Ağız, Diş ve Çene Cerrahisi",
    "hekim": "Dt. Şenay IŞIK",
    "islemTarihi": "2026-09-10"
  },
  "katilimci": {
    "tur": "Hasta",
    "cinsiyet": "Erkek",
    "yasGrubu": "50-59",
    "egitim": "Lise"
  },
  "cevaplar": { "1": 4, "2": 5, "3": 3, "4": 3, "5": 4, "6": 5, "7": null, "8": 4 },
  "tetkikYok": true,
  "hastaGorusu": "Randevu saatinde alındım, memnunum.",
  "pdfDosya": "AHMET YILMAZ - 11.09.2026 14.32.pdf",
  "kilitli": true
}
```

T.C. kimlik numarası kayda giriyor (anket listesi için) ama PDF'e yazılmıyor —
formda böyle bir alan yok. Mükerrer denetimi yine `hastaId` ile yapılıyor.

Kapsam dışı sayılacak cevaplar (4/3, 6/3) kayıtta ham hâliyle duruyor;
"ortalamaya girmez" kuralı `formSurum` alanına bağlı tek bir yerde tanımlı.
Böylece form revize edilirse eski kayıtlar kendi kurallarıyla hesaplanır.

## Ay sonu raporu

Ay seçilir, eklenti o ayın `_veri/` klasörünü okur ve raporu yeniden üretir.
Kaynak her zaman dosyalar; eklentinin kendi belleği değil.

Çıktı, kendi içinde yeterli tek bir HTML: dışarıdan yazı tipi, betik ya da
görsel çekmez. Yeni sekmede açılır, tarayıcıdan Yazdır → PDF ile A4'e basılır.

- Aranan, ulaşılan, tamamlanan anket sayıları ve ulaşılma oranı
- Her soru için ortalama puan ve 1–5 dağılımı (satır içi çubuk)
- Memnuniyet oranı: hem ortalama/5 hem 4–5 verenlerin oranı
- Kırılımlar: poliklinik, hekim, katılımcı türü, cinsiyet, yaş, eğitim
- DÖF için 2 ve altı puanların listesi
- Hastaların serbest görüşleri
- Tekrar aranacaklar listesi
- Önceki ayla karşılaştırma (kartlarda ve soru tablosunda ▲▼ olarak)

**Kapsam dışı cevaplar** (4/3 "Bilgi istemedim", 6/3 "Farkında değildim" ve
tetkik yapılmayan 7. soru) ortalamaya girmez; her sorunun yanında kaç cevabın
kapsam dışı kaldığı ayrıca yazılır. Bir sorunun ortalaması yalnızca o soruyu
puanlayanların üzerinden hesaplanır ve payda "Puanlanan" sütununda görünür.
Kapsam dışı cevaplar 1–5 dağılım çubuğunda ise PDF'te işaretlendiği gibi
görünmeye devam eder.

## Yapım sırası

| Faz | İçerik | Durum |
|---|---|---|
| 1 | Manifest, panel penceresi, HBYS okuma | Yazıldı |
| 2 | Görüşme sonucu, form, 1–5 klavye, taslak, mükerrer uyarısı | Yazıldı |
| 3 | PDF işaretleme, önizleme, onay ve damga | Yazıldı, çıktısı doğrulandı |
| 4 | Klasör izni, ay klasörleri, yazma kuyruğu | Yazıldı, hastanede denenmedi |
| 5 | Ay sonu raporu | Yazıldı, çıktısı doğrulandı |

Kod `eklenti/` altında. Sınamalar için `npm test`:

- `test/pdf-dene.mjs` — işaretleme motorunu Node'da çalıştırıp PDF üretir
- `test/rapor-dene.mjs` — kapsam dışı kuralını, DÖF ve tekrar arama
  listelerini doğrular, örnek rapor üretir
- `test/panel-dene.mjs` — eklentiyi gerçek Chromium'a yükler, paneli açar,
  klavye akışını ve "hasta yakını" kuralını sınar

## Başlamadan doğrulanacaklar

1. **Chrome sürümü** — `chrome://version`. Alt sınır 102; Windows 7
   makinelerin kaldığı 109 destekleniyor (0.10.0 öncesi yan panel yüzünden
   114+ isteniyordu).
2. **Eklenti yükleme izni** — bilgi işlemin grup politikası. Paket mağazaya
   yüklenmeyecek; ya geliştirici modunda elle yüklenecek ya da bilgi işlem
   yerel bir `.crx` dosyasını politikayla dağıtacak. Geliştirici modu
   politikayla kapatılmışsa ikincisi tek yol olur — bunu önden sormakta
   fayda var.
3. **Klasör yazma yetkisi** — anketleri tutacak ağ klasörüne, anketi yapan
   kullanıcının hesabıyla yazılabildiği.

Eklenti çalışırken internete hiçbir istek atmayacak; `pdf-lib`, `fontkit` ve
yazı tipi dâhil kullandığı her şey paketin içinde gömülü olacak.
