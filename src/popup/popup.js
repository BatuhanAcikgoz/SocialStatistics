// Popup'ın açıldığı platforma göre arayüzü özelleştirme
import { queryTabs, sendTabMessage, sendMessage } from '../utils/browser-api.js';

document.addEventListener('DOMContentLoaded', async () => {
    const platformInfoElement = document.getElementById('currentPlatform');
    const sortButton = document.getElementById('sortButton');
    const exportButton = document.getElementById('exportButton');
    const statusBar = document.getElementById('statusBar');
    const statusMessage = document.getElementById('statusMessage');
    const previewTableBody = document.getElementById('previewTableBody');

    // Tarayıcı API'sini belirle
    const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

    // Mevcut sekmeyi kontrol et
    const getCurrentTab = async () => {
        const tabs = await queryTabs({ active: true, currentWindow: true });
        return tabs[0];
    };

    // Platformu belirle
    const detectPlatform = (url) => {
        if (url.includes('instagram.com')) {
            return 'Instagram';
        } else if (url.includes('tiktok.com')) {
            return 'TikTok';
        } else {
            return null;
        }
    };

    // Mesaj gösterme fonksiyonu
    const showMessage = (message, type = 'info') => {
        statusMessage.textContent = message;
        statusMessage.className = `status-message ${type}`;
    };

    // Durum çubuğunu güncelleme
    const updateStatusBar = (message) => {
        statusBar.textContent = message;
    };

    try {
        const currentTab = await getCurrentTab();
        const platform = detectPlatform(currentTab.url);
        console.log('Mevcut sekme:', currentTab);
        console.log('Tespit edilen platform:', platform);

        // Platform bilgisini hemen göster
        platformInfoElement.textContent = platform || 'Tespit edilemedi';

        if (platform) {
            // Content script yüklenmesini beklemek için doğrudan Chrome API'sini kullanalım
            // Firefox'ta browser.tabs.executeScript, Chrome'da chrome.scripting.executeScript
            if (typeof browser !== 'undefined') {
                // Firefox
                try {
                    await browser.tabs.executeScript(currentTab.id, { 
                        code: "console.log('SocialStatistics eklentisi content script kontrolü');" 
                    });
                    console.log('Content script yüklü ve çalışıyor (Firefox)');
                } catch (e) {
                    console.warn('Content script kontrolü başarısız (Firefox):', e);
                }
            } else {
                // Chrome'da script yüklenmiş mi kontrol et
                try {
                    chrome.tabs.executeScript(currentTab.id, { 
                        code: "console.log('SocialStatistics eklentisi content script kontrolü');" 
                    }, function(results) {
                        console.log('Content script yüklü ve çalışıyor (Chrome)');
                    });
                } catch (e) {
                    console.warn('Content script kontrolü başarısız (Chrome):', e);
                }
            }

            // İçerik kontrolü için biraz bekle
            setTimeout(async () => {
                try {
                    console.log(`${platform} content scriptine mesaj gönderiliyor...`);
                    
                    // Doğrudan chrome API'sini kullanarak mesaj gönder
                    chrome.tabs.sendMessage(currentTab.id, { 
                        action: 'checkPageContent', 
                        platform 
                    }, function(response) {
                        console.log('Content script doğrudan yanıt:', response);
                        
                        if (chrome.runtime.lastError) {
                            console.error('Content script mesaj hatası:', chrome.runtime.lastError);
                            showMessage(`${platform} sayfası ile iletişim kurulamadı. Sayfayı yenilemeyi deneyin.`, 'error');
                            updateStatusBar(`Hata: ${platform} ile iletişim başarısız`);
                            return;
                        }
                        
                        if (response && response.success) {
                            updateStatusBar(`${platform} içeriği tespit edildi. ${response.totalItems || (response.previewData ? response.previewData.length : 0)} içerik toplandı.`);
                            
                            // Önizleme verilerini göster
                            if (response.previewData && response.previewData.length > 0) {
                                renderPreviewData(response.previewData);
                                showMessage(`${response.previewData.length} içerik önizlemesi gösteriliyor. Toplam ${response.totalItems || response.previewData.length} içerik toplandı.`, 'success');
                            } else {
                                showMessage('İçerik tespit edildi ancak henüz veri toplanmadı. Sayfayı aşağı doğru kaydırarak daha fazla içeriğin yüklenmesini sağlayabilirsiniz.', 'info');
                            }
                        } else {
                            showMessage(`${platform} sayfasında içerik bulunamadı. Lütfen bir profil veya içerik sayfasında olduğunuzdan emin olun.`, 'error');
                        }
                    });
                } catch (error) {
                    console.error('Content script ile iletişim hatası:', error);
                    showMessage(`${platform} sayfası ile iletişim kurulamadı. Sayfayı yenilemeyi deneyin.`, 'error');
                    platformInfoElement.textContent = platform + ' (iletişim hatası)';
                }
            }, 1000); // Content script'in tam olarak yüklenmesi için bekleme süresini artırdık
        } else {
            platformInfoElement.textContent = 'Desteklenmeyen platform';
            showMessage('Bu eklenti Instagram ve TikTok platformlarında çalışır. Lütfen desteklenen bir platformu ziyaret edin.', 'error');
            sortButton.disabled = true;
            exportButton.disabled = true;
        }
    } catch (error) {
        console.error('Hata oluştu:', error);
        showMessage('Bir hata oluştu: ' + error.message, 'error');
    }

    // Önizleme verilerini tablo olarak gösterme
    const renderPreviewData = (data) => {
        previewTableBody.innerHTML = '';

        data.slice(0, 5).forEach(item => {
            const row = document.createElement('tr');

            // Tarih hücresi
            const dateCell = document.createElement('td');
            dateCell.textContent = new Date(item.date).toLocaleDateString('tr-TR');
            row.appendChild(dateCell);

            // Başlık hücresi
            const titleCell = document.createElement('td');
            titleCell.textContent = item.title || item.caption || 'Başlıksız';
            row.appendChild(titleCell);

            // Beğeni hücresi
            const likesCell = document.createElement('td');
            likesCell.textContent = item.likes?.toLocaleString('tr-TR') || '-';
            row.appendChild(likesCell);

            // Görüntülenme hücresi
            const viewsCell = document.createElement('td');
            viewsCell.textContent = item.views?.toLocaleString('tr-TR') || '-';
            row.appendChild(viewsCell);

            // Yorum hücresi
            const commentsCell = document.createElement('td');
            commentsCell.textContent = item.comments?.toLocaleString('tr-TR') || '-';
            row.appendChild(commentsCell);

            // Paylaşım hücresi
            const sharesCell = document.createElement('td');
            sharesCell.textContent = item.shares?.toLocaleString('tr-TR') || '-';
            row.appendChild(sharesCell);

            previewTableBody.appendChild(row);
        });

        if (data.length > 5) {
            const infoRow = document.createElement('tr');
            const infoCell = document.createElement('td');
            infoCell.colSpan = 6;
            infoCell.textContent = `... ve ${data.length - 5} adet daha içerik`;
            infoCell.style.textAlign = 'center';
            infoCell.style.fontStyle = 'italic';
            infoRow.appendChild(infoCell);
            previewTableBody.appendChild(infoRow);
        }
    };

    // Sıralama butonu tıklama olayı
    sortButton.addEventListener('click', async () => {
        try {
            const currentTab = await getCurrentTab();
            const sortCriteria = document.getElementById('sortCriteria').value;

            showMessage('İçerikler sıralanıyor...', 'info');
            updateStatusBar('Sıralama işlemi devam ediyor...');

            // Doğrudan chrome API kullanarak mesaj gönder
            chrome.tabs.sendMessage(
                currentTab.id,
                {
                    action: 'sortContent',
                    sortCriteria
                },
                function(response) {
                    console.log('Sıralama yanıtı:', response);

                    // Chrome runtime hatası kontrolü
                    if (chrome.runtime.lastError) {
                        console.error('Sıralama hatası:', chrome.runtime.lastError);
                        showMessage('Sayfayla iletişim kurulamadı: ' + chrome.runtime.lastError.message, 'error');
                        updateStatusBar('Hata: İletişim kurulamadı');
                        return;
                    }

                    // Geçerli yanıt kontrolü
                    if (response && response.success) {
                        showMessage(`${response.itemCount} içerik ${response.sortName || sortCriteria} kriterine göre sıralandı.`, 'success');
                        updateStatusBar('Sıralama tamamlandı');

                        if (response.previewData && response.previewData.length > 0) {
                            renderPreviewData(response.previewData);
                        }
                    } else {
                        showMessage(response?.message || 'Sıralama işlemi başarısız oldu.', 'error');
                        updateStatusBar('Sıralama başarısız');
                    }
                }
            );
        } catch (error) {
            console.error('Sıralama hatası:', error);
            showMessage('Sıralama sırasında bir hata oluştu: ' + error.message, 'error');
            updateStatusBar('Hata oluştu');
        }
    });

    // Dışa aktarma butonu tıklama olayı
    exportButton.addEventListener('click', async () => {
        try {
            const currentTab = await getCurrentTab();
            const exportFormat = document.getElementById('exportFormat').value;

            showMessage('Veriler dışa aktarılıyor...', 'info');
            updateStatusBar('Dışa aktarma işlemi devam ediyor...');

            // Doğrudan chrome API kullanarak mesaj gönder
            chrome.tabs.sendMessage(
                currentTab.id,
                {
                    action: 'exportData',
                    exportFormat
                },
                function(response) {
                    console.log('Dışa aktarma yanıtı:', response);

                    // Chrome runtime hatası kontrolü
                    if (chrome.runtime.lastError) {
                        console.error('Dışa aktarma hatası:', chrome.runtime.lastError);
                        showMessage('Sayfayla iletişim kurulamadı: ' + chrome.runtime.lastError.message, 'error');
                        updateStatusBar('Hata: İletişim kurulamadı');
                        return;
                    }

                    // Geçerli yanıt kontrolü
                    if (response && response.success) {
                        try {
                            // Background script'e dosya indirme isteği gönder
                            // Önce background script'in hazır olup olmadığını kontrol et
                            chrome.runtime.sendMessage({action: "ping"}, function(pingResponse) {
                                if (chrome.runtime.lastError) {
                                    console.error('Background script bağlantı hatası:', chrome.runtime.lastError);

                                    // Background script'e erişilemiyorsa, kendi indirme fonksiyonumuzu kullan
                                    const blob = contentTypeToBlob(response.data, response.contentType);
                                    const url = URL.createObjectURL(blob);

                                    // Bağlantıyı manuel olarak indir
                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = response.filename;
                                    document.body.appendChild(a);
                                    a.click();
                                    setTimeout(function() {
                                        document.body.removeChild(a);
                                        URL.revokeObjectURL(url);
                                    }, 100);

                                    showMessage(`${response.itemCount} içerik başarıyla ${exportFormat.toUpperCase()} formatında dışa aktarıldı.`, 'success');
                                    updateStatusBar('Dışa aktarma tamamlandı (alternatif yöntem)');

                                } else {
                                    // Background script hazırsa, indirme isteğini gönder
                                    chrome.runtime.sendMessage({
                                        action: 'downloadFile',
                                        data: response.data,
                                        filename: response.filename,
                                        contentType: response.contentType
                                    }, function(downloadResponse) {
                                        console.log('İndirme yanıtı:', downloadResponse);

                                        if (chrome.runtime.lastError) {
                                            console.error('İndirme hatası:', chrome.runtime.lastError);
                                            showMessage('Dosya indirilemedi: ' + chrome.runtime.lastError.message, 'error');
                                            updateStatusBar('Dışa aktarma başarısız');
                                            return;
                                        }

                                        if (downloadResponse && downloadResponse.success) {
                                            showMessage(`${response.itemCount} içerik başarıyla ${exportFormat.toUpperCase()} formatında dışa aktarıldı.`, 'success');
                                            updateStatusBar('Dışa aktarma tamamlandı');
                                        } else {
                                            showMessage(downloadResponse?.message || 'Dosya indirme işlemi başarısız oldu.', 'error');
                                            updateStatusBar('Dışa aktarma başarısız');
                                        }
                                    });
                                }
                            });
                        } catch (err) {
                            console.error('İndirme sırasında beklenmeyen hata:', err);
                            showMessage('İndirme hatası: ' + err.message, 'error');
                            updateStatusBar('Dışa aktarma başarısız');
                        }
                    } else {
                        showMessage(response?.message || 'Dışa aktarma işlemi başarısız oldu.', 'error');
                        updateStatusBar('Dışa aktarma başarısız');
                    }
                }
            );
        } catch (error) {
            console.error('Dışa aktarma hatası:', error);
            showMessage('Dışa aktarma sırasında bir hata oluştu: ' + error.message, 'error');
            updateStatusBar('Hata oluştu');
        }
    });
});
