/**
 * TikTok için içerik analizi ve sıralama işlemleri
 */

// Çalışma durumunu ve verileri depolamak için kullanılan değişkenler
let collectedVideos = [];
let isCollecting = false;
let lastScrollPosition = 0;
let observerActive = false;

// TikTok sayfasının içeriğini gözlemlemek için kullanılan observer
let tiktokObserver = null;

// Chrome.runtime ile popup'tan gelen mesajları dinle
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('TikTok content script mesaj aldı:', request);

    switch (request.action) {
        case 'checkPageContent':
            handleCheckPageContent(sendResponse);
            return true; // asenkron yanıt için true döndür

        case 'sortContent':
            handleSortContent(request.sortCriteria, sendResponse);
            return true; // asenkron yanıt için true döndür

        case 'exportData':
            handleExportData(request.exportFormat, sendResponse);
            return true; // asenkron yanıt için true döndür
    }
});

/**
 * Mevcut sayfanın TikTok içeriği içerip içermediğini kontrol eder
 */
function handleCheckPageContent(sendResponse) {
    const isProfilePage = window.location.pathname.match(/^\/@[^/]+\/?$/);
    const isForYouPage = window.location.pathname === '/';
    const isVideoPage = window.location.pathname.includes('/video/');
    const isExplorePage = window.location.pathname.includes('/explore');

    // Sayfa türünü belirle
    let pageType = null;
    if (isProfilePage) pageType = 'profile';
    else if (isForYouPage) pageType = 'foryou';
    else if (isVideoPage) pageType = 'video';
    else if (isExplorePage) pageType = 'explore';

    // Eğer desteklenen bir sayfa türü varsa ve içerik tespit edildiyse
    if (pageType && detectTiktokContent()) {
        // Henüz veri toplanmadıysa otomatik olarak toplamaya başla
        if (collectedVideos.length === 0) {
            startCollectingTiktokContent();
        }

        sendResponse({
            success: true,
            pageType: pageType,
            previewData: collectedVideos.slice(0, 5) // İlk 5 içeriği önizleme için gönder
        });
    } else {
        sendResponse({
            success: false,
            message: 'TikTok içeriği bulunamadı. Lütfen bir profil, keşfet veya video sayfasında olduğunuzdan emin olun.'
        });
    }
}

/**
 * Sayfa içeriğini belirtilen kritere göre sıralar
 */
function handleSortContent(sortCriteria, sendResponse) {
    if (collectedVideos.length === 0) {
        // Henüz veri toplanmadıysa önce toplama işlemini başlat
        startCollectingTiktokContent();
        sendResponse({
            success: false,
            message: 'Henüz içerik toplanmadı. Lütfen sayfada biraz daha aşağı kaydırın ve tekrar deneyin.'
        });
        return;
    }

    // Sıralama işlemini gerçekleştir
    const sortedVideos = sortTiktokVideos(collectedVideos, sortCriteria);

    // Sıralama türü için kullanıcı dostu isim
    const sortNames = {
        'date': 'tarih (yeniden eskiye)',
        'date-asc': 'tarih (eskiden yeniye)',
        'likes': 'beğeni sayısı',
        'views': 'görüntülenme sayısı',
        'comments': 'yorum sayısı',
        'shares': 'paylaşım sayısı'
    };

    // Verileri görsel olarak sırala (DOM manipülasyonu)
    visuallySortTiktokVideos(sortedVideos);

    sendResponse({
        success: true,
        itemCount: sortedVideos.length,
        sortName: sortNames[sortCriteria] || sortCriteria,
        previewData: sortedVideos.slice(0, 5) // İlk 5 sıralanmış içeriği önizleme için gönder
    });
}

/**
 * İçerikleri belirtilen formatta dışa aktarır
 */
function handleExportData(exportFormat, sendResponse) {
    if (collectedVideos.length === 0) {
        sendResponse({
            success: false,
            message: 'Dışa aktarılacak içerik bulunamadı. Lütfen sayfada biraz daha aşağı kaydırın ve tekrar deneyin.'
        });
        return;
    }

    // Kullanıcı adını al (URL'den veya sayfadan)
    const username = extractTiktokUsername();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    let data, filename, contentType;

    switch (exportFormat) {
        case 'json':
            // JSON formatında dışa aktar
            data = JSON.stringify(collectedVideos, null, 2);
            filename = `tiktok_${username}_${timestamp}.json`;
            contentType = 'application/json';
            break;

        case 'excel':
            // HTML tabanlı Excel formatında dışa aktar
            data = prepareExcelBlob(collectedVideos);
            filename = `tiktok_${username}_${timestamp}.xlsx`;
            contentType = 'application/vnd.ms-excel';
            break;

        case 'csv':
        default:
            // CSV formatında dışa aktar
            data = convertVideosToCSV(collectedVideos);
            filename = `tiktok_${username}_${timestamp}.csv`;
            contentType = 'text/csv';
            break;
    }

    sendResponse({
        success: true,
        data: exportFormat === 'excel' ? URL.createObjectURL(data) : data,
        filename: filename,
        contentType: contentType,
        itemCount: collectedVideos.length
    });
}

