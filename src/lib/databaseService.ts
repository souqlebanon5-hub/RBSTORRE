import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  Unsubscribe
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import { signOutUser } from './auth';
import { INITIAL_PRODUCTS, INITIAL_VENDORS, INITIAL_ORDERS, INITIAL_ORDER_ITEMS } from '../data/mockData';
import type { 
  ProductWithVendor, 
  Vendor, 
  Order, 
  OrderItem, 
  VendorStatus, 
  ItemStatus 
} from '../types/database';

function toPublicVendor(vendorId: string, vendor: Record<string, any>): Partial<Vendor> & Pick<Vendor, 'id' | 'store_name' | 'slug' | 'phone' | 'city' | 'pickup_address' | 'commission_rate' | 'status' | 'created_at' | 'updated_at'> {
  return {
    id: vendorId,
    store_name: String(vendor.store_name || ''),
    slug: String(vendor.slug || ''),
    phone: String(vendor.phone || ''),
    city: String(vendor.city || ''),
    pickup_address: String(vendor.pickup_address || ''),
    commission_rate: Number(vendor.commission_rate || 10),
    status: vendor.status === 'active' ? 'active' : 'pending',
    instagram_handle: vendor.instagram_handle || null,
    tiktok_handle: vendor.tiktok_handle || null,
    whatsapp_number: vendor.whatsapp_number || null,
    logo_url: vendor.logo_url || null,
    created_at: String(vendor.created_at || new Date().toISOString()),
    updated_at: String(vendor.updated_at || new Date().toISOString()),
  };
}

/**
 * Fetch all active products with their vendors and variants from Firestore
 */
export async function fetchProductsFromDB(): Promise<ProductWithVendor[]> {
  try {
    const productsRef = collection(db, 'products');
    const snap = await getDocs(productsRef);

    if (snap.empty) {
      return [];
    }

    const vendorsRef = collection(db, 'public_vendors');
    const vendorsSnap = await getDocs(vendorsRef);
    const vendorsMap = new Map<string, Vendor>();
    vendorsSnap.forEach(d => {
      vendorsMap.set(d.id, { id: d.id, ...d.data() } as Vendor);
    });

    const products: ProductWithVendor[] = [];
    snap.forEach(d => {
      const p = d.data();
      const vendor = vendorsMap.get(p.vendor_id) || {
        id: p.vendor_id || 'v_unknown',
        store_name: 'Boutique',
        slug: 'boutique',
        city: 'Lebanon',
        phone: '96170000000',
        commission_rate: 10,
        status: 'active' as const,
        instagram_handle: '',
        tiktok_handle: '',
      };
      products.push({
        id: d.id,
        vendor_id: p.vendor_id,
        title: p.title || '',
        description: p.description || '',
        base_price: Number(p.base_price || p.price || 0),
        category: p.category || 'Clothes',
        images: Array.isArray(p.images) ? p.images : (p.image_url ? [p.image_url] : []),
        is_active: p.is_active !== false,
        in_stock: p.in_stock !== false,
        created_at: p.created_at || new Date().toISOString(),
        updated_at: p.updated_at || new Date().toISOString(),
        vendor: {
          id: vendor.id,
          store_name: vendor.store_name,
          slug: vendor.slug,
          city: vendor.city,
          phone: vendor.phone,
          commission_rate: Number(vendor.commission_rate || 10),
          instagram_handle: vendor.instagram_handle,
          tiktok_handle: vendor.tiktok_handle,
        },
        variants: Array.isArray(p.variants) ? p.variants : [],
      });
    });

    return products;
  } catch (err) {
    return [];
  }
}

/**
 * Real-time subscription to products collection using pure Firestore onSnapshot
 */
