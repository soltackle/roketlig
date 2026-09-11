/* HHD.FR.19 formunun işaretleme koordinatları.
 *
 * arastirma/form-geometrisi.json dosyasından üretildi. Koordinatlar PDF
 * sayfasının SOL ÜST köşesine göre; pdf-lib sol alt köşeyi kullandığı için
 * çizim sırasında y çevriliyor (bkz. motor/pdf.js).
 *
 * Seçenek metinleri çalışma anında ayrıştırılmıyor: şablonda bazı seçenekler
 * iki satıra sarıyor, bazıları aynı satırı paylaşıyor. Gerekçesi:
 * docs/02-form-analizi.md
 */

export const GEOMETRI = {
  "kaynak": "HHD.FR.19 HASTA MEMNUNİYET ANKETİ (Rev.01 - 03.11.2025)",
  "sayfa": {
    "genislik": 595.32,
    "yukseklik": 841.92,
    "birim": "pt",
    "koordinat": "sol-ust orijin (PDF kullanici alani: sol-alt; y cevrilmeli)"
  },
  "tablo": {
    "sutunlar": [
      33.6,
      70.0,
      304.0,
      450.2,
      581.6
    ],
    "satirlar": [
      356.0,
      391.0,
      442.3,
      493.5,
      544.9,
      596.0,
      637.4,
      710.4,
      761.6,
      812.2
    ],
    "sutun_adlari": [
      "SIRA NO",
      "ANKET SORULARI",
      "(aciklama sutunu)",
      "secenekler / AÇIKLAMA-ÖNERİ"
    ]
  },
  "serbest_alanlar": {
    "ad_soyad": {
      "x": 145.0,
      "taban_y": 173.06,
      "punto": 10.5
    },
    "telefon": {
      "x": 155.0,
      "taban_y": 185.78,
      "punto": 10.5
    },
    "poliklinik": {
      "x": 188.0,
      "taban_y": 198.38,
      "punto": 10.5
    },
    "damga_satiri": {
      "x": 34.0,
      "taban_y": 824.0,
      "punto": 8.5,
      "not": "tablo alti 812.2 - sayfa sonu 841.92 arasi bos"
    },
    "tetkik_yok_notu": {
      "x": 310.0,
      "taban_y": 735.0,
      "punto": 8.5,
      "not": "7. soru satirinin bos orta sutunu (304.0-450.2 / 710.4-761.6)"
    },
    "gorus_basligi": {
      "punto": 7.0,
      "satir_yuksekligi": 8.4,
      "etiket": "Hastanın görüşü:"
    }
  },
  "parantez_kutulari": {
    "katilan": {
      "Hasta": [
        109.2,
        122.1,
        207.1
      ],
      "Hasta yakını": [
        182.9,
        195.7,
        207.1
      ]
    },
    "cinsiyet": {
      "Kadın": [
        392.4,
        405.3,
        207.1
      ],
      "Erkek": [
        470.6,
        483.5,
        207.1
      ]
    },
    "yas": {
      "20 altı": [
        106.2,
        119.0,
        219.7
      ],
      "20-29": [
        191.6,
        204.4,
        219.7
      ],
      "30-39": [
        254.8,
        267.6,
        219.7
      ],
      "40-49": [
        329.7,
        342.6,
        219.7
      ],
      "50-59": [
        409.5,
        422.3,
        219.7
      ],
      "60 üstü": [
        476.9,
        489.6,
        219.7
      ]
    },
    "egitim": {
      "Okuryazar değil": [
        109.6,
        122.4,
        232.3
      ],
      "Okuryazar": [
        212.9,
        225.7,
        232.3
      ],
      "İlkokul": [
        318.7,
        331.6,
        232.3
      ],
      "Ortaokul": [
        424.9,
        437.8,
        232.3
      ],
      "Lise": [
        106.6,
        119.5,
        245.1
      ],
      "Üniversite": [
        215.4,
        228.2,
        245.1
      ],
      "Yüksek Lisans": [
        316.4,
        329.2,
        245.1
      ],
      "Doktora": [
        424.9,
        437.8,
        245.1
      ]
    }
  },
  "secenek_kutulari": {
    "1": {
      "1": [
        [
          459.3,
          391.7,
          538.6,
          401.8
        ]
      ],
      "2": [
        [
          459.3,
          402.1,
          524.1,
          412.2
        ]
      ],
      "3": [
        [
          459.3,
          412.3,
          525.3,
          422.4
        ],
        [
          459.3,
          422.7,
          493.2,
          432.7
        ]
      ],
      "4": [
        [
          493.1,
          422.7,
          545.0,
          432.7
        ]
      ],
      "5": [
        [
          459.3,
          432.5,
          525.5,
          442.4
        ]
      ]
    },
    "2": {
      "1": [
        [
          459.3,
          442.9,
          515.1,
          453.0
        ]
      ],
      "2": [
        [
          459.3,
          453.1,
          518.1,
          463.2
        ]
      ],
      "3": [
        [
          459.3,
          463.7,
          501.8,
          473.6
        ]
      ],
      "4": [
        [
          459.3,
          474.1,
          488.0,
          484.1
        ]
      ],
      "5": [
        [
          459.3,
          483.7,
          504.4,
          493.7
        ]
      ]
    },
    "3": {
      "1": [
        [
          459.3,
          494.2,
          520.9,
          504.3
        ]
      ],
      "2": [
        [
          459.3,
          504.4,
          505.2,
          514.5
        ]
      ],
      "3": [
        [
          459.3,
          514.9,
          501.9,
          524.9
        ]
      ],
      "4": [
        [
          459.3,
          525.3,
          502.1,
          535.3
        ]
      ],
      "5": [
        [
          459.3,
          535.1,
          541.0,
          545.0
        ]
      ]
    },
    "4": {
      "1": [
        [
          459.3,
          545.6,
          530.7,
          555.6
        ]
      ],
      "2": [
        [
          459.3,
          555.9,
          526.8,
          565.9
        ]
      ],
      "3": [
        [
          459.3,
          566.3,
          523.8,
          576.2
        ]
      ],
      "4": [
        [
          459.3,
          576.7,
          506.1,
          586.7
        ]
      ],
      "5": [
        [
          459.3,
          586.2,
          544.8,
          596.2
        ]
      ]
    },
    "5": {
      "1": [
        [
          459.3,
          596.8,
          513.1,
          606.7
        ]
      ],
      "2": [
        [
          459.3,
          607.1,
          498.1,
          617.0
        ]
      ],
      "3": [
        [
          459.3,
          617.4,
          501.9,
          627.4
        ]
      ],
      "4": [
        [
          501.8,
          617.4,
          530.5,
          627.4
        ]
      ],
      "5": [
        [
          459.3,
          627.1,
          504.4,
          637.1
        ]
      ]
    },
    "6": {
      "1": [
        [
          459.3,
          638.3,
          546.1,
          648.2
        ]
      ],
      "2": [
        [
          459.3,
          648.6,
          532.9,
          658.6
        ]
      ],
      "3": [
        [
          459.3,
          658.8,
          537.4,
          668.8
        ],
        [
          459.3,
          669.1,
          516.1,
          679.1
        ]
      ],
      "4": [
        [
          459.3,
          679.7,
          522.4,
          689.6
        ]
      ],
      "5": [
        [
          459.3,
          690.0,
          526.5,
          700.0
        ],
        [
          459.3,
          700.3,
          495.1,
          710.3
        ]
      ]
    },
    "7": {
      "1": [
        [
          457.5,
          711.1,
          536.8,
          721.2
        ]
      ],
      "2": [
        [
          457.5,
          721.4,
          522.2,
          731.5
        ]
      ],
      "3": [
        [
          457.5,
          731.6,
          523.5,
          741.7
        ],
        [
          457.5,
          742.1,
          491.4,
          752.1
        ]
      ],
      "4": [
        [
          491.3,
          742.1,
          543.2,
          752.1
        ]
      ],
      "5": [
        [
          457.5,
          751.8,
          519.8,
          761.8
        ]
      ]
    },
    "8": {
      "1": [
        [
          457.5,
          770.9,
          511.3,
          780.9
        ]
      ],
      "2": [
        [
          457.5,
          781.3,
          496.3,
          791.3
        ]
      ],
      "3": [
        [
          496.2,
          781.3,
          538.6,
          791.3
        ]
      ],
      "4": [
        [
          457.5,
          791.7,
          486.2,
          801.6
        ]
      ],
      "5": [
        [
          457.5,
          802.0,
          502.6,
          811.9
        ]
      ]
    }
  },
  "notlar": [
    "1/3, 6/3, 6/5 ve 7/3 secenekleri iki satira sariyor; halka birden fazla dikdortgeni kapsamali.",
    "1/4 ve 7/4 onceki secenekle ayni satiri paylasiyor (x 493.1 / 491.3 ten baslar).",
    "5/3-5/4 ve 8/2-8/3 tek satirda yan yana.",
    "Sablonda AcroForm alani yok; isaretleme mevcut sayfa uzerine cizilir.",
    "Gomulu yazi tipleri alt kume (subset) - yeniden kullanilamaz, kendi TTF'imiz gomulmeli.",
    "Hasta gorusu 3., 6. ve 7. sorularin bos orta sutununa yazilir; sigmayan kisim ikinci sayfaya tasar, sablonun 1. sayfasi degismez."
  ],
  "gorus_hucreleri": [
    {
      "soru": 3,
      "x0": 307.5,
      "y0": 497.0,
      "x1": 446.7,
      "y1": 541.4
    },
    {
      "soru": 6,
      "x0": 307.5,
      "y0": 641.0,
      "x1": 446.7,
      "y1": 706.9
    },
    {
      "soru": 7,
      "x0": 307.5,
      "y0": 714.0,
      "x1": 446.7,
      "y1": 758.1,
      "not": "tetkik yok notu bu hucrede duruyorsa gorus icin kullanilmaz"
    }
  ]
};
