# HHD.FR.19 form analizi

Kaynak: `HHD.FR.19 HASTA MEMNUNİYET ANKETİ`, Rev. 01 – 03.11.2025,
Avcılar Ağız ve Diş Sağlığı Merkezi.

## Dosyanın yapısı

| | |
|---|---|
| Sayfa | 1 sayfa, A4 (595.32 × 841.92 pt) |
| Üretim | Microsoft Word 2016, PDF 1.5 |
| İçerik | Vektörel metin + 2 logo görseli + 182 çizgi (tablo) |
| Form alanı | **Yok** – AcroForm/widget tanımlı değil |

Form alanı olmadığı için doldurma işlemi "alan doldurma" değil, mevcut sayfanın
**üzerine çizim**. Şablon böylece bit düzeyinde korunuyor: çıktı milimetrik
olarak aslıyla aynı kalıyor.

## Yazı tipi: gömme zorunlu

Şablondaki yazı tipleri (Times New Roman, Arial, Calibri) belgeye **alt küme
(subset)** olarak gömülü; yalnızca formda geçen karakterleri içeriyorlar. Yani
şablonun kendi yazı tipini ödünç alıp "ŞÜKRÜ DOĞAN" yazmak mümkün değil.

PDF'in standart 14 yazı tipi (Helvetica, Times, Courier) WinAnsi kodlamasıyla
sınırlı; `ş ğ ı İ` karakterlerini basmıyor. Bu yüzden eklentiye Türkçe destekli
bir TTF gömülecek ve `pdf-lib` + `fontkit` ile alt kümelenerek kullanılacak.

Prototipte **Liberation Serif** (384 KB, Times New Roman ile metrik uyumlu,
`şŞğĞıİöÖüÜçÇ` tam) kullanıldı; şablonun Times görünümüne oturuyor.

## Tablo geometrisi

Sütun sınırları (x): `33.6 | 70.0 | 304.0 | 450.2 | 581.6`

| Sütun | Aralık | İçerik |
|---|---|---|
| 1 | 33.6–70.0 | SIRA NO |
| 2 | 70.0–304.0 | ANKET SORULARI |
| 3 | 304.0–450.2 | Sorunun sadeleştirilmiş hâli (3., 6. ve 7. soruda **boş**) |
| 4 | 450.2–581.6 | 1–5 seçenekleri (başlığı "AÇIKLAMA/ÖNERİ") |

Satır sınırları (y): `356.0` (başlık) `391.0` `442.3` `493.5` `544.9` `596.0`
`637.4` `710.4` `761.6` `812.2`

Tablo `812.2`'de bitiyor, sayfa `841.92`'de. Aradaki ~30 pt, onay damgası
satırı için yeterli — şablona dokunmadan.

## İşaretleme yöntemi

1. **Parantezlere "X"** – Ankete Katılan, Cinsiyet, Yaş Grubu ve Eğitim
   Durumu satırlarındaki 18 adet `(  )` işaretinin tam koordinatı çıkarıldı.
2. **Seçilen cevaba halka** – 1–8 soruları için 40 seçeneğin dikdörtgeni
   çıkarıldı; etrafına hafif eğimli, düzensizliği olan bir elips çiziliyor.
3. **İki nokta yanına yazı** – ad-soyad, telefon ve poliklinik.

Koordinatların tamamı `arastirma/form-geometrisi.json` içinde; doğrulama
prototipi `arastirma/isaretleme-prototipi.py`.

### Halkanın dikkat isteyen yerleri

Seçenek metinleri düzgün bir ızgaraya oturmuyor. Halka çizen kod **metni
çalışma anında ayrıştırmamalı**, hazır koordinat tablosunu kullanmalı:

| Durum | Soru/seçenek |
|---|---|
| Seçenek iki satıra sarıyor (halka iki dikdörtgeni kapsamalı) | 1/3, 6/3, 6/5, 7/3 |
| Seçenek önceki seçenekle aynı satırı paylaşıyor | 1/4 (x≈493.1), 7/4 (x≈491.3) |
| İki seçenek tek satırda yan yana | 5/3–5/4, 8/2–8/3 |

## İstatistiği etkileyen noktalar

### "Fikrim yok" cevapları orta puan değil

| Soru | 3 numaralı seçenek |
|---|---|
| 4. Doktor yeterli bilgi verdi mi? | "Bilgi istemedim" |
| 6. Mahremiyete özen gösterildi mi? | "Farkında değildim, bilmiyorum, vb" |

İkisi de memnuniyet ölçen bir orta değer değil, kapsam dışı cevap. 3 puan
sayılırlarsa ortalamayı yukarı çekerler.

### Tetkik sorusu 7. sırada, "yaptırmadım" seçeneği yok

Soru metni: *"7. Tahlil ya da tetkik yaptırdıysanız sonuçlarını size belirtilen
sürede alabildiniz mi?"* — koşullu başlıyor ama "tetkik yaptırmadım" seçeneği
yok. Ağız-diş merkezinde her hastaya tetkik yapılmadığı için panelde bir
"tetkik yok" düğmesi gerekiyor.

> Not: Bu soru önceki değerlendirmede 5. soru olarak anılmıştı. 5. soru
> hastane temizliği; tetkik sorusu 7. sırada. "Boş orta sütuna not düşülür"
> yaklaşımı yine geçerli: 7. soru satırının orta sütunu (304.0–450.2 /
> 710.4–761.6) gerçekten boş.

### Şablondaki yazım tutarsızlıkları

| Yer | Durum |
|---|---|
| 3. soru | Ölçek `0 "çok yetersiz"` diye yazılmış, seçenekler 1–5 |
| 8. soru | Ölçek `5 "iyiydi"` diyor, seçenek `5.Çok iyiydi` |
| 1. ve 7. soru | 5. seçenekte nokta yok: `5 Hiç beklemedim` / `5 Hiç beklemdim` (yazım hatası) |

Hepsi PDF'te olduğu gibi kalacak; bir sonraki revizyonda düzeltilebilir.

### Serbest görüş alanı yok — arka sayfaya yazılıyor

4. sütunun başlığı "AÇIKLAMA/ÖNERİ" olmasına rağmen sütun 1–5 seçeneklerini
barındırıyor; hastanın kendi cümlelerini yazacak ayrılmış bir alan yok.

Hastanın söyledikleri anketin gerçekten yapıldığına dair delil olduğu için
çıktıya giriyor, ama **forma değil arkasına**:

| | |
|---|---|
| Tablo altı | 812.2 pt |
| Sayfa sonu | 841.92 pt |
| Aradaki boşluk | 29.7 pt (10,5 mm) |
| Yazıcının basamadığı alt kenar | ~4,5 mm |
| Kullanılabilir şerit | **~13 pt** |

O 13 punto onay damgasının kendisine gidiyor. Sayfanın altına metin sığmıyor;
formun ortasındaki boş sütuna yazmak ise (önceki denemede yapıldığı gibi)
sayfayı dağıtıyor.

Bu yüzden görüş, "HHD.FR.19 HASTA MEMNUNİYET ANKETİ — HASTA GÖRÜŞÜ" başlıklı
ek bir sayfaya yazılıyor. Sayfada hastanın adı, polikliniği ve aynı tarih
damgası tekrar ediyor. Metin uzunsa sayfa çoğalıyor; hiçbir durumda
kırpılmıyor. 1. sayfadaki damgaya "Hasta görüşü arka sayfada" notu ekleniyor,
böylece yalnızca ön yüzü görenin de haberi oluyor.

Aynı metin veri kaydında da tutuluyor ve aylık raporda listeleniyor.
