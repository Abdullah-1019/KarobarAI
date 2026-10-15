const PKR_FORMATTER = new Intl.NumberFormat('en-PK');

export function formatPrice(amount: number | string): string {
  const num = Number(amount);
  if (Number.isNaN(num)) return 'Rs. 0';
  return `Rs. ${PKR_FORMATTER.format(num)}`;
}
