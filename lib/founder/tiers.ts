export type FounderTierKey = 'seed' | 'sapling' | 'tree' | 'grove' | 'forest';

export interface FounderTier {
  key: FounderTierKey;
  icon: string;
  displayName: string;
  minInvestmentEur: number;
  maxInvestmentEur: number;
  priceEur: number;
  priceCents: number;
  serviceFeeBps: number;
  productFeeBps: number;
  serviceFeePercent: number;
  productFeePercent: number;
  aiCreditsBonus: number;
  trustBonus: number;
  monthlyAiCreditRefill: number;
}

export const FOUNDER_TIERS: readonly FounderTier[] = [
  {
    key: 'seed',
    icon: '🌱',
    displayName: 'Seed',
    minInvestmentEur: 99,
    maxInvestmentEur: 248,
    priceEur: 99,
    priceCents: 9900,
    serviceFeeBps: 600,
    productFeeBps: 350,
    serviceFeePercent: 6,
    productFeePercent: 3.5,
    aiCreditsBonus: 150,
    trustBonus: 100,
    monthlyAiCreditRefill: 20,
  },
  {
    key: 'sapling',
    icon: '🌿',
    displayName: 'Sapling',
    minInvestmentEur: 249,
    maxInvestmentEur: 498,
    priceEur: 249,
    priceCents: 24900,
    serviceFeeBps: 500,
    productFeeBps: 300,
    serviceFeePercent: 5,
    productFeePercent: 3,
    aiCreditsBonus: 500,
    trustBonus: 250,
    monthlyAiCreditRefill: 50,
  },
  {
    key: 'tree',
    icon: '🌳',
    displayName: 'Tree',
    minInvestmentEur: 499,
    maxInvestmentEur: 748,
    priceEur: 499,
    priceCents: 49900,
    serviceFeeBps: 400,
    productFeeBps: 250,
    serviceFeePercent: 4,
    productFeePercent: 2.5,
    aiCreditsBonus: 1200,
    trustBonus: 500,
    monthlyAiCreditRefill: 100,
  },
  {
    key: 'grove',
    icon: '🌲',
    displayName: 'Grove',
    minInvestmentEur: 749,
    maxInvestmentEur: 999,
    priceEur: 749,
    priceCents: 74900,
    serviceFeeBps: 300,
    productFeeBps: 200,
    serviceFeePercent: 3,
    productFeePercent: 2,
    aiCreditsBonus: 2500,
    trustBonus: 750,
    monthlyAiCreditRefill: 175,
  },
  {
    key: 'forest',
    icon: '🏞️',
    displayName: 'Forest',
    minInvestmentEur: 1000,
    maxInvestmentEur: 1000,
    priceEur: 1000,
    priceCents: 100000,
    serviceFeeBps: 200,
    productFeeBps: 150,
    serviceFeePercent: 2,
    productFeePercent: 1.5,
    aiCreditsBonus: 4000,
    trustBonus: 1000,
    monthlyAiCreditRefill: 300,
  },
];

export const STANDARD_SERVICE_FEE_BPS = 800;
export const STANDARD_PRODUCT_FEE_BPS = 500;
export const STANDARD_SERVICE_FEE_PERCENT = 8;
export const STANDARD_PRODUCT_FEE_PERCENT = 5;
export const MIN_INVESTMENT_EUR = 99;
export const MAX_INVESTMENT_EUR = 1000;

export function getTierByKey(key: string): FounderTier | null {
  return FOUNDER_TIERS.find((t) => t.key === key) ?? null;
}

export function getTierByAmount(amountEur: number): FounderTier {
  if (amountEur <= MIN_INVESTMENT_EUR) return FOUNDER_TIERS[0];
  if (amountEur >= MAX_INVESTMENT_EUR) return FOUNDER_TIERS[FOUNDER_TIERS.length - 1];
  for (const tier of FOUNDER_TIERS) {
    if (amountEur >= tier.minInvestmentEur && amountEur <= tier.maxInvestmentEur) {
      return tier;
    }
  }
  return FOUNDER_TIERS[0];
}

export function calculateAnnualSavings(tier: FounderTier, annualRevenueEur: number): number {
  if (annualRevenueEur <= 0) return 0;
  const servicesRevenue = annualRevenueEur * 0.6;
  const productsRevenue = annualRevenueEur * 0.4;
  const standardFees =
    (servicesRevenue * STANDARD_SERVICE_FEE_BPS) / 10000 +
    (productsRevenue * STANDARD_PRODUCT_FEE_BPS) / 10000;
  const tierFees =
    (servicesRevenue * tier.serviceFeeBps) / 10000 +
    (productsRevenue * tier.productFeeBps) / 10000;
  return Math.max(0, standardFees - tierFees);
}

export function calculateBreakEvenMonths(tier: FounderTier, annualRevenueEur: number): number {
  const annualSavings = calculateAnnualSavings(tier, annualRevenueEur);
  if (annualSavings <= 0) return Infinity;
  return Math.round((tier.priceEur / annualSavings) * 12);
}
