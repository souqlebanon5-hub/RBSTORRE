import { NextResponse } from 'next/server';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  increment 
} from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { 
  buildVendorWhatsAppMessage, 
  buildAdminWhatsAppMessage, 
  formatLebanesePhone,
  generateWhatsAppChatLink 
} from '@/src/lib/ultramsg';
import type { CartItem, CheckoutPayload } from '@/src/types/database';
import { INITIAL_PRODUCTS, INITIAL_VENDORS } from '@/src/data/mockData';

export async function POST(request: Request) {
  try {
    const body: CheckoutPayload = await request.json();
    const { 
      customer_name, 
      customer_phone, 
      city, 
      address_details, 
      delivery_notes, 
      payment_method, 
      whish_sender_phone, 
      items 
    } = body;

    // 1. Validation
    if (!customer_name?.trim() || !customer_phone?.trim() || !city?.trim() || !address_details?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Customer name, phone, city, and address details are required.' },
        { status: 400 }
      );
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Cart must contain at least one item.' },
        { status: 400 }
      );
    }

    // 2. Fetch delivery fee and free delivery thresholds from 'settings' Firestore collection
    let baseDeliveryFee = 3.00;
    let freeDeliveryEnabled = true;
    let freeDeliveryThreshold = 50.00;
    let adminPhoneNumber = '96170882233';

    try {
      const settingsSnap = await getDocs(collection(db, 'settings'));
      if (!settingsSnap.empty) {
        settingsSnap.forEach(d => {
          const row = d.data();
          const key = d.id;
          if (key === 'delivery_fee' && row.amount !== undefined) {
            baseDeliveryFee = Number(row.amount);
          }
          if (key === 'free_delivery') {
            if (row.enabled !== undefined) freeDeliveryEnabled = Boolean(row.enabled);
            if (row.threshold !== undefined) freeDeliveryThreshold = Number(row.threshold);
          }
          if (key === 'admin_phone' && row.phone) {
            adminPhoneNumber = String(row.phone);
          }
        });
      }
    } catch (settingsErr) {
      console.warn('Using default settings fallback in Firebase:', settingsErr);
    }

    // 3. Price Fix & Stock Validation from Firestore
    // Pre-fetch all vendors to apply active store commission rates (added on top of price)
    const vendorsSnap = await getDocs(collection(db, 'vendors')).catch(() => null);
    const vendorsMap = new Map<string, any>();
    if (vendorsSnap && !vendorsSnap.empty) {
      vendorsSnap.forEach(d => vendorsMap.set(d.id, d.data()));
    }

    let subtotal = 0;
    const validatedItems: Array<CartItem & { verifiedPrice: number; basePrice: number; commissionRate: number; pickupCode: string }> = [];

    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    const getPickupCode = () => {
      let code = 'PU-';
      for (let i = 0; i < 5; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
      return code;
    };

    for (const item of items) {
      if (item.quantity <= 0) {
        return NextResponse.json(
          { success: false, error: `Invalid quantity for item ${item.title}` },
          { status: 400 }
        );
      }

      const vendorData = vendorsMap.get(item.vendorId) || INITIAL_VENDORS.find(v => v.id === item.vendorId);
      const commissionRate = Number(item.commissionRate ?? vendorData?.commission_rate ?? 10.0);

      let verifiedBasePrice: number | null = null;

      // Query product directly from Firestore
      try {
        const prodSnap = await getDoc(doc(db, 'products', item.productId));
        if (prodSnap.exists()) {
          const prodData = prodSnap.data();
          verifiedBasePrice = Number(prodData.base_price || prodData.price || 0);

          if (item.variantId && Array.isArray(prodData.variants)) {
            const matchedVar = prodData.variants.find((v: any) => v.id === item.variantId);
            if (matchedVar && matchedVar.price_override) {
              verifiedBasePrice = Number(matchedVar.price_override);
            }
          }
        }
      } catch (prodErr) {
        console.warn('Notice querying Firestore product:', prodErr);
      }

      // Fallback check against INITIAL_PRODUCTS
      if (verifiedBasePrice === null) {
        const fallbackProd = INITIAL_PRODUCTS.find(p => p.id === item.productId);
        if (fallbackProd) {
          verifiedBasePrice = fallbackProd.base_price;
          if (item.variantId) {
            const v = fallbackProd.variants.find(vr => vr.id === item.variantId);
            if (v && v.price_override) verifiedBasePrice = v.price_override;
          }
        } else {
          // If no stored base price, derive it from cart item basePrice or unitPrice
          verifiedBasePrice = (item.basePrice !== undefined && item.basePrice !== null && item.basePrice > 0)
            ? Number(item.basePrice)
            : Number((item.unitPrice / (1 + (commissionRate / 100))).toFixed(2));
        }
      }

      const basePrice = Number(verifiedBasePrice || 0);
      // Commission is added ON TOP of the vendor's price:
      const commissionAmountPerUnit = Number((basePrice * (commissionRate / 100)).toFixed(2));
      const verifiedCustomerPrice = Number((basePrice + commissionAmountPerUnit).toFixed(2));

      subtotal += verifiedCustomerPrice * item.quantity;
      validatedItems.push({
        ...item,
        basePrice,
        commissionRate,
        verifiedPrice: verifiedCustomerPrice,
        pickupCode: getPickupCode(),
      });
    }

    // 4. Calculate Delivery Fee
    const isFreeDelivery = freeDeliveryEnabled && subtotal >= freeDeliveryThreshold;
    const deliveryFee = isFreeDelivery ? 0.00 : baseDeliveryFee;
    const totalCodAmount = Number((subtotal + deliveryFee).toFixed(2));
    const orderNumber = `SQL-${Date.now().toString().slice(-6)}`;
    const orderId = `ord_${Date.now()}`;

    // 5. Group items by Vendor to build individualized WhatsApp links
    const itemsByVendor = new Map<string, Array<typeof validatedItems[0]>>();
    validatedItems.forEach(item => {
      const existing = itemsByVendor.get(item.vendorId) || [];
      existing.push(item);
      itemsByVendor.set(item.vendorId, existing);
    });

    const vendorDispatches: any[] = [];

    itemsByVendor.forEach((vItems, vendorId) => {
      const vendorData = vendorsMap.get(vendorId) || INITIAL_VENDORS.find(v => v.id === vendorId) || {
        store_name: vItems[0].vendorName,
        phone: '96170112233',
        city: 'Beirut',
        pickup_address: 'Beirut Central',
      };

      const vendorName = vendorData.store_name;
      const vendorPhone = vendorData.phone;
      // Vendor receives 100% of their base requested price (commission is added on top)
      const vendorPayout = Number(vItems.reduce((sum, vi) => sum + (vi.basePrice * vi.quantity), 0).toFixed(2));

      const message = buildVendorWhatsAppMessage({
        orderNumber,
        storeName: vendorName,
        items: vItems.map(vi => ({
          title: vi.title,
          variantName: vi.variantName,
          quantity: vi.quantity,
          unitPrice: vi.basePrice, // show vendor their base price
          pickupCode: vi.pickupCode,
        })),
        pickupAddress: vendorData.pickup_address,
        totalVendorPayout: vendorPayout,
      });

      const cleanPhone = formatLebanesePhone(vendorPhone);
      const whatsappLink = generateWhatsAppChatLink(cleanPhone, message);

      vendorDispatches.push({
        vendorId,
        vendorPhone: cleanPhone,
        whatsappLink,
        vendorName,
        pickupCodes: vItems.map(vi => vi.pickupCode),
        itemsCount: vItems.reduce((sum, vi) => sum + vi.quantity, 0),
        expectedPayout: vendorPayout,
        messagePreview: message.slice(0, 100) + '...',
        status: 'sent',
        timestamp: new Date().toISOString(),
      });
    });

    // 6. Build Master Admin WhatsApp link
    const adminMsg = buildAdminWhatsAppMessage({
      orderNumber,
      customerName: customer_name,
      customerPhone: customer_phone,
      city,
      addressDetails: address_details,
      deliveryNotes: delivery_notes,
      paymentMethod: payment_method || 'cod',
      whishSenderPhone: whish_sender_phone,
      items: validatedItems.map(vi => ({
        vendorName: vi.vendorName,
        title: vi.title,
        variantName: vi.variantName,
        quantity: vi.quantity,
        unitPrice: vi.verifiedPrice,
      })),
      subtotal,
      deliveryFee,
      totalCodAmount,
    });

    const adminWhatsAppUrl = generateWhatsAppChatLink(adminPhoneNumber, adminMsg);

    // 7. Persist Order and Items to Firestore
    try {
      await setDoc(doc(db, 'orders', orderId), {
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
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      for (let idx = 0; idx < validatedItems.length; idx++) {
        const item = validatedItems[idx];
        const itemId = `item_${Date.now()}_${idx}`;
        const vPayout = Number((item.basePrice * item.quantity).toFixed(2));
        const lineTotal = Number((item.verifiedPrice * item.quantity).toFixed(2));
        const commAmt = Number((lineTotal - vPayout).toFixed(2));

        await setDoc(doc(db, 'order_items', itemId), {
          id: itemId,
          order_id: orderId,
          vendor_id: item.vendorId,
          product_id: item.productId,
          variant_id: item.variantId || null,
          quantity: item.quantity,
          unit_price: item.verifiedPrice,
          commission_amount: commAmt,
          vendor_payout: vPayout,
          item_status: 'awaiting_vendor',
          pickup_code: item.pickupCode,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

        // Decrement stock in Firestore if product doc exists
        try {
          await updateDoc(doc(db, 'products', item.productId), {
            stock_quantity: increment(-item.quantity),
            updated_at: new Date().toISOString(),
          });
        } catch {}
      }
    } catch (dbSaveErr) {
      console.warn('Firestore save order notice:', dbSaveErr);
    }

    return NextResponse.json({
      success: true,
      order: {
        id: orderId,
        orderNumber,
        customerName: customer_name,
        customerPhone: customer_phone,
        city,
        addressDetails: address_details,
        subtotal,
        deliveryFee,
        totalCodAmount,
        currency: 'USD',
        status: 'processing',
        createdAt: new Date().toISOString(),
      },
      vendorDispatches,
      adminWhatsAppUrl,
      orderSummary: {
        subtotal,
        deliveryFee,
        totalCodAmount,
        vendorsCount: itemsByVendor.size,
        itemsCount: validatedItems.reduce((acc, i) => acc + i.quantity, 0),
      }
    });

  } catch (error: any) {
    console.error('Checkout error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal checkout processing error' },
      { status: 500 }
    );
  }
}
