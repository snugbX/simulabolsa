(() => {
const currency = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

const number = new Intl.NumberFormat('pt-BR');
const quantity = new Intl.NumberFormat('pt-BR', {
  maximumFractionDigits: 4,
});

const percentage = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function toCents(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  const cents = Math.round(parsed * 100);
  return Number.isSafeInteger(cents) ? cents : 0;
}

function formatMoney(cents) {
  return currency.format(cents / 100);
}

function formatNumber(value) {
  return number.format(value);
}

function formatQuantity(value) {
  return quantity.format(value);
}

function formatSignedMoney(cents) {
  const prefix = cents > 0 ? '+' : cents < 0 ? '−' : '';
  return `${prefix} ${formatMoney(Math.abs(cents))}`.trim();
}

function formatPercent(value) {
  return `${percentage.format(Math.abs(value))}%`;
}

function formatSignedPercent(value) {
  const prefix = value > 0 ? '+' : value < 0 ? '−' : '';
  return `${prefix}${percentage.format(Math.abs(value))}%`;
}

window.SimulaBolsa = window.SimulaBolsa || {};
window.SimulaBolsa.formatters = Object.freeze({
  toCents,
  formatMoney,
  formatNumber,
  formatQuantity,
  formatPercent,
  formatSignedMoney,
  formatSignedPercent,
});
})();
