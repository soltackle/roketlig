# HHD.FR.19 Anket Eklentisi

Avcılar Ağız ve Diş Sağlığı Merkezi'nin **HHD.FR.19 Hasta Memnuniyet Anketi**
formunu, HBYS ekranının yanındaki Chrome yan panelinden doldurup orijinal PDF
şablonunun üzerine işaretleyen tarayıcı eklentisi.

Eklenti internete hiçbir istek atmaz; kullandığı kütüphaneler, yazı tipi ve
boş form paketin içinde gömülüdür. T.C. kimlik numarası hiçbir yere yazılmaz.

## Kurulum

1. Chrome sürümünü doğrulayın: adres çubuğuna `chrome://version`.
   Yan panel **114 ve üstü** gerektirir.
2. `chrome://extensions` → **Geliştirici modu** açık → **Paketlenmemiş yükle**
   → bu depodaki `eklenti/` klasörünü seçin.
3. HBYS'nin Poliklinik ekranını açın, araç çubuğundaki eklenti simgesine
   tıklayın. Panel HBYS'nin yanında açılır.
4. **Ayarlar** sekmesinden bir kez ana klasörü gösterin ve anketi uygulayanın
   adını girin.

Bilgi işlem geliştirici modunu grup politikasıyla kapattıysa eklentinin yerel
bir `.crx` olarak politikayla dağıtılması gerekir.

## Kullanım

Panelde önce **görüşme sonucu** seçilir. Ulaşılamayan görüşmeler PDF'siz kayıt
olarak tutulur; ulaşılma oranı ve tekrar aranacaklar listesi bunlardan çıkar.

Ulaşıldıysa form açılır. Cevaplar **1–5 tuşlarıyla** girilir, her seçimde
taslak kendiliğinden kaydedilir. Onaydan önce doldurulmuş PDF önizlenir;
onaya basıldığında en alta tarih-saat-uygulayan damgası düşer ve kayıt
kilitlenir.

Dosyalar şu yapıya yazılır:

```
HHD.FR.19 Anketleri/
  2026-09 Eylül/
    AHMET YILMAZ - 11.09.2026 14.32.pdf
    _veri/
      AHMET YILMAZ - 11.09.2026 14.32.json
```

Her anketin bir PDF'i ve yanında küçük bir veri dosyası var; ortak bir Excel
dosyasına satır eklenmiyor. Ay sonu raporu istenildiği an bu veri
dosyalarından yeniden üretilebiliyor.

Ağ klasörüne o an ulaşılamazsa anket eklentide bekler ve bağlantı gelince
yazılır; panelde bekleyen kayıt sayısı görünür.

## Depo düzeni

```
eklenti/          yüklenecek eklenti
  manifest.json
  okuyucu.js      HBYS sayfasının kendi bağlamında çalışan okuyucu (MAIN)
  kopru.js        sayfa ile panel arasındaki röle (ISOLATED)
  arkaplan.js     servis işçisi
  panel/          yan panel arayüzü
  motor/          sorular, PDF işaretleme, kayıt, istatistik, rapor
  varliklar/      boş form, yazı tipi, gömülü kütüphaneler
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
