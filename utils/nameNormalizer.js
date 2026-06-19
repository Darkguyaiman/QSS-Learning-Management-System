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

module.exports = {
  normalizePersonName
};
