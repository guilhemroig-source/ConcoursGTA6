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

// Normalise l'URL publique : ajoute https:// si le schema manque, retire le(s)
// slash final(aux) et les espaces. Mollie refuse toute URL non absolue -> "redirect URL is invalid".
function publicBase() {
  let b = String(config.baseUrl || '').trim().replace(/\s+/g, '').replace(/\/+$/, '');
  if (b && !/^https?:\/\//i.test(b)) b = 'https://' + b;
  return b;
}

async function createPayment(cmd) {
  const base = publicBase();
  if (isDemo()) {
    // Mode demo : pas d'appel reseau, on renvoie une URL locale de simulation.
    return {
      paymentId: 'demo_' + cmd.numero,
      checkoutUrl: `${base}/paiement-demo.html?cmd=${encodeURIComponent(cmd.numero)}`,
      demo: true,
    };
  }
  // Securite : Mollie exige une URL publique https (pas localhost).
  const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)/i.test(base);
  const redirectUrl = `${base}/merci.html?cmd=${encodeURIComponent(cmd.numero)}`;
  const paymentPayload = {
    amount: { currency: config.devise, value: centsToValue(cmd.montant_total) },
    description: `Commande ${cmd.numero} — T-shirt collector GTA VI (Keep Cool Narbonne)`,
    redirectUrl,
    metadata: { orderId: cmd.id, numero: cmd.numero },
  };
  // Le webhook doit etre publiquement joignable : on ne l'envoie pas en local.
  if (!isLocal) paymentPayload.webhookUrl = `${base}/api/webhook/mollie`;
  const payment = await client.payments.create(paymentPayload);
  const checkoutUrl = (typeof payment.getCheckoutUrl === 'function')
    ? payment.getCheckoutUrl()
    : (payment._links && payment._links.checkout && payment._links.checkout.href);
  return {
    paymentId: payment.id,
    checkoutUrl,
    demo: false,
  };
}

async function getPaymentStatus(paymentId) {
  if (isDemo()) return { paid: false, status: 'open', demo: true };
  const payment = await client.payments.get(paymentId);
  // NB : selon la version du client Mollie, payment.isPaid() peut ne pas exister.
  // On se base sur le statut (fiable dans toutes les versions).
  const status = payment.status;
  const paid = status === 'paid' || !!payment.paidAt;
  return {
    paid,
    status,
    failed: ['failed', 'canceled', 'expired'].includes(status),
  };
}

module.exports = { createPayment, getPaymentStatus, isDemo };
