// What each RevenueCat event means for a Hummlist Premium purchase: the table in
// docs/PURCHASES.md ("Subscription lifecycle", "cancel_reason"), row by row.
import { assertEquals } from '@std/assert';
import { type Action, parseWebhook } from './revenuecat.ts';

const HOME = '00000000-0000-4000-8000-00000000a0e1';
const NOW = new Date('2026-11-01T10:00:00Z');
const day = 86_400_000;
const periodEnd = NOW.getTime() + 200 * day;

function event(type: string, overrides: Record<string, unknown> = {}) {
  return {
    event: {
      id: crypto.randomUUID(),
      type,
      app_user_id: HOME,
      store: 'APP_STORE',
      environment: 'PRODUCTION',
      product_id: 'com.hummlist.app.yearly',
      entitlement_ids: ['premium'],
      transaction_id: 't2',
      original_transaction_id: 't1',
      purchased_at_ms: NOW.getTime() - 165 * day,
      event_timestamp_ms: NOW.getTime(),
      expiration_at_ms: periodEnd,
      price: 9.99,
      price_in_purchased_currency: 9.99,
      currency: 'EUR',
      country_code: 'DE',
      ...overrides,
    },
  };
}

const action = (type: string, overrides: Record<string, unknown> = {}): Action =>
  parseWebhook(event(type, overrides), NOW)!.action;

/** The lifecycle state an event reports, or the action's kind when it is no lifecycle. */
function stateOf(a: Action) {
  if (a.do !== 'lifecycle') return a.do;
  const { expiresAt, autoRenew, billingIssue } = a.change.state;
  return { expiresAt: expiresAt?.getTime() ?? null, autoRenew, billingIssue };
}

Deno.test('INITIAL_PURCHASE and RENEWAL record the yearly plan with its period end, renewing', () => {
  for (const type of ['INITIAL_PURCHASE', 'RENEWAL']) {
    const a = action(type);
    assertEquals(a.do, 'record');
    if (a.do !== 'record') continue;
    assertEquals(a.purchase.plan, 'yearly');
    assertEquals(a.purchase.transactionId, 't1');
    assertEquals(a.purchase.eventAt, NOW);
    assertEquals(a.purchase.subscription, {
      expiresAt: new Date(periodEnd),
      autoRenew: true,
      billingIssue: false,
    });
  }
});

Deno.test('a yearly purchase without its end is refused as malformed', () => {
  assertEquals(action('INITIAL_PURCHASE', { expiration_at_ms: null }), {
    do: 'ignore',
    refused: 'malformed',
  });
});

Deno.test('cancel_reason: only CUSTOMER_SUPPORT (a refund) revokes the yearly plan (H-81)', () => {
  const rows: [string | undefined, unknown][] = [
    ['UNSUBSCRIBE', { expiresAt: periodEnd, autoRenew: false, billingIssue: null }],
    ['BILLING_ERROR', { expiresAt: periodEnd, autoRenew: false, billingIssue: null }],
    ['DEVELOPER_INITIATED', { expiresAt: periodEnd, autoRenew: false, billingIssue: null }],
    ['PRICE_INCREASE', { expiresAt: periodEnd, autoRenew: false, billingIssue: null }],
    ['UNKNOWN', { expiresAt: periodEnd, autoRenew: false, billingIssue: null }],
    [undefined, { expiresAt: periodEnd, autoRenew: false, billingIssue: null }],
    ['CUSTOMER_SUPPORT', 'revoke'],
  ];
  for (const [reason, want] of rows) {
    assertEquals(stateOf(action('CANCELLATION', { cancel_reason: reason })), want, String(reason));
  }
});

Deno.test('UNKNOWN with a negative price is a refund; with a positive one it is not', () => {
  assertEquals(action('CANCELLATION', { cancel_reason: 'UNKNOWN', price: -9.99 }).do, 'revoke');
  assertEquals(
    action('CANCELLATION', { cancel_reason: 'UNKNOWN', price_in_purchased_currency: -9.99 }).do,
    'revoke',
  );
  assertEquals(action('CANCELLATION', { cancel_reason: 'UNKNOWN', price: 9.99 }).do, 'lifecycle');
});

Deno.test('any CANCELLATION of the one-time purchase is a refund, as before', () => {
  for (const reason of ['UNSUBSCRIBE', 'UNKNOWN', 'CUSTOMER_SUPPORT', undefined]) {
    const a = action('CANCELLATION', {
      product_id: 'com.hummlist.app.lifetime',
      cancel_reason: reason,
    });
    assertEquals(a.do, 'revoke');
    if (a.do === 'revoke') assertEquals(a.refund.plan, 'lifetime');
  }
});

