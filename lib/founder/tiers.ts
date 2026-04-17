export interface FounderTier {
  key: string;
  displayName: string;
  icon: string;
  priceEur: number;
  serviceFeePercent: number;
  productFeePercent: number;
  aiCreditsBonus: number;
  trustBonus: number;
  monthlyAiCreditRefill: number;
}

export const STANDARD_SERVICE_FEE_PERCENT = 8;
export const STANDARD_PRODUCT_FEE_PERCENT = 5;

export const MIN_INVESTMENT_EUR = 99;
export const MAX_INVESTMENT_EUR = 4999;

export const FOUNDER_TIERS: FounderTier[] = [
  {
    key: 'seed',
    displayName: 'Seed',
    icon: '🌱',
    priceEur: 99,
    serviceFeePercent: 7,
    productFeePercent: 4.5,
    aiCreditsBonus: 200,
    trustBonus: 500,
    monthlyAiCreditRefill: 10,
  },
  {
    key: 'sprout',
    displayName: 'Sprout',
    icon: '🌿',
    priceEur: 499,
    serviceFeePercent: 6,
    productFeePercent: 4,
    aiCreditsBonus: 600,
    trustBonus: 1500,
    monthlyAiCreditRefill: 25,
  },
  {
    key: 'growth',
    displayName: 'Growth',
    icon: '🌳',
    priceEur: 999,
    serviceFeePercent: 5,
    productFeePercent: 3,
    aiCreditsBonus: 1500,
    trustBonus: 3000,
    monthlyAiCreditRefill: 50,
  },
  {
    key: 'canopy',
    displayName: 'Canopy',
    icon: '🏕️',
    priceEur: 2499,
    serviceFeePercent: 3,
    productFeePercent: 2,
    aiCreditsBonus: 5000,
    trustBonus: 8000,
    monthlyAiCreditRefill: 100,
  },
  {
    key: 'legacy',
    displayName: 'Legacy',
    icon: '🏛️',
    priceEur: 4999,
    serviceFeePercent: 1,
    productFeePercent: 0.5,
    aiCreditsBonus: 15000,
    trustBonus: 20000,
    monthlyAiCreditRefill: 250,
  },
];

export function getTierByAmount(amountEur: number): FounderTier {
  let matched = FOUNDER_TIERS[0];
  for (const tier of FOUNDER_TIERS) {
    if (amountEur >= tier.priceEur) {
      matched = tier;
    }
  }
  return matched;
}

export function calculateAnnualSavings(
  tier: FounderTier,
  annualRevenueEur: number,
): number {
  const standardFee = annualRevenueEur * (STANDARD_SERVICE_FEE_PERCENT / 100);
  const founderFee = annualRevenueEur * (tier.serviceFeePercent / 100);
  return standardFee - founderFee;
}

export function calculateBreakEvenMonths(
  tier: FounderTier,
  annualRevenueEur: number,
): number {
  const annualSavings = calculateAnnualSavings(tier, annualRevenueEur);
  if (annualSavings <= 0) return Infinity;
  const monthlySavings = annualSavings / 12;
  return Math.ceil(tier.priceEur / monthlySavings);
}
