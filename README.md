# HHD.FR.19 Anket Eklentisi

Avcılar Ağız ve Diş Sağlığı Merkezi'nin **HHD.FR.19 Hasta Memnuniyet Anketi**
formunu, HBYS ekranının yanına yerleşen panel penceresinden doldurup orijinal
PDF şablonunun üzerine işaretleyen tarayıcı eklentisi.

Eklenti internete hiçbir istek atmaz; kullandığı kütüphaneler, yazı tipi ve
boş form paketin içinde gömülüdür. Kişisel veri hastane içindeki klasörden
dışarı çıkmaz.

## Kurulum

Chrome sürümünü önce doğrulayın: `chrome://version`. Eklenti **102 ve üstü**
ile çalışır; hastanedeki Chrome 109 desteklenir.

Panel, Chrome'un yan panelinde değil, eklenti simgesine basınca tarayıcının
sağına yaslanan ayrı bir pencerede açılır — yan panel API'si 114'te geldiği
için. Panel kapanınca tarayıcı penceresi eski boyutuna döner.

**Tek makinede denemek için:** `chrome://extensions` → Geliştirici modu →
**Paketlenmemiş yükle** → `eklenti/` klasörü (ya da paketten çıkan ZIP'in
açıldığı klasör).

**Hastane genelinde:** imzalı `.crx`, grup politikasıyla dağıtılır. Eklenti
kimliği `dcobgmebekokdbfockoamfmdncnojlog`.

Ayrıntılar, politika girdisi ve paketleme:
[docs/04-kurulum-ve-dagitim.md](docs/04-kurulum-ve-dagitim.md)

İlk açılışta **Ayarlar** sekmesinden ana klasörü gösterin ve anketi uygulayanın
adını girin.

## Paketleme

```bash
./araclar/paketle.sh dagitim/imza-anahtari.pem
```

`dagitim/` altına `.zip` ve imzalı `.crx` üretir. Bu klasör ve imza anahtarı
depoya girmez.

## Kullanım

Panelde önce **görüşme sonucu** seçilir. Ulaşılamayan görüşmeler PDF'siz kayıt
olarak tutulur; ulaşılma oranı ve tekrar aranacaklar listesi bunlardan çıkar.

Ulaşıldıysa form açılır. Cevaplar **1–5 tuşlarıyla** girilir, her seçimde
taslak kendiliğinden kaydedilir. Hastanın kendi cümleleri anketin arkasına
ayrı bir sayfa olarak eklenir — anketin gerçekten yapıldığına dair delil.
Onaydan önce doldurulmuş PDF önizlenir; onaya basıldığında en alta
muayene ve anket zamanı ile anketi uygulayanın adını taşıyan damga düşer,
kayıt kilitlenir.

Formun altında yazıcının basabildiği yalnızca ~13 punto var ve onu damga
kullanıyor; bu yüzden görüş sayfanın altına değil arkasına yazılıyor,
damgada "Hasta görüşü arka sayfada" notu çıkıyor.

Dosyalar şu yapıya yazılır:

```
HHD.FR.19 Anketleri/
  _ayarlar/
    hekimler.json
  2026-09 Eylul/
    AHMET YILMAZ - 11.09.2026 14.32.pdf
    _veri/
      AHMET YILMAZ - 11.09.2026 14.32.json
```

Klasör ve dosya adları ASCII'dir (`Eylul`, `SUKRU DOGAN`): adında Türkçe
karakter olan klasörler tarayıcının dizin listelemesinde görünmüyor, öyle
yazılan anket sonradan bulunamıyor. Panelde ve raporda görünen her şey tam
Türkçe kalır.

Her anketin bir PDF'i ve yanında küçük bir veri dosyası var; ortak bir Excel
dosyasına satır eklenmiyor. Ay sonu raporu istenildiği an bu veri
dosyalarından yeniden üretilebiliyor.

Ağ klasörüne o an ulaşılamazsa anket eklentide bekler ve bağlantı gelince
yazılır; panelde bekleyen kayıt sayısı görünür.

