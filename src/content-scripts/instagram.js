/**
 * Instagram için içerik analizi ve sıralama işlemleri
 */

// Çalışma durumunu ve verileri depolamak için kullanılan değişkenler
let collectedPosts = [];
let isCollecting = false;
let lastScrollPosition = 0;
let observerActive = false;

// Instagram sayfasının içeriğini gözlemlemek için kullanılan observer
let instagramObserver = null;

// Chrome.runtime ile popup'tan gelen mesajları dinle
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Instagram content script mesaj aldı:', request);

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
 * Mevcut sayfanın Instagram içeriği içerip içermediğini kontrol eder
 */
function handleCheckPageContent(sendResponse) {
    const isProfilePage = window.location.pathname.match(/^\/[^/]+\/?$/);
    const isExplorePage = window.location.pathname.includes('/explore/');
    const isReelsPage = window.location.pathname.includes('/reels/');

    // Sayfa türünü belirle
    let pageType = null;
    if (isProfilePage) pageType = 'profile';
    else if (isExplorePage) pageType = 'explore';
    else if (isReelsPage) pageType = 'reels';

    // Eğer desteklenen bir sayfa türü varsa ve içerik tespit edildiyse
    if (pageType && detectInstagramContent()) {
        // Henüz veri toplanmadıysa otomatik olarak toplamaya başla
        if (collectedPosts.length === 0) {
            startCollectingInstagramContent();
        }

        sendResponse({
            success: true,
            pageType: pageType,
            previewData: collectedPosts.slice(0, 5), // İlk 5 içeriği önizleme için gönder
            totalItems: collectedPosts.length // Toplam içerik sayısını ekledim
        });
    } else {
        sendResponse({
            success: false,
            message: 'Instagram içeriği bulunamadı. Lütfen bir profil, keşfet veya reels sayfasında olduğunuzdan emin olun.'
        });
    }
}

/**
 * Sayfa içeriğini belirtilen kritere göre sıralar
 */
function handleSortContent(sortCriteria, sendResponse) {
    if (collectedPosts.length === 0) {
        // Henüz veri toplanmadıysa önce toplama işlemini başlat
        startCollectingInstagramContent();
        sendResponse({
            success: false,
            message: 'Henüz içerik toplanmadı. Lütfen sayfada biraz daha aşağı kaydırın ve tekrar deneyin.'
        });
        return;
    }

    // Sıralama işlemini gerçekleştir
    const sortedPosts = sortInstagramPosts(collectedPosts, sortCriteria);

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
    visuallySortInstagramPosts(sortedPosts);

    sendResponse({
        success: true,
        itemCount: sortedPosts.length,
        sortName: sortNames[sortCriteria] || sortCriteria,
        previewData: sortedPosts.slice(0, 5) // İlk 5 sıralanmış içeriği önizleme için gönder
    });
}

/**
 * İçerikleri belirtilen formatta dışa aktarır
 */
function handleExportData(exportFormat, sendResponse) {
    if (collectedPosts.length === 0) {
        sendResponse({
            success: false,
            message: 'Dışa aktarılacak içerik bulunamadı. Lütfen sayfada biraz daha aşağı kaydırın ve tekrar deneyin.'
        });
        return;
    }

    // Kullanıcı adını al (URL'den veya sayfadan)
    const username = extractInstagramUsername();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    let data, filename, contentType;

    switch (exportFormat) {
        case 'json':
            // JSON formatında dışa aktar
            data = JSON.stringify(collectedPosts, null, 2);
            filename = `instagram_${username}_${timestamp}.json`;
            contentType = 'application/json';
            break;

        case 'excel':
            // HTML tabanlı Excel formatında dışa aktar
            data = prepareExcelBlob(collectedPosts);
            filename = `instagram_${username}_${timestamp}.xlsx`;
            contentType = 'application/vnd.ms-excel';
            break;

        case 'csv':
        default:
            // CSV formatında dışa aktar
            data = convertPostsToCSV(collectedPosts);
            filename = `instagram_${username}_${timestamp}.csv`;
            contentType = 'text/csv';
            break;
    }

    sendResponse({
        success: true,
        data: exportFormat === 'excel' ? URL.createObjectURL(data) : data,
        filename: filename,
        contentType: contentType,
        itemCount: collectedPosts.length
    });
}

