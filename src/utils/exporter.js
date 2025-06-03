/**
 * SocialStatistics Eklentisi - Dışa Aktarma İşlemleri
 *
 * Bu modül, Instagram ve TikTok içeriklerinin farklı formatlarda (CSV, JSON, Excel)
 * dışa aktarılması için gerekli fonksiyonları içerir.
 */

/**
 * İçerikleri CSV formatına dönüştürür
 *
 * @param {Array} items - Dışa aktarılacak içerik dizisi
 * @param {string} platform - Platform adı ('instagram' veya 'tiktok')
 * @returns {string} CSV formatında içerik verisi
 */
export function convertToCSV(items, platform) {
    if (!items || items.length === 0) {
        return '';
    }

    // Platform'a özgü başlıklar
    let headers;
    if (platform === 'instagram') {
        headers = ['ID', 'Tarih', 'Açıklama', 'Beğeni Sayısı', 'Görüntülenme Sayısı', 'Yorum Sayısı', 'Tür', 'URL'];
    } else if (platform === 'tiktok') {
        headers = ['ID', 'Tarih', 'Açıklama', 'Beğeni Sayısı', 'Görüntülenme Sayısı', 'Yorum Sayısı', 'Paylaşım Sayısı', 'URL'];
    } else {
        headers = Object.keys(items[0]);
    }

    // Veri satırlarını oluştur
    const rows = items.map(item => {
        if (platform === 'instagram') {
            return [
                item.id || '',
                formatDate(item.date),
                escapeCsvValue(item.caption || ''),
                item.likes || 0,
                item.views || 0,
                item.comments || 0,
                item.type || 'post',
                item.url || ''
            ];
        } else if (platform === 'tiktok') {
            return [
                item.id || '',
                formatDate(item.date),
                escapeCsvValue(item.caption || ''),
                item.likes || 0,
                item.views || 0,
                item.comments || 0,
                item.shares || 0,
                item.url || ''
            ];
        } else {
            return headers.map(header => {
                const value = item[header];
                return (typeof value === 'string') ? escapeCsvValue(value) : (value || '');
            });
        }
    });

    // CSV oluştur
    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
}

/**
 * CSV değerlerindeki özel karakterleri escape eder
 *
 * @param {string} value - Escape edilecek değer
 * @returns {string} Escape edilmiş değer
 */
