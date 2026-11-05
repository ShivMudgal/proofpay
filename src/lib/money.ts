// Amounts are stored and shown in INR. PayPal no longer settles INR between Indian accounts,
// so by default orders are charged in USD at INR_PER_USD. Set PAYPAL_CURRENCY=INR to skip conversion.
export const CURRENCY = "INR";

const PAYPAL_CURRENCY = (process.env.PAYPAL_CURRENCY || "USD").toUpperCase();
const INR_PER_USD = Number(process.env.INR_PER_USD) || 88;

export function formatINR(amount: number, withPaise = false) {
  return amount.toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: withPaise ? 2 : 0,
    maximumFractionDigits: withPaise ? 2 : 0,
  });
}

export function paypalCharge(amountInr: number) {
  if (PAYPAL_CURRENCY === "INR") return { currency: "INR", value: amountInr.toFixed(2), rate: 1 };
  return { currency: PAYPAL_CURRENCY, value: (amountInr / INR_PER_USD).toFixed(2), rate: INR_PER_USD };
}