export function subscribeToProducts(
  onUpdate: (products: ProductWithVendor[]) => void,
  onError?: (err: any) => void
): Unsubscribe {
  const productsRef = collection(db, 'products');
  return onSnapshot(
    productsRef,
    async (snapshot) => {
      if (snapshot.empty) {
        onUpdate([]);
        return;
      }

      const vendorsRef = collection(db, 'public_vendors');
      const vendorsSnap = await getDocs(vendorsRef);
      const vendorsMap = new Map<string, Vendor>();
      vendorsSnap.forEach(d => {
        vendorsMap.set(d.id, { id: d.id, ...d.data() } as Vendor);
      });

      const prods: ProductWithVendor[] = [];
      snapshot.forEach(d => {
        const p = d.data();
        const vendor = vendorsMap.get(p.vendor_id) || {
          id: p.vendor_id || 'v_unknown',
          store_name: 'Boutique',
          slug: 'boutique',
          city: 'Lebanon',
          phone: '96170000000',
          commission_rate: 10,
          status: 'active' as const,
          instagram_handle: '',
          tiktok_handle: '',
        };
        prods.push({
          id: d.id,
          vendor_id: p.vendor_id,
          title: p.title || '',
          description: p.description || '',
          base_price: Number(p.base_price || p.price || 0),
          category: p.category || 'Clothes',
          images: Array.isArray(p.images) ? p.images : (p.image_url ? [p.image_url] : []),
          is_active: p.is_active !== false,
          in_stock: p.in_stock !== false,
          created_at: p.created_at || new Date().toISOString(),
          updated_at: p.updated_at || new Date().toISOString(),
          vendor,
          variants: Array.isArray(p.variants) ? p.variants : [],
        });
      });
      onUpdate(prods);
    },
    (error) => {
      if (onError) onError(error);
      console.warn('Firestore products subscription notice:', error);
    }
  );
}

/**
 * Fetch all vendors from Firestore
 */
export async function fetchVendorsFromDB(): Promise<Vendor[]> {
  try {
    const vendorsRef = collection(db, 'vendors');
    const snap = await getDocs(vendorsRef);

    if (snap.empty) {
      return [];
    }

    const profilesMap = new Map<string, string>();
    try {
      const profilesSnap = await getDocs(collection(db, 'profiles'));
      profilesSnap.forEach(p => {
        const data = p.data();
        if (data.email) profilesMap.set(p.id, data.email);
      });
    } catch {}

    const vendors: Vendor[] = [];
    snap.forEach(d => {
      const v = d.data();
      const email = v.email || (v.profile_id ? profilesMap.get(v.profile_id) : null) || null;
      vendors.push({
        id: d.id,
        profile_id: v.profile_id,
        email,
        store_name: v.store_name,
        slug: v.slug,
        phone: v.phone,
        city: v.city,
        pickup_address: v.pickup_address,
        commission_rate: Number(v.commission_rate || 10),
        status: v.status || 'active',
        instagram_handle: v.instagram_handle,
        tiktok_handle: v.tiktok_handle,
        created_at: v.created_at,
        updated_at: v.updated_at,
      });
    });

    return vendors;
  } catch (err) {
    return [];
  }
}

/** Fetch sanitized, active vendor data for the public storefront. */
export async function fetchPublicVendorsFromDB(): Promise<Vendor[]> {
  try {
    const snapshot = await getDocs(collection(db, 'public_vendors'));
    return snapshot.docs
      .map((vendorDoc) => toPublicVendor(vendorDoc.id, vendorDoc.data()) as Vendor)
      .filter((vendor) => vendor.status === 'active');
  } catch (err) {
    console.warn('Could not fetch public vendors:', err);
    return [];
  }
}

/**
 * Real-time subscription to vendors collection in Firestore
 */
