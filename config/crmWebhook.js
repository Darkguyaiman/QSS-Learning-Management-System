const CRM_WEBHOOK_SOURCE_SYSTEM = process.env.CRM_WEBHOOK_SOURCE_SYSTEM || 'LMS';
const LOCAL_WEBHOOK_ENDPOINT = process.env.LOCAL_WEBHOOK_ENDPOINT || `http://localhost:${process.env.PORT || 3000}/webhook`;

function buildWebhookBody(eventType, payload = {}) {
  return {
    success: true,
    source_system: CRM_WEBHOOK_SOURCE_SYSTEM,
    event_type: eventType,
    timestamp: new Date().toISOString(),
    payload
  };
}

function extractCustomerId(payload = {}) {
  const customer = payload.customer && typeof payload.customer === 'object'
    ? payload.customer
    : {};

  const candidates = [
    payload.id,
    payload.customer_id,
    payload.crm_id,
    payload.client_id,
    customer.id,
    customer.customer_id,
    customer.crm_id,
    customer.client_id
  ];

  for (const candidate of candidates) {
    const parsed = Number.parseInt(String(candidate || '').trim(), 10);
    if (Number.isInteger(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return null;
}

function extractCustomerName(payload = {}, fallbackId = null) {
  const customer = payload.customer && typeof payload.customer === 'object'
    ? payload.customer
    : {};

  const candidates = [
    payload.name,
    payload.company_name,
    payload.customer_name,
    payload.client_name,
    payload.business_name,
    payload.businessEntity?.name,
    customer.name,
    customer.company_name,
    customer.customer_name,
    customer.client_name,
    customer.business_name,
    customer.businessEntity?.name
  ];

  for (const candidate of candidates) {
    const value = String(candidate || '').trim();
    if (value) {
      return value;
    }
  }

  return fallbackId ? `CRM Client ${fallbackId}` : '';
}

function extractCustomerAddress(payload = {}) {
  const customer = payload.customer && typeof payload.customer === 'object'
    ? payload.customer
    : {};

  const directAddress = String(
    payload.hospital_address ||
    payload.address ||
    payload.full_address ||
    customer.hospital_address ||
    customer.address ||
    customer.full_address ||
    ''
  ).trim();

  if (directAddress) {
    return directAddress;
  }

  return [
    payload.address_1,
    payload.address_2,
    customer.address_1,
    customer.address_2
  ]
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .join(', ');
}

function buildHealthcarePayload(row = {}) {
  return {
    id: row.id,
    name: row.name,
    hospital_address: row.hospital_address || ''
  };
}

module.exports = {
  CRM_WEBHOOK_SOURCE_SYSTEM,
  LOCAL_WEBHOOK_ENDPOINT,
  buildWebhookBody,
  extractCustomerId,
  extractCustomerName,
  extractCustomerAddress,
  buildHealthcarePayload
};
