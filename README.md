# HHD.FR.19 Anket Eklentisi

Avcılar Ağız ve Diş Sağlığı Merkezi'nin **HHD.FR.19 Hasta Memnuniyet Anketi**
formunu, HBYS ekranının yanındaki Chrome yan panelinden doldurup orijinal PDF
şablonunun üzerine işaretleyen tarayıcı eklentisi.

Eklenti internete hiçbir istek atmaz; kullandığı kütüphaneler, yazı tipi ve
boş form paketin içinde gömülüdür. Kişisel veri hastane içindeki klasörden
dışarı çıkmaz.

## Kurulum

Chrome sürümünü önce doğrulayın: `chrome://version`. Yan panel **114 ve üstü**
gerektirir.

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
taslak kendiliğinden kaydedilir. Hastanın kendi cümleleri formun boş orta
sütununa yazılır — anketin gerçekten yapıldığına dair delil; sığmazsa arkaya
ek sayfa eklenir. Onaydan önce doldurulmuş PDF önizlenir; onaya basıldığında
en alta tarih-saat-uygulayan damgası düşer ve kayıt kilitlenir.

Dosyalar şu yapıya yazılır:

```
HHD.FR.19 Anketleri/
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
gösterilir — sağlık bilgisi ne veri kaydına ne PDF'e yazılır. Liste HBYS'den
okunduğu için hastanın Tedavi-Plan sekmesinde açık olması gerekir.

**Aylık hedef.** Rapor sekmesine o ay kuruma gelen hasta sayısı elle girilir;
eklenti bunun yüzdesini (varsayılan %1, Ayarlar'dan değiştirilir) hedef sayar.
Üst çubuktaki rozet "Bu ay: 38/42 kişi" diye ilerlemeyi gösterir. Hedef kişi
üzerinden ölçülür: aynı hastayı iki kez aramak tek kişi sayılır.

**Anket listesi.** Rapor sekmesinden, yapılan anketlerin dökümü alınır: ad
soyad, T.C. kimlik no, telefon, başvurduğu poliklinik, hekim, muayene tarihi
ve saati, aranma tarihi ve saati, görüşme sonucu, anketi uygulayan. Ekranda
açılıp yazdırılabilir ya da CSV olarak Excel'e alınabilir.

Muayene ile arama zamanı üç yerde birden görünür: PDF'in altındaki damgada,
listede ve raporda. Rapor ayrıca **ortalama dönüş süresini** — muayeneden
aramaya kadar geçen süreyi — hesaplar.

## Depo düzeni

```
eklenti/          yüklenecek eklenti
  manifest.json
  okuyucu.js      HBYS sayfasının kendi bağlamında çalışan okuyucu (MAIN)
  kopru.js        sayfa ile panel arasındaki röle (ISOLATED)
  arkaplan.js     servis işçisi
  panel/          yan panel arayüzü
  motor/          sorular, zaman, PDF işaretleme, kayıt, istatistik, rapor, liste
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