/**
 * İçerikleri Excel formatına dönüştürür
 * @param {Array} videos - Dışa aktarılacak video dizisi
 * @returns {Blob} Excel formatında içerik verisi
 */
function prepareExcelBlob(videos) {
    // HTML tablosu oluştur
    let html = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">';
    html += '<head><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>TikTok</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->';
    html += '<meta http-equiv="content-type" content="text/plain; charset=UTF-8"/></head><body>';

    // Tablo başlangıcı
    html += '<table border="1">';

    // Başlıklar
    const headers = ['ID', 'Tarih', 'Açıklama', 'Beğeni Sayısı', 'Görüntülenme Sayısı', 'Yorum Sayısı', 'Paylaşım Sayısı', 'URL'];
    html += '<tr style="font-weight: bold; background-color: #f2f2f2;">';
    headers.forEach(header => {
        html += `<th>${header}</th>`;
    });
    html += '</tr>';

    // Veri satırları
    videos.forEach(video => {
        html += '<tr>';
        html += `<td>${video.id || ''}</td>`;
        html += `<td>${new Date(video.date).toLocaleString('tr-TR')}</td>`;
        html += `<td>${(video.caption || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>`;
        html += `<td>${video.likes || 0}</td>`;
        html += `<td>${video.views || 0}</td>`;
        html += `<td>${video.comments || 0}</td>`;
        html += `<td>${video.shares || 0}</td>`;
        html += `<td>${video.url || ''}</td>`;
        html += '</tr>';
    });

    // Tablo sonu
    html += '</table></body></html>';

    // Excel uyumlu bir HTML Blob oluştur
    return new Blob([html], {type: 'application/vnd.ms-excel'});
}

/**
 * TikTok içeriğinin sayfada mevcut olup olmadığını kontrol eder
 */
function detectTiktokContent() {
    // TikTok videoları için tipik CSS seçicileri
    const videoSelectors = [
        '[data-e2e="recommend-list-item"]', // For You sayfasındaki videolar
        '[data-e2e="user-post-item"]', // Profil sayfasındaki videolar
        '.video-feed-item', // Genel video içerikleri
        '.tiktok-x6y88p-DivItemContainerV2' // Diğer içerik kutuları
    ];

    // Seçicilerden herhangi biri için eşleşme var mı kontrol et
    for (const selector of videoSelectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
            return true;
        }
    }

    return false;
}

/**
 * TikTok içeriklerini toplamaya başlar
 */
function startCollectingTiktokContent() {
    if (isCollecting) return; // Zaten toplama işlemi devam ediyorsa çık

    isCollecting = true;
    console.log('TikTok içerikleri toplanmaya başlıyor...');

    // Sayfayı gözlemlemek için MutationObserver kur
    setupTiktokObserver();

    // İlk taramayı başlat
    scanTiktokVideos();

    // Scroll olayını dinle
    window.addEventListener('scroll', handleTiktokScroll);
}

/**
 * Sayfa kaydırma olayı için işleyici
 */
function handleTiktokScroll() {
    // Sürekli scroll olayı tetiklenmesini önlemek için throttle uygula
    if (window.scrollY === lastScrollPosition) return;

    lastScrollPosition = window.scrollY;

    // Kaydırma sonrası yeni içerikleri tara
    setTimeout(() => {
        scanTiktokVideos();
    }, 500);
}

/**
 * Sayfadaki TikTok videolarını tarar ve toplar
 */
