const fs = require('fs-extra');
const path = require('path');

const srcDir = path.join(__dirname, 'src');
const distDir = path.join(__dirname, 'dist');

// Önceki build temizlenir
if (fs.existsSync(distDir)) {
  fs.removeSync(distDir);
}

// Dist klasörü oluşturulur
fs.mkdirSync(distDir);

// src içeriğini dist'e kopyala
fs.copySync(srcDir, distDir);

console.log('Build işlemi tamamlandı! Eklenti dist/ klasöründe hazır.');
console.log('Eklentiyi nasıl yükleyeceğinize dair talimatlar için README.md dosyasına bakın.');
