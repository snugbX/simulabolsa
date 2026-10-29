(() => {
const STOCK_SALES_EXEMPTION_CENTS = 2_000_000;

const ASSETS = Object.freeze({
  STOCKS: 'stocks',
  FIIS: 'fiis',
});

const OPERATIONS = Object.freeze({
  COMMON: 'common',
  DAY_TRADE: 'dayTrade',
});

const SCENARIOS = Object.freeze([
  { label: 'Queda de 30%', multiplier: 0.7 },
  { label: 'Queda de 15%', multiplier: 0.85 },
  { label: 'Estabilidade', multiplier: 1 },
  { label: 'Alta de 15%', multiplier: 1.15 },
  { label: 'Alta de 40%', multiplier: 1.4 },
  { label: 'Cotação dobra', multiplier: 2 },
]);

/**
 * Calcula uma única simulação usando centavos inteiros para evitar erros de
 * ponto flutuante em valores monetários.
 */
function calculateOperation({
  asset,
  operation,
  capitalCents,
  buyPriceCents,
  sellPriceCents,
  costsCents,
  otherMonthlySalesCents,
  eligibleLossCents,
}) {
  const quantity = buyPriceCents > 0 ? Math.floor(capitalCents / buyPriceCents) : 0;
  const investedCents = quantity * buyPriceCents;
  const revenueCents = quantity * sellPriceCents;
  const grossResultCents = revenueCents - investedCents;
  const resultBeforeTaxCents = grossResultCents - costsCents;
  const stockCommonOperation = asset === ASSETS.STOCKS && operation === OPERATIONS.COMMON;
  const monthlyStockSalesCents = stockCommonOperation
    ? revenueCents + otherMonthlySalesCents
    : revenueCents;
  const exemptionApplied = stockCommonOperation
    && monthlyStockSalesCents <= STOCK_SALES_EXEMPTION_CENTS;
  const taxRate = operation === OPERATIONS.DAY_TRADE || asset === ASSETS.FIIS ? 0.2 : 0.15;
  const taxableGainCents = Math.max(0, resultBeforeTaxCents - eligibleLossCents);
  const taxCents = exemptionApplied ? 0 : Math.round(taxableGainCents * taxRate);
  const netResultCents = resultBeforeTaxCents - taxCents;

  return {
    quantity,
    investedCents,
    remainingCents: capitalCents - investedCents,
    revenueCents,
    grossResultCents,
    resultBeforeTaxCents,
    monthlyStockSalesCents,
    exemptionApplied,
    taxRate,
    taxableGainCents,
    taxCents,
    netResultCents,
    returnPercent: investedCents > 0 ? (netResultCents / investedCents) * 100 : 0,
    estimatedWealthCents: capitalCents + netResultCents,
  };
}

function calculateScenarios(input) {
  return SCENARIOS.map((scenario) => {
    const result = calculateOperation({
      ...input,
      sellPriceCents: Math.round(input.buyPriceCents * scenario.multiplier),
    });

    return { ...scenario, ...result };
  });
}

window.SimulaBolsa = window.SimulaBolsa || {};
window.SimulaBolsa.calculator = Object.freeze({
  ASSETS,
  OPERATIONS,
  SCENARIOS,
  calculateOperation,
  calculateScenarios,
});
})();
