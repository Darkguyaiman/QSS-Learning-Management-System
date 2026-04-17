require('dotenv').config();

const { LOCAL_WEBHOOK_ENDPOINT, buildWebhookBody } = require('../config/crmWebhook');

async function main() {
  const body = buildWebhookBody('customer-create', {
    id: 999001,
    name: 'Sample CRM Customer',
    hospital_address: '123 Sample Street'
  });

  console.log('Posting local test payload to the LMS webhook receiver:');
  console.log(LOCAL_WEBHOOK_ENDPOINT);
  console.log(JSON.stringify(body, null, 2));

  const response = await fetch(LOCAL_WEBHOOK_ENDPOINT, {
    method: 'POST',
    redirect: 'manual',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  const responseText = await response.text().catch(() => '');
  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get('location') || '';
    throw new Error(`Local webhook request was redirected to ${location || 'another URL'}. Restart the LMS server so the public /webhook route is loaded.`);
  }

  if (!response.ok) {
    throw new Error(`Local webhook request failed: ${response.status} ${response.statusText}${responseText ? ` - ${responseText}` : ''}`);
  }

  const contentType = String(response.headers.get('content-type') || '').toLowerCase();
  if (!contentType.includes('application/json')) {
    throw new Error(`Local webhook returned unexpected content type: ${contentType || 'unknown'}. Restart the LMS server and try again.`);
  }

  console.log('Local webhook receiver accepted the test payload.');
  console.log(responseText);
}

main().catch((error) => {
  console.error('Failed to post local test payload to webhook receiver:', error.message || error);
  process.exit(1);
});