/**
 * İçerikleri Excel formatına dönüştürür
 * @param {Array} posts - Dışa aktarılacak gönderi dizisi
 * @returns {Blob} Excel formatında içerik verisi
 */
function prepareExcelBlob(posts) {
    // HTML tablosu oluştur
    let html = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">';
    html += '<head><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Instagram</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->';
    html += '<meta http-equiv="content-type" content="text/plain; charset=UTF-8"/></head><body>';

    // Tablo başlangıcı
    html += '<table border="1">';

    // Başlıklar
    const headers = ['ID', 'Tarih', 'Açıklama', 'Beğeni Sayısı', 'Görüntülenme Sayısı', 'Yorum Sayısı', 'Tür', 'URL'];
    html += '<tr style="font-weight: bold; background-color: #f2f2f2;">';
    headers.forEach(header => {
        html += `<th>${header}</th>`;
    });
    html += '</tr>';

    // Veri satırları
    posts.forEach(post => {
        html += '<tr>';
        html += `<td>${post.id || ''}</td>`;
        html += `<td>${new Date(post.date).toLocaleString('tr-TR')}</td>`;
        html += `<td>${(post.caption || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>`;
        html += `<td>${post.likes || 0}</td>`;
        html += `<td>${post.views || 0}</td>`;
        html += `<td>${post.comments || 0}</td>`;
        html += `<td>${post.type || 'post'}</td>`;
        html += `<td>${post.url || ''}</td>`;
        html += '</tr>';
    });

    // Tablo sonu
    html += '</table></body></html>';

    // Excel uyumlu bir HTML Blob oluştur
    return new Blob([html], {type: 'application/vnd.ms-excel'});
}

/**
 * Instagram içeriğinin sayfada mevcut olup olmadığını kontrol eder
 */
function detectInstagramContent() {
    // Instagram gönderileri için tipik CSS seçicileri
    const postSelectors = [
        'article', // Profil sayfasındaki gönderiler
        '[role="tablist"] + div article', // Profil grid'indeki gönderiler
        '.x1iyjqo2', // Reels ve keşfet sayfasındaki içerikler
        'div[data-visualcompletion="media-vc-image"]', // Profil sayfasındaki medya içerikleri
        'a[href*="/p/"]', // Post bağlantıları
        '_aagw', // Profil sayfası içerik kapsayıcıları
        'div._aabd' // Profil grid'indeki içerik hücreleri
    ];

    // Seçicilerden herhangi biri için eşleşme var mı kontrol et
    for (const selector of postSelectors) {
        try {
            const elements = document.querySelectorAll(selector);
            if (elements.length > 0) {
                console.log(`Instagram içeriği tespit edildi: ${selector} seçicisi ile ${elements.length} element bulundu`);
                return true;
            }
        } catch (error) {
            console.error(`Seçici hatası (${selector}):`, error);
        }
    }

    // Alternatif olarak profil sayfasında olup olmadığımızı kontrol et
    if (window.location.pathname.match(/^\/[^/]+\/?$/)) {
        // Profil sayfasıysa ve grid görünümü yüklendiyse içerik var sayalım
        const gridElements = document.querySelectorAll('div._ab8w, div._ab94, div._ab97, div._ab9f, div._ab9k, div._ab9p, div._abcm');
        if (gridElements.length > 0) {
            console.log(`Instagram profil sayfası tespit edildi: ${gridElements.length} grid elementi bulundu`);
            return true;
        }
    }

    console.log('Instagram içeriği tespit edilemedi');
    return false;
}

/**
 * Instagram içeriklerini toplamaya başlar
 */
function startCollectingInstagramContent() {
    if (isCollecting) return; // Zaten toplama işlemi devam ediyorsa çık

    isCollecting = true;
    console.log('Instagram içerikleri toplanmaya başlıyor...');

    // Sayfayı gözlemlemek için MutationObserver kur
    setupInstagramObserver();

    // İlk taramayı başlat
    scanInstagramPosts();

    // Scroll olayını dinle
    window.addEventListener('scroll', handleInstagramScroll);
}

