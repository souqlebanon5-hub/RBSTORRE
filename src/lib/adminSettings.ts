// ============================================================================
// Platform Settings Service: Cloud Firestore Persistence
// ============================================================================

import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';

export const DEFAULT_ADMIN_WHISH_PHONE = '96170882233';
export const DEFAULT_DELIVERY_FEE = 3.00;
export const DEFAULT_FREE_DELIVERY_ENABLED = true;
export const DEFAULT_FREE_DELIVERY_THRESHOLD = 50.00;

interface CachedAdminSettings {
  adminPhone: string;
  deliveryFee: number;
  freeDeliveryEnabled: boolean;
  freeDeliveryThreshold: number;
  platformCommissionOverride: number | null;
  isInitialized: boolean;
}

const SETTINGS_CACHE_KEY = 'souq_admin_settings_cache';

function readCachedSettings(): Partial<CachedAdminSettings> {
  if (typeof window === 'undefined') return {};
  try {
    const cached = localStorage.getItem(SETTINGS_CACHE_KEY);
    return cached ? JSON.parse(cached) as Partial<CachedAdminSettings> : {};
  } catch {
    return {};
  }
}

// In-memory synchronized state from Cloud Firestore
let cachedSettings: CachedAdminSettings = {
  adminPhone: DEFAULT_ADMIN_WHISH_PHONE,
  deliveryFee: DEFAULT_DELIVERY_FEE,
  freeDeliveryEnabled: DEFAULT_FREE_DELIVERY_ENABLED,
  freeDeliveryThreshold: DEFAULT_FREE_DELIVERY_THRESHOLD,
  platformCommissionOverride: null as number | null,
  ...readCachedSettings(),
  isInitialized: false,
};

function persistCachedSettings(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(cachedSettings));
  } catch {}
}

/**
 * Normalizes Arabic-Indic (٠-٩) and Eastern Arabic (۰-۹) numerals to standard ASCII digits (0-9)
 */
export function normalizeDigits(input: string | number): string {
  if (typeof input === 'number') return isNaN(input) ? '' : input.toString();
  if (!input) return '';
  return input
    .toString()
    .replace(/[٠-٩]/g, (d) => (d.charCodeAt(0) - 1632).toString())
    .replace(/[۰-۹]/g, (d) => (d.charCodeAt(0) - 1776).toString())
    .replace(/[^\d.]/g, '');
}

/**
 * Initialize real-time synchronization with Firestore 'settings' collection
 */
export function initSettingsListener(onChanged?: () => void) {
  if (typeof window === 'undefined') return () => {};

  // Listen to 'pricing' document
  const unsubPricing = onSnapshot(doc(db, 'settings', 'pricing'), (snap) => {
    if (snap.exists()) {
      const data = snap.data();
      if (data.delivery_fee !== undefined) cachedSettings.deliveryFee = Number(data.delivery_fee);
      if (data.free_delivery_enabled !== undefined) cachedSettings.freeDeliveryEnabled = Boolean(data.free_delivery_enabled);
      if (data.free_delivery_threshold !== undefined) cachedSettings.freeDeliveryThreshold = Number(data.free_delivery_threshold);
      cachedSettings.isInitialized = true;
      persistCachedSettings();
      if (onChanged) onChanged();
      window.dispatchEvent(new Event('kooll_admin_settings_changed'));
    }
  });

  // Listen to 'general' document
  const unsubGeneral = onSnapshot(doc(db, 'settings', 'general'), (snap) => {
    if (snap.exists()) {
      const data = snap.data();
      if (data.admin_phone) cachedSettings.adminPhone = String(data.admin_phone);
      if (data.whish_phone) cachedSettings.adminPhone = String(data.whish_phone);
      cachedSettings.isInitialized = true;
      persistCachedSettings();
      if (onChanged) onChanged();
      window.dispatchEvent(new Event('kooll_admin_settings_changed'));
    }
  });

  return () => {
    unsubPricing();
    unsubGeneral();
  };
}

// Auto-start listener on client
if (typeof window !== 'undefined') {
  initSettingsListener();
}

export function getAdminWhishPhone(): string {
  return cachedSettings.adminPhone || DEFAULT_ADMIN_WHISH_PHONE;
}

export async function setAdminWhishPhone(phone: string): Promise<void> {
  const cleaned = normalizeDigits(phone) || DEFAULT_ADMIN_WHISH_PHONE;
  cachedSettings.adminPhone = cleaned;
  persistCachedSettings();
  try {
    await setDoc(doc(db, 'settings', 'general'), {
      admin_phone: cleaned,
      whish_phone: cleaned,
      updated_at: new Date().toISOString(),
    }, { merge: true });
  } catch (err) {
    console.warn('Failed to update admin phone in Firestore:', err);
  }
}

