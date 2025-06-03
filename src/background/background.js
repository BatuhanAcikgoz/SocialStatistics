/**
 * SocialStatistics Eklentisi - Arkaplan İşlemleri
 *
 * Bu script, eklentinin arkaplanda çalışan ve tüm sekmeleri koordine eden kısmıdır.
 * İndirme işlemleri ve genel durumu yönetir.
 */

// Tarayıcı API'sini belirle
const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

// Başlangıç mesajı
console.log('SocialStatistics eklentisi başlatıldı.');

// Eklenti durum değişkenleri
let activeTabs = new Map(); // Aktif sekmeleri ve durumlarını saklar

// Runtime mesajlarını dinle
browserAPI.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Arkaplan script mesaj aldı:', message);

    // Sekme değişikliklerini izle
    if (sender.tab) {
        // Aktif sekme bilgisini güncelle
        activeTabs.set(sender.tab.id, {
            url: sender.tab.url,
            platform: determinePlatform(sender.tab.url),
            lastActivity: Date.now()
        });
    }

    // Mesaj türüne göre işlem yap
    switch (message.action) {
        case 'downloadFile':
            handleDownload(message, sendResponse);
            return true; // asenkron yanıt için true döndür

        case 'trackEvent':
            trackEvent(message.category, message.action, message.label);
            sendResponse({ success: true });
            break;

        case 'getPlatformStatus':
            sendResponse({
                success: true,
                platformStatus: getPlatformStatus()
            });
            break;
    }
});

/**
 * URL'den platform türünü belirle
 */
function determinePlatform(url) {
    if (url.includes('instagram.com')) {
        return 'instagram';
    } else if (url.includes('tiktok.com')) {
        return 'tiktok';
    } else {
        return null;
    }
}

/**
 * Dosya indirme işlemini yönetir
 */
function handleDownload(message, sendResponse) {
    try {
        const { data, filename, contentType } = message;

        // Veri URL'i oluştur
        let dataUrl;

        if (contentType === 'application/vnd.ms-excel') {
            // Excel formatı için HTML string ise, yeniden Blob oluştur
            if (typeof data === 'string' && data.startsWith('blob:')) {
                // Blob URL yerine doğrudan veriyi gönder
                sendResponse({
                    success: false,
                    message: 'Lütfen Excel dışa aktarımını tekrar deneyin. Blob URL'ler doğrudan indirilemez.'
                });
                return;
            }

            // HTML içeriğinden yeni bir blob oluştur
            const blob = new Blob([data], { type: contentType });
            dataUrl = URL.createObjectURL(blob);
        }
        else if (contentType === 'text/csv' || contentType === 'application/json') {
            // Metin tabanlı veri için
            const blob = new Blob([data], { type: contentType });
            dataUrl = URL.createObjectURL(blob);
        } else {
            // Başka bir format için doğrudan URL kullan
            // Eğer blob URL ise ve farklı kaynaktan geliyorsa, hata döndür
            if (typeof data === 'string' && data.startsWith('blob:')) {
                sendResponse({
                    success: false,
                    message: 'Dosya indirme hatası: Blob URL\'ler doğrudan indirilemez.'
                });
                return;
            }
            dataUrl = data;
        }

        // Dosyayı indir
        browserAPI.downloads.download({
            url: dataUrl,
            filename: filename,
            saveAs: true
        }, (downloadId) => {
            if (browserAPI.runtime.lastError) {
                console.error('İndirme hatası:', browserAPI.runtime.lastError);
                // Hata durumunda URL nesnesini temizle
                if (dataUrl && dataUrl.startsWith('blob:')) {
                    URL.revokeObjectURL(dataUrl);
                }
                sendResponse({
                    success: false,
                    message: 'İndirme hatası: ' + browserAPI.runtime.lastError.message
                });
            } else {
                console.log('Dosya indirme başarılı. Download ID:', downloadId);
                // Başarı durumunda da URL nesnesini temizle
                if (dataUrl && dataUrl.startsWith('blob:')) {
                    URL.revokeObjectURL(dataUrl);
                }
                sendResponse({
                    success: true,
                    downloadId: downloadId
                });
            }
        });
    } catch (error) {
        console.error('Dosya indirme sırasında hata:', error);
        sendResponse({
            success: false,
            message: 'Dosya indirme sırasında hata: ' + error.message
        });
    }
}

/**
 * Eklenti kullanım metriklerini takip et
 */
function trackEvent(category, action, label) {
    // Bu fonksiyon, gelecekte kullanım analitiği eklemek istediğinizde genişletilebilir
    console.log(`Etkinlik takip: ${category} - ${action} - ${label}`);

    // Yerel depolamada basit istatistik tut
    browserAPI.storage.local.get(['usage_stats'], (result) => {
        const stats = result.usage_stats || {};

        // Kategori istatistiklerini güncelle
        if (!stats[category]) {
            stats[category] = {};
        }

        if (!stats[category][action]) {
            stats[category][action] = 0;
        }

        stats[category][action]++;

        // İstatistikleri kaydet
        browserAPI.storage.local.set({ usage_stats: stats });
    });
}

/**
 * Her platform için aktif sekme sayısını ve durumunu döndürür
 */
function getPlatformStatus() {
    const status = {
        instagram: { active: 0, total: 0 },
        tiktok: { active: 0, total: 0 }
    };

    // 5 dakikadan eski sekmeleri temizle
    const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);

    for (const [tabId, tabInfo] of activeTabs.entries()) {
        if (tabInfo.lastActivity < fiveMinutesAgo) {
            activeTabs.delete(tabId);
            continue;
        }

        if (tabInfo.platform === 'instagram') {
            status.instagram.total++;
            status.instagram.active++;
        } else if (tabInfo.platform === 'tiktok') {
            status.tiktok.total++;
            status.tiktok.active++;
        }
    }

    return status;
}

// Sekme kapatma olayını dinle
browserAPI.tabs.onRemoved.addListener((tabId) => {
    // Kapatılan sekmeyi izlenen sekmelerden kaldır
    activeTabs.delete(tabId);
});

// Eklenti yüklendiğinde ilk çalıştırma
browserAPI.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        // İlk kurulumda karşılama sayfasını aç
        browserAPI.tabs.create({
            url: browserAPI.runtime.getURL('popup/welcome.html')
        });

        // Varsayılan ayarları ayarla
        browserAPI.storage.local.set({
            settings: {
                autoSort: false,
                defaultSortCriteria: 'date',
                defaultExportFormat: 'excel'
            },
            usage_stats: {}
        });
    } else if (details.reason === 'update') {
        // Güncelleme sonrası yenilikler sayfasını açmak isterseniz
        // Şu an açılmaması için devre dışı bırakıldı
        // browserAPI.tabs.create({
        //     url: browserAPI.runtime.getURL('popup/whatsnew.html')
        // });
    }
});
