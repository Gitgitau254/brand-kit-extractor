'use strict';

function normalizeUrl(value) {
  let v = String(value || '').trim().replace(/\s+/g, '');
  if (!v) return '';
  if (!/^https?:\/\//i.test(v)) v = 'https://' + v;

  try {
    const u = new URL(v);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return '';
    return u.toString();
  } catch {
    return '';
  }
}

const form = document.getElementById('landingForm');
const input = document.getElementById('landingUrl');

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const url = normalizeUrl(input.value);

  if (!url) {
    input.focus();
    input.setCustomValidity('Enter a valid domain like example.com');
    form.reportValidity();
    input.setCustomValidity('');
    return;
  }

  window.location.href = `./results.html?url=${encodeURIComponent(url)}`;
});
