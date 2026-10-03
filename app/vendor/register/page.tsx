'use client';

import React, { useState } from 'react';
import { 
  Store, 
  MapPin, 
  Phone, 
  Instagram, 
  CheckCircle2, 
  Clock, 
  ArrowRight,
  ShieldCheck,
  Package,
  Layers,
  Sparkles
} from 'lucide-react';
import type { Vendor } from '@/src/types/database';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';

interface VendorRegisterProps {
  onRegistered?: (newVendor: Vendor) => void;
}

export default function VendorRegisterPage({ onRegistered }: VendorRegisterProps) {
  const [storeName, setStoreName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('Beirut - Achrafieh');
  const [pickupAddress, setPickupAddress] = useState('');
  const [instagramHandle, setInstagramHandle] = useState('');
  const [tiktokHandle, setTiktokHandle] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [registeredVendor, setRegisteredVendor] = useState<Vendor | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeName || !phone || !pickupAddress) return;

    setIsSubmitting(true);
    await new Promise(r => setTimeout(r, 600));

    const cleanPhone = phone.replace(/\D/g, '');
    const newVendor: Vendor = {
      id: `v_reg_${Date.now()}`,
      store_name: (storeName || '').trim(),
      slug: (storeName || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || `store_${Date.now()}`,
      phone: cleanPhone.startsWith('961') ? cleanPhone : '961' + cleanPhone,
      city,
      pickup_address: pickupAddress.trim(),
      commission_rate: 10.00, // Default pending platform review
      status: 'pending',
      instagram_handle: instagramHandle.trim() || undefined,
      tiktok_handle: tiktokHandle.trim() || undefined,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    try {
      await setDoc(doc(db, 'vendors', newVendor.id), newVendor);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('kooll_vendor_registered', { detail: newVendor }));
      }
    } catch (err) {
      console.warn('Failed saving vendor to Firestore in register page:', err);
    }

    setRegisteredVendor(newVendor);
    if (onRegistered) onRegistered(newVendor);
    setIsSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-stone-50 py-12 px-4 sm:px-6">
      <div className="max-w-xl mx-auto">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-900 text-xs font-semibold rounded-full border border-amber-200/80 mb-3">
            <Store className="w-3.5 h-3.5 text-amber-700" />
            <span>Lebanese Boutique Onboarding</span>
          </div>
          <h1 className="text-3xl font-serif font-bold text-stone-900 tracking-tight">
            Register Your Boutique Store
          </h1>
          <p className="text-sm text-stone-600 mt-2 max-w-md mx-auto">
            Bring your boutique sales to RB Store for delivery across Lebanon.
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-stone-200 p-6 sm:p-8">
          {registeredVendor ? (
            <div className="text-center py-6 space-y-4">
              <div className="w-16 h-16 bg-amber-50 text-amber-800 rounded-full flex items-center justify-center mx-auto ring-8 ring-amber-50/50">
                <Clock className="w-8 h-8 text-amber-700" />
              </div>
              <h2 className="text-xl font-bold text-stone-900">Application Submitted for Review</h2>
              <p className="text-sm text-stone-600 max-w-md mx-auto">
                Thank you, <strong>{registeredVendor.store_name}</strong>! Your boutique registration has been submitted. Our platform Super Admin will verify your Instagram boutique, verify pickup logistics at <strong>{registeredVendor.city}</strong>, and approve your store.
              </p>

              <div className="bg-stone-50 rounded-xl p-4 text-left border border-stone-200 text-xs space-y-2 mt-4">
                <div className="flex justify-between">
                  <span className="text-stone-500">Assigned Boutique Slug:</span>
                  <span className="font-mono font-medium">{registeredVendor.slug}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">WhatsApp Notification Number:</span>
                  <span className="font-mono font-medium">+{registeredVendor.phone}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">Initial Review Status:</span>
                  <span className="font-semibold text-amber-700 uppercase">Pending Approval</span>
                </div>
              </div>

              <div className="pt-4">
                <button
                  onClick={() => setRegisteredVendor(null)}
                  className="text-xs text-amber-900 font-medium hover:underline"
                >
                  Register another boutique
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                  Boutique / Store Name
                </label>
                <input
                  type="text"
                  required
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  placeholder="e.g. Mar Mikhael Artisan Studio"
                  className="w-full px-3.5 py-2.5 bg-white border border-stone-300 rounded-lg text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-800/20 focus:border-amber-800 transition-colors"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1.5 flex items-center gap-1.5">
                    <Instagram className="w-3.5 h-3.5 text-stone-400" />
                    <span>Instagram Handle</span>
                  </label>
                  <input
                    type="text"
                    value={instagramHandle}
                    onChange={(e) => setInstagramHandle(e.target.value)}
                    placeholder="@yourboutique"
                    className="w-full px-3.5 py-2.5 bg-white border border-stone-300 rounded-lg text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-800/20 focus:border-amber-800 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                    TikTok Handle (Optional)
                  </label>
                  <input
                    type="text"
                    value={tiktokHandle}
                    onChange={(e) => setTiktokHandle(e.target.value)}
                    placeholder="@yourboutique_lb"
                    className="w-full px-3.5 py-2.5 bg-white border border-stone-300 rounded-lg text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-800/20 focus:border-amber-800 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1.5 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-stone-400" />
                  <span>WhatsApp Dispatch & Orders Phone</span>
                </label>
                <div className="flex">
                  <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-stone-300 bg-stone-100 text-stone-600 text-xs font-mono">
                    🇱🇧 +961
                  </span>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="71 445 566"
                    className="w-full px-3.5 py-2.5 bg-white border border-stone-300 rounded-r-lg text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-800/20 focus:border-amber-800 transition-colors font-mono"
                  />
                </div>
                <span className="text-[11px] text-stone-500 mt-1 block">
                  Automated pickup notices with item codes will be dispatched to this WhatsApp number.
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1.5 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-stone-400" />
                  <span>City / Governorate</span>
                </label>
                <select
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-stone-300 rounded-lg text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-800/20 focus:border-amber-800 transition-colors"
                >
                  <option value="Beirut (Achrafieh)">Beirut (Achrafieh)</option>
                  <option value="Beirut (Mar Mikhael / Gemmayzeh)">Beirut (Mar Mikhael / Gemmayzeh)</option>
                  <option value="Beirut (Hamra / Verdun)">Beirut (Hamra / Verdun)</option>
                  <option value="Mount Lebanon (Metn / Dbayeh)">Mount Lebanon (Metn / Dbayeh)</option>
                  <option value="Mount Lebanon (Keserwan / Jounieh)">Mount Lebanon (Keserwan / Jounieh)</option>
                  <option value="Mount Lebanon (Chouf / Deir el Qamar)">Mount Lebanon (Chouf / Deir el Qamar)</option>
                  <option value="North (Tripoli / Al-Mina)">North (Tripoli / Al-Mina)</option>
                  <option value="North (Batroun Old Town)">North (Batroun Old Town)</option>
                  <option value="North (Byblos / Jbeil)">North (Byblos / Jbeil)</option>
                  <option value="South (Sidon / Saida)">South (Sidon / Saida)</option>
                  <option value="Bekaa (Zahle / Chtaura)">Bekaa (Zahle / Chtaura)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                  Exact Pickup Address for Logistics Courier
                </label>
                <textarea
                  rows={2}
                  required
                  value={pickupAddress}
                  onChange={(e) => setPickupAddress(e.target.value)}
                  placeholder="Street, Building, Floor/Apt or storefront location in the souk..."
                  className="w-full px-3.5 py-2.5 bg-white border border-stone-300 rounded-lg text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-800/20 focus:border-amber-800 transition-colors"
                />
              </div>

              <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 text-xs text-stone-600 space-y-1">
                <span className="font-semibold text-stone-800 block">How RB Store Partnership Works:</span>
                <p>1. Orders placed by customers are consolidated in our Beirut hub.</p>
                <p>2. You receive an automated WhatsApp notification for each item with a pickup code.</p>
                <p>3. Our courier collects your items, confirms the pickup code, and we pay you directly.</p>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-stone-900 hover:bg-stone-800 active:bg-stone-950 text-white font-medium rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-60"
              >
                {isSubmitting ? (
                  <span>Registering Boutique...</span>
                ) : (
                  <>
                    <span>Submit Application for Approval</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
