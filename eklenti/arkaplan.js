/* Servis işçisi: yan paneli yalnızca HBYS sekmesinde açar. */
"use strict";

const HBYS = "10.212.200.215";

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch(() => { /* eski sürümlerde yok */ });
});

function hbysMi(url) {
  try { return new URL(url).hostname === HBYS; } catch { return false; }
}

async function paneliAyarla(tabId, url) {
  try {
    if (hbysMi(url)) {
      await chrome.sidePanel.setOptions({ tabId, path: "panel/panel.html", enabled: true });
    } else {
      await chrome.sidePanel.setOptions({ tabId, enabled: false });
    }
  } catch { /* sekme kapanmış olabilir */ }
}

chrome.tabs.onUpdated.addListener((tabId, bilgi, sekme) => {
  if (bilgi.status === "loading" || bilgi.url) paneliAyarla(tabId, sekme.url || "");
});

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  try {
    const sekme = await chrome.tabs.get(tabId);
    paneliAyarla(tabId, sekme.url || "");
  } catch { /* yoksay */ }
});

/* Ağ klasörü erişilemediğinde bekleyen kayıtlar için panele dürtü. */
chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create("kuyruk", { periodInMinutes: 5 });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== "kuyruk") return;
  chrome.runtime.sendMessage({ kaynak: "arkaplan", tip: "kuyrugu-dene" }).catch(() => {});
});
