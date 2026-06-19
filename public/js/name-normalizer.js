(function () {
  function normalizeOrdinaryNamePart(part) {
    if (!part) return part;

    const chars = Array.from(part.toLowerCase());
    const firstLetterIndex = chars.findIndex(char => /[a-z]/i.test(char));

    if (firstLetterIndex === -1) {
      return part;
    }

    chars[firstLetterIndex] = chars[firstLetterIndex].toUpperCase();
    return chars.join('');
  }

  function normalizeOrdinaryToken(token) {
    return token
      .split(/([-'`])/)
      .map(part => (/^[-'`]$/.test(part) ? part : normalizeOrdinaryNamePart(part)))
      .join('');
  }

  function normalizeNameToken(token) {
    const compact = token.replace(/[.\s]/g, '').toLowerCase();

    if (compact === 'bin') return 'bin';
    if (compact === 'binti') return 'binti';
    if (compact === 'bt') return 'bt';

    if (compact === 'a/l' || compact === 'al') return 'A/L';
    if (compact === 'a/p' || compact === 'ap') return 'A/P';

    return normalizeOrdinaryToken(token);
  }

  function normalizePersonName(value) {
    return String(value || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map(normalizeNameToken)
      .join(' ');
  }

  function normalizeInputValue(input) {
    if (!input) return;
    input.value = normalizePersonName(input.value);
  }

  function attachNameNormalization(formOrDocument) {
    const firstName = formOrDocument.querySelector('#firstName');
    const lastName = formOrDocument.querySelector('#lastName');

    [firstName, lastName].forEach(input => {
      if (!input) return;
      input.addEventListener('blur', () => normalizeInputValue(input));
    });

    const form = firstName?.form || lastName?.form;
    if (form) {
      form.addEventListener('submit', () => {
        normalizeInputValue(firstName);
        normalizeInputValue(lastName);
      });
    }
  }

  window.qssNormalizePersonName = normalizePersonName;
  window.qssAttachNameNormalization = attachNameNormalization;

  document.addEventListener('DOMContentLoaded', () => attachNameNormalization(document));
})();
