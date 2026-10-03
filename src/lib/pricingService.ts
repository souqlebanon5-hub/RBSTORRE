import type { ProductWithVendor, ProductVariant } from '../types/database';

/**
 * Pricing Engine: Commission is ADDED ON TOP of the vendor's base price.
 * 
 * Business Model:
 * 1. Vendor sets their desired net payout price (e.g. $20.00).
 * 2. Platform adds its commission percentage on top (e.g. 10% = +$2.00).
 * 3. Customer sees and pays the final price ($22.00).
 * 4. At fulfillment, the vendor receives their full requested $20.00, and the platform retains $2.00.
 */
export function computeProductPricing(
  basePrice: number,
  commissionRate: number = 10
): {
  basePrice: number;
  commissionRate: number;
  commissionAmount: number;
  customerSellingPrice: number;
} {
  const cleanBase = Math.max(0, Number(basePrice || 0));
  const cleanRate = Math.max(0, Number(commissionRate ?? 10));
  const commissionAmount = Number((cleanBase * (cleanRate / 100)).toFixed(2));
  const customerSellingPrice = Number((cleanBase + commissionAmount).toFixed(2));

  return {
    basePrice: cleanBase,
    commissionRate: cleanRate,
    commissionAmount,
    customerSellingPrice,
  };
}

export function getProductCustomerPrice(
  product: ProductWithVendor,
  variantId?: string | null
): {
  basePrice: number;
  commissionRate: number;
  commissionAmount: number;
  customerSellingPrice: number;
} {
  const variant = product.variants?.find(v => v.id === variantId) || product.variants?.[0];
  const basePrice = Number(variant?.price_override ?? product.base_price ?? 0);
  const commissionRate = Number(product.vendor?.commission_rate ?? 10);
  return computeProductPricing(basePrice, commissionRate);
}