function scanTiktokVideos() {
    console.log('TikTok videoları taranıyor...');

    // Sayfa türüne göre uygun seçici belirle
    let videoElements = [];

    if (window.location.pathname === '/') {
        // For You sayfası
        videoElements = document.querySelectorAll('[data-e2e="recommend-list-item"]');
    } else if (window.location.pathname.match(/^\/@[^/]+\/?$/)) {
        // Profil sayfası
        videoElements = document.querySelectorAll('[data-e2e="user-post-item"]');
    } else {
        // Diğer sayfalar
        videoElements = document.querySelectorAll('.video-feed-item, .tiktok-x6y88p-DivItemContainerV2');
    }

    console.log(`${videoElements.length} adet video elementi bulundu`);

    // Her video için veri çıkar
    for (const element of videoElements) {
        // Video ID'sini veya benzersiz tanımlayıcı bul
        const videoId = extractVideoId(element);

        // Bu video daha önce eklendiyse atla
        if (videoId && collectedVideos.some(video => video.id === videoId)) {
            continue;
        }

        // Videoyu işle ve verileri çıkar
        const videoData = extractTiktokVideoData(element, videoId);

        if (videoData) {
            collectedVideos.push(videoData);
            console.log('Yeni video eklendi:', videoData);
        }
    }

    console.log(`Toplam ${collectedVideos.length} video toplandı`);
}

/**
 * TikTok videosundan veri çıkarma işlemi
 */
function extractTiktokVideoData(element, videoId) {
    try {
        // Tarih bilgisini bul
        const dateElement = element.querySelector('span[data-e2e="video-create-time"]') ||
                           element.querySelector('.tiktok-8h6j0k-SpanOtherInfos');
        // TikTok genellikle göreli tarih gösterir (ör. "3d ago"), bu durumda yaklaşık tarih hesapla
        const date = dateElement ? parseRelativeDate(dateElement.textContent) : Date.now();

        // Başlık/açıklama metni
        const captionElement = element.querySelector('div[data-e2e="video-desc"]') ||
                              element.querySelector('.tiktok-1wrhn5c-DivContainer');
        const caption = captionElement ? captionElement.textContent.trim() : '';

        // Beğeni sayısı
        const likesElement = element.querySelector('[data-e2e="like-count"]') ||
                            element.querySelector('.tiktok-1xiuanb-ButtonActionItem');
        const likes = likesElement ? parseNumberFromText(likesElement.textContent) : 0;

        // Yorum sayısı
        const commentsElement = element.querySelector('[data-e2e="comment-count"]') ||
                               element.querySelector('.tiktok-1xiuanb-ButtonActionItem:nth-child(2)');
        const comments = commentsElement ? parseNumberFromText(commentsElement.textContent) : 0;

        // Paylaşım sayısı
        const sharesElement = element.querySelector('[data-e2e="share-count"]') ||
                             element.querySelector('.tiktok-1xiuanb-ButtonActionItem:nth-child(3)');
        const shares = sharesElement ? parseNumberFromText(sharesElement.textContent) : 0;

        // Görüntülenme sayısı
        const viewsElement = element.querySelector('[data-e2e="video-views"]') ||
                            element.querySelector('.video-count');
        const views = viewsElement ? parseNumberFromText(viewsElement.textContent) : 0;

        // İçerik URL'i
        const linkElement = element.querySelector('a[href*="/video/"]');
        const url = linkElement ? linkElement.href : '';

        return {
            id: videoId || generateUniqueId(),
            date: date,
            caption: caption,
            likes: likes,
            comments: comments,
            shares: shares,
            views: views,
            url: url
        };
    } catch (error) {
        console.error('Video verisi çıkarılırken hata:', error);
        return null;
    }
}

/**
 * Göreceli tarih ifadesini (örn. "3 gün önce") tarih nesnesine dönüştürür
 */
function parseRelativeDate(text) {
    if (!text) return Date.now();

    text = text.toLowerCase().trim();
    const now = new Date();

    // "X saat önce", "X gün önce" gibi ifadeleri işle
    if (text.includes('saniye önce') || text.includes('seconds ago')) {
        const seconds = parseInt(text.match(/\d+/)[0] || 0);
        return now.getTime() - (seconds * 1000);
    } else if (text.includes('dakika önce') || text.includes('minutes ago')) {
        const minutes = parseInt(text.match(/\d+/)[0] || 0);
        return now.getTime() - (minutes * 60 * 1000);
    } else if (text.includes('saat önce') || text.includes('hours ago')) {
        const hours = parseInt(text.match(/\d+/)[0] || 0);
        return now.getTime() - (hours * 60 * 60 * 1000);
    } else if (text.includes('gün önce') || text.includes('days ago')) {
        const days = parseInt(text.match(/\d+/)[0] || 0);
        return now.getTime() - (days * 24 * 60 * 60 * 1000);
    } else if (text.includes('hafta önce') || text.includes('weeks ago')) {
        const weeks = parseInt(text.match(/\d+/)[0] || 0);
        return now.getTime() - (weeks * 7 * 24 * 60 * 60 * 1000);
    } else if (text.includes('ay önce') || text.includes('months ago')) {
        const months = parseInt(text.match(/\d+/)[0] || 0);
        const date = new Date(now);
        date.setMonth(date.getMonth() - months);
        return date.getTime();
    } else if (text.includes('yıl önce') || text.includes('years ago')) {
        const years = parseInt(text.match(/\d+/)[0] || 0);
        const date = new Date(now);
        date.setFullYear(date.getFullYear() - years);
        return date.getTime();
    }

    // Tarih formatı tanınmadıysa şu anki zamanı döndür
    return now.getTime();
}

