'use client';

import React, { useState, useEffect } from 'react';
import { 
  X, 
  ShoppingBag, 
  Store, 
  Truck, 
  ShieldCheck, 
  Plus, 
  Minus, 
  Check, 
  MapPin, 
  DollarSign, 
  CreditCard,
  Share2,
  Trash2
} from 'lucide-react';
import type { ProductWithVendor } from '@/src/types/database';
import { useI18n } from '@/src/lib/i18nContext';
import { getDeliveryFee, getFreeDeliveryEnabled, getFreeDeliveryThreshold } from '@/src/lib/adminSettings';
import { getStorageImageUrl } from '@/src/lib/storage';
import { deleteProductFromDB } from '@/src/lib/databaseService';
import { getProductCustomerPrice, computeProductPricing } from '@/src/lib/pricingService';

interface ProductDetailsModalProps {
  product: ProductWithVendor | null;
  isOpen: boolean;
  onClose: () => void;
  onAddToCart: (product: ProductWithVendor, variantId?: string, quantity?: number) => void;
  onSelectStore?: (storeId: string) => void;
  isAdmin?: boolean;
  onDeleteProduct?: (productId: string) => void;
}

export const ProductDetailsModal: React.FC<ProductDetailsModalProps> = ({
  product,
  isOpen,
  onClose,
  onAddToCart,
  onSelectStore,
  isAdmin,
  onDeleteProduct,
}) => {
  const { locale, dir } = useI18n();
  const isAr = locale === 'ar';
  const isRtl = dir === 'rtl';

  const [selectedVariantId, setSelectedVariantId] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number>(0);
  const [showAddedFeedback, setShowAddedFeedback] = useState<boolean>(false);

  useEffect(() => {
    if (product) {
      setSelectedVariantId(product.variants[0]?.id || '');
      setQuantity(1);
      setSelectedImageIndex(0);
      setShowAddedFeedback(false);
    }
  }, [product]);

  if (!isOpen || !product) return null;

  const currentVariant = product.variants.find(v => v.id === selectedVariantId) || product.variants[0];
  const pricing = getProductCustomerPrice(product, currentVariant?.id);
  const unitPrice = pricing.customerSellingPrice;
  const totalPrice = Number((unitPrice * quantity).toFixed(2));
  const isOutOfStock = product.in_stock === false;
  const lbpApprox = Math.round(totalPrice * 89500).toLocaleString('en-US');

  const deliveryRate = getDeliveryFee();
  const freeEnabled = getFreeDeliveryEnabled();
  const freeThreshold = getFreeDeliveryThreshold();

  const rawImages = product.images && product.images.length > 0
    ? product.images
    : ['/images/product_linen_shirt.png'];
  const images = rawImages.map(img => getStorageImageUrl(img));

  const handleAdd = () => {
    if (isOutOfStock) return;
    onAddToCart(product, currentVariant?.id, quantity);
    setShowAddedFeedback(true);
    setTimeout(() => {
      setShowAddedFeedback(false);
      onClose();
    }, 900);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] border border-stone-200/80"
        dir={dir}
      >
        {/* Top Vibrant Accent Ribbon */}
        <div className="h-1.5 w-full bg-gradient-to-r from-rose-500 via-pink-500 to-amber-400 shrink-0" />

        {/* Header Bar */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-stone-100 bg-white">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-rose-50 text-[#FF2A6D] border border-rose-200/80">
              <span className="w-2 h-2 rounded-full bg-[#FF2A6D] animate-pulse" />
              {isAr ? 'تفاصيل القطعة والمقاسات' : 'Product & Boutique Details'}
            </span>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-500 hover:text-stone-800 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 text-start">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
            {/* Gallery Section */}
            <div className="space-y-3">
              <div className="relative aspect-4/5 w-full rounded-2xl overflow-hidden bg-stone-100 border border-stone-200/80 shadow-xs">
                <img
                  src={images[selectedImageIndex] || images[0]}
                  alt={product.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />

                {/* Stock Badge Overlay */}
                <div className="absolute top-3 start-3">
                  {isOutOfStock ? (
                    <span className="px-3 py-1 bg-rose-600/95 text-white text-[11px] font-black rounded-lg shadow-sm">
                      {isAr ? 'نفدت الكمية (Out of Stock)' : 'Out of Stock'}
                    </span>
                  ) : (
                    <span className="px-3 py-1 bg-emerald-600/95 text-white text-[11px] font-black rounded-lg shadow-sm">
                      {isAr ? 'متوفر وجاهز للشحن' : 'In Stock & Ready'}
                    </span>
                  )}
                </div>

                <div className="absolute bottom-3 end-3 bg-black/80 backdrop-blur-xs text-white px-3 py-1 rounded-xl text-xs font-mono font-black shadow-xs">
                  ${unitPrice.toFixed(2)} USD
                </div>
              </div>

              {/* Thumbnails */}
              {images.length > 1 && (
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  {images.map((img, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedImageIndex(idx)}
                      className={`relative w-14 h-14 rounded-xl overflow-hidden border-2 transition-all cursor-pointer shrink-0 ${
                        selectedImageIndex === idx ? 'border-[#FF2A6D] scale-105 shadow-xs' : 'border-stone-200 opacity-70 hover:opacity-100'
                      }`}
                    >
                      <img src={img} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Product Meta & Actions */}
            <div className="flex flex-col justify-between space-y-4">
              <div className="space-y-3.5">
                {/* Store Tag */}
                <button
                  onClick={() => {
                    if (onSelectStore) {
                      onSelectStore(product.vendor.id);
                      onClose();
                    }
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-rose-50 to-pink-50 hover:from-rose-100 hover:to-pink-100 text-stone-900 text-xs font-bold rounded-xl border border-rose-200/70 transition-all cursor-pointer shadow-2xs"
                >
                  <Store className="w-3.5 h-3.5 text-[#FF2A6D]" />
                  <span>{product.vendor.store_name}</span>
                  <span className="text-stone-300">·</span>
                  <span className="text-stone-500 text-[11px] font-medium">{product.vendor.city}</span>
                </button>

                <h2 className="text-xl sm:text-2xl font-black text-stone-900 leading-snug tracking-tight">
                  {product.title}
                </h2>

                {/* Price Display */}
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black text-[#FF2A6D] font-mono tracking-tight">
                    ${unitPrice.toFixed(2)}
                  </span>
                  <span className="text-xs font-semibold text-stone-500">
                    (~{Math.round(unitPrice * 89500).toLocaleString('en-US')} {isAr ? 'ل.ل' : 'LBP'})
                  </span>
                </div>

                {/* Description */}
                <div className="text-xs text-stone-600 leading-relaxed bg-stone-50/80 p-3.5 rounded-2xl border border-stone-200/80">
                  {product.description || (isAr ? 'منتج مميز بجودة عالية من المتاجر المحلية اللبنانية.' : 'High-quality curated piece from local independent Lebanese boutiques.')}
                </div>

                {/* Variants Selector */}
                {product.variants.length > 0 && (
                  <div className="space-y-2">
                    <label className="text-xs font-black text-stone-800 block">
                      {isAr ? 'المقاس / الخيار المطلوب:' : 'Select Variant / Size:'}
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {product.variants.map((v) => {
                        const isSelected = v.id === selectedVariantId;
                        const vPricing = computeProductPricing(v.price_override ?? product.base_price, product.vendor?.commission_rate ?? 10);
                        const vPrice = vPricing.customerSellingPrice;
                        return (
                          <button
                            key={v.id}
                            onClick={() => setSelectedVariantId(v.id)}
                            className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-[#FF2A6D] text-white border-[#FF2A6D] shadow-md shadow-[#FF2A6D]/25 scale-102'
                                : 'bg-stone-50 text-stone-700 border-stone-200 hover:border-stone-300 hover:bg-stone-100'
                            }`}
                          >
                            <span>{v.name}</span>
                            {v.price_override && v.price_override !== product.base_price && (
                              <span className="ms-1.5 text-[10px] opacity-80 font-mono">(${vPrice.toFixed(2)})</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Quantity Selector */}
                {!isOutOfStock && (
                  <div className="space-y-2">
                    <label className="text-xs font-black text-stone-800 block">
                      {isAr ? 'الكمية المطلوبة:' : 'Quantity:'}
                    </label>
                    <div className="flex items-center gap-3">
                      <div className="inline-flex items-center border border-stone-200 rounded-xl bg-stone-50/80 p-1">
                        <button
                          onClick={() => setQuantity(q => Math.max(1, q - 1))}
                          disabled={quantity <= 1}
                          className="w-7 h-7 flex items-center justify-center rounded-lg text-stone-600 hover:bg-white hover:shadow-xs disabled:opacity-30 cursor-pointer transition-all"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-9 text-center font-mono font-bold text-sm text-stone-900">
                          {quantity}
                        </span>
                        <button
                          onClick={() => setQuantity(q => q + 1)}
                          className="w-7 h-7 flex items-center justify-center rounded-lg text-stone-600 hover:bg-white hover:shadow-xs cursor-pointer transition-all"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <span className="text-xs font-semibold text-stone-600">
                        {isAr ? 'المجموع:' : 'Subtotal:'}{' '}
                        <span className="font-mono font-black text-stone-950 text-sm">${totalPrice.toFixed(2)} USD</span>
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Guarantees & Badges */}
              <div className="space-y-2 pt-2 border-t border-stone-100 text-xs">
                <div className="flex items-center gap-2 text-stone-700 font-medium">
                  <Truck className="w-4 h-4 text-[#FF2A6D]" />
                  <span>
                    {freeEnabled 
                      ? (isAr ? `توصيل مجاني للطلبات فوق $${freeThreshold} (ديليفري عادي $${deliveryRate})` : `Free delivery over $${freeThreshold} (Flat $${deliveryRate} otherwise)`)
                      : (isAr ? `توصيل موحد $${deliveryRate} لكل لبنان مهما تعددت المتاجر` : `Flat $${deliveryRate} Delivery Everywhere in Lebanon`)}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-emerald-700 font-medium">
                  <CreditCard className="w-4 h-4 text-emerald-600" />
                  <span>{isAr ? 'الدفع كاش عند الاستلام أو عبر ويش موني' : 'Cash on Delivery or Whish Money'}</span>
                </div>
              </div>

              {/* Super Admin Action: Delete Product */}
              {isAdmin && (
                <div className="p-3 bg-rose-50 border border-rose-200/90 rounded-2xl flex items-center justify-between gap-3 text-xs">
                  <div>
                    <span className="font-bold text-rose-950 block">
                      {isAr ? 'صلاحيات الإدارة (Super Admin):' : 'Super Admin Action:'}
                    </span>
                    <span className="text-[11px] text-rose-700">
                      {isAr ? 'حذف هذا المنتج بالكامل من المنصة وقاعدة البيانات.' : 'Delete this item from Firestore permanently.'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      if (confirm(isAr ? `تأكيد كمسؤول: هل أنت متأكد من حذف المنتج "${product.title}" نهائياً من المنصة؟` : `Admin Confirm: Permanently delete product "${product.title}"?`)) {
                        await deleteProductFromDB(product.id);
                        if (onDeleteProduct) onDeleteProduct(product.id);
                        onClose();
                      }
                    }}
                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white rounded-xl font-bold cursor-pointer shrink-0 shadow-xs flex items-center gap-1.5 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{isAr ? 'حذف كمسؤول' : 'Delete'}</span>
                  </button>
                </div>
              )}

              {/* Action Button */}
              <div className="pt-2">
                <button
                  onClick={handleAdd}
                  disabled={isOutOfStock}
                  className={`w-full py-4 px-5 rounded-2xl text-sm font-black flex items-center justify-center gap-2.5 transition-all shadow-lg cursor-pointer ${
                    isOutOfStock
                      ? 'bg-stone-200 text-stone-400 cursor-not-allowed shadow-none'
                      : showAddedFeedback
                      ? 'bg-emerald-600 text-white shadow-emerald-500/25 scale-98'
                      : 'bg-[#FF2A6D] hover:bg-[#E01E5A] active:scale-98 text-white shadow-[#FF2A6D]/25'
                  }`}
                >
                  {isOutOfStock ? (
                    <span>{isAr ? 'نفدت الكمية حالياً (Out of Stock)' : 'Currently Out of Stock'}</span>
                  ) : showAddedFeedback ? (
                    <>
                      <Check className="w-5 h-5 text-white" />
                      <span>{isAr ? 'تمت الإضافة إلى السلة بنجاح!' : 'Added to Bag!'}</span>
                    </>
                  ) : (
                    <>
                      <ShoppingBag className="w-5 h-5" />
                      <span>
                        {isAr
                          ? `أضف إلى السلة — $${totalPrice.toFixed(2)} USD`
                          : `Add to Bag — $${totalPrice.toFixed(2)} USD`}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