**Son gelişinde yapılan işlemler.** Aramadan önce hasta kartından açılır:
hastaya hangi gün ne yapıldığı, hangi dişe, hangi hekim tarafından. Yalnızca
gösterilir — sağlık bilgisi ne veri kaydına ne PDF'e yazılır.

Varsayılan olarak eklenti yalnızca ekranda açık olanı okur, yani hastanın
Tedavi-Plan sekmesinde açık olması gerekir. Ayarlardaki **"İşlemleri HBYS'den
doğrudan getir"** tiki açılırsa eklenti tek bir okuma isteğiyle kendisi getirir
ve hastayı açmaya gerek kalmaz. Çalışmazsa kendiliğinden eski yönteme döner ve
sebebini söyler; denemesi risksizdir.

**Hekim – poliklinik eşlemesi.** HBYS'de birim bilgisi dağınık: hasta listesi
ızgarasında birim sütunu yok, poliklinik adı filtreden tahmin ediliyor. Ayarlar
sekmesinde hangi hekimin hangi poliklinikte çalıştığı elle giriliyor; anket
yapılan hekimler listeye kendiliğinden düşüyor. Eşleme ana klasördeki
`_ayarlar/hekimler.json` dosyasına yazılıyor, ikinci bilgisayar da aynı listeyi
görüyor. Eşleme girildiği anda hem yeni anketlerin polikliniği doğru geliyor
hem eski kayıtlar rapor ve liste üretilirken düzeltiliyor.

Kurumdaki poliklinikler Ayarlar'da bir kez yazılır (her satıra bir tane).
Hekim eşlemesinde ve anket ekranında bu listeden **seçilir**, elle
yazılmaz — aynı birim iki farklı yazımla ikiye bölünmez.

Hekimin polikliniği listeden seçildiği anda kaydedilir; ayrıca bir düğmeye
basmak gerekmez. Yalnızca **daha önce atanmış** bir polikliniği
değiştirirseniz tek bir soru çıkar:

- **Yanlış atanmış** — bütün anketler yeni poliklinikte görünür
- **Taşındı** — bugünden itibaren geçerli olur, o tarihten önceki anketler
  eski poliklinikte kalır

Tarihi eklenti kendisi tutar. Geçmiş dönemler hekimin altında
"Önce: Ortodonti (12.09.2026 öncesi)" diye görünür. Bu soru anket sırasında
hiç çıkmaz.

Polikliniği girilmemiş hekim varsa Ayarlar uyarır; anket sırasında da hasta
kartının altında "bu hekimin polikliniği tanımlı değil" notu çıkar.

**Rapor bölümleri.** Raporda hangi bölümlerin görüneceği Ayarlar'dan tikle
seçiliyor. Hazır bölümler: kapsam ve hedef, soru bazlı sonuçlar, poliklinik ve
hekim kırılımı, poliklinik × soru matrisi, katılımcı profili, saat ve gün
analizi, tekrar aramanın getirisi, ay içinde dağılım, dönüş süresi ve
memnuniyet, numara hatalı çıkanlar, anketi uygulayan kırılımı, DÖF, hasta
görüşleri, tekrar aranacaklar.

Kırılım tablolarında beş anketten az olan satırlar yıldızla işaretleniyor —
ayda ~40 ankette hücreler hızla inceliyor ve tek bir cevap ortalamayı uçurabiliyor.

