# Gömülü varlıklar

Eklenti çalışırken internete hiçbir istek atmaz; ihtiyaç duyduğu her şey
burada gömülüdür.

| Dosya | Ne | Sürüm / Kaynak |
|---|---|---|
| `HHD.FR.19-bos-form.pdf` | Boş anket şablonu | Rev.01 – 03.11.2025 |
| `LiberationSerif-Regular.ttf` | Türkçe destekli yazı tipi | Liberation Fonts, SIL OFL 1.1 |
| `pdf-lib.esm.min.js` | PDF okuma/yazma | pdf-lib 1.17.1 (dağıtımdaki ESM yapısı) |
| `fontkit.esm.js` | Yazı tipi gömme ve alt kümeleme | @pdf-lib/fontkit 1.1.1 + pako 3.0.1 |

## fontkit neden yeniden paketlendi

`@pdf-lib/fontkit` dağıtımındaki `fontkit.es.min.js` kendi içinde yeterli
değil: `pako` paketini çıplak bir `import` ile çağırıyor. Tarayıcıda paket
çözücü olmadığı için bu dosya doğrudan yüklenemiyor. UMD yapısı ise ES modülü
olarak içe aktarıldığında kendini global nesneye iliştirmeye çalışıyor.

Bu yüzden `pako` ile birlikte tek bir bağımsız ES modülüne paketlendi:

```bash
npm install @pdf-lib/fontkit pako esbuild
echo 'export { default } from "@pdf-lib/fontkit";' > giris.mjs
npx esbuild giris.mjs --bundle --format=esm --minify \
    --platform=browser --outfile=fontkit.esm.js
```

Sonuç `eval` içermiyor; Manifest V3'ün içerik güvenlik politikasına uyuyor.

Lisans metinleri `lisans/` klasöründe.
