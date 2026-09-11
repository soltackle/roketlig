#!/usr/bin/env bash
# Eklentiyi dağıtıma hazırlar: ZIP (paketlenmemiş yükleme için) ve
# imzalı CRX (grup politikasıyla dağıtım için).
#
#   ./araclar/paketle.sh [imza-anahtari.pem]
#
# Anahtar verilmezse yeni bir tane üretilir ve dagitim/ altına yazılır.
# DİKKAT: eklenti kimliği imza anahtarından türer. Anahtar değişirse
# kimlik de değişir ve Chrome yeni sürümü güncelleme değil, ayrı bir
# eklenti sayar. Anahtarı saklayın; depoya koymayın.

set -euo pipefail

kok="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
kaynak="$kok/eklenti"
hedef="$kok/dagitim"
anahtar="${1:-}"

: "${CHROME:=$(command -v google-chrome || command -v chromium || command -v chromium-browser || true)}"

surum="$(node -p "require('$kaynak/manifest.json').version")"
mkdir -p "$hedef"

# ── ZIP ────────────────────────────────────────────────────
zip_yolu="$hedef/hhd-fr-19-anket-$surum.zip"
rm -f "$zip_yolu"
(cd "$kaynak" && zip -rq "$zip_yolu" . -x '.*')
echo "ZIP : $zip_yolu"

# ── CRX ────────────────────────────────────────────────────
if [[ -z "$CHROME" ]]; then
  echo "CRX : atlandı (Chrome bulunamadı; CHROME=/yol/chrome ile verin)" >&2
  exit 0
fi

gecici="$(mktemp -d)"
trap 'rm -rf "$gecici"' EXIT
cp -r "$kaynak" "$gecici/eklenti"

if [[ -n "$anahtar" ]]; then
  "$CHROME" --no-sandbox --pack-extension="$gecici/eklenti" \
            --pack-extension-key="$anahtar" >/dev/null 2>&1
else
  "$CHROME" --no-sandbox --pack-extension="$gecici/eklenti" >/dev/null 2>&1
  anahtar="$hedef/imza-anahtari.pem"
  cp "$gecici/eklenti.pem" "$anahtar"
  chmod 600 "$anahtar"
  echo "ANAHTAR ÜRETİLDİ: $anahtar — saklayın, depoya koymayın"
fi

crx_yolu="$hedef/hhd-fr-19-anket-$surum.crx"
cp "$gecici/eklenti.crx" "$crx_yolu"
echo "CRX : $crx_yolu"

# ── Kimlik ─────────────────────────────────────────────────
kimlik="$(openssl rsa -in "$anahtar" -pubout -outform DER 2>/dev/null | python3 -c "
import hashlib, sys
h = hashlib.sha256(sys.stdin.buffer.read()).hexdigest()[:32]
print(''.join(chr(ord('a') + int(c, 16)) for c in h))
")"
echo "KİMLİK: $kimlik"
echo "$kimlik" > "$hedef/eklenti-kimligi.txt"
