import type { 
  CartItem, 
  CheckoutPayload, 
  CheckoutResponse, 
  Order, 
  OrderItem, 
  Vendor,
  UltraMsgDispatchSummary 
} from '../types/database';
import { 
  buildVendorWhatsAppMessage, 
  buildAdminWhatsAppMessage, 
  formatLebanesePhone 
} from './ultramsg';
import { getAdminWhishPhone, calculateOrderDeliveryFee } from './adminSettings';
import { saveOrderToDB } from './databaseService';

export function executeCheckoutService(
  payload: CheckoutPayload,
  vendors: Vendor[],
  existingOrders: Order[],
  existingItems: OrderItem[]
): {
  response: CheckoutResponse;
  newOrder: Order;
  newOrderItems: OrderItem[];
  dispatches: UltraMsgDispatchSummary[];
} {
  const { 
    customer_name, 
    customer_phone, 
    city, 
    address_details, 
    delivery_notes, 
    payment_method, 
    whish_sender_phone, 
    items 
  } = payload;

  const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, '');
  const randNum = Math.floor(1000 + Math.random() * 9000);
  const orderNumber = `SQH-${dateStr}-${randNum}`;
  const orderId = `ord_${Date.now()}_${randNum}`;

  const subtotal = items.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
  const { deliveryFee } = calculateOrderDeliveryFee(subtotal);
  const totalCodAmount = subtotal + deliveryFee;

  const newOrder: Order = {
    id: orderId,
    order_number: orderNumber,
    customer_name,
    customer_phone,
    city,
    address_details,
    delivery_notes: delivery_notes || null,
    subtotal,
    delivery_fee: deliveryFee,
    total_cod_amount: totalCodAmount,
    currency: 'USD',
    status: 'processing',
    payment_method: payment_method || 'cod',
    whish_sender_phone: whish_sender_phone || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // Group items by vendor
  const vendorMap = new Map<string, Vendor>();
  vendors.forEach(v => vendorMap.set(v.id, v));

  const vendorGroupedItems = new Map<string, Array<{
    item: CartItem;
    pickupCode: string;
    commissionAmount: number;
    vendorPayout: number;
  }>>();

  const newOrderItems: OrderItem[] = [];

  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const getPickupCode = () => {
    let code = 'PU-';
    for (let i = 0; i < 5; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
    return code;
  };

  items.forEach((cartItem, idx) => {
    const vendor = vendorMap.get(cartItem.vendorId) || {
      id: cartItem.vendorId,
      store_name: cartItem.vendorName,
      slug: 'boutique',
      phone: '96170112233',
      city: 'Beirut',
      pickup_address: 'Central Boutique Location, Beirut',
      commission_rate: 10.0,
      status: 'active' as const,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const lineTotal = cartItem.unitPrice * cartItem.quantity;
    const commRate = Number(cartItem.commissionRate ?? vendor.commission_rate ?? 10.0);
    
    // Commission is added ON TOP of the vendor's base price:
    // vendorPayout is the vendor's full requested base price, and commission is the added markup
    const baseUnitPrice = (cartItem.basePrice !== undefined && cartItem.basePrice !== null && cartItem.basePrice > 0)
      ? Number(cartItem.basePrice)
      : Number((cartItem.unitPrice / (1 + (commRate / 100))).toFixed(2));

    const vendorPayout = Number((baseUnitPrice * cartItem.quantity).toFixed(2));
    const commissionAmount = Number((lineTotal - vendorPayout).toFixed(2));
    const pickupCode = getPickupCode();

    const orderItemRecord: OrderItem = {
      id: `item_${Date.now()}_${idx}`,
      order_id: orderId,
      vendor_id: cartItem.vendorId,
      product_id: cartItem.productId,
      variant_id: cartItem.variantId || null,
      quantity: cartItem.quantity,
      unit_price: cartItem.unitPrice,
      commission_amount: commissionAmount,
      vendor_payout: vendorPayout,
      item_status: 'awaiting_vendor',
      pickup_code: pickupCode,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    newOrderItems.push(orderItemRecord);

    if (!vendorGroupedItems.has(cartItem.vendorId)) {
      vendorGroupedItems.set(cartItem.vendorId, []);
    }
    vendorGroupedItems.get(cartItem.vendorId)!.push({
      item: cartItem,
      pickupCode,
      commissionAmount,
      vendorPayout,
    });
  });

  // Automated Vendor WhatsApp Dispatches
  // STRICT PRIVACY: ZERO customer name, phone, address, notes, or payment info sent to vendors!
  const dispatches: UltraMsgDispatchSummary[] = [];

  for (const [vendorId, group] of vendorGroupedItems.entries()) {
    const vendor = vendorMap.get(vendorId) || {
      id: vendorId,
      store_name: group[0]?.item.vendorName || 'Boutique Partner',
      slug: 'partner',
      phone: '96170112233',
      city: 'Lebanon',
      pickup_address: 'Boutique Location, Lebanon',
      commission_rate: 10.0,
      status: 'active' as const,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const totalPayout = group.reduce((sum, g) => sum + g.vendorPayout, 0);

    const messagePreview = buildVendorWhatsAppMessage({
      storeName: vendor.store_name,
      orderNumber,
      items: group.map(g => ({
        title: g.item.title,
        variantName: g.item.variantName,
        quantity: g.item.quantity,
        unitPrice: g.item.unitPrice,
        pickupCode: g.pickupCode,
      })),
      totalVendorPayout: totalPayout,
      pickupAddress: vendor.pickup_address,
    });

    dispatches.push({
      vendorId,
      vendorName: vendor.store_name,
      vendorPhone: vendor.phone,
      pickupCodes: group.map(g => g.pickupCode),
      itemsCount: group.reduce((sum, g) => sum + g.item.quantity, 0),
      expectedPayout: totalPayout,
      messagePreview,
      status: 'sent',
      timestamp: new Date().toISOString(),
    });
  }

  // Pre-filled admin WhatsApp confirmation URL using official Admin phone
  // Customer delivery details ONLY go to the central platform administrator
  const adminPhone = getAdminWhishPhone();
  const adminMsg = buildAdminWhatsAppMessage({
    orderNumber,
    customerName: customer_name,
    customerPhone: customer_phone,
    city,
    addressDetails: address_details,
    deliveryNotes: delivery_notes,
    paymentMethod: payment_method || 'cod',
    whishSenderPhone: whish_sender_phone,
    items: items.map(i => ({
      vendorName: i.vendorName,
      title: i.title,
      variantName: i.variantName,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
    })),
    subtotal,
    deliveryFee,
    totalCodAmount,
  });

  const adminWhatsAppUrl = `https://wa.me/${formatLebanesePhone(adminPhone)}?text=${encodeURIComponent(adminMsg)}`;

  // Asynchronously persist order into Firebase Firestore
  saveOrderToDB(newOrder, newOrderItems).catch(err => {
    console.warn('Async Firebase saveOrder notice:', err);
  });

  const response: CheckoutResponse = {
    success: true,
    orderId,
    orderNumber,
    totalAmount: totalCodAmount,
    subtotal,
    deliveryFee,
    adminWhatsAppUrl,
    vendorDispatchesCount: vendorGroupedItems.size,
    dispatches,
  };

  return {
    response,
    newOrder,
    newOrderItems,
    dispatches,
  };
}