function escapeCsvValue(value) {
    if (!value) return '';

    // Çift tırnak içeren metinleri düzelt ve metni çift tırnak içine al
    value = value.replace(/"/g, '""');
    return `"${value}"`;
}

/**
 * Tarihi formatlar
 *
 * @param {Date|number|string} date - Formatlanacak tarih
 * @returns {string} Formatlanmış tarih
 */
function formatDate(date) {
    if (!date) return '';

    const dateObj = new Date(date);

    // ISO formatına dönüştür (2023-01-01T12:30:45)
    return dateObj.toISOString();
}

/**
 * İçerikleri JSON formatına dönüştürür
 *
 * @param {Array} items - Dışa aktarılacak içerik dizisi
 * @param {boolean} prettyPrint - JSON formatını güzelleştir (varsayılan: true)
 * @returns {string} JSON formatında içerik verisi
 */
export function convertToJSON(items, prettyPrint = true) {
    if (!items) return '[]';

    return prettyPrint ? JSON.stringify(items, null, 2) : JSON.stringify(items);
}

/**
 * İçerikleri XLSX (Excel) formatına dönüştürmek için veri hazırlar
 * Not: Bu fonksiyon tarayıcıda basit bir Excel dosyası oluşturur.
 *
 * @param {Array} items - Dışa aktarılacak içerik dizisi
 * @param {string} platform - Platform adı ('instagram' veya 'tiktok')
 * @returns {Blob} Excel formatında içerik verisi
 */
export function prepareForExcel(items, platform) {
    // HTML tablosu oluştur
    let html = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">';
    html += '<head><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Sayfa1</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->';
    html += '<meta http-equiv="content-type" content="text/plain; charset=UTF-8"/></head><body>';

    // Tablo başlangıcı
    html += '<table>';

    // Başlıklar
    html += '<tr>';
    let headers;
    if (platform === 'instagram') {
        headers = ['ID', 'Tarih', 'Açıklama', 'Beğeni Sayısı', 'Görüntülenme Sayısı', 'Yorum Sayısı', 'Tür', 'URL'];
    } else if (platform === 'tiktok') {
        headers = ['ID', 'Tarih', 'Açıklama', 'Beğeni Sayısı', 'Görüntülenme Sayısı', 'Yorum Sayısı', 'Paylaşım Sayısı', 'URL'];
    } else {
        headers = Object.keys(items[0] || {});
    }

    // Başlık hücreleri
    headers.forEach(header => {
        html += `<th>${header}</th>`;
    });
    html += '</tr>';

    // Veri satırları
    items.forEach(item => {
        html += '<tr>';
        if (platform === 'instagram') {
            html += `<td>${item.id || ''}</td>`;
            html += `<td>${new Date(item.date).toLocaleString()}</td>`;
            html += `<td>${(item.caption || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>`;
            html += `<td>${item.likes || 0}</td>`;
            html += `<td>${item.views || 0}</td>`;
            html += `<td>${item.comments || 0}</td>`;
            html += `<td>${item.type || 'post'}</td>`;
            html += `<td>${item.url || ''}</td>`;
        } else if (platform === 'tiktok') {
            html += `<td>${item.id || ''}</td>`;
            html += `<td>${new Date(item.date).toLocaleString()}</td>`;
            html += `<td>${(item.caption || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>`;
            html += `<td>${item.likes || 0}</td>`;
            html += `<td>${item.views || 0}</td>`;
            html += `<td>${item.comments || 0}</td>`;
            html += `<td>${item.shares || 0}</td>`;
            html += `<td>${item.url || ''}</td>`;
        } else {
            headers.forEach(header => {
                const value = item[header];
                html += `<td>${value !== undefined && value !== null ? value : ''}</td>`;
            });
        }
        html += '</tr>';
    });

    // Tablo sonu
    html += '</table></body></html>';

    // Excel uyumlu bir HTML Blob oluştur
    return new Blob([html], {type: 'application/vnd.ms-excel'});
}

/**
 * Dosya adı oluşturur
 *
 * @param {string} platform - Platform adı ('instagram' veya 'tiktok')
 * @param {string} username - Kullanıcı adı
 * @param {string} format - Dosya formatı ('csv', 'json', 'excel')
 * @returns {string} Oluşturulan dosya adı
 */
export function generateFilename(platform, username, format) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const sanitizedUsername = (username || 'user').replace(/[^a-zA-Z0-9_]/g, '_');

    let extension;
    switch (format) {
        case 'json':
            extension = 'json';
            break;
        case 'excel':
            extension = 'xlsx';
            break;
        case 'csv':
        default:
            extension = 'csv';
            break;
    }

    return `${platform}_${sanitizedUsername}_${timestamp}.${extension}`;
}

/**
 * İçerikleri dışa aktarır ve dosyayı indirmek için URL oluşturur
 *
 * @param {Array} items - Dışa aktarılacak içerik dizisi
 * @param {string} format - Dışa aktarma formatı ('csv', 'json', 'excel')
 * @param {string} platform - Platform adı ('instagram' veya 'tiktok')
 * @param {string} username - Kullanıcı adı
 * @returns {Object} Dosya verisi, adı ve içerik türü
 */
export function exportData(items, format, platform, username) {
    let data, filename, contentType;

    switch (format) {
        case 'json':
            data = convertToJSON(items);
            filename = generateFilename(platform, username, 'json');
            contentType = 'application/json';
            break;

        case 'excel':
            data = prepareForExcel(items, platform);
            filename = generateFilename(platform, username, 'excel');
            contentType = 'application/vnd.ms-excel';
            break;

        case 'csv':
        default:
            data = convertToCSV(items, platform);
            filename = generateFilename(platform, username, 'csv');
            contentType = 'text/csv';
            break;
    }

    return {
        data,
        filename,
        contentType,
        itemCount: items.length
    };
}
