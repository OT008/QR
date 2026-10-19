(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const contactFields = ['contact-first', 'contact-last', 'contact-phone', 'contact-email', 'contact-org', 'contact-title', 'contact-url'];
  const fields = ['url', 'text', 'ssid', 'password', 'security', 'hidden-network', ...contactFields];
  const typeButtons = [...document.querySelectorAll('[data-type]')];
  const colorButtons = [...document.querySelectorAll('[data-color]')];
  const emptyPreview = $('qr-image').innerHTML;
  const encoder = new TextEncoder();
  let type = 'url';
  let color = '#25283a';
  let currentQR = null;
  let currentPayload = '';
  let timer;
  let revision = 0;
  const libraryReady = typeof window.qrcode === 'function';
  if (libraryReady) window.qrcode.stringToBytes = (value) => Array.from(encoder.encode(value));

  function invalid(message, field) {
    const error = new Error(message);
    error.field = field;
    throw error;
  }

  function webAddress(value, field) {
      if (!value) return '';
      if (/\s/.test(value)) invalid('Bağlantıda boşluk olmamalı. Adresi kontrol et.', field);
      const normalized = /^https?:\/\//i.test(value) ? value : `https://${value}`;
      let parsed;
      try { parsed = new URL(normalized); } catch { invalid('Geçerli bir web adresi gir. Örneğin: https://ornek.com', field); }
      if (!/^https?:$/.test(parsed.protocol) || !parsed.hostname.includes('.') || parsed.username || parsed.password || (value.includes('://') && !/^https?:\/\//i.test(value))) {
        invalid('Geçerli bir http:// veya https:// web adresi gir.', field);
      }
      return parsed.href;
  }

  function contactCard() {
    const get = (name) => $(`contact-${name}`).value.trim();
    const first = get('first');
    const last = get('last');
    if (!contactFields.some((id) => $(id).value.trim())) return '';
    if (!first && !last) invalid('Kişi kartı için en az ad veya soyad gir.', 'contact-first');
    const phone = get('phone');
    const normalizedPhone = phone.replace(/[\s().-]/g, '');
    if (phone && (!/^[+\d\s().-]+$/.test(phone) || !/^\+?\d{3,20}$/.test(normalizedPhone))) {
      invalid('Geçerli bir telefon numarası gir. Örneğin: +90 532 123 45 67', 'contact-phone');
    }
    const email = get('email');
    if (email && !$('contact-email').validity.valid) invalid('Geçerli bir e-posta adresi gir.', 'contact-email');
    const website = webAddress(get('url'), 'contact-url');
    // vCard 3.0 text values: preserve Unicode; escape separators and newlines.
    const escape = (value) => value.replace(/\\/g, '\\\\').replace(/\r\n|\r|\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,');
    const lines = [
      'BEGIN:VCARD', 'VERSION:3.0',
      `N:${escape(last)};${escape(first)};;;`,
      `FN:${escape([first, last].filter(Boolean).join(' '))}`,
    ];
    if (phone) lines.push(`TEL;TYPE=CELL:${normalizedPhone}`);
    if (email) lines.push(`EMAIL;TYPE=INTERNET:${escape(email)}`);
    if (get('org')) lines.push(`ORG:${escape(get('org'))}`);
    if (get('title')) lines.push(`TITLE:${escape(get('title'))}`);
    if (website) lines.push(`URL:${website}`);
    lines.push('END:VCARD');
    // Fold at 75 UTF-8 bytes without splitting multibyte characters.
    return lines.map((line) => {
      let folded = '';
      let length = 0;
      for (const char of line) {
        const bytes = encoder.encode(char).length;
        if (length + bytes > 75) { folded += '\r\n '; length = 1; }
        folded += char;
        length += bytes;
      }
      return folded;
    }).join('\r\n') + '\r\n';
  }

  function primaryField() {
    return type === 'contact' ? 'contact-first' : type === 'wifi' ? 'ssid' : type;
  }

  function payload() {
    if (type === 'text') return $('text').value.trim() ? $('text').value : '';
    if (type === 'contact') return contactCard();
    if (type === 'url') {
      return webAddress($('url').value.trim(), 'url');
    }
    if (!$('ssid').value.trim()) return '';
    const escape = (value) => value.replace(/[\\;,:"']/g, '\\$&');
    const security = $('security').value;
    if (security !== 'nopass' && !$('password').value) throw new Error('Bu ağ için şifre gir veya “Şifresiz ağ” seç.');
    return `WIFI:T:${security};S:${escape($('ssid').value)};${security === 'nopass' ? '' : `P:${escape($('password').value)};`}H:${$('hidden-network').checked};;`;
  }

  function svgFor(qr, size, codeColor) {
    const count = qr.getModuleCount();
    const extent = count + 8; // Four-module quiet zone on every side.
    const paths = [];
    for (let row = 0; row < count; row++) {
      for (let col = 0; col < count; col++) {
        if (qr.isDark(row, col)) paths.push(`M${col + 4},${row + 4}h1v1h-1z`);
      }
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${extent} ${extent}" shape-rendering="crispEdges"><rect width="${extent}" height="${extent}" fill="#ffffff"/><path d="${paths.join('')}" fill="${codeColor}"/></svg>`;
  }

  function setReady(ready) {
    $('download-png').disabled = !ready;
    $('download-svg').disabled = !ready;
    $('download-vcf').disabled = !ready || type !== 'contact';
  }

  function update() {
    clearTimeout(timer);
    revision++;
    currentQR = null;
    currentPayload = '';
    setReady(false);
    $('error').textContent = '';
    $('qr-image').innerHTML = emptyPreview;
    $('qr-image').setAttribute('aria-label', 'QR kod için içerik bekleniyor');
    $('preview-status').textContent = 'Oluşturmak için içeriğini ekle.';
    $('char-count').textContent = `${Array.from($('text').value).length} karakter`;
    $('password').disabled = $('security').value === 'nopass';
    $('download-vcf').hidden = type !== 'contact';
    $('scan-note').textContent = type === 'contact'
      ? 'Android veya iPhone ile tara, kişi eklemeyi onayla. Alternatif olarak .vcf dosyasını Kişiler uygulamasında açabilirsin.'
      : 'Hazır olduğunda telefonunun kamerasıyla dene.';
    document.querySelector('.workspace').classList.toggle('contact-mode', type === 'contact');
    for (const id of fields) $(id).removeAttribute('aria-invalid');
    try {
      if (!libraryReady) throw new Error('QR kütüphanesi yüklenemedi. Sayfayı yeniden açmayı dene.');
      const value = payload();
      if (!value) return;
      if (encoder.encode(value).length > 2000) throw new Error('İçerik çok uzun. En fazla 2000 bayt kullanılabilir; Türkçe harfler ve emojiler birden fazla bayt olabilir.');
      const qr = window.qrcode(0, 'M');
      qr.addData(value, 'Byte');
      qr.make();
      currentQR = qr;
      currentPayload = value;
      $('qr-image').innerHTML = svgFor(qr, 256, color);
      $('qr-image').setAttribute('aria-label', 'Girdiğin içerikten oluşturulan QR kod');
      $('preview-status').textContent = type === 'url' ? new URL(value).hostname + ' · QR kodun hazır' : 'QR kodun hazır. İndir, tara, paylaş.';
      if (type === 'contact') $('preview-status').textContent = 'Kişi kartın hazır. Tarayarak rehbere ekle.';
      setReady(true);
    } catch (error) {
      $('error').textContent = error instanceof Error ? error.message : 'Bu içerikten QR oluşturulamadı. İçeriği kısaltıp tekrar dene.';
      $(error.field || primaryField()).setAttribute('aria-invalid', 'true');
      $('preview-status').textContent = 'Devam etmek için içeriğini kontrol et.';
    }
  }

  function download(blob, extension) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `qr-${type}.${extension}`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    $('preview-status').textContent = `${extension.toUpperCase()} dosyan hazır. İndirme başlatıldı.`;
  }

  typeButtons.forEach((button) => button.addEventListener('click', () => {
    type = button.dataset.type;
    typeButtons.forEach((item) => {
      const active = item === button;
      item.classList.toggle('active', active);
      item.setAttribute('aria-pressed', String(active));
      $(`panel-${item.dataset.type}`).hidden = !active;
    });
    update();
  }));
  colorButtons.forEach((button) => button.addEventListener('click', () => {
    color = button.dataset.color;
    colorButtons.forEach((item) => {
      item.classList.toggle('selected', item === button);
      item.setAttribute('aria-pressed', String(item === button));
    });
    update();
  }));
  fields.forEach((id) => $(id).addEventListener('input', () => {
    clearTimeout(timer);
    revision++;
    currentQR = null;
    currentPayload = '';
    setReady(false);
    // Hide the previous code immediately so it cannot be mistaken for new input.
    $('qr-image').innerHTML = emptyPreview;
    $('qr-image').setAttribute('aria-label', 'QR kod güncelleniyor');
    $('preview-status').textContent = 'Önizleme güncelleniyor…';
    $('char-count').textContent = `${Array.from($('text').value).length} karakter`;
    timer = setTimeout(update, 180);
  }));
  $('reset').addEventListener('click', () => {
    ['url', 'text', 'ssid', 'password', ...contactFields].forEach((id) => { $(id).value = ''; });
    $('security').value = 'WPA';
    $('hidden-network').checked = false;
    update();
    $(primaryField()).focus();
  });
  $('download-vcf').addEventListener('click', () => {
    if (currentQR && type === 'contact') download(new Blob([currentPayload], { type: 'text/vcard;charset=utf-8' }), 'vcf');
  });
  $('download-svg').addEventListener('click', () => {
    if (currentQR) download(new Blob([svgFor(currentQR, Number($('size').value), color)], { type: 'image/svg+xml;charset=utf-8' }), 'svg');
  });
  $('download-png').addEventListener('click', () => {
    if (!currentQR) return;
    const qr = currentQR;
    const version = revision;
    const size = Number($('size').value);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const context = canvas.getContext('2d');
    if (!context) { $('error').textContent = 'PNG oluşturulamadı. SVG olarak indirmeyi dene.'; return; }
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, size, size);
    context.fillStyle = color;
    const count = qr.getModuleCount();
    const scale = Math.floor(size / (count + 8));
    const offset = Math.floor((size - count * scale) / 2);
    for (let row = 0; row < count; row++) for (let col = 0; col < count; col++) {
      if (qr.isDark(row, col)) context.fillRect(offset + col * scale, offset + row * scale, scale, scale);
    }
    canvas.toBlob((blob) => {
      if (version !== revision) return;
      if (blob) download(blob, 'png');
      else $('error').textContent = 'PNG oluşturulamadı. SVG olarak indirmeyi dene.';
    }, 'image/png');
  });
  update();
})();
