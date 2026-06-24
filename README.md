# 🚀 RoketLig - 3D Araba Futbolu

Tarayıcı üzerinden oynanabilen, Three.js ve React Three Fiber ile geliştirilmiş **Rocket League** tarzı 3D araba futbolu oyunu.

## 🎮 Özellikler

- 🏎️ **Tam Araba Fiziği**: İvmelenme, frenleme, zıplama, çift zıplama, dodge/flip, boost
- ⚽ **Gerçekçi Top Fiziği**: Rapier.js WASM fizik motoru
- 🤖 **Bot Rakipler**: 3 zorluk seviyesi (Kolay, Orta, Zor)
- 🏟️ **3D Arena**: Duvarlar, tavan, kaleler, eğimli köşeler
- ⚡ **Boost Sistemi**: Büyük ve küçük boost pad'leri
- 📸 **Kamera Sistemi**: Ball Cam / Car Cam geçişi (Y tuşu)
- 💥 **Demolition**: Süpersonik hızda rakibi patlatma
- 🎯 **Gol Algılama**: Otomatik skor takibi ve maç zamanlayıcısı
- ⏱️ **Overtime**: Berabere biten maçlarda uzatma

## 🎮 Kontroller

| Tuş | Aksiyon |
|-----|---------|
| `W` / `S` | İleri / Geri |
| `A` / `D` | Sola / Sağa |
| `Space` | Zıplama (çift zıplama / dodge) |
| `Shift` | Boost |
| `Y` | Ball Cam aç/kapa |
| `Q` / `E` | Air Roll |
| `Tab` | Skor tablosu |

## 🛠️ Teknolojiler

- **React** + **TypeScript**
- **Three.js** / **React Three Fiber (R3F)**
- **Rapier.js** (3D Fizik Motoru - WASM)
- **Zustand** (State Management)
- **Vite** (Build Tool)

## 🚀 Kurulum ve Çalıştırma

```bash
# Bağımlılıkları yükle
npm install

# Geliştirme sunucusunu başlat
npm run dev

# Üretim için build
npm run build
```

## 📦 Deploy

Bu proje statik bir web sitesi olarak Vercel, Netlify veya herhangi bir statik hosting servisinde yayınlanabilir.

```bash
npm run build
# dist/ klasörünü deploy edin
```

## 📝 Lisans

MIT License