**Aylık hedef.** Rapor sekmesine o ay kuruma gelen hasta sayısı elle girilir;
eklenti bunun yüzdesini (varsayılan %1, Ayarlar'dan değiştirilir) hedef sayar.
Üst çubuktaki rozet "Bu ay: 38/42 kişi" diye ilerlemeyi gösterir. Hedef kişi
üzerinden ölçülür: aynı hastayı iki kez aramak tek kişi sayılır.

**Anket listesi.** Rapor sekmesinden, yapılan anketlerin dökümü alınır: ad
soyad, T.C. kimlik no, telefon, başvurduğu poliklinik, hekim, muayene tarihi
ve saati, aranma tarihi ve saati, görüşme sonucu, anketi uygulayan. İstenirse
tek bir gün seçilip yalnızca o gün **muayene olan** hastalar listelenir —
arama daha sonra, hatta ertesi ay yapılmış olsa bile. Ekranda açılıp
yazdırılabilir ya da doğrudan .xlsx olarak indirilebilir — dosyanın en
üstünde kurum ve anket adı, altında seçilen gün/ay etiketi yer alır.

Muayene ile arama zamanı üç yerde birden görünür: PDF'in altındaki damgada,
listede ve raporda. Rapor ayrıca **ortalama dönüş süresini** — muayeneden
aramaya kadar geçen süreyi — hesaplar.

**Muayene günü.** HBYS'nin muayene alanı çoğu kayıtta yalnızca saat veriyor.
Muayene günü aslında hastaya son yapılan işlemin tarihidir; "Son gelişinde
yapılan işlemler" bir kez getirildiğinde o tarih kayda geçer ve forma, listeye,
rapora muayene günü olarak yazılır. Getirilmediyse ve gün başka bir alandan da
çözülemiyorsa panel uyarır, alan uydurulmaz.

**Arşiv.** Basılan PDF'te hasta adı, telefonu, polikliniği ve **T.C. kimlik
numarası** yer alır; kimlik numarası formda böyle bir alan olmadığı için ad
soyad satırının sağına yazılır. Denetimcinin arşivdeki belgeyi hasta kimliğiyle
eşleştirebilmesi için.

## Depo düzeni

```
eklenti/          yüklenecek eklenti
  manifest.json
  okuyucu.js      HBYS sayfasının kendi bağlamında çalışan okuyucu (MAIN)
  kopru.js        sayfa ile panel arasındaki röle (ISOLATED)
  arkaplan.js     servis işçisi
  panel/          panel penceresi arayüzü (pencere.js yerleşimi yapar)
  motor/          sorular, zaman, hekimler, PDF, kayıt, istatistik, rapor, liste
  varliklar/      boş form, yazı tipi, gömülü kütüphaneler
araclar/          paketleme betiği
test/             Node ve Chromium sınamaları
docs/             çözümleme ve plan belgeleri
arastirma/        form geometrisi ve doğrulama prototipi
```

## Sınamalar

```bash
npm install
npm test
```

| Sınama | Ne doğruluyor |
|---|---|
| `test:pdf` | İşaretleme motorunu Node'da çalıştırıp PDF üretir |
| `test:istatistik` | Kapsam dışı kuralı, DÖF ve tekrar arama listeleri, örnek rapor |
| `test:panel` | Eklentiyi gerçek Chromium'a yükler; klavye akışı ve "hasta yakını" kuralı |

## Belgeler

| Dosya | İçerik |
|---|---|
| [docs/01-hbys-veri-kaynaklari.md](docs/01-hbys-veri-kaynaklari.md) | HBYS'den hangi verinin nasıl okunabildiği |
| [docs/02-form-analizi.md](docs/02-form-analizi.md) | PDF formunun yapısı, işaretleme yöntemi, istatistik notları |
| [docs/03-ilk-surum-plani.md](docs/03-ilk-surum-plani.md) | Mimari, veri kaydı biçimi, yapım sırası, ön koşullar |
| [docs/04-kurulum-ve-dagitim.md](docs/04-kurulum-ve-dagitim.md) | Kurulum yolları, grup politikası, imza anahtarı |
| [eklenti/varliklar/README.md](eklenti/varliklar/README.md) | Gömülü kütüphaneler ve neden yeniden paketlendikleri |

## Çözümleme çıktıları

`arastirma/form-geometrisi.json` formdaki 18 parantez ve 40 seçeneğin tam
koordinatlarını taşır; eklentinin işaretleme motoru bu tabloyu kullanır.
`arastirma/isaretleme-prototipi.py` aynı koordinatları Python'da doğrulayan
bağımsız prototiptir:

```bash
pip install pymupdf
python3 arastirma/isaretleme-prototipi.py \
        eklenti/varliklar/HHD.FR.19-bos-form.pdf dolu-ornek.pdf
```