export function getDeliveryFee(): number {
  return cachedSettings.deliveryFee;
}

export async function setDeliveryFee(fee: number | string): Promise<void> {
  const cleaned = normalizeDigits(fee);
  const parsed = parseFloat(cleaned);
  const validFee = isNaN(parsed) ? DEFAULT_DELIVERY_FEE : Math.max(0, parsed);
  cachedSettings.deliveryFee = validFee;
  persistCachedSettings();

  try {
    await setDoc(doc(db, 'settings', 'pricing'), {
      delivery_fee: validFee,
      updated_at: new Date().toISOString(),
    }, { merge: true });
  } catch (err) {
    console.warn('Failed to update delivery fee in Firestore:', err);
  }
}

export function getFreeDeliveryEnabled(): boolean {
  return cachedSettings.freeDeliveryEnabled;
}

export async function setFreeDeliveryEnabled(enabled: boolean): Promise<void> {
  cachedSettings.freeDeliveryEnabled = enabled;
  persistCachedSettings();
  try {
    await setDoc(doc(db, 'settings', 'pricing'), {
      free_delivery_enabled: enabled,
      updated_at: new Date().toISOString(),
    }, { merge: true });
  } catch (err) {
    console.warn('Failed to update free delivery in Firestore:', err);
  }
}

export function getFreeDeliveryThreshold(): number {
  return cachedSettings.freeDeliveryThreshold;
}

export function getPlatformCommissionOverride(): number | null {
  return cachedSettings.platformCommissionOverride;
}

export function subscribeToPlatformCommissionOverride(onChanged?: (amount: number | null) => void): () => void {
  return onSnapshot(
    doc(db, 'settings', 'platform_metrics'),
    (snap) => {
      const value = snap.exists() ? snap.data().platform_commission_override : null;
      cachedSettings.platformCommissionOverride = value === null || value === undefined ? null : Number(value);
      persistCachedSettings();
      onChanged?.(cachedSettings.platformCommissionOverride);
    },
    (err) => console.warn('Could not load the platform commission override:', err)
  );
}

export async function setPlatformCommissionOverride(amount: number | null): Promise<boolean> {
  const cleaned = amount === null ? null : Math.max(0, Number(amount));

  try {
    await setDoc(doc(db, 'settings', 'platform_metrics'), {
      platform_commission_override: cleaned,
      updated_at: new Date().toISOString(),
    }, { merge: true });
    cachedSettings.platformCommissionOverride = cleaned;
    persistCachedSettings();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('kooll_admin_settings_changed'));
    }
    return true;
  } catch (err) {
    console.warn('Failed to update platform commission display override:', err);
    return false;
  }
}

export async function setFreeDeliveryThreshold(threshold: number | string): Promise<void> {
  const cleaned = normalizeDigits(threshold);
  const parsed = parseFloat(cleaned);
  const valid = isNaN(parsed) ? DEFAULT_FREE_DELIVERY_THRESHOLD : Math.max(0, parsed);
  cachedSettings.freeDeliveryThreshold = valid;
  persistCachedSettings();

  try {
    await setDoc(doc(db, 'settings', 'pricing'), {
      free_delivery_threshold: valid,
      updated_at: new Date().toISOString(),
    }, { merge: true });
  } catch (err) {
    console.warn('Failed to update free delivery threshold in Firestore:', err);
  }
}

export function calculateOrderDeliveryFee(subtotal: number): {
  deliveryFee: number;
  baseDeliveryFee: number;
  isFreeDeliveryUnlocked: boolean;
  freeDeliveryEnabled: boolean;
  freeDeliveryThreshold: number;
  amountRemainingForFreeDelivery: number;
} {
  const baseFee = getDeliveryFee();
  const freeEnabled = getFreeDeliveryEnabled();
  const threshold = getFreeDeliveryThreshold();

  if (subtotal <= 0) {
    return {
      deliveryFee: 0,
      baseDeliveryFee: baseFee,
      isFreeDeliveryUnlocked: false,
      freeDeliveryEnabled: freeEnabled,
      freeDeliveryThreshold: threshold,
      amountRemainingForFreeDelivery: threshold
    };
  }

  if (freeEnabled && subtotal >= threshold) {
    return {
      deliveryFee: 0,
      baseDeliveryFee: baseFee,
      isFreeDeliveryUnlocked: true,
      freeDeliveryEnabled: true,
      freeDeliveryThreshold: threshold,
      amountRemainingForFreeDelivery: 0
    };
  }

  const remaining = Math.max(0, threshold - subtotal);
  return {
    deliveryFee: baseFee,
    baseDeliveryFee: baseFee,
    isFreeDeliveryUnlocked: false,
    freeDeliveryEnabled: freeEnabled,
    freeDeliveryThreshold: threshold,
    amountRemainingForFreeDelivery: remaining
  };
}
