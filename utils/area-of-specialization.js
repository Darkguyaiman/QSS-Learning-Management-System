function normalizeAreaValue(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item || '').trim())
      .filter(Boolean);
  }

  if (value === null || value === undefined) {
    return [];
  }

  const text = String(value).trim();
  if (!text) {
    return [];
  }

  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) {
      return parsed
        .map((item) => String(item || '').trim())
        .filter(Boolean);
    }
  } catch (error) {
    // Fall back to legacy comma-separated storage.
  }

  return text
    .split(/[,;]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function serializeAreaValue(value) {
  const normalized = normalizeAreaValue(value);
  return normalized.length > 0 ? JSON.stringify(normalized) : null;
}

function formatAreaValue(value) {
  return normalizeAreaValue(value).join(', ');
}

function normalizeTraineeRecord(record) {
  if (!record) return record;

  const areaList = normalizeAreaValue(record.area_of_specialization);
  return {
    ...record,
    area_of_specialization_raw: record.area_of_specialization,
    area_of_specialization_list: areaList,
    area_of_specialization: areaList.join(', ')
  };
}

function normalizeTraineeRecords(records) {
  return Array.isArray(records) ? records.map(normalizeTraineeRecord) : [];
}

module.exports = {
  formatAreaValue,
  normalizeAreaValue,
  normalizeTraineeRecord,
  normalizeTraineeRecords,
  serializeAreaValue
};