/**
 * Bir metin içerisindeki sayısal değeri çıkarır (K, M gibi kısaltmaları işler)
 */
function parseNumberFromText(text) {
    if (!text) return 0;

    text = text.trim();

    // "123K", "1.2M" gibi değerleri işle
    if (text.endsWith('K') || text.endsWith('k')) {
        return parseFloat(text.replace(/[Kk]/, '')) * 1000;
    } else if (text.endsWith('M') || text.endsWith('m')) {
        return parseFloat(text.replace(/[Mm]/, '')) * 1000000;
    } else if (text.endsWith('B') || text.endsWith('b')) {
        return parseFloat(text.replace(/[Bb]/, '')) * 1000000000;
    }

    // Nokta ve virgülleri temizle ve sayıya dönüştür
    return parseInt(text.replace(/[.,\s]/g, '')) || 0;
}

/**
 * Video elemandan videoId çıkarma
 */
function extractVideoId(element) {
    // Önce link üzerinden ID bulmayı dene
    const linkElement = element.querySelector('a[href*="/video/"]');

    if (linkElement) {
        const href = linkElement.getAttribute('href');
        const match = href.match(/\/video\/(\d+)/);
        if (match && match[1]) {
            return match[1];
        }
    }

    // Alternatif olarak data özniteliklerini kontrol et
    for (const attr of ['data-video-id', 'data-id', 'id']) {
        const id = element.getAttribute(attr);
        if (id) return id;
    }

    return null;
}

/**
 * Benzersiz bir ID oluşturur
 */
