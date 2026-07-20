export function formatCurrency(value: number) {
  return `${new Intl.NumberFormat("en-US").format(value)} د.ع`;
}
