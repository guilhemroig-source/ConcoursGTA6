'use strict';

/*
 * Wrapper Mollie. Si aucune cle API n'est configuree, on bascule en MODE DEMO
 * (paiement simule) pour pouvoir tester le parcours sans compte Mollie.
 */

const config = require('./config');
const { centsToValue } = require('./orders');

let client = null;
if (config.mollieApiKey) {
  const { createMollieClient } = require('@mollie/api-client');
  client = createMollieClient({ apiKey: config.mollieApiKey });
}

const isDemo = () => !client;

async function createPayment(cmd) {
  if (isDemo()) {
    // Mode demo : pas d'appel reseau, on renvoie une URL locale de simulation.
    return {
      paymentId: 'demo_' + cmd.numero,
      checkoutUrl: `${config.baseUrl}/paiement-demo.html?cmd=${encodeURIComponent(cmd.numero)}`,
      demo: true,
    };
  }
  const payment = await client.payments.create({
    amount: { currency: config.devise, value: centsToValue(cmd.montant_total) },
    description: `Commande ${cmd.numero} — T-shirt collector GTA VI (Keep Cool Narbonne)`,
    redirectUrl: `${config.baseUrl}/merci.html?cmd=${encodeURIComponent(cmd.numero)}`,
    webhookUrl: `${config.baseUrl}/api/webhook/mollie`,
    metadata: { orderId: cmd.id, numero: cmd.numero },
  });
  return {
    paymentId: payment.id,
    checkoutUrl: payment.getCheckoutUrl(),
    demo: false,
  };
}

async function getPaymentStatus(paymentId) {
  if (isDemo()) return { paid: false, status: 'open', demo: true };
  const payment = await client.payments.get(paymentId);
  return {
    paid: payment.isPaid(),
    status: payment.status,
    failed: ['failed', 'canceled', 'expired'].includes(payment.status),
  };
}

module.exports = { createPayment, getPaymentStatus, isDemo };
