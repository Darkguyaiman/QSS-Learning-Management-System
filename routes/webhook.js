const express = require('express');
const router = express.Router();
const {
  extractCustomerId,
  extractCustomerName,
  extractCustomerAddress
} = require('../config/crmWebhook');

router.get('/', (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Webhook endpoint is available. Send a POST request to this URL to deliver webhook events.'
  });
});

router.post('/', async (req, res) => {
  const rawEventType = String(req.body?.event_type || '').trim().toLowerCase();
  const eventType = rawEventType;
  const payload = req.body?.payload && typeof req.body.payload === 'object' ? req.body.payload : {};
  const customerPayload = payload.customer && typeof payload.customer === 'object' ? payload.customer : {};
  const contactType = String(
    customerPayload.contact_type ||
    payload.contact_type ||
    ''
  ).trim().toLowerCase();

  try {
    if (!eventType) {
      return res.status(400).json({ success: false, error: 'event_type is required' });
    }

    if (contactType !== 'existing') {
      return res.status(200).json({ success: true, action: 'ignored', reason: 'unsupported_contact_type' });
    }

    const customerId = extractCustomerId(payload);
    if (!customerId) {
      return res.status(400).json({ success: false, error: 'A numeric payload id/customer_id/crm_id/client_id is required' });
    }

    if (['customer-delete', 'customer-deleted'].includes(eventType)) {
      await req.db.query('DELETE FROM healthcare WHERE id = ?', [customerId]);
      return res.json({ success: true, action: 'deleted', customer_id: customerId });
    }

    if (['customer-create', 'customer-update', 'customer-updated'].includes(eventType)) {
      const customerName = extractCustomerName(payload, customerId);
      const hospitalAddress = extractCustomerAddress(payload);

      if (!customerName) {
        return res.status(400).json({ success: false, error: 'Customer name is required for create/update events' });
      }

      await req.db.query(
        `INSERT INTO healthcare (id, name, hospital_address)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE
           name = VALUES(name),
           hospital_address = VALUES(hospital_address)`,
        [customerId, customerName, hospitalAddress || null]
      );

      return res.json({ success: true, action: 'upserted', customer_id: customerId });
    }

    return res.status(200).json({ success: true, action: 'ignored', event_type: rawEventType });
  } catch (error) {
    console.error('CRM webhook processing error:', error);
    return res.status(500).json({ success: false, error: 'Failed to process webhook' });
  }
});

module.exports = router;
