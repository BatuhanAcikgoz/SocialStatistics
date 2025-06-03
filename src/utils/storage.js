/**
 * SocialStatistics Eklentisi - Veri Depolama İşlemleri
 *
 * Bu modül, eklentinin veri depolama ve yükleme işlemlerini yönetir.
 * Browser API'si kullanılarak veriler tarayıcıda saklanır.
 */

import { storageGet, storageSet, storageRemove } from './browser-api.js';

/**
 * Verileri yerel depolamaya kaydeder
 *
 * @param {string} key - Veri anahtarı
 * @param {any} data - Kaydedilecek veri
 * @returns {Promise} İşlem sonucu
 */
export function saveData(key, data) {
    const saveObj = {};
    saveObj[key] = data;
    return storageSet(saveObj);
}

/**
 * Yerel depolamadan verileri yükler
 *
 * @param {string} key - Yüklenecek veri anahtarı
 * @returns {Promise<any>} Yüklenen veri
 */
export function loadData(key) {
    return storageGet([key]).then(result => result[key]);
}

/**
 * Yerel depolamadan belirli bir anahtarı siler
 *
 * @param {string} key - Silinecek veri anahtarı
 * @returns {Promise} İşlem sonucu
 */
export function removeData(key) {
    return storageRemove(key);
}

/**
 * Eklenti ayarlarını yükler
 *
 * @returns {Promise<Object>} Eklenti ayarları
 */
export async function loadSettings() {
    const settings = await loadData('settings');

    // Varsayılan ayarlar
    const defaultSettings = {
        autoSort: false,
        defaultSortCriteria: 'date',
        defaultExportFormat: 'excel',
        darkMode: false,
        maxItemsToCollect: 1000
    };

    // Eğer ayarlar yoksa varsayılanları kullan
    if (!settings) {
        await saveData('settings', defaultSettings);
        return defaultSettings;
    }

    // Eksik ayarları varsayılanlarla tamamla
    const mergedSettings = { ...defaultSettings, ...settings };

    // Eğer eksik ayarlar varsa tamamla ve kaydet
    if (Object.keys(mergedSettings).length !== Object.keys(settings).length) {
        await saveData('settings', mergedSettings);
    }

    return mergedSettings;
}

/**
 * Eklenti ayarlarını günceller
 *
 * @param {Object} newSettings - Yeni ayarlar
 * @returns {Promise<Object>} Güncellenmiş tüm ayarlar
 */
export async function updateSettings(newSettings) {
    // Mevcut ayarları yükle
    const currentSettings = await loadSettings();

    // Yeni ayarları mevcut ayarlarla birleştir
    const updatedSettings = { ...currentSettings, ...newSettings };

    // Güncellenmiş ayarları kaydet
    await saveData('settings', updatedSettings);

    return updatedSettings;
}

/**
 * Toplanan içerikleri yerel depolamaya kaydeder
 *
 * @param {string} platform - Platform adı ('instagram' veya 'tiktok')
 * @param {string} username - Kullanıcı adı
 * @param {Array} items - Kaydedilecek içerik dizisi
 * @returns {Promise} İşlem sonucu
 */
export async function saveCollectedContent(platform, username, items) {
    if (!platform || !username || !items) {
        throw new Error('Geçersiz parametreler');
    }

    // Kaydedilecek veri anahtarı
    const key = `${platform}_${username}_content`;

    // İçerikleri kaydet
    return saveData(key, {
        platform,
        username,
        items,
        lastUpdated: new Date().getTime()
    });
}

/**
 * Toplanan içerikleri yerel depolamadan yükler
 *
 * @param {string} platform - Platform adı ('instagram' veya 'tiktok')
 * @param {string} username - Kullanıcı adı
 * @returns {Promise<Array>} Yüklenen içerik dizisi
 */
export async function loadCollectedContent(platform, username) {
    if (!platform || !username) {
        throw new Error('Geçersiz parametreler');
    }

    // Yüklenecek veri anahtarı
    const key = `${platform}_${username}_content`;

    // İçerikleri yükle
    const data = await loadData(key);

    return data ? data.items : [];
}

/**
 * Eklentinin kullanım istatistiklerini kaydeder
 *
 * @param {string} category - İstatistik kategorisi
 * @param {string} action - Yapılan işlem
 * @param {string} label - İşleme ait etiket (opsiyonel)
 * @returns {Promise} İşlem sonucu
 */
export async function trackUsage(category, action, label = '') {
    // Mevcut istatistikleri yükle
    const stats = await loadData('usage_stats') || {};

    // Kategori istatistiklerini kontrol et
    if (!stats[category]) {
        stats[category] = {};
    }

    // İşlem istatistiklerini kontrol et
    if (!stats[category][action]) {
        stats[category][action] = {
            count: 0,
            labels: {}
        };
    }

    // İşlem sayısını artır
    stats[category][action].count++;

    // Etiket istatistiklerini güncelle
    if (label) {
        if (!stats[category][action].labels[label]) {
            stats[category][action].labels[label] = 0;
        }
        stats[category][action].labels[label]++;
    }

    // Son kullanım zamanını güncelle
    stats.lastUsed = new Date().getTime();

    // İstatistikleri kaydet
    return saveData('usage_stats', stats);
}

/**
 * Son kullanılan platformları ve kullanıcı adlarını yükler
 *
 * @returns {Promise<Array>} Son kullanılan platform ve kullanıcı adları listesi
 */
export async function getRecentlyUsed() {
    // Son kullanılanlar listesini yükle
    const recentlyUsed = await loadData('recently_used') || [];

    // Son 10 kaydı döndür
    return recentlyUsed.slice(0, 10);
}

/**
 * Son kullanılan platform ve kullanıcı adını kaydeder
 *
 * @param {string} platform - Platform adı
 * @param {string} username - Kullanıcı adı
 * @returns {Promise} İşlem sonucu
 */
export async function addToRecentlyUsed(platform, username) {
    if (!platform || !username) return;

    // Son kullanılanlar listesini yükle
    const recentlyUsed = await loadData('recently_used') || [];

    // Yeni kaydı oluştur
    const newEntry = {
        platform,
        username,
        timestamp: new Date().getTime()
    };

    // Eğer aynı kayıt varsa listeden çıkar
    const filteredList = recentlyUsed.filter(entry =>
        !(entry.platform === platform && entry.username === username)
    );

    // Yeni kaydı listenin başına ekle
    filteredList.unshift(newEntry);

    // Listeyi maksimum 20 kayıtla sınırla
    const trimmedList = filteredList.slice(0, 20);

    // Güncellenmiş listeyi kaydet
    return saveData('recently_used', trimmedList);
}
