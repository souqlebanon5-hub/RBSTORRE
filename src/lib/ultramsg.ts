// ============================================================================
// UltraMsg WhatsApp Gateway Integration for SouqHub Lebanon
// Handles automated vendor notifications and admin dispatch formatting
// ============================================================================

export interface SendWhatsAppParams {
  instanceId?: string;
  token?: string;
  to: string; // E.164 phone format without + (e.g. "96170112233")
  body: string;
}

export interface UltraMsgApiResponse {
  sent?: string | boolean;
  message?: string;
  id?: number | string;
  error?: string;
}

/**
 * Clean and format Lebanese phone numbers to international standard (961XXXXXXXX)
 */
export function formatLebanesePhone(phone: string): string {
  // Remove non-digit characters
  let cleaned = phone.replace(/\D/g, '');
  
  // If starts with 00961, strip 00
  if (cleaned.startsWith('00961')) {
    cleaned = cleaned.substring(2);
  }
  
  // If starts with 0 (e.g., 03XXXXXX, 07XXXXXX, 01XXXXXX), replace leading 0 with 961
  if (cleaned.startsWith('0') && cleaned.length === 8) {
    cleaned = '961' + cleaned.substring(1);
  }
  
  // If standard 7 or 8 digit local number without country code
  if (cleaned.length === 8 && !cleaned.startsWith('961')) {
    cleaned = '961' + cleaned;
  }
  
  if (cleaned.length === 7) {
    cleaned = '961' + cleaned;
  }
  
  return cleaned;
}

/**
 * Format Vendor WhatsApp Notification message
 * STRICT PRIVACY: Zero customer phone, zero customer address, zero other boutique items.
 * Contains only: Order number, item details, variant, quantity, pickup code, and expected net payout.
 */
export function buildVendorWhatsAppMessage(params: {
  storeName: string;
  orderNumber: string;
  items: Array<{
    title: string;
    variantName?: string | null;
    quantity: number;
    unitPrice: number;
    pickupCode: string;
  }>;
  totalVendorPayout: number;
  pickupAddress: string;
}): string {
  const { storeName, orderNumber, items, totalVendorPayout, pickupAddress } = params;

  let message = `📦 *RB Store — New Pickup Request*\n`;
  message += `━━━━━━━━━━━━━━━━━━━━━\n`;
  message += `مرحباً *${storeName}*،\n`;
  message += `لديك طلبية جديدة جاهزة للتحضير!\n\n`;
  message += `🏷️ *Order Ref:* \`${orderNumber}\`\n`;
  message += `📍 *Pickup Location:* ${pickupAddress}\n\n`;
  message += `*Items to Prepare / الأصناف المطلوبة:*\n`;

  items.forEach((item, index) => {
    message += `\n${index + 1}. *${item.title}*\n`;
    if (item.variantName) {
      message += `   • Variant: ${item.variantName}\n`;
    }
    message += `   • Quantity: x${item.quantity}\n`;
    message += `   • Unit: $${item.unitPrice.toFixed(2)}\n`;
    message += `   🔑 *Pickup Code:* \`${item.pickupCode}\`\n`;
  });

  message += `\n━━━━━━━━━━━━━━━━━━━━━\n`;
  message += `💰 *Your Net Payout (صافي المستحقات):* $${totalVendorPayout.toFixed(2)}\n`;
  message += `_(عمولة المنصة تضاف فوق السعر ويدفعها الزبون — يستلم متجرك سعره المطلوب كاملاً 100%)_\n\n`;
  message += `⚠️ *Instructions for Boutique:*\n`;
  message += `1. Please bag items and label with pickup codes.\n`;
  message += `2. An RB Store courier will arrive today between 1:00 PM – 5:00 PM.\n`;
  message += `3. Courier will provide the exact Pickup Code upon collection.\n\n`;
  message += `_RB Store Dispatch System • Automated Message_`;

  return message;
}

/**
 * Format Customer-to-Platform-Admin WhatsApp Confirmation Link
 * Contains the complete master order consolidation breakdown, customer details, and COD totals.
 */
export function buildAdminWhatsAppMessage(params: {
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  city: string;
  addressDetails: string;
  deliveryNotes?: string | null;
  items: Array<{
    vendorName: string;
    title: string;
    variantName?: string | null;
    quantity: number;
    unitPrice: number;
  }>;
  subtotal: number;
  deliveryFee: number;
  totalCodAmount: number;
  paymentMethod?: 'cod' | 'whish';
  whishSenderPhone?: string;
}): string {
  const {
    orderNumber,
    customerName,
    customerPhone,
    city,
    addressDetails,
    deliveryNotes,
    items,
    subtotal,
    deliveryFee,
    totalCodAmount,
    paymentMethod,
    whishSenderPhone
  } = params;

  // Approximate LBP conversion at 89,500 LBP/USD
  const lbpTotal = Math.round(totalCodAmount * 89500).toLocaleString('en-US');

  let text = `🛍️ *RB Store — New Order Confirmation*\n`;
  text += `━━━━━━━━━━━━━━━━━━━━━\n`;
  text += `*Order Ref:* \`${orderNumber}\`\n`;
  text += `*Customer:* ${customerName}\n`;
  text += `*Phone:* ${customerPhone}\n`;
  text += `*City/Area:* ${city}\n`;
  text += `*Address:* ${addressDetails}\n`;
  if (deliveryNotes) {
    text += `*Notes:* ${deliveryNotes}\n`;
  }

  text += `\n*Consolidated Items / الأصناف:*\n`;
  items.forEach((item, idx) => {
    text += `${idx + 1}. *${item.title}* (x${item.quantity})\n`;
    text += `   🏪 Store: _${item.vendorName}_\n`;
    if (item.variantName) {
      text += `   🏷️ ${item.variantName}\n`;
    }
    text += `   💵 $${(item.unitPrice * item.quantity).toFixed(2)}\n`;
  });

  text += `\n━━━━━━━━━━━━━━━━━━━━━\n`;
  text += `*Subtotal:* $${subtotal.toFixed(2)}\n`;
  text += `*Consolidated Delivery:* $${deliveryFee.toFixed(2)}\n`;
  
  if (paymentMethod === 'whish') {
    text += `💳 *طريقة الدفع:* محفظة ويش موني (Whish Money)\n`;
    if (whishSenderPhone) {
      text += `📱 *رقم المحول / الإشعار:* ${whishSenderPhone}\n`;
    }
    text += `*المجموع المحول:* *$${totalCodAmount.toFixed(2)} USD* (~${lbpTotal} LBP)\n\n`;
    text += `يرجى تأكيد استلام الحوالة وتحديد موعد التوصيل. شكراً لك!`;
  } else {
    text += `💵 *طريقة الدفع:* كاش عند الاستلام (COD)\n`;
    text += `*المجموع المطلوب عند الاستلام:* *$${totalCodAmount.toFixed(2)} USD* (~${lbpTotal} LBP)\n\n`;
    text += `يرجى تأكيد موعد التوصيل. شكراً لك!`;
  }

  return text;
}

/**
 * Generate direct WhatsApp Web / App chat click link (wa.me)
 */
export function generateWhatsAppChatLink(phone: string, text: string): string {
  const formatted = formatLebanesePhone(phone);
  return `https://wa.me/${formatted}?text=${encodeURIComponent(text)}`;
}
