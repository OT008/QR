(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const contactFields = ['contact-first', 'contact-last', 'contact-phone', 'contact-email', 'contact-org', 'contact-title', 'contact-url'];
  const fields = ['url', 'text', 'ssid', 'password', 'security', 'hidden-network', ...contactFields, 'contact-country', 'contact-dial-code'];
  const typeButtons = [...document.querySelectorAll('[data-type]')];
  const emptyPreview = $('qr-image').innerHTML;
  const encoder = new TextEncoder();
  let type = 'url';
  let color = '#000000';
  let exportFormat = 'png';
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
    if (!first) invalid('Adını gir.', 'contact-first');
    if (!last) invalid('Soyadını gir.', 'contact-last');
    const phone = get('phone');
    const dialCode = countryCode();
    if (!/^\+[1-9]\d{0,2}$/.test(dialCode)) invalid('Geçerli bir ülke kodu gir. Örnek: +90', 'contact-dial-code');
    if (!phone) invalid('Telefon numaranı gir.', 'contact-phone');
    const digits = phone.replace(/\s/g, '');
    if (!/^\d+$/.test(digits)) invalid('Numarayı seçili ülke kodu olmadan gir.', 'contact-phone');
    if (dialCode === '+90' && !/^[1-9]\d{9}$/.test(digits)) {
      invalid('Telefon numarası başında 0 olmadan 10 haneli olmalı.', 'contact-phone');
    }
    if (digits.length < 6 || digits.length + dialCode.length - 1 > 15) {
      invalid('Telefon numarasının uzunluğunu kontrol et.', 'contact-phone');
    }
    const normalizedPhone = dialCode + digits;
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

  function countryCode() {
    return $('contact-country').value === 'other' ? $('contact-dial-code').value.trim() : $('contact-country').value;
  }

  function formatPhone() {
    const input = $('contact-phone');
    const raw = input.value;
    const caret = input.selectionStart ?? raw.length;
    let digitsBefore = (raw.slice(0, caret).match(/\d/g) || []).length;
    let digits = raw.replace(/\D/g, '');
    const dialCode = countryCode();
    // Accept pasted international numbers only when they match the selected code.
    if (/^\s*(?:\+|00)/.test(raw)) {
      const prefix = (/^\s*00/.test(raw) ? '00' : '') + dialCode.slice(1);
      if (!/^\+[1-9]\d{0,2}$/.test(dialCode) || !digits.startsWith(prefix)) return;
      digits = digits.slice(prefix.length);
      digitsBefore = Math.max(0, digitsBefore - prefix.length);
    }
    // Turkish domestic numbers may be pasted with the trunk prefix 0.
    if (dialCode === '+90' && digits.length === 11 && digits.startsWith('0')) {
      digits = digits.slice(1);
      digitsBefore = Math.max(0, digitsBefore - 1);
    }
    // Keep extra digits visible for validation; never silently truncate a number.
    const lengths = [3, 3, 2, 2];
    const parts = [];
    let offset = 0;
    for (const length of lengths) {
      if (offset >= digits.length) break;
      parts.push(digits.slice(offset, offset + length));
      offset += length;
    }
    if (offset < digits.length) parts.push(digits.slice(offset));
    input.value = parts.join(' ');
    let position = 0;
    let seen = 0;
    while (position < input.value.length && seen < digitsBefore) {
      if (/\d/.test(input.value[position])) seen++;
      position++;
    }
    input.setSelectionRange(position, position);
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
    $('download-confirm').disabled = !ready;
  }

  function readColor() {
    const hex = $('color-hex').value.trim().replace(/^#/, '');
    if (!/^(?:[\da-f]{3}|[\da-f]{6})$/i.test(hex)) {
      invalid('3 veya 6 haneli HEX kodu gir. Örnek: #000000', 'color-hex');
    }
    const normalized = '#' + (hex.length === 3 ? [...hex].map((digit) => digit + digit).join('') : hex).toUpperCase();
    $('color-picker').value = normalized;
    const channels = normalized.slice(1).match(/../g).map((value) => {
      const channel = parseInt(value, 16) / 255;
      return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    });
    const luminance = channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
    if (1.05 / (luminance + 0.05) < 3) $('color-feedback').textContent = 'Bu renk beyaz zeminde zor okunabilir.';
    return normalized;
  }

  function update() {
    clearTimeout(timer);
    revision++;
    currentQR = null;
    currentPayload = '';
    setReady(false);
    $('error').textContent = '';
    $('color-feedback').textContent = '';
    $('color-hex').removeAttribute('aria-invalid');
    $('qr-image').innerHTML = emptyPreview;
    $('qr-image').setAttribute('aria-label', 'QR kod için içerik bekleniyor');
    $('preview-status').textContent = 'İçerik girerek başla.';
    $('char-count').textContent = `${Array.from($('text').value).length} karakter`;
    $('password').disabled = $('security').value === 'nopass';
    $('country-prefix').textContent = countryCode() || 'Diğer';
    $('download-vcf').hidden = type !== 'contact';
    $('scan-note').hidden = type !== 'contact';
    $('scan-note').textContent = type === 'contact' ? 'Tara → Kişilere ekle → Kaydet' : '';
    document.querySelector('.workspace').classList.toggle('contact-mode', type === 'contact');
    for (const id of fields) $(id).removeAttribute('aria-invalid');
    try {
      if (!libraryReady) throw new Error('QR kütüphanesi yüklenemedi. Sayfayı yeniden açmayı dene.');
      color = readColor();
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
      $('preview-status').textContent = type === 'contact' ? 'Kişi kartı hazır.' : 'QR hazır.';
      setReady(true);
    } catch (error) {
      $(error.field === 'color-hex' ? 'color-feedback' : 'error').textContent = error instanceof Error ? error.message : 'Bu içerikten QR oluşturulamadı. İçeriği kısaltıp tekrar dene.';
      $(error.field || primaryField()).setAttribute('aria-invalid', 'true');
      $('preview-status').textContent = 'İçeriği kontrol et.';
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
    $('preview-status').textContent = `${extension.toUpperCase()} indirme başlatıldı.`;
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
  $('color-picker').addEventListener('input', () => {
    $('color-hex').value = $('color-picker').value.toUpperCase();
    update();
  });
  $('color-hex').addEventListener('input', update);
  $('color-hex').addEventListener('blur', () => {
    if (!$('color-hex').hasAttribute('aria-invalid')) $('color-hex').value = color;
  });
  $('color-black').addEventListener('click', () => {
    $('color-hex').value = '#000000';
    update();
  });
  $('contact-phone').addEventListener('beforeinput', (event) => {
    const input = event.target;
    const position = input.selectionStart;
    if (position !== input.selectionEnd) return;
    // Backspace/Delete should remove a digit, not get stuck on an inserted space.
    if (event.inputType === 'deleteContentBackward' && input.value[position - 1] === ' ') input.setSelectionRange(position - 2, position);
    if (event.inputType === 'deleteContentForward' && input.value[position] === ' ') input.setSelectionRange(position, position + 2);
  });
  fields.forEach((id) => $(id).addEventListener('input', () => {
    if (id === 'contact-country') {
      $('custom-country').hidden = $('contact-country').value !== 'other';
      $('contact-dial-code').required = !$('custom-country').hidden;
    }
    if (['contact-phone', 'contact-country', 'contact-dial-code'].includes(id)) formatPhone();
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
    $('contact-country').value = '+90';
    $('contact-dial-code').value = '';
    $('contact-dial-code').required = false;
    $('custom-country').hidden = true;
    update();
    $(primaryField()).focus();
  });
  $('download-vcf').addEventListener('click', () => {
    if (currentQR && type === 'contact') download(new Blob([currentPayload], { type: 'text/vcard;charset=utf-8' }), 'vcf');
  });
  ['png', 'svg'].forEach((format) => $(`download-${format}`).addEventListener('click', () => {
    if (!currentQR) return;
    exportFormat = format;
    $('download-title').textContent = `${format.toUpperCase()} indir`;
    $('download-confirm').textContent = `${format.toUpperCase()} indir`;
    $('export-note').hidden = format !== 'svg';
    $('download-dialog').showModal();
  }));
  $('download-cancel').addEventListener('click', () => $('download-dialog').close());
  $('download-form').addEventListener('submit', (event) => {
    event.preventDefault();
    if (!currentQR) return;
    const size = Number($('size').value);
    if (![512, 1024, 2048].includes(size)) return;
    $('download-dialog').close();
    if (exportFormat === 'svg') {
      download(new Blob([svgFor(currentQR, size, color)], { type: 'image/svg+xml;charset=utf-8' }), 'svg');
    } else {
      downloadPNG(size);
    }
  });

  function downloadPNG(size) {
    if (!currentQR) return;
    const qr = currentQR;
    const version = revision;
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
  }
  update();
})();
