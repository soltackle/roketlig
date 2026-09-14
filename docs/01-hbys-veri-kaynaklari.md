# HBYS'den okunabilen veriler

Kaynak: `http://10.212.200.215:8090/Poliklinik/Index` sayfasının 11.09.2026
tarihli kaynak kodu (view-source MHTML dökümü).

## Teknik zemin

| | |
|---|---|
| Sunucu | TRtek Web HBYS (ASP.NET MVC + Ext.NET 4.5) |
| İstemci | ExtJS 4.5 `classic` teması, tek sayfa uygulaması |
| Protokol | HTTP (TLS yok, hastane içi ağ) |
| Sayfa başlığı | `Poliklinik Modülü | TRtek Web HBYS` |

Sayfa tek bir SPA olduğu için **URL değişmeden** hasta seçimi, sekme geçişi ve
liste yenilemesi oluyor. Eklenti bu yüzden URL değişimini değil, ExtJS
bileşenlerinin olaylarını dinlemeli.

## Hasta listesi kılavuzu

Listeyi `App.GridHastaListesi` taşıyor. Store, şu uç noktadan besleniyor:

```
GET /Poliklinik/HastaListesiGetir
     birimId, birimGrubuId, ortakHavuzBirimi,
     tarih              <- App.DfHastalarTarih.getValue()
     hastaListesiTurId  <- HastaListesiTuruGetir()
     mesaiTuru          <- MesaiTuruGetir()
```

`hastaListesiTurId` değerleri `App.RgHastaListesiTur` radyo grubundan geliyor:

| Değer | Liste |
|---|---|
| 1 | Tümü |
| 2 | İşlemi Devam Edenler |
| **3** | **İşlemi Bitenler** |
| 4 | İşlem Görmemişler |
| 5 | Bitmeyen İşler |

Yani "seçilen günün İşlemi Bitenler listesinden rastgele hasta öner" özelliği,
listenin zaten yüklü olan store'u üzerinden ek bir istek atmadan çalışabilir.

## Ankette işimize yarayan alanlar

Hepsi `App.GridHastaListesi.getStore()` kayıtlarında mevcut:

| Alan | Kullanım |
|---|---|
| `HASTA_ADI` | PDF: "HASTA ADI SOYADI" |
| `CEP_TELEFONU` | PDF: "TELEFON NUMARASI" (yedek: `EV_TELEFONU`) |
| `CINSIYETI` | Panelde "Cinsiyetiniz" önerisi |
| `DOGUM_TARIHI`, `H_YASI` | Panelde "Yaş Grubu" önerisi |
| `DOKTOR_ADI`, `DOKTOR_ID` | Aylık raporun hekim kırılımı |
| `HASTA_ID` | Aynı ay tekrar arama denetimi |
| `MURACAAT_ID` | Başvuru bazlı tekillik |
| `TARIHI`, `MUAYENE_BITIS_ZAMANI` | Hangi güne ait olduğu |
| `TC_KIMLIK_NO` | Anket listesi (resmî döküm) |
| `MUAYENE_BASLAMA_ZAMANI` | Muayene saati (yoksa `KABUL_ZAMANI`, o da yoksa bitiş) |

### Poliklinik adı burada yok

Hasta listesi ızgarasında `BIRIM_ADI` sütunu **yok**. "BAŞVURDUĞU POLİKLİNİK"
için kaynak, filtredeki birim seçimi: `App.CmbHastaListesiBirimler`
(`displayField: "ADI"`, `valueField: "ID"`). Birim grubu ya da ortak havuz
seçiliyken liste birden fazla birimi kapsayabildiği için bu alan panelde
**öneri** olarak gelmeli ve elle düzeltilebilmeli.

## Tedavi-Plan sekmesindeki başlık yetmiyor

Akış şemasında bilgiler "Tedavi-Plan sekmesinden" okunuyor. Oradaki hasta
başlığı (`FsPolHastaBilgileri`) yalnızca şunları taşıyor:

`LblPolHastaAdi` · `LblPolHastaYasi` · `LblPolHastaID` · `LblPolMuracaatNo` ·
`LblPolDefterNo` · `LblPolHastaTuru` · `LblPolHastaTCKimlikNoYildiz`

**Cinsiyet ve cep telefonu bu başlıkta yok.** İkisi de yalnızca hasta listesi
kaydında bulunuyor. Ayrıca T.C. kimlik numarası ekranda yıldızlı gösteriliyor
(`...Yildiz`), açık hâli gizli alanda duruyor.

Sonuç: eklenti hasta bilgisini **hasta listesi kaydından** almalı; başlık
yalnızca "şu an hangi hasta seçili" bilgisini doğrulamak için kullanılmalı.
Akış zaten "İşlemi Bitenler" listesinden başladığı için bu bir kısıt değil.

## Poliklinik neden elle giriliyor

Hasta listesi ızgarasında birim sütunu yok; poliklinik adı yalnızca filtredeki
birim seçiminden (`CmbHastaListesiBirimler`) tahmin edilebiliyor ve birim grubu
ya da ortak havuz seçiliyken bu tahmin yanlış çıkıyor.

Bu yüzden poliklinik, hekim üzerinden çözülüyor: hangi hekimin hangi
poliklinikte çalıştığı Ayarlar'dan elle giriliyor. Anket yapılan her hekim
listeye kendiliğinden ekleniyor — hasta seçildiği anda, poliklinik girilene
kadar yalnızca o tarayıcıda tutuluyor, ağ klasörüne boş kayıt gitmiyor.

Eşleme dönemli tutuluyor: hekim taşındığında yeni dönem açılıyor, bir anketin
polikliniği o anketin muayene tarihindeki döneme bakılarak bulunuyor. Kullanıcı
tarih girmiyor; "yazım düzeltmesi mi, taşınma mı" sorusuna verdiği cevaba göre
eklenti tarihi kendisi koyuyor.

