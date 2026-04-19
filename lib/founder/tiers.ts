export type FounderTierKey =
  | 'seed'
  | 'sapling'
  | 'tree'
  | 'grove'
  | 'forest'
  | 'summit'
  | 'legacy';

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
  topupDiscountPercent: number;
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
    serviceFeeBps: 450,
    productFeeBps: 275,
    serviceFeePercent: 4.5,
    productFeePercent: 2.75,
    aiCreditsBonus: 150,
    trustBonus: 100,
    monthlyAiCreditRefill: 20,
    topupDiscountPercent: 30,
  },
  {
    key: 'sapling',
    icon: '🌿',
    displayName: 'Sapling',
    minInvestmentEur: 249,
    maxInvestmentEur: 498,
    priceEur: 249,
    priceCents: 24900,
    serviceFeeBps: 350,
    productFeeBps: 225,
    serviceFeePercent: 3.5,
    productFeePercent: 2.25,
    aiCreditsBonus: 500,
    trustBonus: 250,
    monthlyAiCreditRefill: 50,
    topupDiscountPercent: 30,
  },
  {
    key: 'tree',
    icon: '🌳',
    displayName: 'Tree',
    minInvestmentEur: 499,
    maxInvestmentEur: 998,
    priceEur: 499,
    priceCents: 49900,
    serviceFeeBps: 250,
    productFeeBps: 175,
    serviceFeePercent: 2.5,
    productFeePercent: 1.75,
    aiCreditsBonus: 1200,
    trustBonus: 500,
    monthlyAiCreditRefill: 100,
    topupDiscountPercent: 30,
  },
  {
    key: 'grove',
    icon: '🌲',
    displayName: 'Grove',
    minInvestmentEur: 999,
    maxInvestmentEur: 1998,
    priceEur: 999,
    priceCents: 99900,
    serviceFeeBps: 150,
    productFeeBps: 100,
    serviceFeePercent: 1.5,
    productFeePercent: 1,
    aiCreditsBonus: 2500,
    trustBonus: 1000,
    monthlyAiCreditRefill: 200,
    topupDiscountPercent: 30,
  },
  {
    key: 'forest',
    icon: '🏞️',
    displayName: 'Forest',
    minInvestmentEur: 1999,
    maxInvestmentEur: 3498,
    priceEur: 1999,
    priceCents: 199900,
    serviceFeeBps: 75,
    productFeeBps: 50,
    serviceFeePercent: 0.75,
    productFeePercent: 0.5,
    aiCreditsBonus: 6000,
    trustBonus: 2000,
    monthlyAiCreditRefill: 400,
    topupDiscountPercent: 30,
  },
  {
    key: 'summit',
    icon: '⛰️',
    displayName: 'Summit',
    minInvestmentEur: 3499,
    maxInvestmentEur: 4999,
    priceEur: 3499,
    priceCents: 349900,
    serviceFeeBps: 40,
    productFeeBps: 40,
    serviceFeePercent: 0.4,
    productFeePercent: 0.4,
    aiCreditsBonus: 12000,
    trustBonus: 3500,
    monthlyAiCreditRefill: 750,
    topupDiscountPercent: 30,
  },
  {
    key: 'legacy',
    icon: '🌌',
    displayName: 'Legacy',
    minInvestmentEur: 5000,
    maxInvestmentEur: 5000,
    priceEur: 5000,
    priceCents: 500000,
    serviceFeeBps: 25,
    productFeeBps: 0,
    serviceFeePercent: 0.25,
    productFeePercent: 0,
    aiCreditsBonus: 20000,
    trustBonus: 5000,
    monthlyAiCreditRefill: 1200,
    topupDiscountPercent: 30,
  },
];

export const STANDARD_SERVICE_FEE_BPS = 800;
export const STANDARD_PRODUCT_FEE_BPS = 500;
export const STANDARD_SERVICE_FEE_PERCENT = 8;
export const STANDARD_PRODUCT_FEE_PERCENT = 5;
export const MIN_INVESTMENT_EUR = 99;
export const MAX_INVESTMENT_EUR = 5000;

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

export function calculateFiveYearSavings(tier: FounderTier, annualRevenueEur: number): number {
  return calculateAnnualSavings(tier, annualRevenueEur) * 5 - tier.priceEur;
}
