// ============================================================================
// Database & Domain Types for SouqHub Lebanon Multi-Vendor Marketplace
// Matches Firebase Firestore Blueprint Schema
// ============================================================================

export type UserRole = 'super_admin' | 'vendor' | 'customer';

export type VendorStatus = 'pending' | 'active' | 'suspended';

export type OrderStatus = 
  | 'processing' 
  | 'collecting_items' 
  | 'at_hub' 
  | 'out_for_delivery' 
  | 'delivered' 
  | 'cancelled';

export type ItemStatus = 
  | 'awaiting_vendor' 
  | 'confirmed' 
  | 'picked_up' 
  | 'at_hub' 
  | 'out_of_stock';

export interface Profile {
  id: string; // references auth.users(id)
  role: UserRole;
  full_name: string | null;
  phone: string | null;
  created_at: string;
  updated_at: string;
}

export interface Vendor {
  id: string;
  profile_id?: string | null;
  email?: string | null;
  store_name: string;
  slug: string;
  phone: string;
  city: string;
  pickup_address: string;
  commission_rate: number; // e.g. 10.0 for 10%
  status: VendorStatus;
  is_active?: boolean;
  instagram_handle?: string | null;
  tiktok_handle?: string | null;
  whatsapp_number?: string | null;
  logo_url?: string | null;
  created_at: string;
  updated_at: string;
}

export interface VendorStore {
  id: string;
  vendor_id: string; // references auth.users(id) / profiles(id)
  store_id: string;  // references vendors(id)
  role: string;      // 'owner' | 'manager'
  created_at: string;
  store?: Vendor;
}

export interface Product {
  id: string;
  vendor_id: string;
  title: string;
  description: string | null;
  base_price: number; // in USD
  category: string;
  images: string[];
  is_active: boolean;
  in_stock?: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  name: string; // e.g., "Size M / Olive Green"
  stock_quantity: number;
  price_override: number | null;
  sku?: string | null;
  created_at: string;
}

export interface Order {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  city: string;
  address_details: string;
  delivery_notes?: string | null;
  subtotal: number;
  delivery_fee: number; // default $3.00 USD
  total_cod_amount: number;
  currency: string; // 'USD' | 'LBP'
  status: OrderStatus;
  payment_method?: 'cod' | 'whish';
  whish_sender_phone?: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  vendor_id: string;
  product_id: string;
  variant_id?: string | null;
  quantity: number;
  unit_price: number;
  commission_amount: number;
  vendor_payout: number;
  item_status: ItemStatus;
  pickup_code: string; // e.g. "PU-89412"
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Extended Application Types & DTOs
// ============================================================================

export interface ProductWithVendor extends Product {
  vendor: Pick<Vendor, 'id' | 'store_name' | 'slug' | 'city' | 'phone' | 'commission_rate'> & {
    instagram_handle?: string | null;
    tiktok_handle?: string | null;
  };
  variants: ProductVariant[];
}

export interface CartItem {
  productId: string;
  variantId?: string | null;
  vendorId: string;
  vendorName: string;
  title: string;
  variantName?: string | null;
  unitPrice: number; // Customer price (including added commission)
  basePrice?: number; // Base vendor price (before commission)
  commissionRate?: number; // Vendor's commission rate percentage (e.g. 10)
  quantity: number;
  imageUrl?: string;
}

export interface CheckoutPayload {
  customer_name: string;
  customer_phone: string;
  city: string;
  address_details: string;
  delivery_notes?: string;
  payment_method?: 'cod' | 'whish';
  whish_sender_phone?: string;
  items: CartItem[];
}

export interface CheckoutResponse {
  success: boolean;
  orderId: string;
  orderNumber: string;
  totalAmount: number;
  subtotal: number;
  deliveryFee: number;
  adminWhatsAppUrl: string;
  vendorDispatchesCount: number;
  dispatches?: VendorDispatchSummary[];
  error?: string;
}

export interface VendorDispatchSummary {
  vendorId: string;
  vendorName: string;
  vendorPhone: string;
  pickupCodes: string[];
  itemsCount: number;
  expectedPayout: number;
  messagePreview: string;
  status: 'sent' | 'simulated' | 'failed';
  timestamp: string;
}

export type UltraMsgDispatchSummary = VendorDispatchSummary;