export function subscribeToVendors(
  onUpdate: (vendors: Vendor[]) => void,
  onError?: (err: any) => void
): Unsubscribe {
  const vendorsRef = collection(db, 'vendors');
  return onSnapshot(
    vendorsRef,
    async (snap) => {
      try {
        const profilesMap = new Map<string, string>();
        try {
          const profilesSnap = await getDocs(collection(db, 'profiles'));
          profilesSnap.forEach(p => {
            const data = p.data();
            if (data.email) profilesMap.set(p.id, data.email);
          });
        } catch {}

        const vendors: Vendor[] = [];
        snap.forEach(d => {
          const v = d.data();
          const email = v.email || (v.profile_id ? profilesMap.get(v.profile_id) : null) || null;
          vendors.push({
            id: d.id,
            profile_id: v.profile_id,
            email,
            store_name: v.store_name,
            slug: v.slug,
            phone: v.phone,
            city: v.city,
            pickup_address: v.pickup_address,
            commission_rate: Number(v.commission_rate || 10),
            status: v.status || 'pending',
            instagram_handle: v.instagram_handle,
            tiktok_handle: v.tiktok_handle,
            created_at: v.created_at || new Date().toISOString(),
            updated_at: v.updated_at || new Date().toISOString(),
          });
        });

        onUpdate(vendors);
      } catch (err) {
        if (onError) onError(err);
      }
    },
    (err) => {
      console.warn('Vendors onSnapshot notice:', err);
      if (onError) onError(err);
    }
  );
}

/** Subscribe to sanitized, active vendor data for the public storefront. */
export function subscribeToPublicVendors(
  onUpdate: (vendors: Vendor[]) => void,
  onError?: (err: any) => void
): Unsubscribe {
  return onSnapshot(
    collection(db, 'public_vendors'),
    (snapshot) => {
      const vendors = snapshot.docs
        .map((vendorDoc) => toPublicVendor(vendorDoc.id, vendorDoc.data()) as Vendor)
        .filter((vendor) => vendor.status === 'active');
      onUpdate(vendors);
    },
    (error) => {
      onError?.(error);
      console.warn('Public vendors subscription notice:', error);
    }
  );
}

/** Sync sanitized active stores to the public catalog. Call from the admin console only. */
export async function syncPublicVendorCatalogFromDB(): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const [vendorsSnapshot, publicVendorsSnapshot] = await Promise.all([
      getDocs(collection(db, 'vendors')),
      getDocs(collection(db, 'public_vendors')),
    ]);
    const activeVendorIds = new Set<string>();
    let count = 0;

    for (const vendorDoc of vendorsSnapshot.docs) {
      const vendor = vendorDoc.data();
      if (vendor.status !== 'active' || vendor.is_active === false) continue;

      activeVendorIds.add(vendorDoc.id);
      await setDoc(doc(db, 'public_vendors', vendorDoc.id), toPublicVendor(vendorDoc.id, vendor));
      count += 1;
    }

    for (const publicVendorDoc of publicVendorsSnapshot.docs) {
      if (!activeVendorIds.has(publicVendorDoc.id)) {
        await deleteDoc(doc(db, 'public_vendors', publicVendorDoc.id));
      }
    }

    return { success: true, count };
  } catch (err: any) {
    return { success: false, count: 0, error: err.message || 'Failed to sync public vendor catalog.' };
  }
}

/**
 * Fetch consolidated orders and order items from Firestore
 */