function generateUniqueId() {
    return 'video_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

/**
 * TikTok kullanıcı adını sayfadan çıkarır
 */
function extractTiktokUsername() {
    // URL'den kullanıcı adını çıkarmayı dene
    const urlMatch = window.location.pathname.match(/\/@([^/]+)/);
    if (urlMatch && urlMatch[1]) {
        return urlMatch[1];
    }

    // Sayfadan kullanıcı adını bulmayı dene
    const usernameElement = document.querySelector('h1.tiktok-arkop9-H1') ||
                           document.querySelector('[data-e2e="user-title"]');
    if (usernameElement) {
        return usernameElement.textContent.trim().replace('@', '');
    }

    return 'tiktok_user';
}

/**
 * TikTok videolarını belirtilen kritere göre sıralar
 */
function sortTiktokVideos(videos, criteria) {
    const sortedVideos = [...videos]; // Orijinal diziyi değiştirmemek için kopyala

    switch (criteria) {
        case 'date':
            // Tarih (yeniden eskiye)
            sortedVideos.sort((a, b) => b.date - a.date);
            break;

        case 'date-asc':
            // Tarih (eskiden yeniye)
            sortedVideos.sort((a, b) => a.date - b.date);
            break;

        case 'likes':
            // Beğeni sayısı (çoktan aza)
            sortedVideos.sort((a, b) => b.likes - a.likes);
            break;

        case 'views':
            // Görüntülenme sayısı (çoktan aza)
            sortedVideos.sort((a, b) => b.views - a.views);
            break;

        case 'comments':
            // Yorum sayısı (çoktan aza)
            sortedVideos.sort((a, b) => b.comments - a.comments);
            break;

        case 'shares':
            // Paylaşım sayısı (çoktan aza)
            sortedVideos.sort((a, b) => b.shares - a.shares);
            break;

        default:
            // Varsayılan olarak tarih sıralaması
            sortedVideos.sort((a, b) => b.date - a.date);
    }

    return sortedVideos;
}

/**
 * Sıralanmış videoları sayfada görsel olarak yeniden düzenler
 */
function visuallySortTiktokVideos(sortedVideos) {
    // Sayfa türüne göre farklı işlem yap
    if (window.location.pathname.match(/^\/@[^/]+\/?$/)) {
        // Profil sayfası için grid düzeninde sıralama
        sortVideosInProfileGrid(sortedVideos);
    } else if (window.location.pathname === '/') {
        // For You sayfası için sıralama
        sortVideosInForYouPage(sortedVideos);
    } else {
        // Keşfet veya diğer sayfalar için
        sortVideosGeneric(sortedVideos);
    }
}

/**
 * Profil sayfasındaki grid içerisindeki videoları sıralar
 */
function sortVideosInProfileGrid(sortedVideos) {
    const gridContainer = document.querySelector('[data-e2e="user-post-item-list"]');
    if (!gridContainer) return;

    // Tüm video elementlerini bul
    const videoElements = Array.from(gridContainer.querySelectorAll('[data-e2e="user-post-item"]'));
    if (videoElements.length === 0) return;

    // Elementleri sıralanmış verilere göre yeniden düzenle
    for (const video of sortedVideos) {
        const videoElement = videoElements.find(el => {
            const link = el.querySelector('a[href*="/video/"]');
            return link && link.href.includes(video.id);
        });

        if (videoElement) {
            gridContainer.appendChild(videoElement);
        }
    }
}

/**
 * For You sayfasındaki içerikleri sıralar
 */
function sortVideosInForYouPage(sortedVideos) {
    const feedContainer = document.querySelector('[data-e2e="recommend-list"]');
    if (!feedContainer) return;

    // Tüm video elementlerini bul
    const videoElements = Array.from(feedContainer.querySelectorAll('[data-e2e="recommend-list-item"]'));
    if (videoElements.length === 0) return;

    // Elementleri sıralanmış verilere göre yeniden düzenle
    for (const video of sortedVideos) {
        const videoElement = videoElements.find(el => {
            const link = el.querySelector('a[href*="/video/"]');
            return link && link.href.includes(video.id);
        });

        if (videoElement) {
            feedContainer.appendChild(videoElement);
        }
    }
}

/**
 * Genel sayfalardaki içerikleri sıralar
 */
function sortVideosGeneric(sortedVideos) {
    // Sayfadaki tüm video elementlerini bul
    const videoElements = Array.from(document.querySelectorAll('.video-feed-item, .tiktok-x6y88p-DivItemContainerV2'));
    if (videoElements.length === 0) return;

    // Elementleri sıralanmış verilere göre yeniden düzenle
    const container = videoElements[0].parentElement;
    if (!container) return;

    for (const video of sortedVideos) {
        const videoElement = videoElements.find(el => {
            const link = el.querySelector('a[href*="/video/"]');
            return link && link.href.includes(video.id);
        });

        if (videoElement) {
            container.appendChild(videoElement);
        }
    }
}

/**
 * TikTok içeriklerini gözlemlemek için MutationObserver kurar
 */
function setupTiktokObserver() {
    if (observerActive) return;

    observerActive = true;

    // Sayfa değişikliklerini izlemek için MutationObserver oluştur
    tiktokObserver = new MutationObserver((mutations) => {
        let shouldScan = false;

        for (const mutation of mutations) {
            // Eğer DOM'a yeni node'lar eklendiyse tarama yap
            if (mutation.addedNodes.length > 0) {
                shouldScan = true;
                break;
            }
        }

        if (shouldScan) {
            // Yeni içerikler eklendiğinde tarama yap
            scanTiktokVideos();
        }
    });

    // Tüm sayfa için gözlem başlat
    tiktokObserver.observe(document.body, {
        childList: true,
        subtree: true
    });
}

/**
 * Topladığımız videoları CSV formatına dönüştürür
 */
function convertVideosToCSV(videos) {
    // CSV başlık satırı
    const headers = ['ID', 'Tarih', 'Açıklama', 'Beğeni Sayısı', 'Görüntülenme Sayısı', 'Yorum Sayısı', 'Paylaşım Sayısı', 'URL'];

    // Veri satırlarını oluştur
    const rows = videos.map(video => [
        video.id,
        new Date(video.date).toISOString(),
        `"${(video.caption || '').replace(/"/g, '""')}"`, // Çift tırnak kaçışını yönet
        video.likes,
        video.views,
        video.comments,
        video.shares,
        video.url
    ]);

    // Tüm satırları birleştir
    return [headers, ...rows].map(row => row.join(',')).join('\n');
}

// Sayfa yüklendiğinde otomatik olarak çalışmaya başla
window.addEventListener('load', () => {
    setTimeout(() => {
        if (detectTiktokContent()) {
            startCollectingTiktokContent();
        }
    }, 1500); // Sayfanın tam olarak yüklenmesi için biraz bekle
});
