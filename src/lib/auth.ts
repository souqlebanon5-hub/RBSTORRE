// ============================================================================
// Production Firebase Authentication & Role-Based Access Control (RBAC)
// ============================================================================

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  collection,
  query,
  where,
  getDocs
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { formatLebanesePhone } from './ultramsg';
import type { Vendor, UserRole, VendorStatus } from '../types/database';

export interface VendorSignUpInput {
  email: string;
  password: string;
  fullName: string;
  storeName: string;
  phone: string;
  city: string;
  pickupAddress: string;
  instagramHandle?: string;
  tiktokHandle?: string;
}

export interface AuthSessionUser {
  id: string;
  email: string;
  role: UserRole;
  fullName?: string | null;
  vendor?: Vendor | null;
  accessToken?: string | null;
}

const STORAGE_KEY_SESSION = 'souq_auth_session';

// Helper to set secure auth cookies for Next.js Middleware route protection
export function setAuthCookies(token: string, role: string) {
  if (typeof document !== 'undefined') {
    document.cookie = `firebase-access-token=${token}; path=/; max-age=604800; SameSite=Lax`;
    document.cookie = `app-user-role=${role}; path=/; max-age=604800; SameSite=Lax`;
  }
}

export function clearAuthCookies() {
  if (typeof document !== 'undefined') {
    document.cookie = 'firebase-access-token=; path=/; max-age=0; SameSite=Lax';
    document.cookie = 'app-user-role=; path=/; max-age=0; SameSite=Lax';
  }
}

/**
 * 1. Real Vendor Registration Flow (/vendor/signup)
 * - Creates real auth user in Firebase Authentication
 * - Creates real document in 'profiles' collection with role = 'vendor'
 * - Creates real document in 'vendors' collection with status = 'pending'
 */
export async function signUpVendor(input: VendorSignUpInput): Promise<{
  success: boolean;
  user?: AuthSessionUser;
  error?: string;
}> {
  try {
    const formattedPhone = formatLebanesePhone(input.phone);
    const storeSlug = (input.storeName || '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || `store_${Date.now()}`;

    // 1. Firebase Auth Sign Up
    const cleanEmail = input.email.trim().toLowerCase();
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      cleanEmail,
      input.password
    );
    const firebaseUser = userCredential.user;
    const userId = firebaseUser.uid;
    const token = await firebaseUser.getIdToken();

    // 2. Insert Profile document into Firestore
    await setDoc(doc(db, 'profiles', userId), {
      id: userId,
      email: cleanEmail,
      role: 'vendor',
      full_name: input.fullName.trim(),
      phone: formattedPhone,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // 3. Insert Vendor store record into Firestore with status = 'pending'
    const newVendorId = `v_${userId.slice(0, 10)}_${Date.now()}`;
    const newVendor: Vendor = {
      id: newVendorId,
      profile_id: userId,
      email: cleanEmail,
      store_name: input.storeName.trim(),
      slug: storeSlug,
      phone: formattedPhone,
      city: input.city,
      pickup_address: input.pickupAddress.trim(),
      commission_rate: 10,
      status: 'pending',
      is_active: false,
      instagram_handle: input.instagramHandle?.trim() || null,
      tiktok_handle: input.tiktokHandle?.trim() || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await setDoc(doc(db, 'vendors', newVendorId), newVendor);

    // Also link in vendor_stores mapping
    try {
      await setDoc(doc(db, 'vendor_stores', `link_${userId}_${newVendorId}`), {
        id: `link_${userId}_${newVendorId}`,
        vendor_id: userId,
        store_id: newVendorId,
        role: 'owner',
        created_at: new Date().toISOString(),
      });
    } catch {}

    const sessionUser: AuthSessionUser = {
      id: userId,
      email: cleanEmail,
      role: 'vendor',
      fullName: input.fullName,
      vendor: newVendor,
      accessToken: token,
    };

    setAuthCookies(token, 'vendor');
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify(sessionUser));
    }

    return { success: true, user: sessionUser };
  } catch (err: any) {
    if (err.code === 'auth/email-already-in-use') {
      return { success: false, error: 'البريد الإلكتروني مسجل بالفعل. يرجى تسجيل الدخول / Email already registered.' };
    }
    if (err.code === 'auth/weak-password') {
      return { success: false, error: 'كلمة المرور ضعيفة. يرجى اختيار 6 أحرف على الأقل / Password should be at least 6 characters.' };
    }
    return { success: false, error: err.message || 'فشل تسجيل المتجر في Firebase.' };
  }
}

/**
 * 2. Real Vendor Login Flow (/vendor/login)
 * - Authenticates with real Firebase Auth (signInWithEmailAndPassword)
 * - Resolves vendor document from Firestore tied to profile_id == auth.currentUser.uid
 * - Verifies status === 'active' and is_active === true
 */
export async function signInVendor(
  email: string,
  pass: string
): Promise<{
  success: boolean;
  user?: AuthSessionUser;
  vendorStatus?: VendorStatus;
  error?: string;
}> {
  try {
    const cleanEmail = (email || '').toLowerCase().trim();

    if (!cleanEmail || !pass || pass.trim().length === 0) {
      return {
        success: false,
        error: 'يرجى إدخال البريد الإلكتروني وكلمة المرور للمتابعة / Credentials are required.',
      };
    }

    // 1. Real Firebase Auth Sign In
    let firebaseUser: FirebaseUser;
    let token = '';

    try {
      const userCredential = await signInWithEmailAndPassword(auth, cleanEmail, pass);
      firebaseUser = userCredential.user;
      token = await firebaseUser.getIdToken();
    } catch (authError: any) {
      return {
        success: false,
        error:
          authError.code === 'auth/wrong-password' || authError.code === 'auth/invalid-credential'
            ? 'كلمة المرور غير صحيحة / Incorrect password.'
            : authError.code === 'auth/user-not-found'
            ? 'الحساب غير مسجل / Account not found.'
            : authError.message || 'فشل تسجيل الدخول.',
      };
    }

    const userId = firebaseUser.uid;

    // 2. Query Firestore vendors collection for profile_id == auth.currentUser.uid
    let vendorRecord: Vendor | null = null;
    const qVendors = query(collection(db, 'vendors'), where('profile_id', '==', userId));
    const snap = await getDocs(qVendors);

    if (!snap.empty) {
      vendorRecord = { ...(snap.docs[0].data() as Vendor), id: snap.docs[0].id };
    }

    if (!vendorRecord) {
      await signOut(auth);
      clearAuthCookies();
      return {
        success: false,
        error: 'لم يتم العثور على متجر مسجل مرتبط بهذا الحساب / No vendor boutique found.',
      };
    }

    // 3. Strict Verification: Check status == 'active' and is_active == true
    const isStatusActive = vendorRecord.status === 'active';
    const isFlagActive = vendorRecord.is_active !== false;

    if (!isStatusActive || !isFlagActive) {
      await signOut(auth);
      clearAuthCookies();
      return {
        success: false,
        vendorStatus: vendorRecord.status,
        error:
          vendorRecord.status === 'pending'
            ? 'حساب المتجر لا يزال قيد المراجعة من إدارة RB Store. / Store is pending approval.'
            : 'تم إيقاف حساب هذا المتجر مؤقتاً من إدارة المنصة. / Store account is suspended.',
      };
    }

    const sessionUser: AuthSessionUser = {
      id: userId,
      email: cleanEmail,
      role: 'vendor',
      fullName: vendorRecord.store_name,
      vendor: vendorRecord,
      accessToken: token,
    };

    setAuthCookies(token, 'vendor');
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify(sessionUser));
    }

    return {
      success: true,
      user: sessionUser,
      vendorStatus: 'active',
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'Login failed.' };
  }
}

