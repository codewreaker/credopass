/**
 * Generates a fake card to pre-fill the mock checkout.
 *
 * Why hand-rolled instead of a faker dependency: this is ~40 lines, it runs in
 * the browser bundle, and — the important part — it lets the numbers be
 * *deliberately* un-chargeable. A general-purpose faker happily produces
 * realistic PANs, and a realistic PAN sitting in a form field is something
 * someone eventually mistakes for a real one.
 *
 * Every number here is drawn from the ranges the card networks reserve for
 * testing (`4242…`, Stripe's published test set). They are Luhn-valid, so the
 * form's own validation exercises the real path, and they are inert everywhere:
 * no processor will ever authorise one.
 *
 * None of this is sent anywhere. `PUT /organizations/{id}/plan` takes a plan id
 * and nothing else — the card exists to make the screen look like a checkout,
 * and it is discarded when the component unmounts.
 */

export interface FakeCard {
  number: string;
  name: string;
  expiry: string;
  cvc: string;
  brand: string;
}

/** Reserved test PANs — Luhn-valid, and declined by every real processor. */
const TEST_CARDS: { brand: string; digits: string }[] = [
  { brand: 'Visa', digits: '4242424242424242' },
  { brand: 'Visa (debit)', digits: '4000056655665556' },
  { brand: 'Mastercard', digits: '5555555555554444' },
  { brand: 'Mastercard (debit)', digits: '5200828282828210' },
  { brand: 'Amex', digits: '378282246310005' },
];

const FIRST_NAMES = ['Ada', 'Femi', 'Rowan', 'Ines', 'Kwame', 'Mira', 'Otis', 'Sana'];
const LAST_NAMES = ['Okonkwo', 'Whitfield', 'Baptiste', 'Nakamura', 'Osei', 'Lindqvist'];

const pick = <T,>(items: readonly T[]): T => items[Math.floor(Math.random() * items.length)];

/** Group a PAN into the 4-4-4-4 (or 4-6-5 for Amex) blocks a card reader shows. */
function group(digits: string): string {
  if (digits.length === 15) {
    return `${digits.slice(0, 4)} ${digits.slice(4, 10)} ${digits.slice(10)}`;
  }
  return digits.replace(/(.{4})/g, '$1 ').trim();
}

export function generateFakeCard(): FakeCard {
  const card = pick(TEST_CARDS);
  const now = new Date();
  // Always in the future, so the mock never fails its own expiry check.
  const year = now.getFullYear() + 1 + Math.floor(Math.random() * 4);
  const month = 1 + Math.floor(Math.random() * 12);

  return {
    number: group(card.digits),
    brand: card.brand,
    name: `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`.toUpperCase(),
    expiry: `${String(month).padStart(2, '0')}/${String(year).slice(-2)}`,
    // Amex CVCs are 4 digits; everything else is 3.
    cvc: String(Math.floor(Math.random() * (card.digits.length === 15 ? 9000 : 900)) +
      (card.digits.length === 15 ? 1000 : 100)),
  };
}

/** `4900` → `£49`, `1900` → `£19`, `0` → `Free`. Minor units in, display out. */
export function formatPrice(minorUnits: number | null): string {
  if (minorUnits === null) return 'Custom';
  if (minorUnits === 0) return 'Free';
  const major = minorUnits / 100;
  return `£${Number.isInteger(major) ? major : major.toFixed(2)}`;
}