## Yapılan işlemler

Anketçi hastayı aramadan önce ne yapıldığına bakıyor. Bu bilgi
`App.GridHastaTetkikDetay` ızgarasında:

| Alan | İçerik |
|---|---|
| `TETKIK_ADI` | İşlemin adı |
| `TETKIK_KODU` | SUT kodu |
| `DIS_KODU` | Hangi diş |
| `TARIHI` | İşlem tarihi |
| `DOKTOR_ADI` | İşlemi yapan hekim |
| `MURACAAT_ID` | Hangi başvuruya ait |

Store `hastaGelisId: 0` ile besleniyor, yani hastanın **tüm geçmişini** taşıyor.
Anketin ait olduğu ziyareti ayırmak için hasta listesi satırındaki
`MURACAAT_ID` ile eşleştiriliyor; eşleşme bulunamazsa tüm işlemler tarihe göre
gruplanıp gösteriliyor.

**Kısıt:** bu ızgara yalnızca hasta Tedavi-Plan sekmesinde açıkken dolu oluyor.
Eklenti varsayılan olarak ek istek atmadığı için, hasta orada açık değilse panel
bunu söyleyip kullanıcıdan açmasını istiyor. `getHastaId()` ile ızgaranın o an
hangi hastaya ait olduğu doğrulanıyor — başka hastanın işlemleri yanlışlıkla
gösterilmiyor.

### Doğrudan sorgu (Ayarlar'dan açılır, varsayılan kapalı)

Ayarlardaki "İşlemleri HBYS'den doğrudan getir" tiki açılırsa eklenti hastayı
Tedavi-Plan'da beklemek yerine tek bir okuma isteği atıyor:

```
GET /Poliklinik/HastaTetkikleriniGetir?hastaId=<id>&hastaGelisId=0
```

İstek sayfanın kendi `Ext.Ajax`'ıyla gidiyor: aynı adres, aynı oturum, aynı
başlıklar — sunucu açısından ızgaranın kendi isteğinden farkı yok. Cevap dizi,
`data` ya da `result` altında gelebilir; üçü de tanınıyor, tanınmayan biçimde
hata sayılıyor. 15 saniyede yanıt gelmezse vazgeçiliyor.

Başarısız olan her durumda (istek reddedildi, biçim tanınmadı, zaman aşımı)
sessizce eski yönteme düşüyor ve pencerede neden düştüğü yazıyor. Tik kapalıyken
bu kod hiç çalışmıyor.

Bu seçenek denenmeden açılmamalı: HBYS sürümleri arasında uç nokta ve parametre
değişebiliyor. Hastanede bir kez açıp denemek, sonucunu görmek için yeterli.

Bu veriler **hiçbir yere yazılmıyor**: sağlık bilgisi ne anket kaydına ne PDF'e
giriyor, yalnızca panelde gösteriliyor.

## Erişim biçimi

`App.*` nesneleri sayfanın kendi JavaScript bağlamında yaşıyor. İçerik betikleri
yalıtılmış dünyada çalıştığından bunlara doğrudan erişemez. Okuma yapan betik
`"world": "MAIN"` ile enjekte edilmeli. Manifestteki `world` alanı Chrome
111+ ister; 109'u desteklemek için betik manifestten değil, servis işçisinden
`chrome.scripting.registerContentScripts` ile kaydediliyor — aynı alan orada
102'den beri var. Okunan veri
`window.postMessage` ile yalıtılmış içerik betiğine, oradan da panele aktarılır.

Sayfaya yazma yapılmayacak, yalnızca okuma. Ek ağ isteği atılmayacak; hâlihazırda
yüklü store okunacak.

## Kişisel veri

- Ad-soyad, T.C. kimlik numarası ve telefon veri kaydında tutulur; hepsi
  hastane içindeki klasörde kalır.
- T.C. kimlik numarası veri kaydında, anket listesinde ve **PDF'te** bulunur.
  Formda böyle bir alan olmadığı için ad soyad satırının boş kalan sağ yarısına
  yazılıyor; ad uzunsa alttaki damga satırına düşüyor. 0.11.0'da eklendi:
  arşivlenen belgeyi denetimci hasta kimliğiyle eşleştirmek istiyor.
- Aynı ay tekrar arama denetimi T.C. ile değil `HASTA_ID` ile yapılır.
- Eklenti dışarıya hiçbir istek atmaz, tüm kütüphaneler paket içine gömülüdür.

> T.C. kimlik numarası ilk sürümde hiç okunmuyordu. Anket listesinin resmî
> döküm niteliği taşıması istendiği için 0.3.0'da eklendi; daha eski
> kayıtlarda bu alan boş görünür. 0.11.0'dan önce basılan PDF'lerde de yoktur.

## Muayene günü

`MUAYENE_BASLAMA_ZAMANI` alanı çoğu kayıtta yalnızca saat taşıyor ("09:15"),
gün taşımıyor. Muayene günü aslında hastaya **son yapılan işlemin tarihidir**:
hasta o gün gelmiş, işlemler o gün yapılmıştır. Bu tarih, Tedavi-Plan
ızgarasından (ya da doğrudan sorgudan) gelen işlem satırlarının en yenisinden
okunup kayda `sonIslemTarihi` olarak yazılıyor; gün ile saat `motor/muayene.js`
içinde birleştiriliyor.

İşlem listesi hiç getirilmediyse gün ızgaradaki `TARIHI` alanından, o da yoksa
muayene alanından çözülüyor; hiçbiri gün taşımıyorsa panel uyarıyor ve alan
boş bırakılıyor — uydurulmuyor.