export async function fetchOrdersFromDB(): Promise<{ orders: Order[]; orderItems: OrderItem[] }> {
  try {
    const ordersSnap = await getDocs(collection(db, 'orders'));
    const itemsSnap = await getDocs(collection(db, 'order_items'));

    if (ordersSnap.empty) {
      return { orders: [], orderItems: [] };
    }

    const parsedOrders: Order[] = [];
    ordersSnap.forEach(d => {
      const o = d.data();
      parsedOrders.push({
        id: d.id,
        order_number: o.order_number || d.id,
        customer_name: o.customer_name || '',
        customer_phone: o.customer_phone || '',
        city: o.city || o.delivery_city || '',
        address_details: o.address_details || o.delivery_address || '',
        delivery_notes: o.delivery_notes || '',
        subtotal: Number(o.subtotal || 0),
        delivery_fee: Number(o.delivery_fee || 0),
        total_cod_amount: Number(o.total_cod_amount || o.total_usd || 0),
        currency: o.currency || 'USD',
        status: o.status || 'pending',
        created_at: o.created_at || new Date().toISOString(),
        updated_at: o.updated_at || new Date().toISOString(),
      });
    });

    const parsedItems: OrderItem[] = [];
    itemsSnap.forEach(d => {
      const i = d.data();
      const qty = Number(i.quantity || 1);
      const price = Number(i.unit_price || i.price || 0);
      const lineTotal = qty * price;
      const commRate = Number(i.commission_rate || 10.0);
      const payout = (i.vendor_payout !== undefined && i.vendor_payout !== null && Number(i.vendor_payout) > 0)
        ? Number(i.vendor_payout)
        : Number((lineTotal / (1 + (commRate / 100))).toFixed(2));
      const commAmt = (i.commission_amount !== undefined && i.commission_amount !== null && Number(i.commission_amount) > 0)
        ? Number(i.commission_amount)
        : Number((lineTotal - payout).toFixed(2));

      parsedItems.push({
        id: d.id,
        order_id: i.order_id,
        vendor_id: i.vendor_id,
        product_id: i.product_id,
        variant_id: i.variant_id || null,
        quantity: qty,
        unit_price: price,
        commission_amount: commAmt,
        vendor_payout: payout,
        item_status: i.item_status || i.status || 'pending_fulfillment',
        pickup_code: i.pickup_code || 'PK-0000',
        created_at: i.created_at || new Date().toISOString(),
        updated_at: i.updated_at || new Date().toISOString(),
      });
    });

    return { orders: parsedOrders, orderItems: parsedItems };
  } catch (err) {
    return { orders: INITIAL_ORDERS, orderItems: INITIAL_ORDER_ITEMS };
  }
}

/**
 * Real-time subscription to orders and line items using pure Firestore onSnapshot
 */
export function subscribeToOrders(
  onUpdate: (data: { orders: Order[]; orderItems: OrderItem[] }) => void,
  onError?: (err: any) => void
): Unsubscribe {
  const ordersRef = collection(db, 'orders');
  return onSnapshot(
    ordersRef,
    async () => {
      try {
        const latest = await fetchOrdersFromDB();
        onUpdate(latest);
      } catch (e) {
        if (onError) onError(e);
      }
    },
    (error) => {
      if (onError) onError(error);
      console.warn('Firestore orders subscription notice:', error);
    }
  );
}

/** Subscribe to order items belonging to one authenticated vendor store. */
export function subscribeToVendorOrderItems(
  vendorId: string,
  onUpdate: (items: OrderItem[]) => void,
  onError?: (err: unknown) => void
): Unsubscribe {
  const itemsQuery = query(collection(db, 'order_items'), where('vendor_id', '==', vendorId));
  return onSnapshot(
    itemsQuery,
    (snapshot) => {
      const items = snapshot.docs.map((itemDoc) => {
        const item = itemDoc.data();
        return {
          id: itemDoc.id,
          order_id: item.order_id,
          vendor_id: item.vendor_id,
          product_id: item.product_id,
          variant_id: item.variant_id || null,
          quantity: Number(item.quantity || 1),
          unit_price: Number(item.unit_price || item.price || 0),
          commission_amount: Number(item.commission_amount || 0),
          vendor_payout: Number(item.vendor_payout || 0),
          item_status: item.item_status || item.status || 'awaiting_vendor',
          pickup_code: item.pickup_code || 'PK-0000',
          created_at: item.created_at || new Date().toISOString(),
          updated_at: item.updated_at || new Date().toISOString(),
        } as OrderItem;
      });
      onUpdate(items);
    },
    onError
  );
}

/**
 * Persist a newly created order and child items to Firestore
 */
