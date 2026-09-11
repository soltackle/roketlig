# HHD.FR.19 Anket Eklentisi

Avcılar Ağız ve Diş Sağlığı Merkezi'nin **HHD.FR.19 Hasta Memnuniyet Anketi**
formunu, HBYS ekranının yanındaki Chrome yan panelinden doldurup orijinal PDF
şablonunun üzerine işaretleyen tarayıcı eklentisi.

Bu depo şu an **çözümleme aşamasında**; mimari kararlar netleşince uygulama
kodu eklenecek.

## Belgeler

| Dosya | İçerik |
|---|---|
| [docs/01-hbys-veri-kaynaklari.md](docs/01-hbys-veri-kaynaklari.md) | HBYS'den hangi verinin nasıl okunabildiği |
| [docs/02-form-analizi.md](docs/02-form-analizi.md) | PDF formunun yapısı, işaretleme yöntemi, istatistik notları |

## Çözümleme çıktıları

| Dosya | İçerik |
|---|---|
| `arastirma/form-geometrisi.json` | Formdaki 18 parantez ve 40 seçeneğin tam koordinatları |
| `arastirma/isaretleme-prototipi.py` | Koordinatları görsel olarak doğrulayan prototip |

Prototipi çalıştırmak için:

```bash
pip install pymupdf
python3 arastirma/isaretleme-prototipi.py bos-form.pdf dolu-ornek.pdf
```

Prototip doğrulama amaçlıdır. Üretimde işaretleme, eklentinin içinde
`pdf-lib` + `fontkit` ile yapılacak; koordinat tablosu aynı kalacak.
