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
| `TC_KIMLIK_NO` | **Kullanılmayacak** (aşağıya bkz.) |

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

## Erişim biçimi

`App.*` nesneleri sayfanın kendi JavaScript bağlamında yaşıyor. İçerik betikleri
yalıtılmış dünyada çalıştığından bunlara doğrudan erişemez. Okuma yapan betik
`"world": "MAIN"` ile enjekte edilmeli (MV3, Chrome 111+); yan panel zaten
Chrome 114+ istediği için bu ek bir kısıt getirmiyor. Okunan veri
`window.postMessage` ile yalıtılmış içerik betiğine, oradan da panele aktarılır.

Sayfaya yazma yapılmayacak, yalnızca okuma. Ek ağ isteği atılmayacak; hâlihazırda
yüklü store okunacak.

## Kişisel veri

- T.C. kimlik numarası hiçbir yere yazılmayacak. Aynı ay tekrar arama denetimi
  için `HASTA_ID` yeterli.
- Ad-soyad ve telefon yalnızca PDF'in kendisinde ve yanındaki veri dosyasında
  tutulacak; ikisi de hastane içindeki klasörde kalacak.
- Eklenti dışarıya hiçbir istek atmayacak, tüm kütüphaneler paket içine gömülü
  olacak.
