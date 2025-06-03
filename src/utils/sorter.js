/**
 * SocialStatistics Eklentisi - Sıralama İşlemleri
 *
 * Bu modül, Instagram ve TikTok içeriklerinin farklı kriterlere göre sıralanması için
 * kullanılan fonksiyonları içerir.
 */

/**
 * İçerikleri belirli kriterlere göre sıralar
 *
 * @param {Array} items - Sıralanacak içerik dizisi
 * @param {string} criteria - Sıralama kriteri (date, likes, views, vb.)
 * @param {boolean} ascending - Artan sıralama ise true, azalan ise false (varsayılan: false)
 * @returns {Array} Sıralanmış içerik dizisi
 */
export function sortItems(items, criteria, ascending = false) {
    // Orijinal diziyi bozmamak için kopyala
    const sortedItems = [...items];

    // Sıralama fonksiyonu
    const sorter = (a, b) => {
        let valueA, valueB;

        // Kritere göre değerleri al
        switch (criteria) {
            case 'date':
                valueA = a.date || 0;
                valueB = b.date || 0;
                break;
            case 'likes':
                valueA = a.likes || 0;
                valueB = b.likes || 0;
                break;
            case 'views':
                valueA = a.views || 0;
                valueB = b.views || 0;
                break;
            case 'comments':
                valueA = a.comments || 0;
                valueB = b.comments || 0;
                break;
            case 'shares':
                valueA = a.shares || 0;
                valueB = b.shares || 0;
                break;
            default:
                valueA = a[criteria] || 0;
                valueB = b[criteria] || 0;
        }

        // Artan veya azalan sıralama
        if (ascending) {
            return valueA - valueB;
        } else {
            return valueB - valueA;
        }
    };

    // Sıralama işlemini gerçekleştir
    return sortedItems.sort(sorter);
}

/**
 * Instagram içeriklerini belirli kriterlere göre sıralar
 *
 * @param {Array} posts - Sıralanacak Instagram gönderileri
 * @param {string} criteria - Sıralama kriteri
 * @returns {Array} Sıralanmış Instagram gönderileri
 */
export function sortInstagramContent(posts, criteria) {
    // Özel sıralama türleri için işlemler
    if (criteria === 'date-asc') {
        return sortItems(posts, 'date', true);
    } else if (criteria === 'engagement') {
        // Etkileşim puanına göre sıralama (beğeni + yorum + görüntülenme / 100)
        return sortItems(posts, 'engagementScore');
    } else {
        return sortItems(posts, criteria);
    }
}

/**
 * TikTok içeriklerini belirli kriterlere göre sıralar
 *
 * @param {Array} videos - Sıralanacak TikTok videoları
 * @param {string} criteria - Sıralama kriteri
 * @returns {Array} Sıralanmış TikTok videoları
 */
export function sortTikTokContent(videos, criteria) {
    // Özel sıralama türleri için işlemler
    if (criteria === 'date-asc') {
        return sortItems(videos, 'date', true);
    } else if (criteria === 'engagement') {
        // TikTok videolarına etkileşim puanı ekle
        const videosWithEngagement = videos.map(video => {
            const engagementScore = (video.likes || 0) +
                                   (video.comments || 0) * 2 +
                                   (video.shares || 0) * 3 +
                                   (video.views || 0) / 100;
            return { ...video, engagementScore };
        });

        return sortItems(videosWithEngagement, 'engagementScore');
    } else {
        return sortItems(videos, criteria);
    }
}

/**
 * İçerik dizisinden istatistiksel özet bilgileri hesaplar
 *
 * @param {Array} items - İçerik dizisi
 * @returns {Object} İstatistiksel özet bilgileri
 */
export function calculateContentStats(items) {
    if (!items || items.length === 0) {
        return {
            count: 0,
            avgLikes: 0,
            avgComments: 0,
            avgViews: 0,
            avgShares: 0,
            bestPerforming: null,
            worstPerforming: null
        };
    }

    // Toplam değerler
    let totalLikes = 0;
    let totalComments = 0;
    let totalViews = 0;
    let totalShares = 0;

    // En iyi ve en kötü performans gösteren içerikler
    let bestItem = items[0];
    let worstItem = items[0];

    // Her içerik için değerleri topla ve karşılaştır
    items.forEach(item => {
        const likes = item.likes || 0;
        const comments = item.comments || 0;
        const views = item.views || 0;
        const shares = item.shares || 0;

        // Toplamları güncelle
        totalLikes += likes;
        totalComments += comments;
        totalViews += views;
        totalShares += shares;

        // Toplam etkileşim puanı hesapla
        const itemEngagement = likes + comments * 2 + shares * 3 + views / 100;
        const bestEngagement = bestItem.likes + bestItem.comments * 2 +
                             (bestItem.shares || 0) * 3 + (bestItem.views || 0) / 100;
        const worstEngagement = worstItem.likes + worstItem.comments * 2 +
                              (worstItem.shares || 0) * 3 + (worstItem.views || 0) / 100;

        // En iyi performansı güncelle
        if (itemEngagement > bestEngagement) {
            bestItem = item;
        }

        // En kötü performansı güncelle
        if (itemEngagement < worstEngagement) {
            worstItem = item;
        }
    });

    // Ortalama değerleri hesapla
    const count = items.length;
    const avgLikes = totalLikes / count;
    const avgComments = totalComments / count;
    const avgViews = totalViews / count;
    const avgShares = totalShares / count;

    return {
        count,
        avgLikes,
        avgComments,
        avgViews,
        avgShares,
        bestPerforming: bestItem,
        worstPerforming: worstItem
    };
}

/**
 * İki tarih arasındaki içerikleri filtreler
 *
 * @param {Array} items - İçerik dizisi
 * @param {Date|number} startDate - Başlangıç tarihi
 * @param {Date|number} endDate - Bitiş tarihi
 * @returns {Array} Filtrelenmiş içerik dizisi
 */
export function filterItemsByDateRange(items, startDate, endDate) {
    // Tarihleri milisaniye cinsine dönüştür
    const start = startDate instanceof Date ? startDate.getTime() : startDate;
    const end = endDate instanceof Date ? endDate.getTime() : endDate;

    // Tarih aralığına göre filtrele
    return items.filter(item => {
        const itemDate = item.date instanceof Date ? item.date.getTime() : item.date;
        return itemDate >= start && itemDate <= end;
    });
}
