export const formatCurrency = (amount: number): string =>
  `Rs. ${amount.toFixed(2)}`;

export const formatNumber = (n: number, decimals = 0): string =>
  n.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