Deno.test('UNCANCELLATION turns auto-renew back on', () => {
  assertEquals(stateOf(action('UNCANCELLATION')), {
    expiresAt: periodEnd,
    autoRenew: true,
    billingIssue: null,
  });
});

Deno.test("BILLING_ISSUE keeps premium through the grace period, else to the period's end", () => {
  const grace = NOW.getTime() + 14 * day;
  assertEquals(
    stateOf(action('BILLING_ISSUE', {
      expiration_at_ms: NOW.getTime(),
      grace_period_expiration_at_ms: grace,
    })),
    { expiresAt: grace, autoRenew: null, billingIssue: true },
  );
  assertEquals(stateOf(action('BILLING_ISSUE', { expiration_at_ms: NOW.getTime() })), {
    expiresAt: NOW.getTime(),
    autoRenew: null,
    billingIssue: true,
  });
});

Deno.test('EXPIRATION ends premium at the reported end, never after the event', () => {
  const past = NOW.getTime() - day;
  assertEquals(stateOf(action('EXPIRATION', { expiration_at_ms: past })), {
    expiresAt: past,
    autoRenew: false,
    billingIssue: false,
  });
  // Paused, account hold, or an end RevenueCat reports in the future: it ends now.
  for (const reason of ['SUBSCRIPTION_PAUSED', 'BILLING_ERROR', 'UNSUBSCRIBE']) {
    assertEquals(
      stateOf(action('EXPIRATION', { expiration_reason: reason, expiration_at_ms: periodEnd })),
      { expiresAt: NOW.getTime(), autoRenew: false, billingIssue: false },
    );
  }
});

Deno.test('SUBSCRIPTION_EXTENDED moves the end; SUBSCRIPTION_PAUSED keeps premium to it', () => {
  const later = periodEnd + 30 * day;
  assertEquals(stateOf(action('SUBSCRIPTION_EXTENDED', { expiration_at_ms: later })), {
    expiresAt: later,
    autoRenew: null,
    billingIssue: null,
  });
  assertEquals(stateOf(action('SUBSCRIPTION_PAUSED')), {
    expiresAt: periodEnd,
    autoRenew: false,
    billingIssue: null,
  });
});

Deno.test('REFUND_REVERSED reinstates; TRANSFER, PRODUCT_CHANGE and others write nothing', () => {
  assertEquals(action('REFUND_REVERSED'), { do: 'reinstate', store: 'apple', transactionId: 't1' });
  for (
    const type of [
      'TRANSFER',
      'PRODUCT_CHANGE',
      'TEMPORARY_ENTITLEMENT_GRANT',
      'TEST',
      'INVOICE_ISSUANCE',
      'NEW_TYPE',
    ]
  ) {
    assertEquals(action(type), { do: 'ignore' }, type);
  }
});

Deno.test('lifecycle events of the one-time purchase change nothing', () => {
  for (const type of ['UNCANCELLATION', 'BILLING_ISSUE', 'EXPIRATION', 'SUBSCRIPTION_EXTENDED']) {
    assertEquals(action(type, { product_id: 'com.hummlist.app.lifetime' }), { do: 'ignore' }, type);
  }
});

Deno.test('Play ids: the bare subscription id and :yearly map to yearly, other base plans do not', () => {
  for (const id of ['com.hummlist.app.yearly', 'com.hummlist.app.yearly:yearly']) {
    const a = action('RENEWAL', { store: 'PLAY_STORE', product_id: id });
    assertEquals(a.do === 'record' && [a.purchase.productId, a.purchase.plan], [
      'com.hummlist.app.yearly',
      'yearly',
    ]);
  }
  for (const id of ['com.hummlist.app.yearly:monthly', 'com.hummlist.app.yearly:', 'other']) {
    assertEquals(action('RENEWAL', { product_id: id }), { do: 'ignore', refused: 'product' });
  }
});

Deno.test('a lifecycle event names its transaction by the original id and its time', () => {
  const a = action('CANCELLATION', {
    cancel_reason: 'UNSUBSCRIBE',
    event_timestamp_ms: NOW.getTime() - 60_000,
  });
  assertEquals(a.do === 'lifecycle' && [a.change.transactionId, a.change.eventAt], [
    't1',
    new Date(NOW.getTime() - 60_000),
  ]);
});