export async function saveOrderToDB(
  newOrder: Order, 
  newOrderItems: OrderItem[]
): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Insert master order document
    await setDoc(doc(db, 'orders', newOrder.id), {
      id: newOrder.id,
      order_number: newOrder.order_number,
      customer_name: newOrder.customer_name,
      customer_phone: newOrder.customer_phone,
      city: newOrder.city,
      address_details: newOrder.address_details,
      delivery_notes: newOrder.delivery_notes,
      subtotal: newOrder.subtotal,
      delivery_fee: newOrder.delivery_fee,
      total_cod_amount: newOrder.total_cod_amount,
      currency: newOrder.currency,
      status: newOrder.status,
      created_at: newOrder.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // 2. Insert child line items
    for (const item of newOrderItems) {
      await setDoc(doc(db, 'order_items', item.id), {
        id: item.id,
        order_id: newOrder.id,
        vendor_id: item.vendor_id,
        product_id: item.product_id,
        variant_id: item.variant_id || null,
        quantity: item.quantity,
        unit_price: item.unit_price,
        commission_amount: item.commission_amount,
        vendor_payout: item.vendor_payout,
        item_status: item.item_status,
        pickup_code: item.pickup_code,
        created_at: item.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Fetch platform settings from Firestore
 */
export async function fetchPlatformSettingsFromDB(): Promise<{
  deliveryFee: number;
  freeDeliveryEnabled: boolean;
  freeDeliveryThreshold: number;
  adminPhone: string;
}> {
  const defaults = {
    deliveryFee: 3.00,
    freeDeliveryEnabled: true,
    freeDeliveryThreshold: 50.00,
    adminPhone: '96170882233',
  };

  try {
    const [pricingSnapshot, generalSnapshot] = await Promise.all([
      getDoc(doc(db, 'settings', 'pricing')),
      getDoc(doc(db, 'settings', 'general')),
    ]);
    const pricing = pricingSnapshot.data() || {};
    const general = generalSnapshot.data() || {};

    return {
      deliveryFee: Number(pricing.delivery_fee ?? defaults.deliveryFee),
      freeDeliveryEnabled: Boolean(pricing.free_delivery_enabled ?? defaults.freeDeliveryEnabled),
      freeDeliveryThreshold: Number(pricing.free_delivery_threshold ?? defaults.freeDeliveryThreshold),
      adminPhone: String(general.whish_phone || general.admin_phone || defaults.adminPhone),
    };
  } catch {
    return defaults;
  }
}

/**
 * Update vendor status in Firestore (Super Admin)
 */
export async function updateVendorStatusInDB(vendorId: string, status: VendorStatus): Promise<boolean> {
  try {
    const vendorRef = doc(db, 'vendors', vendorId);
    await setDoc(doc(db, 'vendors', vendorId), {
      status,
      is_active: status === 'active',
      updated_at: new Date().toISOString(),
    }, { merge: true });

    if (status === 'active') {
      const vendorSnapshot = await getDoc(vendorRef);
      if (vendorSnapshot.exists()) {
        await setDoc(doc(db, 'public_vendors', vendorId), toPublicVendor(vendorId, vendorSnapshot.data()));
      }
    } else {
      await deleteDoc(doc(db, 'public_vendors', vendorId));
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Update vendor commission rate in Firestore (Super Admin)
 */
export async function updateVendorCommissionInDB(vendorId: string, rate: number): Promise<boolean> {
  try {
    await setDoc(doc(db, 'vendors', vendorId), {
      commission_rate: rate,
      updated_at: new Date().toISOString(),
    }, { merge: true });
    const publicVendorRef = doc(db, 'public_vendors', vendorId);
    const publicVendorSnapshot = await getDoc(publicVendorRef);
    if (publicVendorSnapshot.exists()) {
      await setDoc(publicVendorRef, { commission_rate: rate, updated_at: new Date().toISOString() }, { merge: true });
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Delete a product permanently from Firestore (Admin or Vendor)
 */
export async function deleteProductFromDB(productId: string): Promise<boolean> {
  try {
    await deleteDoc(doc(db, 'products', productId));
    return true;
  } catch (err) {
    console.warn('Error deleting product from Firestore:', err);
    return false;
  }
}

/**
 * Save or update a product in Firestore database
 */
export async function saveProductToDB(product: ProductWithVendor): Promise<boolean> {
  try {
    const prodDocRef = doc(db, 'products', product.id);
    const dataToSave = {
      id: product.id,
      vendor_id: product.vendor_id,
      title: product.title || '',
      description: product.description || '',
      base_price: Number(product.base_price || 0),
      category: product.category || 'Clothes',
      images: Array.isArray(product.images) && product.images.length > 0 ? product.images : [],
      is_active: product.is_active !== false,
      in_stock: product.in_stock !== false,
      variants: Array.isArray(product.variants) ? product.variants : [],
      created_at: product.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await setDoc(prodDocRef, dataToSave, { merge: true });
    return true;
  } catch (err) {
    console.error('Failed to save product to Firestore:', err);
    return false;
  }
}

/**
 * Update order item fulfillment status in Firestore
 */
export async function updateOrderItemStatusInDB(itemId: string, status: ItemStatus): Promise<boolean> {
  try {
    await updateDoc(doc(db, 'order_items', itemId), {
      item_status: status,
      updated_at: new Date().toISOString(),
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * 1. Fetch ONLY stores owned by the current authenticated vendor
 */
export async function getVendorStores(vendorUserId: string): Promise<Vendor[]> {
  if (!vendorUserId) return [];

  try {
    const storesList: Vendor[] = [];

    // 1. Query vendor_stores collection
    const vsQuery = query(collection(db, 'vendor_stores'), where('vendor_id', '==', vendorUserId));
    const vsSnap = await getDocs(vsQuery);

    for (const d of vsSnap.docs) {
      const storeId = d.data().store_id;
      if (storeId) {
        const storeDoc = await getDoc(doc(db, 'vendors', storeId));
        if (storeDoc.exists()) {
          storesList.push({ id: storeDoc.id, ...storeDoc.data() } as Vendor);
        }
      }
    }

    // 2. Query direct profile_id in vendors collection
    const directQuery = query(collection(db, 'vendors'), where('profile_id', '==', vendorUserId));
    const directSnap = await getDocs(directQuery);
    directSnap.forEach(d => {
      if (!storesList.some(s => s.id === d.id)) {
        storesList.push({ id: d.id, ...d.data() } as Vendor);
      }
    });

    // 3. Fallback for demo sessions
    if (storesList.length === 0) {
      const allInit = INITIAL_VENDORS;
      const matched = allInit.filter(v => v.profile_id === vendorUserId || v.id === vendorUserId);
      if (matched.length > 0) {
        return matched;
      }
    }

    return storesList;
  } catch (err) {
    console.warn('Error fetching vendor stores from Firestore:', err);
    return [];
  }
}

/**
 * 2. Verify Store Ownership: Does the current vendor own the selected store?
 */
export async function verifyStoreOwnership(vendorUserId: string, storeId: string): Promise<boolean> {
  if (!vendorUserId || !storeId) return false;

  try {
    // Check in vendor_stores collection
    const vsQuery = query(
      collection(db, 'vendor_stores'),
      where('vendor_id', '==', vendorUserId),
      where('store_id', '==', storeId)
    );
    const vsSnap = await getDocs(vsQuery);
    if (!vsSnap.empty) return true;

    // Check in vendors collection
    const vDoc = await getDoc(doc(db, 'vendors', storeId));
    if (vDoc.exists() && vDoc.data().profile_id === vendorUserId) {
      return true;
    }

    if (vendorUserId === storeId || vendorUserId === `u_${storeId}`) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * 3. Create a new store explicitly owned by the current authenticated vendor
 */
export async function createVendorStore(
  vendorUserId: string,
  storeData: {
    storeName: string;
    city: string;
    phone: string;
    pickupAddress: string;
    instagramHandle?: string;
    tiktokHandle?: string;
  }
): Promise<{ success: boolean; store?: Vendor; error?: string }> {
  if (!vendorUserId) {
    return { success: false, error: 'غير مصرح: يجب تسجيل الدخول لإنشاء متجر جديد.' };
  }

  try {
    const storeSlug = (storeData.storeName || '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || `store_${Date.now()}`;

    const newStoreId = `v_${Date.now()}`;

    const newStore: Vendor = {
      id: newStoreId,
      profile_id: vendorUserId,
      store_name: storeData.storeName.trim(),
      slug: `${storeSlug}-${Math.random().toString(36).substring(2, 6)}`,
      phone: storeData.phone,
      city: storeData.city,
      pickup_address: storeData.pickupAddress,
      commission_rate: 10.0,
      status: 'pending',
      is_active: false,
      instagram_handle: storeData.instagramHandle,
      tiktok_handle: storeData.tiktokHandle,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // 1. Insert into vendors collection
    await setDoc(doc(db, 'vendors', newStoreId), newStore);

    // 2. Link in vendor_stores collection
    await setDoc(doc(db, 'vendor_stores', `${vendorUserId}_${newStoreId}`), {
      id: `${vendorUserId}_${newStoreId}`,
      vendor_id: vendorUserId,
      store_id: newStoreId,
      role: 'owner',
    });

    return { success: true, store: newStore };
  } catch (err: any) {
    return { success: false, error: err.message || 'فشل تسجيل المتجر الجديد في Firestore' };
  }
}

/**
 * 4. Permanently delete vendor account, store, products, and auth session from Firebase
 */
export async function deleteVendorAccountPermanently(
  vendorId: string,
  userId?: string,
  signOutAfterDelete = true
): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Delete all products belonging to this vendor
    const prodsQuery = query(collection(db, 'products'), where('vendor_id', '==', vendorId));
    const prodsSnap = await getDocs(prodsQuery);
    for (const p of prodsSnap.docs) {
      await deleteDoc(doc(db, 'products', p.id));
    }

    // 2. Delete vendor_stores associations
    const vsQuery = query(collection(db, 'vendor_stores'), where('store_id', '==', vendorId));
    const vsSnap = await getDocs(vsQuery);
    for (const v of vsSnap.docs) {
      await deleteDoc(doc(db, 'vendor_stores', v.id));
    }

    if (userId) {
      const userVsQuery = query(collection(db, 'vendor_stores'), where('vendor_id', '==', userId));
      const userVsSnap = await getDocs(userVsQuery);
      for (const uv of userVsSnap.docs) {
        await deleteDoc(doc(db, 'vendor_stores', uv.id));
      }
    }

    // 3. Delete vendor store document
    await deleteDoc(doc(db, 'vendors', vendorId));
    await deleteDoc(doc(db, 'public_vendors', vendorId));

    // 4. Delete user profile if userId is provided
    if (userId) {
      await deleteDoc(doc(db, 'profiles', userId));
    }

    // 5. Sign out Firebase auth session
    if (signOutAfterDelete) await signOutUser();

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'فشل حذف الحساب كلياً من Firebase' };
  }
}

/**
 * Delete one vendor store page and its products without deleting the user account.
 */
export async function deleteVendorStorePage(
  vendorId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const productsQuery = query(collection(db, 'products'), where('vendor_id', '==', vendorId));
    const productsSnapshot = await getDocs(productsQuery);
    for (const product of productsSnapshot.docs) {
      await deleteDoc(doc(db, 'products', product.id));
    }

    const storeLinksQuery = query(collection(db, 'vendor_stores'), where('store_id', '==', vendorId));
    const storeLinksSnapshot = await getDocs(storeLinksQuery);
    for (const link of storeLinksSnapshot.docs) {
      await deleteDoc(doc(db, 'vendor_stores', link.id));
    }

    await deleteDoc(doc(db, 'vendors', vendorId));
    await deleteDoc(doc(db, 'public_vendors', vendorId));
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to delete vendor store page.' };
  }
}
