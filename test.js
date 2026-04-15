require('dotenv').config();
const fs = require('fs');

const BASE_URL = 'https://crm.quickstopsolution.com/api/existing-clients';
const CRM_API_KEY = process.env.CRM_API_KEY;

async function getAllClients() {
  let allClients = [];
  let page = 1;
  let lastPage = 1;

  const seen = new Map();
  const duplicates = [];

  try {
    while (page <= lastPage) {
      const res = await fetch(`${BASE_URL}?page=${page}&per_page=15`, {
        headers: {
          'X-API-KEY': CRM_API_KEY,
          'Accept': 'application/json'
        }
      });

      const data = await res.json();

      console.log(`Fetched page ${page} of ${data.meta.last_page}`);

      data.data.forEach((client, index) => {
        if (seen.has(client.id)) {
          const firstSeen = seen.get(client.id);

          duplicates.push({
            id: client.id,
            name: client.name,
            firstPage: firstSeen.page,
            duplicatePage: page
          });
        } else {
          seen.set(client.id, { page, index });
        }
      });

      allClients.push(...data.data);

      lastPage = data.meta.last_page;
      page++;
    }

    console.log('Total clients fetched:', allClients.length);
    console.log('Total unique IDs:', seen.size);

    generateCSV(allClients, duplicates);

    return allClients;

  } catch (error) {
    console.error('Error:', error);
    return [];
  }
}

function generateCSV(allClients, duplicates) {
  const clientHeaders = ['id', 'name', 'email_address', 'work_phone'];
  const duplicateHeaders = ['id', 'name', 'firstPage', 'duplicatePage'];

  const clientRows = allClients.map(c =>
    clientHeaders.map(h => `"${(c[h] ?? '').toString().replace(/"/g, '""')}"`).join(',')
  );

  const duplicateRows = duplicates.map(d =>
    duplicateHeaders.map(h => `"${(d[h] ?? '').toString().replace(/"/g, '""')}"`).join(',')
  );

  const csvContent = [
    'ALL CLIENTS',
    clientHeaders.join(','),
    ...clientRows,
    '',
    'DUPLICATES',
    duplicateHeaders.join(','),
    ...duplicateRows
  ].join('\n');

  fs.writeFileSync('clients_report.csv', csvContent);
  console.log('CSV file created: clients_report.csv');
}

getAllClients();