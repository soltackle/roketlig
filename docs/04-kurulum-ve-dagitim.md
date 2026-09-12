# Kurulum ve dağıtım

## Önce: Chrome sürümü

Adres çubuğuna `chrome://version`. Eklenti **102 ve üstü** ile çalışır;
Windows 7 makinelerin takılı kaldığı **109** dâhil.

0.10.0'a kadar yan panel (`chrome.sidePanel`) kullanılıyordu ve o API 114'te
geldiği için 109 dışarıda kalıyordu. Artık panel, eklenti simgesine basınca
tarayıcının sağına yaslanan ayrı bir pencerede açılıyor; HBYS sayfasını okuyan
betik de manifestten değil, servis işçisinden kaydediliyor (`"world": "MAIN"`
manifest alanı 111+, `chrome.scripting` ile aynı şey 102+). Görünen davranış
yan paneldekiyle aynı: panel sağda tam boy durur, tarayıcı penceresi soluna
daralır, panel kapanınca eski boyutuna döner.

## Yol 1 — Paketlenmemiş yükleme (tek makine, deneme)

1. `dagitim/hhd-fr-19-anket-<sürüm>.zip` dosyasını bir klasöre açın.
   Klasörü kalıcı bir yere koyun; Chrome her açılışta oradan okur, silinirse
   eklenti kaybolur.
2. `chrome://extensions` → sağ üstte **Geliştirici modu** açık.
3. **Paketlenmemiş yükle** → açtığınız klasörü seçin.
4. HBYS'nin Poliklinik ekranını açın, araç çubuğundaki simgeye tıklayın.

Bu yolda eklenti kimliği klasör yolundan türer; klasörü taşırsanız kimlik
değişir ve kayıtlı klasör izni ile taslaklar sıfırlanır.

Bilgi işlem geliştirici modunu grup politikasıyla kapattıysa bu yol çalışmaz —
Yol 2'ye geçin.

## Yol 2 — Grup politikasıyla dağıtım (hastane geneli)

İmzalı `.crx` kullanılır. Eklenti kimliği imza anahtarından türer ve sabittir:

```
dcobgmebekokdbfockoamfmdncnojlog
```

Chrome artık `.crx` dosyalarının sürükle-bırak ile kurulmasına izin vermiyor;
tek geçerli yol politika. Bilgi işleme verilecek bilgi:

1. `.crx` dosyasını herkesin okuyabileceği bir paylaşıma ya da iç sunucuya
   koyun, yanına bir güncelleme bildirimi (`update manifest`) yazın:

```xml
<?xml version='1.0' encoding='UTF-8'?>
<gupdate xmlns='http://www.google.com/update2/response' protocol='2.0'>
  <app appid='dcobgmebekokdbfockoamfmdncnojlog'>
    <updatecheck codebase='http://sunucu/eklenti/hhd-fr-19-anket-0.1.0.crx'
                 version='0.1.0' />
  </app>
</gupdate>
```

2. Grup politikasında `ExtensionInstallForcelist` girdisi:

```
dcobgmebekokdbfockoamfmdncnojlog;http://sunucu/eklenti/guncelleme.xml
```

3. Kaynak `http://` ise `ExtensionInstallSources` içine de eklenmesi gerekebilir.

Sürüm yükseltmek için `manifest.json` içindeki `version` artırılır, yeni `.crx`
**aynı anahtarla** paketlenir ve güncelleme bildirimindeki sürüm ile dosya adı
güncellenir. Chrome değişikliği kendisi alır.

## Paketleme

```bash
./araclar/paketle.sh dagitim/imza-anahtari.pem
```

Üretilenler `dagitim/` altına düşer: `.zip`, `.crx` ve `eklenti-kimligi.txt`.
Chrome farklı bir yerdeyse `CHROME=/yol/chrome` verin.

Windows'ta betik yerine Chrome'un kendi arayüzü kullanılabilir:
`chrome://extensions` → **Uzantıyı paketle** → kaynak olarak `eklenti/`
klasörü, özel anahtar olarak `imza-anahtari.pem`.

### İmza anahtarı

`dagitim/imza-anahtari.pem` eklentinin kimliğini belirler ve **depoya
girmez** (`.gitignore`). Kaybedilirse yeni anahtarla üretilen paket Chrome
için bambaşka bir eklenti olur: politika girdisi tutmaz, kayıtlı klasör izni
ve taslaklar sıfırlanır. Bilgi işlemin yedeklediği bir yerde saklayın.

## İlk açılışta yapılacaklar

1. **Ayarlar** sekmesi → **Ana klasörü seç** → anketlerin tutulacağı klasör.
   Eklenti altında `HHD.FR.19 Anketleri / YYYY-AA Ay / _veri` yapısını kendisi
   kurar.
2. Aynı sekmede **Anketi uygulayan** adını girin; PDF'in altındaki damgaya
   bu yazılır.

Tarayıcı her yeniden açıldığında klasör izni "bekliyor" durumuna düşer; panel
üst çubuğunda uyarı görünür ve **İzni onayla** düğmesiyle tek tıkla tazelenir.
Bu Chrome'un güvenlik davranışı, eklentinin eksiği değil.

## Ağ klasörü kullanılıyorsa

Klasöre anketi yapan kullanıcının hesabıyla yazılabildiğini önden deneyin.
Klasöre o an ulaşılamazsa anket kaybolmaz: eklentinin içinde bekler, panelde
bekleyen kayıt sayısı görünür ve bağlantı gelince yazılır. Beklerken tarayıcı
kapatılabilir.

## Kaldırma

`chrome://extensions` üzerinden kaldırmak, klasöre yazılmış PDF ve veri
dosyalarına dokunmaz. Yalnızca eklentinin içinde bekleyen kayıtlar varsa
onlar silinir — kaldırmadan önce panelde bekleyen kayıt olmadığından emin olun.