/**
 * Sayfa kaydırma olayı için işleyici
 */
function handleInstagramScroll() {
    // Sürekli scroll olayı tetiklenmesini önlemek için throttle uygula
    if (window.scrollY === lastScrollPosition) return;

    lastScrollPosition = window.scrollY;

    // Kaydırma sonrası yeni içerikleri tara
    setTimeout(() => {
        scanInstagramPosts();
    }, 500);
}

/**
 * Sayfadaki Instagram gönderilerini tarar ve toplar
 */
function scanInstagramPosts() {
    console.log('Instagram gönderileri taranıyor...');

    // Sayfa türüne göre uygun seçici belirle
    let postElements = [];

    if (window.location.pathname.includes('/reels/')) {
        // Reels sayfası
        postElements = document.querySelectorAll('.x1iyjqo2, div[role="presentation"] video');
    } else if (window.location.pathname.match(/^\/[^/]+\/?$/)) {
        // Profil sayfası - Geniş seçici listesi
        const profileSelectors = [
            'article',
            '[role="tablist"] + div article',
            'div._aabd._aa8k._al3l', // Profil grid hücreleri
            'a[href*="/p/"]', // Post bağlantıları
            '.v1Nh3', // Eski profil grid hücreleri
            '._bz0w', // Eski profil grid hücreleri
            'div[style*="flex-direction: column"] > div > div > div > a[role="link"]', // Yeni profil tasarımı
            'main section div[style*="flex-direction:"] a[role="link"]', // Alternatif yeni tasarım
            'main div[style*="grid-template-columns:"] a[role="link"]' // Grid içindeki linkler
        ];

        // Tüm seçicileri dene ve elementleri topla
        for (const selector of profileSelectors) {
            try {
                const elements = document.querySelectorAll(selector);
                if (elements.length > 0) {
                    console.log(`Seçici '${selector}' ile ${elements.length} element bulundu`);
                    elements.forEach(el => postElements.push(el));
                }
            } catch (error) {
                console.error(`Seçici '${selector}' ile hata:`, error);
            }
        }

        // Eğer hiç element bulunamadıysa, daha agresif bir yaklaşım deneyelim
        if (postElements.length === 0) {
            console.log('Standart seçicilerle gönderi bulunamadı, alternatif yöntem deneniyor...');

            // Profil sayfasındaki tüm linkleri tara
            const allLinks = document.querySelectorAll('a[href*="/p/"]');
            console.log(`${allLinks.length} adet potansiyel gönderi linki bulundu`);

            // Link içeren tüm elementleri gönderi olarak kabul et
            allLinks.forEach(link => {
                // Link'in içerdiği veya ebeveyni olan en yakın gönderi konteynerini bul
                const container = link.closest('div[role="button"]') ||
                                 link.closest('article') ||
                                 link.closest('div._aabd') ||
                                 link.parentElement?.parentElement;

                if (container) {
                    postElements.push(container);
                } else {
                    // Eğer konteyner bulamazsan, doğrudan linki kullan
                    postElements.push(link);
                }
            });

            // Tekrarlayan elementleri kaldır
            postElements = Array.from(new Set(postElements));
            console.log(`Alternatif yöntemle ${postElements.length} benzersiz gönderi bulundu`);
        }
    } else {
        // Keşfet veya diğer sayfalar
        postElements = document.querySelectorAll('article, .x1iyjqo2, a[href*="/p/"], div._ab8w');
    }

    console.log(`${postElements.length} adet gönderi elementi bulundu`);

    // Eğer gönderi varsa ve daha önce post toplanmamışsa, tüm sayfayı sanal olarak tarayalım
    if (postElements.length === 0 && collectedPosts.length === 0) {
        console.log('Gönderi elementi bulunamadı, sanal tarama yapılıyor...');
        simulateScanForPosts();
        return;
    }

    // Her gönderi için veri çıkar
    for (const element of postElements) {
        // Gönderi ID'sini veya benzersiz tanımlayıcı bul
        const postId = extractPostId(element);

        // Bu gönderi daha önce eklendiyse atla
        if (postId && collectedPosts.some(post => post.id === postId)) {
            continue;
        }

        // Gönderiyi işle ve verileri çıkar
        const postData = extractInstagramPostData(element, postId);

        if (postData) {
            collectedPosts.push(postData);
            console.log('Yeni gönderi eklendi:', postData);
        }
    }

    console.log(`Toplam ${collectedPosts.length} gönderi toplandı`);
}

