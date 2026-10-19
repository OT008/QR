# QR

Türkçe, mobil uyumlu, yalnızca QR kod oluşturmak için hazırlanmış statik site.

## Kullanım

`index.html` dosyasını tarayıcıda aç. Kurulum veya derleme gerekmez.

- Bağlantı, metin, kişi kartı (vCard) ve Wi-Fi QR kodları; otomatik önizleme.
- Türkçe karakter ve emoji desteği, en fazla 2000 bayt içerik.
- Varsayılan siyah QR; renk seçici ve 3/6 haneli HEX koduyla özel renk. Açık renklerde okunabilirlik uyarısı.
- PNG veya SVG indirme düğmesine basınca 512, 1024 ya da 2048 piksel boyut seçimi. SVG vektöreldir; seçilen ölçü başlangıç görüntüleme boyutudur.
- Dört modüllük beyaz kenarlık ve M hata düzeltme seviyesi.
- QR içeriği tarayıcıda işlenir; analiz, çerez, harici API veya içerik kaydı yoktur.
- Tüm kaynaklar yereldir. Dosyalar indirildikten sonra internet bağlantısı gerekmez.

Wi-Fi kodları şifreyi içerir: kodu verdiğin kişiler şifreye erişebilir. Wi-Fi bağlantı davranışı telefon ve kamera uygulamasına göre değişebilir. Oluşturulan statik QR kodun süresi dolmaz; hedef bağlantının erişilebilir kalması gerekir. Dağıtmadan önce kodu telefonla tarayarak kontrol et.

## QR ile rehbere ekleme

**Kişi** sekmesinde ad, soyad ve telefon zorunludur; eksikken QR oluşturulmaz. E-posta, şirket, ünvan ve web sitesi isteğe bağlıdır. Ülke kodu listesinde varsayılan Türkiye (+90); listede bulunmayan kodlar “Diğer ülke kodu” ile girilebilir. Numara yazılırken `532 123 45 67` biçiminde gruplandırılır. Türkiye için başında 0 olmadan 10 hane gerekir; tam numara yapıştırıldığında seçili +90/0090 kodu veya 11 haneli yerel numaranın başındaki 0 ayrılır. Diğer ülkelerde farklı uzunluklar korunur (ülke koduyla birlikte en fazla 15 hane); her ülkenin numara tahsis kuralları doğrulanmaz. QR ve VCF telefon alanı, boşluksuz ülke kodu + numara içerir. QR doğrudan kişi kartını taşır; bağlantı veya sunucu gerekmez.

Kod, UTF-8 **vCard 3.0** içerir: `N` ve `FN` alanları, CRLF satır sonları, metin kaçışları ve çok baytlı karakterleri bölmeden satır katlama uygulanır. Aynı içerik **Kişi kartını indir (.vcf)** düğmesinden alınabilir.

Android/iPhone'da vCard tanıyan kamera veya QR okuyucuyla taranıp kişi ekleme/kaydetme işlemi onaylanır. Her telefonun yerleşik kamerasının aynı davranacağı garanti edilemez. Kamera yalnızca metin gösteriyorsa vCard destekleyen bir okuyucu kullanılabilir veya oluşturucudan indirilen `.vcf` dosyası paylaşılabilir. iPhone vCard içe aktarmayı, Google Kişiler ise VCF dosyasından içe aktarmayı destekler. Kayıt, kullanıcının onayını gerektirir.

Kaynaklar: [vCard 3.0 standardı](https://www.rfc-editor.org/rfc/rfc2426.html), [iPhone'a kişi aktarma](https://support.apple.com/en-mide/guide/iphone/iph356499f31/26/ios/26), [Android'de VCF içe aktarma](https://support.google.com/contacts/answer/15147365?co=GENIE.Platform%3DAndroid&hl=en-uk).

## GitHub Pages'te yayınlama

1. GitHub'da yeni bir `QR` deposu oluştur.
2. **Bu klasörün içeriğini** deponun köküne yükle. `index.html` ve `vendor/` aynı seviyede olmalı; `vendor/` içindeki iki dosya da dahil edilmeli.
3. Depoda **Settings → Pages → Build and deployment** bölümünü aç.
4. **Source → Deploy from a branch**, **Branch → main**, klasör **/(root)** seç ve **Save** düğmesine bas.
5. Yayın tamamlanınca adres genellikle `https://KULLANICI_ADI.github.io/QR/` olur; kesin bağlantıyı Pages bölümünde görebilirsin.

Mevcut çoklu site deponun kökü zaten GitHub Pages'te yayınlanıyorsa `QR` klasörünü olduğu gibi o depoya ekleyebilirsin. Bu durumda site, mevcut Pages adresinin `/QR/` alt yolunda açılır. Pages kaynak klasörü olarak doğrudan `/QR` seçilmez; kaynak `/` veya `/docs` olmalıdır.

Resmî yönerge: [GitHub Pages yayın kaynağını yapılandırma](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).

## Dosyalar

- `index.html`: arayüz
- `styles.css`: responsive tasarım; üst klasördeki `standart.txt` paletini temel alır
- `app.js`: veri doğrulama, QR önizlemesi ve indirme
- `vendor/qrcode.js`: yerel QR matrisi kütüphanesi
- `vendor/LICENSE`: üçüncü taraf MIT lisansı
- `.nojekyll`: GitHub Pages için doğrudan statik sunum

QR matrisi için [Kazuhiko Arase / qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) 1.4.4 kullanılır (MIT). Kaynak: https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js. UTF-8 kodlaması `TextEncoder` ile uygulanır. Çalışma sırasında CDN isteği yapılmaz.