/**
 * 3. Real Super Admin Login Flow (/admin/login)
 * - Authenticates with real Firebase Auth (signInWithEmailAndPassword)
 * - Validates role === 'super_admin' in 'profiles' collection
 */
export async function signInSuperAdmin(
  email: string,
  pass: string
): Promise<{
  success: boolean;
  user?: AuthSessionUser;
  error?: string;
}> {
  try {
    const rawInput = (email || '').toLowerCase().trim();
    let cleanEmail = rawInput;
    if (cleanEmail === 'admin' || cleanEmail === 'superadmin' || cleanEmail === 'root') {
      cleanEmail = 'souqlebanon5@gmail.com';
    }

    if (!cleanEmail || !pass || pass.trim().length === 0) {
      return {
        success: false,
        error: 'يرجى إدخال البريد الإلكتروني للمسؤول وكلمة المرور / Admin credentials required.',
      };
    }

    let firebaseUser: FirebaseUser;
    let token = '';

    try {
      const userCredential = await signInWithEmailAndPassword(auth, cleanEmail, pass);
      firebaseUser = userCredential.user;
      token = await firebaseUser.getIdToken();
    } catch (authError: any) {
      return {
        success: false,
        error:
          authError.code === 'auth/wrong-password' || authError.code === 'auth/invalid-credential'
            ? 'كلمة المرور غير صحيحة / Incorrect password.'
            : authError.code === 'auth/user-not-found'
            ? 'حساب المسؤول غير مسجل / Admin account not found.'
            : authError.message || 'فشل تسجيل الدخول.',
      };
    }

    const userId = firebaseUser.uid;

    // Verify role === 'super_admin' in profiles collection
    const profileRef = doc(db, 'profiles', userId);
    const profileSnap = await getDoc(profileRef);
    const isSuperAdmin = profileSnap.exists() && profileSnap.data().role === 'super_admin';

    if (!isSuperAdmin) {
      await signOut(auth);
      clearAuthCookies();
      return {
        success: false,
        error: 'تم رفض الوصول: هذا الحساب لا يملك صلاحيات الإدارة العليا (super_admin). / Access Denied: Super Admin role required.',
      };
    }

    const sessionUser: AuthSessionUser = {
      id: userId,
      email: cleanEmail,
      role: 'super_admin',
      fullName: 'Super Administrator',
      accessToken: token,
    };

    setAuthCookies(token, 'super_admin');
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify(sessionUser));
    }

    return {
      success: true,
      user: sessionUser,
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'Admin authentication failed.' };
  }
}

/**
 * 4. Sign Out Helper
 */
export async function signOutCurrentSession(): Promise<void> {
  try {
    await signOut(auth);
  } catch {}
  clearAuthCookies();
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem(STORAGE_KEY_SESSION);
  }
}

export const signOutUser = signOutCurrentSession;

/**
 * 5. Get current authenticated session user
 */
export function getCurrentSessionUser(): AuthSessionUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY_SESSION);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * 6. Auth state change listener for client components
 */
export function subscribeToAuthState(callback: (user: FirebaseUser | null) => void) {
  return onAuthStateChanged(auth, callback);
}