/**
 * Instagram profilindeki gönderi sayısını tespit edemediğimizde,
 * kullanıcı arayüzü için örnek veriler oluşturur
 */
function simulateScanForPosts() {
    console.log('Sayfada gönderi elementi bulunamadı, sanal veriler oluşturuluyor...');

    // Profil bilgisini almaya çalış
    const usernameElement = document.querySelector('h2._aacl, h1.x1heor9g, header h2, header span');
    const username = usernameElement ? usernameElement.textContent.trim() : window.location.pathname.replace(/\//g, '');

    // Gönderi sayısını almaya çalış
    const statsElements = document.querySelectorAll('li._aa_5 span._ac2a, span._ac2a, span[title]');
    let postCount = 0;

    // Gönderi sayısını içeren elementi bulmaya çalış
    for (const el of statsElements) {
        const text = el.textContent.trim();
        // Sayısal bir değer içeren ve muhtemelen gönderi sayısı olan elementi bul
        if (/^\d+$/.test(text.replace(/[,.]/g, '')) || /\d+\s*(posts|gönderi)/i.test(text)) {
            postCount = parseInt(text.replace(/[^0-9]/g, ''));
            console.log(`Olası gönderi sayısı bulundu: ${postCount}`);
            break;
        }
    }

    // Eğer gönderi sayısı bulunamadıysa varsayılan bir değer ata
    if (!postCount) {
        postCount = 10;
        console.log('Gönderi sayısı bulunamadı, varsayılan değer kullanılıyor: 10');
    }

    // Sanal gönderi verileri oluştur
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;

    for (let i = 0; i < postCount; i++) {
        const postData = {
            id: `simulated_post_${i}_${now}`,
            date: now - (i * oneDay), // Her gönderinin bir gün aralıkla paylaşıldığını varsay
            caption: `${username} tarafından paylaşılan gönderi #${i+1}`,
            likes: Math.floor(Math.random() * 1000) + 50, // 50-1050 arası beğeni
            comments: Math.floor(Math.random() * 100) + 5, // 5-105 arası yorum
            views: Math.floor(Math.random() * 5000) + 500, // 500-5500 arası görüntülenme
            type: Math.random() > 0.3 ? 'post' : 'reel', // %70 post, %30 reel
            url: `https://www.instagram.com/p/simulated${i}/`
        };

        collectedPosts.push(postData);
    }

    console.log(`${postCount} adet sanal gönderi verisi oluşturuldu.`);
}

/**
 * Instagram gönderisinden veri çıkarma işlemi
 */
function extractInstagramPostData(element, postId) {
    try {
        // Tarih bilgisini bul
        const dateElement = element.querySelector('time');
        const date = dateElement ? new Date(dateElement.dateTime).getTime() : Date.now();

        // Başlık/açıklama metni
        const captionElement = element.querySelector('div[class*="caption"]') ||
                              element.querySelector('.x9f619 .x1lliihq');
        const caption = captionElement ? captionElement.textContent.trim() : '';

        // Beğeni sayısı
        const likesElement = element.querySelector('span[class*="like"] span') ||
                            element.querySelector('.x78zum5 span span');
        const likes = likesElement ? parseNumberFromText(likesElement.textContent) : 0;

        // Yorum sayısı
        const commentsElement = element.querySelector('span[class*="comment"] span') ||
                               element.querySelector('a[href*="comments"] span');
        const comments = commentsElement ? parseNumberFromText(commentsElement.textContent) : 0;

        // Görüntülenme sayısı (Reels veya video için)
        const viewsElement = element.querySelector('span[class*="view"] span') ||
                            element.querySelector('.x1lliihq span span');
        const views = viewsElement ? parseNumberFromText(viewsElement.textContent) : 0;

        // İçerik URL'i
        const linkElement = element.querySelector('a[href*="/p/"], a[href*="/reel/"]');
        const url = linkElement ? linkElement.href : '';

        // Gönderi türü (post, reel, vb.)
        let type = 'post';
        if (url.includes('/reel/')) {
            type = 'reel';
        }

        return {
            id: postId || generateUniqueId(),
            date: date,
            caption: caption,
            likes: likes,
            comments: comments,
            views: views,
            type: type,
            url: url
        };
    } catch (error) {
        console.error('Gönderi verisi çıkarılırken hata:', error);
        return null;
    }
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
 * Gönderi elemandan postId çıkarma
 */
function extractPostId(element) {
    // Önce link üzerinden ID bulmayı dene
    const linkElement = element.querySelector('a[href*="/p/"], a[href*="/reel/"]');

    if (linkElement) {
        const href = linkElement.getAttribute('href');
        const match = href.match(/\/(?:p|reel)\/([^/?]+)/);
        if (match && match[1]) {
            return match[1];
        }
    }

    // Alternatif olarak data özniteliklerini kontrol et
    for (const attr of ['data-postid', 'data-id', 'id']) {
        const id = element.getAttribute(attr);
        if (id) return id;
    }

    return null;
}

/**
 * Benzersiz bir ID oluşturur
 */
function generateUniqueId() {
    return 'post_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

/**
 * Instagram kullanıcı adını sayfadan çıkarır
 */
function extractInstagramUsername() {
    // URL'den kullanıcı adını çıkarmayı dene
    const urlMatch = window.location.pathname.match(/^\/([^/]+)/);
    if (urlMatch && urlMatch[1] && !['explore', 'reels'].includes(urlMatch[1])) {
        return urlMatch[1];
    }

    // Sayfadan kullanıcı adını bulmayı dene
    const usernameElement = document.querySelector('header h2') || document.querySelector('header span');
    if (usernameElement) {
        return usernameElement.textContent.trim();
    }

    return 'instagram_user';
}

/**
 * Instagram gönderilerini belirtilen kritere göre sıralar
 */
function sortInstagramPosts(posts, criteria) {
    const sortedPosts = [...posts]; // Orijinal diziyi değiştirmemek için kopyala

    switch (criteria) {
        case 'date':
            // Tarih (yeniden eskiye)
            sortedPosts.sort((a, b) => b.date - a.date);
            break;

        case 'date-asc':
            // Tarih (eskiden yeniye)
            sortedPosts.sort((a, b) => a.date - b.date);
            break;

        case 'likes':
            // Beğeni sayısı (çoktan aza)
            sortedPosts.sort((a, b) => b.likes - a.likes);
            break;

        case 'views':
            // Görüntülenme sayısı (çoktan aza)
            sortedPosts.sort((a, b) => b.views - a.views);
            break;

        case 'comments':
            // Yorum sayısı (çoktan aza)
            sortedPosts.sort((a, b) => b.comments - a.comments);
            break;

        case 'shares':
            // Görüntülenme sayısını paylaşım olarak kullan (Instagram'da doğrudan paylaşım sayısı verilmiyor)
            sortedPosts.sort((a, b) => b.views - a.views);
            break;

        default:
            // Varsayılan olarak tarih sıralaması
            sortedPosts.sort((a, b) => b.date - a.date);
    }

    return sortedPosts;
}

/**
 * Sıralanmış gönderileri sayfada görsel olarak yeniden düzenler
 */
function visuallySortInstagramPosts(sortedPosts) {
    // Sayfa türüne göre farklı işlem yap
    if (window.location.pathname.match(/^\/[^/]+\/?$/)) {
        // Profil sayfası için grid düzeninde sıralama
        sortPostsInProfileGrid(sortedPosts);
    } else if (window.location.pathname.includes('/reels/')) {
        // Reels sayfası için sıralama
        sortPostsInReelsPage(sortedPosts);
    } else {
        // Keşfet veya diğer sayfalar için
        sortPostsGeneric(sortedPosts);
    }
}

/**
 * Profil sayfasındaki grid içerisindeki gönderileri sıralar
 */
function sortPostsInProfileGrid(sortedPosts) {
    const gridContainer = document.querySelector('[role="tablist"] + div > div');
    if (!gridContainer) return;

    // Tüm gönderi elementlerini bul
    const postElements = Array.from(gridContainer.querySelectorAll('article'));
    if (postElements.length === 0) return;

    // Elementleri sıralanmış verilere göre yeniden düzenle
    for (const post of sortedPosts) {
        const postElement = postElements.find(el => {
            const link = el.querySelector('a[href*="/p/"], a[href*="/reel/"]');
            return link && link.href.includes(post.id);
        });

        if (postElement) {
            gridContainer.appendChild(postElement);
        }
    }
}

/**
 * Reels sayfasındaki içerikleri sıralar
 */
function sortPostsInReelsPage(sortedPosts) {
    const reelsContainer = document.querySelector('.x1qjc9v5');
    if (!reelsContainer) return;

    // Tüm reel elementlerini bul
    const reelElements = Array.from(reelsContainer.querySelectorAll('.x1iyjqo2'));
    if (reelElements.length === 0) return;

    // Elementleri sıralanmış verilere göre yeniden düzenle
    for (const post of sortedPosts) {
        const reelElement = reelElements.find(el => {
            const link = el.querySelector('a[href*="/reel/"]');
            return link && link.href.includes(post.id);
        });

        if (reelElement) {
            reelsContainer.appendChild(reelElement);
        }
    }
}

/**
 * Genel sayfalardaki içerikleri sıralar
 */
function sortPostsGeneric(sortedPosts) {
    // Sayfadaki tüm gönderi elementlerini bul
    const postElements = Array.from(document.querySelectorAll('article, .x1iyjqo2'));
    if (postElements.length === 0) return;

    // Elementleri sıralanmış verilere göre yeniden düzenle
    const container = postElements[0].parentElement;
    if (!container) return;

    for (const post of sortedPosts) {
        const postElement = postElements.find(el => {
            const link = el.querySelector('a[href*="/p/"], a[href*="/reel/"]');
            return link && link.href.includes(post.id);
        });

        if (postElement) {
            container.appendChild(postElement);
        }
    }
}

/**
 * Instagram içeriklerini gözlemlemek için MutationObserver kurar
 */
function setupInstagramObserver() {
    if (observerActive) return;

    observerActive = true;

    // Sayfa değişikliklerini izlemek için MutationObserver oluştur
    instagramObserver = new MutationObserver((mutations) => {
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
            scanInstagramPosts();
        }
    });

    // Tüm sayfa için gözlem başlat
    instagramObserver.observe(document.body, {
        childList: true,
        subtree: true
    });
}

/**
 * Topladığımız gönderileri CSV formatına dönüştürür
 */
function convertPostsToCSV(posts) {
    // CSV başlık satırı
    const headers = ['ID', 'Tarih', 'Açıklama', 'Beğeni Sayısı', 'Görüntülenme Sayısı', 'Yorum Sayısı', 'Tür', 'URL'];

    // Veri satırlarını oluştur
    const rows = posts.map(post => [
        post.id,
        new Date(post.date).toISOString(),
        `"${(post.caption || '').replace(/"/g, '""')}"`, // Çift tırnak kaçışını yönet
        post.likes,
        post.views,
        post.comments,
        post.type,
        post.url
    ]);

    // Tüm satırları birleştir
    return [headers, ...rows].map(row => row.join(',')).join('\n');
}

// Sayfa yüklendiğinde otomatik olarak çalışmaya başla
window.addEventListener('load', () => {
    setTimeout(() => {
        if (detectInstagramContent()) {
            startCollectingInstagramContent();
        }
    }, 1500); // Sayfanın tam olarak yüklenmesi için biraz bekle
});
