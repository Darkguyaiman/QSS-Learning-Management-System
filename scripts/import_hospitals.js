require('dotenv').config();
const { pool } = require('../config/database');

const BASE_URL = 'https://crm.quickstopsolution.com/api/existing-clients';
const CRM_API_KEY = process.env.CRM_API_KEY;
const SHOULD_RESET = process.argv.includes('--reset');

function buildHeaders() {
  if (!CRM_API_KEY) {
    throw new Error('Missing CRM_API_KEY in .env');
  }

  return {
    'X-API-KEY': CRM_API_KEY,
    Accept: 'application/json'
  };
}

function buildAddress(client) {
  return [client?.address_1, client?.address_2]
    .map(value => String(value || '').trim())
    .filter(Boolean)
    .join(', ');
}

function buildName(client, clientId) {
  const preferredName = String(client?.name || '').trim();
  const businessEntityName = String(client?.businessEntity?.name || '').trim();

  return preferredName || businessEntityName || `CRM Client ${clientId}`;
}

function buildDescription(client) {
  return [
    `mobile_phone: ${client?.mobile_phone || ''}`,
    `email_address: ${client?.email_address || ''}`,
    `work_phone: ${client?.work_phone || ''}`
  ].join('\n');
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: buildHeaders() });

  if (!response.ok) {
    throw new Error(`CRM request failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

async function getAllExistingClients() {
  const firstPage = await fetchJson(BASE_URL);
  const lastPage = Number(firstPage?.meta?.last_page || 1);
  const allClients = Array.isArray(firstPage?.data) ? [...firstPage.data] : [];

  const requests = [];
  for (let page = 2; page <= lastPage; page++) {
    requests.push(fetchJson(`${BASE_URL}?page=${page}`));
  }

  const remainingPages = await Promise.all(requests);
  for (const pageData of remainingPages) {
    if (Array.isArray(pageData?.data)) {
      allClients.push(...pageData.data);
    }
  }

  return allClients;
}

async function upsertClients(connection, clients) {
  let inserted = 0;
  let updated = 0;

  for (const client of clients) {
    const clientId = Number(client?.id);
    if (!Number.isInteger(clientId) || clientId <= 0) {
      throw new Error(`CRM record is missing a valid numeric id: ${JSON.stringify(client)}`);
    }

    const name = buildName(client, clientId);
    const hospitalAddress = buildAddress(client);
    const description = buildDescription(client);

    const [existingRows] = await connection.query('SELECT id FROM healthcare WHERE id = ? LIMIT 1', [clientId]);

    if (existingRows.length > 0) {
      await connection.query(
        'UPDATE healthcare SET name = ?, hospital_address = ?, description = ? WHERE id = ?',
        [name, hospitalAddress, description, clientId]
      );
      updated++;
      continue;
    }

    await connection.query(
      'INSERT INTO healthcare (id, name, hospital_address, description) VALUES (?, ?, ?, ?)',
      [clientId, name, hospitalAddress, description]
    );
    inserted++;
  }

  return { inserted, updated };
}

async function resetHealthcareTable(connection) {
  await connection.query('DELETE FROM healthcare');
}

async function main() {
  const connection = await pool.getConnection();

  try {
    if (SHOULD_RESET) {
      await resetHealthcareTable(connection);
      console.log('Cleared existing healthcare rows before import.');
    }

    const clients = await getAllExistingClients();
    const result = await upsertClients(connection, clients);

    console.log(`Fetched ${clients.length} existing client records from CRM.`);
    console.log(`Inserted ${result.inserted} healthcare rows.`);
    console.log(`Updated ${result.updated} healthcare rows.`);
  } finally {
    connection.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error('Hospital import failed:', err.message || err);
  process.exit(1);
});
