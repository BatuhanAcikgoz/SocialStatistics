/**
 * Browser API Compatibility Layer
 *
 * Bu modül, Chrome ve Firefox arasındaki API farklılıklarını giderir.
 * Her iki tarayıcıda da aynı kodun çalışmasını sağlar.
 */

// Tarayıcıyı belirle
const browserAPI = (function() {
    // Firefox mı kontrol et (browser nesnesi varsa Firefox'tur)
    if (typeof browser !== 'undefined') {
        return browser;
    }
    // Chrome API'sini kullan
    return chrome;
})();

/**
 * Promise tabanlı storage.local.get
 * @param {string|Array|Object} keys - Alınacak verilerin anahtarları
 * @returns {Promise<Object>} Veriler
 */
export function storageGet(keys) {
    if (typeof browser !== 'undefined' && browser.storage) {
        // Firefox: Promise desteği var
        return browser.storage.local.get(keys);
    } else {
        // Chrome: Promise desteği için sarmalama gerekiyor
        return new Promise((resolve, reject) => {
            chrome.storage.local.get(keys, (result) => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                } else {
                    resolve(result);
                }
            });
        });
    }
}

/**
 * Promise tabanlı storage.local.set
 * @param {Object} items - Kaydedilecek veriler
 * @returns {Promise<void>} İşlem sonucu
 */
export function storageSet(items) {
    if (typeof browser !== 'undefined' && browser.storage) {
        // Firefox: Promise desteği var
        return browser.storage.local.set(items);
    } else {
        // Chrome: Promise desteği için sarmalama gerekiyor
        return new Promise((resolve, reject) => {
            chrome.storage.local.set(items, () => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                } else {
                    resolve();
                }
            });
        });
    }
}

/**
 * Promise tabanlı storage.local.remove
 * @param {string|Array} keys - Silinecek veri anahtarları
 * @returns {Promise<void>} İşlem sonucu
 */
export function storageRemove(keys) {
    if (typeof browser !== 'undefined' && browser.storage) {
        // Firefox: Promise desteği var
        return browser.storage.local.remove(keys);
    } else {
        // Chrome: Promise desteği için sarmalama gerekiyor
        return new Promise((resolve, reject) => {
            chrome.storage.local.remove(keys, () => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                } else {
                    resolve();
                }
            });
        });
    }
}

/**
 * Promise tabanlı runtime.sendMessage
 * @param {any} message - Gönderilecek mesaj
 * @returns {Promise<any>} Yanıt
 */
export function sendMessage(message) {
    if (typeof browser !== 'undefined' && browser.runtime) {
        // Firefox: Promise desteği var
        return browser.runtime.sendMessage(message);
    } else {
        // Chrome: Promise desteği için sarmalama gerekiyor
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage(message, (response) => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                } else {
                    resolve(response);
                }
            });
        });
    }
}

/**
 * Promise tabanlı tabs.sendMessage
 * @param {number} tabId - Mesaj gönderilecek sekme ID'si
 * @param {any} message - Gönderilecek mesaj
 * @returns {Promise<any>} Yanıt
 */
export function sendTabMessage(tabId, message) {
    if (typeof browser !== 'undefined' && browser.tabs) {
        // Firefox: Promise desteği var
        return browser.tabs.sendMessage(tabId, message);
    } else {
        // Chrome: Promise desteği için sarmalama gerekiyor
        return new Promise((resolve, reject) => {
            try {
                chrome.tabs.sendMessage(tabId, message, (response) => {
                    // Chrome'da lastError boş olabilir veya yanıt alamama durumu olabilir
                    if (chrome.runtime.lastError) {
                        console.error('Mesaj gönderme hatası:', chrome.runtime.lastError);
                        // Hatayı reject etmek yerine null yanıt dönelim
                        resolve(null);
                    } else {
                        resolve(response);
                    }
                });
            } catch (error) {
                console.error('Mesaj gönderme istisnası:', error);
                resolve(null);
            }
        });
    }
}

/**
 * Promise tabanlı downloads.download
 * @param {Object} options - İndirme seçenekleri
 * @returns {Promise<number>} İndirme ID'si
 */
export function downloadFile(options) {
    if (typeof browser !== 'undefined' && browser.downloads) {
        // Firefox: Promise desteği var
        return browser.downloads.download(options);
    } else {
        // Chrome: Promise desteği için sarmalama gerekiyor
        return new Promise((resolve, reject) => {
            try {
                chrome.downloads.download(options, (downloadId) => {
                    if (chrome.runtime.lastError) {
                        console.error('İndirme hatası:', chrome.runtime.lastError);
                        reject(chrome.runtime.lastError);
                    } else {
                        resolve(downloadId);
                    }
                });
            } catch (error) {
                console.error('İndirme istisnası:', error);
                reject(error);
            }
        });
    }
}

/**
 * Promise tabanlı tabs.query
 * @param {Object} queryInfo - Sorgu parametreleri
 * @returns {Promise<Array>} Bulunan sekmeler
 */
export function queryTabs(queryInfo) {
    if (typeof browser !== 'undefined' && browser.tabs) {
        // Firefox: Promise desteği var
        return browser.tabs.query(queryInfo);
    } else {
        // Chrome: Promise desteği için sarmalama gerekiyor
        return new Promise((resolve, reject) => {
            chrome.tabs.query(queryInfo, (tabs) => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                } else {
                    resolve(tabs);
                }
            });
        });
    }
}

export default {
    storageGet,
    storageSet,
    storageRemove,
    sendMessage,
    sendTabMessage,
    downloadFile,
    queryTabs,
    // Diğer tarayıcı API'lerine doğrudan erişim
    api: browserAPI
};
