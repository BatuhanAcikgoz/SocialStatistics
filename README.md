# Social Statistics

Instagram ve TikTok platformlarındaki içerikleri analiz eden, sıralayan ve dışa aktaran tarayıcı eklentisi.

## Özellikler

- **İçerik Sıralama**
  - Instagram gönderileri ve Reels içeriklerini oluşturulma tarihi, beğeni sayısı, görüntülenme sayısı ve paylaşım sayısı gibi metriklere göre sıralama
  - TikTok videolarını benzer metriklere göre sıralama
  - Tek tıklamayla sıralama işlemi

- **Veri Dışa Aktarımı**
  - İçeriklerin başlıkları, görüntülenme sayıları, beğeni sayıları ve diğer etkileşim verilerini Excel, CSV veya JSON formatlarında dışa aktarma

## Kurulum ve Geliştirme

### Gereksinimler

- Node.js ve npm

### Kurulum

1. Proje dosyalarını bilgisayarınıza indirin:
```
git clone https://github.com/kullaniciadi/SocialStatistics.git
cd SocialStatistics
```

2. Gerekli bağımlılıkları yükleyin:
```
npm install
```

3. Eklentiyi derleyin:
```
npm run build
```

## Eklentiyi Tarayıcıya Yükleme

### Chrome'a Yükleme

1. Chrome tarayıcısını açın ve adres çubuğuna `chrome://extensions` yazın.
2. Sağ üst köşedeki "Geliştirici modu" düğmesini etkinleştirin.
3. Açılan ekranda "Paketlenmemiş öğe yükle" düğmesine tıklayın.
4. SocialStatistics projesinin `dist` klasörünü seçin ve "Klasör Seç" düğmesine tıklayın.
5. Eklenti artık Chrome'a yüklenmiş olacak ve adres çubuğunun yanındaki eklenti simgelerine eklenecektir.

### Firefox'a Yükleme

1. Firefox tarayıcısını açın ve adres çubuğuna `about:debugging#/runtime/this-firefox` yazın.
2. "Geçici Eklenti Yükle" düğmesine tıklayın.
3. SocialStatistics projesinin `dist` klasöründeki `manifest.json` dosyasını seçin.
4. Eklenti artık Firefox'a geçici olarak yüklenmiş olacak.

**Not:** Firefox'ta geçici olarak yüklenen eklentiler, tarayıcı kapatıldığında kaldırılır. Kalıcı olarak yüklemek için eklentiyi paketleyip Firefox Add-ons sitesinde yayınlamanız gerekir.

## Kullanım

1. Eklentiyi yükledikten sonra, Instagram veya TikTok web sitesini ziyaret edin.
2. Bir profil sayfasına veya içerik listesi olan bir sayfaya gidin.
3. Tarayıcının sağ üst köşesindeki eklenti simgesine tıklayın.
4. Açılan popup penceresinde, içerikleri istediğiniz kritere göre sıralayabilir veya dışa aktarabilirsiniz.

## Lisans

Bu proje MIT lisansı altında lisanslanmıştır - Ayrıntılar için [LICENSE](LICENSE) dosyasına bakın.
