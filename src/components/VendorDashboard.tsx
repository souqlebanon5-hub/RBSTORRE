'use client';

import React, { useState } from 'react';
import { 
  Store, 
  Package, 
  CheckCircle2, 
  MapPin, 
  Phone, 
  DollarSign, 
  ShieldCheck, 
  AlertCircle,
  Truck,
  Edit3,
  Plus,
  X,
  Check,
  Tag,
  ExternalLink,
  MessageCircle,
  Clock,
  Image as ImageIcon,
  Upload,
  Camera,
  Trash2,
  Palette,
  Sliders,
  Sparkles,
  Layers,
  LogOut
} from 'lucide-react';
import type { Vendor, OrderItem, ProductWithVendor, ItemStatus, ProductVariant } from '../types/database';
import { useI18n } from '../lib/i18nContext';
import { getAdminWhishPhone } from '../lib/adminSettings';
import { formatLebanesePhone } from '../lib/ultramsg';
import { doc, onSnapshot, collection, query, where, getDocs } from 'firebase/firestore';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { db, auth } from '../lib/firebase';
import { 
  getVendorStores, 
  verifyStoreOwnership, 
  createVendorStore,
  subscribeToVendorOrderItems,
  deleteVendorAccountPermanently,
  deleteProductFromDB,
  saveProductToDB
} from '../lib/databaseService';
import { getCurrentSessionUser, signOutUser } from '../lib/auth';

// Dynamic Custom Attribute Field
export interface CustomAttributeField {
  id: string;
  name: string;        // e.g. "المقاس", "اللون", "الحجم والسعة", "العيار والمعدن", "الخامة"
  values: string[];    // e.g. ["S", "M", "L"], ["50 ml", "100 ml"], ["ذهب 18 قيراط", "فضة 925"]
}

// Category-specific default attribute fields for Lebanese Boutique items (No food or sweets)
export const CATEGORY_DEFAULT_FIELDS: Record<string, CustomAttributeField[]> = {
  Clothes: [
    { id: 'f_size', name: 'المقاس', values: ['S', 'M', 'L', 'XL'] },
    { id: 'f_color', name: 'اللون', values: ['أسود', 'أبيض', 'بيج', 'كحلي'] }
  ],
  Jewelry: [
    { id: 'f_karat', name: 'العيار والمعدن', values: ['ذهب 18 قيراط', 'ذهب 21 قيراط', 'فضة 925'] },
    { id: 'f_length', name: 'المقاس أو الطول', values: ['45 سم', '50 سم'] }
  ],
  Accessories: [
    { id: 'f_karat', name: 'العيار والمعدن', values: ['ذهب 18 قيراط', 'فضة 925'] },
    { id: 'f_length', name: 'المقاس أو الطول', values: ['45 سم', '50 سم'] }
  ],
  Beauty: [
    { id: 'f_vol', name: 'الحجم والسعة', values: ['50 ml', '100 ml'] },
    { id: 'f_conc', name: 'التركيز أو النوع', values: ['Eau de Parfum', 'Intense'] }
  ],
  Tech: [
    { id: 'f_device', name: 'موديل الهاتف', values: ['iPhone 16 Pro Max', 'iPhone 15 Pro', 'iPhone 14'] },
    { id: 'f_finish', name: 'اللون أو المظهر', values: ['تيتانيوم طبيعي', 'أسود فاحم', 'شفاف'] }
  ],
  Gifts: [
    { id: 'f_material', name: 'الخامة أو النوع', values: ['خشب أرز طبيعي', 'رخام حرفي', 'جلد طبيعي'] },
    { id: 'f_size_gift', name: 'الحجم أو المقاس', values: ['حجم وسط', 'حجم كبير'] }
  ]
};

// 1-click presets for boutique categories
const ATTRIBUTE_PRESETS = [
  {
    categoryKey: 'Clothes',
    title: '👗 أزياء وملابس (مقاسات وألوان)',
    fields: CATEGORY_DEFAULT_FIELDS.Clothes
  },
  {
    categoryKey: 'Jewelry',
    title: '💍 مجوهرات وإكسسوارات (عيار ومقاس)',
    fields: CATEGORY_DEFAULT_FIELDS.Jewelry
  },
  {
    categoryKey: 'Beauty',
    title: '🧴 عناية وعطور ومكياج (أحجام وسعات)',
    fields: CATEGORY_DEFAULT_FIELDS.Beauty
  },
  {
    categoryKey: 'Tech',
    title: '📱 كفرات وإلكترونيات (موديلات وتصاميم)',
    fields: CATEGORY_DEFAULT_FIELDS.Tech
  },
  {
    categoryKey: 'Gifts',
    title: '🎁 هدايا وحرف وديكور (خامات وأحجام)',
    fields: CATEGORY_DEFAULT_FIELDS.Gifts
  }
];

// Helper to compute Cartesian product combinations of all active fields
function generateVariantsFromFields(fields: CustomAttributeField[]): string[] {
  const activeFields = fields.filter(f => f.name.trim() && f.values.length > 0);
  if (activeFields.length === 0) {
    return ['قياس موحد (Standard)'];
  }

  // If only 1 field is defined, use its values directly
  if (activeFields.length === 1) {
    return [...activeFields[0].values];
  }

  // If multiple fields, generate all combinations joined with " / "
  let combos: string[][] = [[]];
  for (const field of activeFields) {
    const nextCombos: string[][] = [];
    for (const prefix of combos) {
      for (const val of field.values) {
        nextCombos.push([...prefix, val]);
      }
    }
    combos = nextCombos;
  }

  return combos.map(c => c.join(' / '));
}

// Reusable Dynamic Attributes & Options Builder Component
interface DynamicAttributesEditorProps {
  isAr: boolean;
  fields: CustomAttributeField[];
  onChangeFields: (newFields: CustomAttributeField[]) => void;
  variantsList: string[];
  onChangeVariantsList: (variants: string[]) => void;
  categoryName?: string;
}

const DynamicAttributesEditor: React.FC<DynamicAttributesEditorProps> = ({
  isAr,
  fields,
  onChangeFields,
  variantsList,
  onChangeVariantsList,
  categoryName
}) => {
  const [newValueInputs, setNewValueInputs] = useState<Record<string, string>>({});
  const [newFieldNameInput, setNewFieldNameInput] = useState('');
  const [customVariantInput, setCustomVariantInput] = useState('');

  // Add a new empty attribute group
  const handleAddField = (name?: string, initialValues: string[] = []) => {
    const fieldName = (name || newFieldNameInput).trim();
    if (!fieldName) return;
    const newField: CustomAttributeField = {
      id: `f_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: fieldName,
      values: initialValues
    };
    const updated = [...fields, newField];
    onChangeFields(updated);
    setNewFieldNameInput('');
    onChangeVariantsList(generateVariantsFromFields(updated));
  };

  // Remove an entire attribute field
  const handleRemoveField = (fieldId: string) => {
    const updated = fields.filter(f => f.id !== fieldId);
    onChangeFields(updated);
    onChangeVariantsList(generateVariantsFromFields(updated));
  };

  // Rename an attribute field
  const handleRenameField = (fieldId: string, newName: string) => {
    const updated = fields.map(f => f.id === fieldId ? { ...f, name: newName } : f);
    onChangeFields(updated);
    onChangeVariantsList(generateVariantsFromFields(updated));
  };

  // Add a value to a field
  const handleAddValue = (fieldId: string) => {
    const val = (newValueInputs[fieldId] || '').trim();
    if (!val) return;
    const updated = fields.map(f => {
      if (f.id === fieldId && !f.values.includes(val)) {
        return { ...f, values: [...f.values, val] };
      }
      return f;
    });
    onChangeFields(updated);
    setNewValueInputs(prev => ({ ...prev, [fieldId]: '' }));
    onChangeVariantsList(generateVariantsFromFields(updated));
  };

  // Remove a value from a field
  const handleRemoveValue = (fieldId: string, valToRemove: string) => {
    const updated = fields.map(f => {
      if (f.id === fieldId) {
        return { ...f, values: f.values.filter(v => v !== valToRemove) };
      }
      return f;
    });
    onChangeFields(updated);
    onChangeVariantsList(generateVariantsFromFields(updated));
  };

  // Apply a template preset
  const handleApplyPreset = (preset: typeof ATTRIBUTE_PRESETS[0]) => {
    const newFields = preset.fields.map((f, i) => ({
      id: `f_${Date.now()}_${i}`,
      name: f.name,
      values: [...f.values]
    }));
    onChangeFields(newFields);
    onChangeVariantsList(generateVariantsFromFields(newFields));
  };

  // Clear all fields
  const handleClearAll = () => {
    onChangeFields([]);
    onChangeVariantsList(['قياس موحد (Standard)']);
  };

  // Add a standalone custom variant directly
  const handleAddCustomVariant = () => {
    const v = customVariantInput.trim();
    if (!v) return;
    if (!variantsList.includes(v)) {
      onChangeVariantsList([...variantsList, v]);
    }
    setCustomVariantInput('');
  };

  // Remove a generated variant
  const handleRemoveVariant = (variantName: string) => {
    onChangeVariantsList(variantsList.filter(v => v !== variantName));
  };

  return (
    <div className="bg-stone-50 border border-stone-200 rounded-2xl p-4 space-y-4">
      {/* Header with Title and Count */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-stone-200/80">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-900 flex items-center justify-center shrink-0">
            <Sliders className="w-4 h-4" />
          </div>
          <div>
            <h4 className="font-bold text-stone-900 text-xs sm:text-sm">
              {isAr ? 'خانات وخصائص المنتج (يتم تهيئتها بحسب القسم ويمكنك تعديلها بحرية):' : 'Custom Product Attributes (Configured by Category & Fully Editable):'}
            </h4>
            <p className="text-[11px] text-stone-500">
              {isAr ? 'تتحدد الخانات تلقائياً بحسب القسم المختار ويمكنك إضافة أي خانة جديدة أو حذف وتعديل أي قيمة.' : 'Fields are auto-set based on category. You can add, rename, or delete any field freely.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono font-bold text-stone-600 bg-white border border-stone-200 px-2 py-0.5 rounded-lg">
            {fields.length} {isAr ? 'خانات' : 'fields'}
          </span>
          <span className="text-[11px] font-mono font-bold text-amber-900 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-lg">
            {variantsList.length} {isAr ? 'خيارات ناتجة' : 'options'}
          </span>
        </div>
      </div>

      {/* Quick Category Templates Bar */}
      <div>
        <span className="text-[11px] font-bold text-stone-600 mb-1.5 block">
          {isAr ? '⚡ تبديل سريع لقوالب الخانات حسب نوع القطعة:' : '⚡ Quick Templates by Category:'}
        </span>
        <div className="flex flex-wrap gap-1.5">
          {ATTRIBUTE_PRESETS.map((preset, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleApplyPreset(preset)}
              className="px-2.5 py-1 bg-white hover:bg-stone-100 border border-stone-200 text-stone-700 rounded-lg text-xs font-semibold transition-all cursor-pointer shadow-2xs"
            >
              {preset.title}
            </button>
          ))}
          <button
            type="button"
            onClick={handleClearAll}
            className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 rounded-lg text-xs font-bold transition-all cursor-pointer"
          >
            {isAr ? '🗑️ تفريغ كافة الخانات' : 'Clear All'}
          </button>
        </div>
      </div>

      {/* List of Attribute Fields */}
      <div className="space-y-3">
        {fields.length === 0 ? (
          <div className="text-center py-6 bg-white rounded-xl border border-dashed border-stone-300 p-4">
            <Tag className="w-6 h-6 text-stone-300 mx-auto mb-1.5" />
            <p className="text-xs text-stone-500 font-medium">
              {isAr ? 'لم تقم بإضافة خانات خصائص بعد. المنتج سيعتبر قياس موحد أو يمكنك إضافة خانات أدناه.' : 'No attributes added. Product will be Free Size / Standard or add fields below.'}
            </p>
          </div>
        ) : (
          fields.map((field, idx) => (
            <div
              key={field.id}
              className="bg-white p-3.5 rounded-xl border border-stone-200/90 shadow-2xs space-y-2.5 text-start"
            >
              {/* Field Header: Name input + Delete button */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="w-5 h-5 rounded-md bg-stone-100 text-stone-600 font-mono text-xs font-bold flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>
                  <label className="text-xs font-bold text-stone-600 shrink-0">
                    {isAr ? 'اسم الخانة:' : 'Field Name:'}
                  </label>
                  <input
                    type="text"
                    value={field.name}
                    onChange={(e) => handleRenameField(field.id, e.target.value)}
                    placeholder={isAr ? 'مثال: المقاس، الحجم، العيار، الخامة...' : 'Field name (e.g. Size, Karat)'}
                    className="px-2.5 py-1 bg-stone-50 hover:bg-white focus:bg-white border border-stone-200 focus:border-stone-800 rounded-lg text-xs font-bold text-stone-900 focus:outline-none w-full max-w-xs transition-colors"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => handleRemoveField(field.id)}
                  className="inline-flex items-center gap-1 text-[11px] text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2 py-1 rounded-md font-bold transition-colors cursor-pointer shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{isAr ? 'حذف الخانة' : 'Delete Field'}</span>
                </button>
              </div>

              {/* Values of this field (Pills) */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                {field.values.map((val) => (
                  <span
                    key={val}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 border border-amber-200 text-amber-950 rounded-lg text-xs font-semibold"
                  >
                    <span>{val}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveValue(field.id, val)}
                      className="hover:text-rose-600 text-stone-400 p-0.5 cursor-pointer text-xs"
                      title={isAr ? 'حذف هذه القيمة' : 'Remove value'}
                    >
                      ✕
                    </button>
                  </span>
                ))}

                {field.values.length === 0 && (
                  <span className="text-[11px] text-stone-400 italic">
                    {isAr ? 'لا توجد خيارات مضافة لهذه الخانة بعد.' : 'No values added yet.'}
                  </span>
                )}
              </div>

              {/* Add value to this field input */}
              <div className="flex items-center gap-2 pt-1 border-t border-stone-100">
                <input
                  type="text"
                  placeholder={isAr ? `أضف خياراً لـ (${field.name})... واضغط إضافة` : `Add value for (${field.name})...`}
                  value={newValueInputs[field.id] || ''}
                  onChange={(e) => setNewValueInputs({ ...newValueInputs, [field.id]: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddValue(field.id);
                    }
                  }}
                  className="px-2.5 py-1.5 bg-stone-50 border border-stone-200 rounded-lg text-xs text-stone-800 focus:bg-white focus:outline-none focus:border-stone-800 flex-1 max-w-sm"
                />
                <button
                  type="button"
                  onClick={() => handleAddValue(field.id)}
                  className="px-3 py-1.5 bg-stone-800 hover:bg-black text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
                >
                  {isAr ? '+ إضافة' : '+ Add'}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Button to Add a New Custom Attribute Field */}
      <div className="pt-2 border-t border-stone-200 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        <input
          type="text"
          placeholder={isAr ? 'اسم خانة جديدة (مثال: العيار، الخامة، المقاس، الحجم، نوع القماش...)' : 'New attribute name (e.g. Karat, Material, Size, Volume)...'}
          value={newFieldNameInput}
          onChange={(e) => setNewFieldNameInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleAddField();
            }
          }}
          className="px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs text-stone-900 focus:outline-none focus:border-stone-900 flex-1"
        />
        <button
          type="button"
          onClick={() => handleAddField()}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-amber-900 hover:bg-amber-950 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>{isAr ? '+ إضافة خانة خاصية جديدة' : '+ Add Custom Field'}</span>
        </button>
      </div>

      {/* Customer Visible Output / Generated Variants Preview */}
      <div className="pt-3 border-t border-stone-200/90 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-stone-700 block">
            {isAr ? 'الخيارات التي ستظهر للمشتري في المتجر (انقر ✕ لحذف أي خيار غير متوفر):' : 'Options visible to customers in store (Tap ✕ to remove any):'}
          </span>
          <span className="text-[10px] text-stone-400">
            {variantsList.length} {isAr ? 'خيارات جاهزة' : 'ready options'}
          </span>
        </div>

        <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-2 bg-white rounded-xl border border-stone-200">
          {variantsList.map((vName, idx) => (
            <span
              key={idx}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-stone-100 hover:bg-stone-200 border border-stone-300 text-stone-800 rounded-lg text-xs font-semibold transition-colors"
            >
              <span>{vName}</span>
              <button
                type="button"
                onClick={() => handleRemoveVariant(vName)}
                className="hover:text-rose-600 transition-colors text-stone-400 cursor-pointer text-xs"
                title={isAr ? 'حذف هذا الخيار' : 'Remove option'}
              >
                ✕
              </button>
            </span>
          ))}
        </div>

        {/* Add custom standalone option directly */}
        <div className="flex items-center gap-2 pt-1">
          <input
            type="text"
            placeholder={isAr ? 'أو اكتب خياراً مفرداً مخصصاً مباشرة (مثال: طقم كامل VIP)...' : 'Or add standalone option directly...'}
            value={customVariantInput}
            onChange={(e) => setCustomVariantInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddCustomVariant();
              }
            }}
            className="px-2.5 py-1 bg-white border border-stone-200 rounded-lg text-xs text-stone-800 focus:outline-none focus:border-stone-800 flex-1 max-w-xs"
          />
          <button
            type="button"
            onClick={handleAddCustomVariant}
            className="px-3 py-1 bg-stone-200 hover:bg-stone-300 text-stone-800 text-xs font-bold rounded-lg cursor-pointer transition-colors"
          >
            {isAr ? '+ إضافة خيار مباشر' : '+ Add'}
          </button>
        </div>
      </div>
    </div>
  );
};

interface VendorDashboardProps {
  vendors: Vendor[];
  currentVendorId: string;
  onSelectVendor: (id: string) => void;
  products: ProductWithVendor[];
  onUpdateItemStatus?: (itemId: string, status: ItemStatus) => void;
  onNavigateToRegister: () => void;
  onUpdateProduct?: (updatedProduct: ProductWithVendor) => void;
  onAddProduct?: (newProduct: ProductWithVendor) => void;
  currentUserId?: string;
  currentVendorSession?: Vendor | null;
  onAccountDeleted?: () => void;
  onDeleteProduct?: (productId: string) => void;
  onSignOut?: () => void;
}

function compressImageFile(file: File, maxWidth = 1000, maxHeight = 1000, quality = 0.8): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      if (!dataUrl) {
        resolve('');
        return;
      }
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        } else {
          resolve(dataUrl);
        }
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    };
    reader.onerror = () => resolve('');
    reader.readAsDataURL(file);
  });
}

export const VendorDashboard: React.FC<VendorDashboardProps> = ({
  vendors,
  currentVendorId,
  onSelectVendor,
  products,
  onUpdateItemStatus,
  onNavigateToRegister,
  onUpdateProduct,
  onAddProduct,
  currentUserId,
  currentVendorSession,
  onAccountDeleted,
  onDeleteProduct,
  onSignOut
}) => {
  const { locale, dir } = useI18n();
  const isAr = locale === 'ar';

  const [currentUserUid, setCurrentUserUid] = useState<string | null>(() => auth.currentUser?.uid || getCurrentSessionUser()?.id || null);
  const [ownedStores, setOwnedStores] = useState<Vendor[]>([]);
  const [isLoadingStores, setIsLoadingStores] = useState<boolean>(true);
  const [storeAccessError, setStoreAccessError] = useState<string | null>(null);

  // Track Firebase auth state directly
  React.useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUserUid(user.uid);
      } else {
        const session = getCurrentSessionUser();
        setCurrentUserUid(session?.id || null);
      }
    });
    return () => unsub();
  }, []);

  // Fetch strictly only stores where profile_id == auth.currentUser.uid
  React.useEffect(() => {
    let isMounted = true;
    if (!currentUserUid) {
      setIsLoadingStores(false);
      return;
    }

    setIsLoadingStores(true);
    setStoreAccessError(null);

    const q = query(
      collection(db, 'vendors'),
      where('profile_id', '==', currentUserUid)
    );

    getDocs(q).then((snap) => {
      if (!isMounted) return;
      setIsLoadingStores(false);
      const verifiedStores: Vendor[] = [];
      snap.forEach((d) => {
        const data = d.data() as Vendor;
        verifiedStores.push({ ...data, id: d.id });
      });

      setOwnedStores(verifiedStores);
      if (verifiedStores.length > 0) {
        onSelectVendor(verifiedStores[0].id);
      }
    }).catch((err) => {
      if (!isMounted) return;
      setIsLoadingStores(false);
      console.warn('Failed querying verified stores:', err);
    });

    return () => { isMounted = false; };
  }, [currentUserUid]);

  // Add New Store Modal State
  const [isAddStoreModalOpen, setIsAddStoreModalOpen] = useState<boolean>(false);
  const [newStoreName, setNewStoreName] = useState('');
  const [newStoreCity, setNewStoreCity] = useState('Beirut (Achrafieh)');
  const [newStorePhone, setNewStorePhone] = useState(currentVendorSession?.phone || '96170112233');
  const [newStoreAddress, setNewStoreAddress] = useState('');
  const [newStoreInstagram, setNewStoreInstagram] = useState('');
  const [isCreatingStore, setIsCreatingStore] = useState(false);
  const [createStoreError, setCreateStoreError] = useState<string | null>(null);

  // Permanent Account Deletion State
  const [isDeleteAccountModalOpen, setIsDeleteAccountModalOpen] = useState<boolean>(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState<string>('');
  const [isDeletingAccount, setIsDeletingAccount] = useState<boolean>(false);
  const [deleteAccountError, setDeleteAccountError] = useState<string | null>(null);

  const handleDeleteAccount = async (vendorIdToDelete: string) => {
    const requiredWord = isAr ? 'حذف' : 'DELETE';
    if (deleteConfirmationText.trim() !== 'حذف' && deleteConfirmationText.trim().toUpperCase() !== 'DELETE') {
      setDeleteAccountError(isAr ? 'يرجى كتابة كلمة "حذف" في الحقل لتأكيد العملية' : 'Please type "DELETE" to confirm.');
      return;
    }

    if (!currentUserUid) return;

    setIsDeletingAccount(true);
    setDeleteAccountError(null);

    const result = await deleteVendorAccountPermanently(vendorIdToDelete, currentUserUid);
    setIsDeletingAccount(false);

    if (!result.success) {
      setDeleteAccountError(result.error || (isAr ? 'فشل حذف الحساب' : 'Failed to delete account'));
      return;
    }

    setIsDeleteAccountModalOpen(false);
    if (onAccountDeleted) {
      onAccountDeleted();
    } else if (typeof window !== 'undefined') {
      window.location.href = '/';
    }
  };

  // Register an additional store owned by this authenticated user
  const handleCreateNewStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStoreName.trim() || !newStoreAddress.trim() || !currentUserUid) return;

    setIsCreatingStore(true);
    setCreateStoreError(null);

    const result = await createVendorStore(currentUserUid, {
      storeName: newStoreName.trim(),
      city: newStoreCity,
      phone: newStorePhone.trim(),
      pickupAddress: newStoreAddress.trim(),
      instagramHandle: newStoreInstagram.trim() || undefined,
    });

    setIsCreatingStore(false);

    if (!result.success || !result.store) {
      setCreateStoreError(result.error || (isAr ? 'فشل تسجيل المتجر' : 'Failed to register store'));
      return;
    }

    const created = result.store;
    setOwnedStores(prev => [created, ...prev]);
    setIsAddStoreModalOpen(false);
    setNewStoreName('');
    setNewStoreAddress('');
    setNewStoreInstagram('');

    onSelectVendor(created.id);
  };

  // Strict Vendor Resolution: NEVER trust URL query params or component props
  const currentVendor = ownedStores[0] || null;
  const adminWhishPhone = getAdminWhishPhone();
  const [vendorOrderItems, setVendorOrderItems] = useState<OrderItem[]>([]);

  React.useEffect(() => {
    if (!currentVendor?.id) {
      setVendorOrderItems([]);
      return;
    }

    return subscribeToVendorOrderItems(
      currentVendor.id,
      setVendorOrderItems,
      (error) => console.warn('Could not load this store\'s orders:', error)
    );
  }, [currentVendor?.id]);

  // Real-time synchronization of vendor profile & commission rate from Super Admin
  React.useEffect(() => {
    if (!currentVendor?.id) return;
    try {
      const unsub = onSnapshot(doc(db, 'vendors', currentVendor.id), (docSnap) => {
        if (docSnap.exists()) {
          const freshData = docSnap.data();
          if (freshData.commission_rate !== undefined) {
            setOwnedStores(prev =>
              prev.map(s => (s.id === currentVendor.id ? { ...s, ...freshData, commission_rate: Number(freshData.commission_rate) } : s))
            );
          }
        }
      });
      return () => unsub();
    } catch {}
  }, [currentVendor?.id]);

  // Vendor's products & inventory stats
  const vendorProducts = products.filter(p => p.vendor_id === currentVendor?.id);
  const inStockProducts = vendorProducts.filter(p => p.in_stock !== false);
  const outOfStockProducts = vendorProducts.filter(p => p.in_stock === false);

  // Store's Order Items & Commission Calculations
  const totalStoreSales = vendorOrderItems.reduce((sum, item) => sum + (Number(item.unit_price || 0) * Number(item.quantity || 1)), 0);
  const commRate = Number(currentVendor?.commission_rate ?? 10);
  const totalVendorPayout = vendorOrderItems.reduce((sum, item) => {
    const lineTotal = Number(item.unit_price || 0) * Number(item.quantity || 1);
    const payout = (item.vendor_payout !== undefined && item.vendor_payout !== null && Number(item.vendor_payout) > 0)
      ? Number(item.vendor_payout)
      : Number((lineTotal / (1 + (commRate / 100))).toFixed(2));
    return sum + payout;
  }, 0);
  const totalCommissionDeducted = Number((totalStoreSales - totalVendorPayout).toFixed(2));
  const pendingOrdersCount = vendorOrderItems.filter(i => i.item_status === 'awaiting_vendor').length;

  // Product Edit Modal State
  const [editingProduct, setEditingProduct] = useState<ProductWithVendor | null>(null);
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editPrice, setEditPrice] = useState<number>(0);
  const [editDesc, setEditDesc] = useState('');
  const [editCategory, setEditCategory] = useState('Clothes');
  const [editInStock, setEditInStock] = useState(true);
  const [editImageUrl, setEditImageUrl] = useState('');
  const [editImages, setEditImages] = useState<string[]>([]);
  const [editFields, setEditFields] = useState<CustomAttributeField[]>([]);
  const [editVariantsList, setEditVariantsList] = useState<string[]>([]);

  const handleDeleteProduct = async (product: ProductWithVendor) => {
    const confirmed = window.confirm(isAr
      ? `هل أنت متأكد من حذف المنتج "${product.title}" نهائياً من متجرك؟`
      : `Delete product "${product.title}" permanently?`);
    if (!confirmed) return;

    setDeletingProductId(product.id);
    const deleted = await deleteProductFromDB(product.id);
    setDeletingProductId(null);

    if (!deleted) {
      window.alert(isAr ? 'تعذر حذف المنتج. تحقق من الاتصال أو صلاحيات المتجر.' : 'Could not delete the product. Check the connection or store permissions.');
      return;
    }

    onDeleteProduct?.(product.id);
    if (editingProduct?.id === product.id) setEditingProduct(null);
  };

  // New Product Modal State
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newPrice, setNewPrice] = useState<number>(25);
  const [newDesc, setNewDesc] = useState('');
  const [newCategory, setNewCategory] = useState('Clothes');
  const [newImageUrl, setNewImageUrl] = useState('');
  const [newImages, setNewImages] = useState<string[]>([]);
  const [newFields, setNewFields] = useState<CustomAttributeField[]>(CATEGORY_DEFAULT_FIELDS.Clothes);
  const [newVariantsList, setNewVariantsList] = useState<string[]>(generateVariantsFromFields(CATEGORY_DEFAULT_FIELDS.Clothes));

  // Category change handlers that automatically configure appropriate fields for the category
  const handleCategoryChangeForNew = (cat: string) => {
    setNewCategory(cat);
    const defaults = CATEGORY_DEFAULT_FIELDS[cat] || CATEGORY_DEFAULT_FIELDS['Clothes'];
    const cloned = defaults.map(f => ({
      id: `f_${Date.now()}_${f.name}`,
      name: f.name,
      values: [...f.values]
    }));
    setNewFields(cloned);
    setNewVariantsList(generateVariantsFromFields(cloned));
  };

  const handleCategoryChangeForEdit = (cat: string) => {
    setEditCategory(cat);
    const defaults = CATEGORY_DEFAULT_FIELDS[cat] || CATEGORY_DEFAULT_FIELDS['Clothes'];
    const cloned = defaults.map(f => ({
      id: `f_${Date.now()}_${f.name}`,
      name: f.name,
      values: [...f.values]
    }));
    setEditFields(cloned);
    setEditVariantsList(generateVariantsFromFields(cloned));
  };

  const openEditModal = (product: ProductWithVendor) => {
    setEditingProduct(product);
    setEditTitle(product.title);
    setEditPrice(product.base_price);
    setEditDesc(product.description || '');
    setEditCategory(product.category);
    setEditInStock(product.in_stock !== false);
    const existingImgs = product.images && product.images.length > 0 ? [...product.images] : (product.images[0] ? [product.images[0]] : []);
    setEditImages(existingImgs);
    setEditImageUrl(existingImgs[0] || '');

    // Extract existing variants into fields and variants list
    const existingVariantNames = product.variants.map(v => v.name);
    const initialFields: CustomAttributeField[] = [];

    if (existingVariantNames.length > 0) {
      initialFields.push({
        id: `f_init_${Date.now()}`,
        name: isAr ? 'المقاس أو الخيار' : 'Size / Option',
        values: [...existingVariantNames]
      });
    } else {
      const defaults = CATEGORY_DEFAULT_FIELDS[product.category] || CATEGORY_DEFAULT_FIELDS['Clothes'];
      initialFields.push(...defaults.map(f => ({
        id: `f_${Date.now()}_${f.name}`,
        name: f.name,
        values: [...f.values]
      })));
    }

    setEditFields(initialFields);
    setEditVariantsList(existingVariantNames.length > 0 ? existingVariantNames : generateVariantsFromFields(initialFields));
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;

    const finalVariantNames = editVariantsList.length > 0 
      ? editVariantsList 
      : generateVariantsFromFields(editFields);

    const updatedVariants: ProductVariant[] = finalVariantNames.map((vName, idx) => ({
      id: `var_${Date.now()}_${idx}`,
      product_id: editingProduct.id,
      name: vName,
      sku: `SKU-${idx + 1}`,
      price_override: null,
      stock_quantity: 10,
      created_at: new Date().toISOString()
    }));

    const finalImages = editImages.length > 0 
      ? editImages 
      : (editImageUrl.trim() ? [editImageUrl.trim()] : (editingProduct.images.length > 0 ? editingProduct.images : ['https://images.unsplash.com/photo-1598033129183-c4f50c736f10?auto=format&fit=crop&w=800&q=80']));

    const updated: ProductWithVendor = {
      ...editingProduct,
      title: editTitle,
      base_price: Number(editPrice),
      description: editDesc,
      category: editCategory,
      in_stock: editInStock,
      images: finalImages,
      variants: updatedVariants,
      updated_at: new Date().toISOString()
    };

    await saveProductToDB(updated);
    if (onUpdateProduct) onUpdateProduct(updated);
    setEditingProduct(null);
  };

  const handleQuickStockToggle = async (product: ProductWithVendor, e: React.MouseEvent) => {
    e.stopPropagation();

    const updated: ProductWithVendor = {
      ...product,
      in_stock: product.in_stock === false ? true : false,
      updated_at: new Date().toISOString()
    };

    await saveProductToDB(updated);
    if (onUpdateProduct) onUpdateProduct(updated);
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentVendor) return;

    const newProdId = `prod_${Date.now()}`;
    const finalVariantNames = newVariantsList.length > 0
      ? newVariantsList
      : generateVariantsFromFields(newFields);

    const createdVariants: ProductVariant[] = finalVariantNames.map((vName, idx) => ({
      id: `var_${Date.now()}_${idx}`,
      product_id: newProdId,
      name: vName,
      sku: `SKU-${idx + 1}`,
      price_override: null,
      stock_quantity: 10,
      created_at: new Date().toISOString()
    }));

    const finalImages = newImages.length > 0 
      ? newImages 
      : (newImageUrl.trim() ? [newImageUrl.trim()] : ['https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=800&q=80']);

    const newProd: ProductWithVendor = {
      id: newProdId,
      vendor_id: currentVendor.id,
      title: newTitle,
      base_price: Number(newPrice),
      description: newDesc,
      category: newCategory,
      images: finalImages,
      is_active: true,
      in_stock: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      vendor: {
        id: currentVendor.id,
        store_name: currentVendor.store_name,
        slug: currentVendor.slug,
        city: currentVendor.city,
        phone: currentVendor.phone,
        commission_rate: currentVendor.commission_rate
      },
      variants: createdVariants
    };

    await saveProductToDB(newProd);
    if (onAddProduct) onAddProduct(newProd);

    setIsAddingNew(false);
    setNewTitle('');
    setNewPrice(25);
    setNewDesc('');
    setNewImageUrl('');
    setNewImages([]);
    setNewCategory('Clothes');
    setNewFields(CATEGORY_DEFAULT_FIELDS.Clothes);
    setNewVariantsList(generateVariantsFromFields(CATEGORY_DEFAULT_FIELDS.Clothes));
  };

  const adminWhatsAppUrl = `https://wa.me/${formatLebanesePhone(adminWhishPhone)}?text=${encodeURIComponent(
    isAr 
      ? `مرحباً إدارة RB Store، أنا متجر ${currentVendor?.store_name}، أود المتابعة بخصوص الطلبيات والتجهيز.`
      : `Hello RB Store admin, this is ${currentVendor?.store_name} store checking in regarding orders and fulfillment.`
  )}`;

  if (isLoadingStores) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3" dir={dir}>
        <div className="w-10 h-10 border-4 border-amber-800/20 border-t-amber-800 rounded-full animate-spin" />
        <span className="text-xs font-bold text-stone-600">
          {isAr ? 'جاري التحقق من بيانات المتجر المعتمد...' : 'Verifying authorized boutique credentials...'}
        </span>
      </div>
    );
  }

  if (!currentVendor) {
    return (
      <div className="max-w-xl mx-auto my-12 p-8 bg-white border border-stone-200 rounded-3xl shadow-sm text-center space-y-4" dir={dir}>
        <div className="w-14 h-14 bg-amber-50 text-amber-900 rounded-2xl flex items-center justify-center mx-auto">
          <Store className="w-7 h-7" />
        </div>
        <h3 className="font-black text-stone-900 text-lg">
          {isAr ? 'لم يتم العثور على متجر نشط مرتبط بحسابك' : 'No active boutique associated with this account'}
        </h3>
        <p className="text-xs text-stone-600 leading-relaxed">
          {isAr
            ? 'حسابك الحالي لا يملك متجراً مفعلاً أو أن حساب المتجر قيد المراجعة من الإدارة. يرجى تسجيل متجر جديد أو تسجيل الدخول بالحساب الصحيح.'
            : 'Your authenticated session does not have an active boutique or it is pending admin approval.'}
        </p>
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            onClick={() => onNavigateToRegister ? onNavigateToRegister() : window.location.href = '/vendor/signup'}
            className="px-5 py-2.5 bg-stone-900 hover:bg-black text-white text-xs font-bold rounded-xl cursor-pointer"
          >
            {isAr ? 'تسجيل متجر جديد' : 'Register New Boutique'}
          </button>
          <button
            onClick={async () => {
              await signOutUser();
              if (onSignOut) onSignOut();
              else window.location.href = '/vendor/login';
            }}
            className="px-4 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold rounded-xl cursor-pointer"
          >
            {isAr ? 'تسجيل الخروج' : 'Sign Out'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 py-6 space-y-6 text-start overflow-x-hidden" dir={dir}>
      {/* Access Denied Warning Banner */}
      {storeAccessError && (
        <div className="p-4 bg-rose-50 border border-rose-300 rounded-2xl flex items-center justify-between gap-3 text-rose-900 text-xs font-bold shadow-xs animate-in fade-in duration-200">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{storeAccessError}</span>
          </div>
          <button
            onClick={() => setStoreAccessError(null)}
            className="text-rose-500 hover:text-rose-900 p-1 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Top Store Header Bar */}
      <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-amber-100/80 text-amber-900 flex items-center justify-center font-bold text-lg shrink-0 border border-amber-200">
            {currentVendor?.store_name?.charAt(0) || 'M'}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-stone-500">
              <span>{isAr ? 'بوابة الشركاء للمتاجر' : 'Store Merchant Portal'}</span>
              <span>·</span>
              <span className="text-emerald-700 font-bold">
                {isAr ? 'حالة المتجر: نشط' : `STATUS: ${currentVendor?.status?.toUpperCase()}`}
              </span>
            </div>
            <h2 className="text-base font-black text-stone-900 truncate">{currentVendor?.store_name}</h2>
          </div>
        </div>

        {/* Store Location & Phone Badge & Sign Out */}
        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          <div className="flex items-center gap-3 text-xs font-semibold text-stone-600 bg-stone-50 px-3.5 py-2 rounded-xl border border-stone-200/80">
            <span className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-amber-700" />
              <span>{currentVendor?.city}</span>
            </span>
            <span className="text-stone-300">·</span>
            <span className="flex items-center gap-1.5 font-mono">
              <Phone className="w-3.5 h-3.5 text-stone-500" />
              <span dir="ltr">+{currentVendor?.phone}</span>
            </span>
          </div>

          <button
            type="button"
            onClick={async () => {
              await signOutUser();
              if (onSignOut) {
                onSignOut();
              } else {
                window.location.href = '/vendor/login';
              }
            }}
            className="flex items-center gap-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            title={isAr ? 'تسجيل الخروج من لوحة المتجر' : 'Sign Out'}
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>{isAr ? 'تسجيل الخروج' : 'Sign Out'}</span>
          </button>
        </div>
      </div>

      {/* WhatsApp Operations & Direct Order Tracking Banner */}
      <div className="bg-gradient-to-r from-emerald-50 via-emerald-50/80 to-teal-50 border border-emerald-200 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
            <MessageCircle className="w-5 h-5 fill-white" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              <h3 className="font-bold text-sm sm:text-base text-emerald-950">
                {isAr ? 'متابعة الطلبيات عبر واتساب مباشرة' : 'Orders & Dispatch Follow-up via WhatsApp'}
              </h3>
            </div>
            <p className="text-xs text-emerald-900/85 leading-relaxed max-w-2xl">
              {isAr
                ? `تصلك تفاصيل الطلبيات الجديدة والأصناف المطلوبة وتنسيق الاستلام مع سائقي التوصيل مباشرة عبر محادثة واتساب الرسمية مع إدارة المنصة (رقم الإدارة: +${adminWhishPhone}).`
                : `All order alerts, packing details, and pickup coordination are handled directly through official WhatsApp communication with central management (+${adminWhishPhone}).`}
            </p>
          </div>
        </div>

        <a
          href={adminWhatsAppUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-xs font-bold transition-all shadow-xs shrink-0 cursor-pointer"
        >
          <Phone className="w-3.5 h-3.5 fill-white" />
          <span>{isAr ? 'محادثة الإدارة عبر واتساب' : 'Chat with Admin on WhatsApp'}</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      {/* Dashboard Store Inventory Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs">
          <span className="text-xs text-stone-500 font-semibold block">
            {isAr ? 'إجمالي منتجات متجرك' : 'Total Store Items'}
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-stone-900 font-mono">{vendorProducts.length}</span>
            <span className="text-[11px] text-stone-400">
              {isAr ? 'منتج معروض' : 'products'}
            </span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs">
          <span className="text-xs text-stone-500 font-semibold block">
            {isAr ? 'متوفر في المخزون' : 'In Stock'}
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-700 font-mono">{inStockProducts.length}</span>
            <span className="text-[11px] text-emerald-600 font-bold">
              {isAr ? '🟢 متاح للطلب' : 'Active'}
            </span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs">
          <span className="text-xs text-stone-500 font-semibold block">
            {isAr ? 'نفدت الكمية' : 'Out of Stock'}
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-rose-700 font-mono">{outOfStockProducts.length}</span>
            <span className="text-[11px] text-rose-600 font-bold">
              {isAr ? '🔴 غير متاح' : 'Unavailable'}
            </span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs">
          <span className="text-xs text-stone-500 font-semibold block">
            {isAr ? 'نسبة عمولة المنصة' : 'Commission Rate'}
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-stone-900 font-mono">
              {commRate}%
            </span>
            <span className="text-[11px] text-stone-400">
              {isAr ? 'لكل طلبية' : 'per order'}
            </span>
          </div>
        </div>
      </div>

      {/* Financial Accounting & Commission Metrics Bar */}
      <div className="bg-gradient-to-br from-amber-500/10 via-stone-50 to-amber-500/5 p-4 sm:p-5 rounded-2xl border border-amber-200/80 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-amber-900" />
            <span className="font-black text-sm text-stone-900">
              {isAr ? 'الحسابات المالية واحتساب العمولة' : 'Store Financials & Commission Accounting'}
            </span>
          </div>
          <span className="text-xs font-bold text-amber-900 bg-amber-100/90 px-3 py-1 rounded-full border border-amber-300 w-fit">
            {isAr ? `نسبة العمولة المعتمدة: ${commRate}%` : `Applied Take Rate: ${commRate}%`}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white p-3.5 rounded-xl border border-stone-200 shadow-2xs">
            <span className="text-xs text-stone-500 font-semibold block">
              {isAr ? 'مبيعات الزبائن (بالعمولة)' : 'Gross Customer Sales'}
            </span>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-xl sm:text-2xl font-black text-stone-900 font-mono">${totalStoreSales.toFixed(2)}</span>
              <span className="text-[10px] text-stone-400 font-bold">USD</span>
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-amber-200 bg-amber-50/30 shadow-2xs">
            <span className="text-xs text-amber-900 font-semibold block">
              {isAr ? 'عمولة المنصة المضافة' : 'Added Platform Commission'}
            </span>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-xl sm:text-2xl font-black text-amber-800 font-mono">+${totalCommissionDeducted.toFixed(2)}</span>
              <span className="text-[10px] text-amber-700 font-bold">(+{commRate}%)</span>
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/40 shadow-2xs">
            <span className="text-xs text-emerald-800 font-semibold block">
              {isAr ? 'مستحقات متجرك بالكامل' : 'Full Store Payout'}
            </span>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-xl sm:text-2xl font-black text-emerald-700 font-mono">${totalVendorPayout.toFixed(2)}</span>
              <span className="text-[10px] text-emerald-600 font-bold">USD (100%)</span>
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-stone-200 shadow-2xs">
            <span className="text-xs text-stone-500 font-semibold block">
              {isAr ? 'طلبيات قيد التجهيز' : 'Pending Fulfillment'}
            </span>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-xl sm:text-2xl font-black text-stone-900 font-mono">{pendingOrdersCount}</span>
              <span className="text-[10px] text-amber-700 font-bold">
                {isAr ? 'بانتظار السائق' : 'items'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Products Catalog with Direct Edit and Stock Toggle */}
      <div className="bg-white rounded-2xl border border-stone-200 p-4 sm:p-5 space-y-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-stone-100">
          <div>
            <h3 className="font-bold text-stone-900 text-sm sm:text-base flex items-center gap-2">
              <Package className="w-4 h-4 text-stone-700" />
              <span>{isAr ? `منتجات المتجر وإدارة الخصائص والمخزون (${vendorProducts.length})` : `Store Products & Custom Attributes (${vendorProducts.length})`}</span>
            </h3>
            <p className="text-xs text-stone-500">
              {isAr ? 'تعديل الأسعار والأوصاف، ضبط خانات الخصائص بحسب القسم، وتبديل التوفر بنقرة واحدة' : 'Manage pricing, custom attribute fields by category, and stock availability with 1-click'}
            </p>
          </div>

          <button
            onClick={() => setIsAddingNew(true)}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-stone-900 hover:bg-black active:scale-95 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer w-fit"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{isAr ? 'إضافة منتج جديد' : 'Add New Product'}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {vendorProducts.map(product => {
            const isOutOfStock = product.in_stock === false;

            return (
              <div 
                key={product.id} 
                className="p-3.5 bg-stone-50/80 rounded-2xl border border-stone-200 flex flex-col justify-between gap-3 hover:border-stone-300 transition-all text-start"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-16 h-16 rounded-xl overflow-hidden bg-stone-200 shrink-0 border border-stone-300/60">
                      <img
                        src={product.images[0] || 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=400&q=80'}
                        alt={product.title}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </div>

                    <div className="min-w-0">
                      <span className="text-xs sm:text-sm font-bold text-stone-900 block truncate">
                        {product.title}
                      </span>
                      <span className="text-[11px] text-stone-500 block line-clamp-1 mt-0.5">
                        {product.description || (isAr ? 'لا يوجد وصف' : 'No description')}
                      </span>
                      <div className="flex items-center gap-2 mt-1 text-xs flex-wrap">
                        <span className="font-mono font-bold text-stone-900">${product.base_price.toFixed(2)}</span>
                        <span className="text-[10px] text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 font-semibold">
                          {isAr ? `+ عمولة ${commRate}% = $${(product.base_price * (1 + commRate / 100)).toFixed(2)} للزبون` : `+ ${commRate}% fee = $${(product.base_price * (1 + commRate / 100)).toFixed(2)}`}
                        </span>
                        <span className="text-stone-300">·</span>
                        <span className="text-stone-500 text-[11px]">{product.category}</span>
                      </div>

                      {/* Display of variants/options chips */}
                      {product.variants.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {product.variants.slice(0, 4).map(v => (
                            <span 
                              key={v.id} 
                              className="text-[10px] font-semibold px-2 py-0.5 bg-white border border-stone-200 text-stone-700 rounded-md"
                            >
                              {v.name}
                            </span>
                          ))}
                          {product.variants.length > 4 && (
                            <span className="text-[10px] text-stone-400 font-semibold px-1 py-0.5">
                              +{product.variants.length - 4}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Quick In Stock / Out of Stock Toggle Button */}
                  <button
                    onClick={(e) => handleQuickStockToggle(product, e)}
                    className={`shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer border ${
                      isOutOfStock
                        ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                        : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                    }`}
                    title={isAr ? 'انقر لتغيير حالة التوفر' : 'Click to toggle stock'}
                  >
                    {isOutOfStock ? (
                      <span>🔴 {isAr ? 'نفدت الكمية' : 'Out of Stock'}</span>
                    ) : (
                      <span>🟢 {isAr ? 'متوفر' : 'In Stock'}</span>
                    )}
                  </button>
                </div>

                {/* Edit & Delete Product Action Row */}
                <div className="pt-2 border-t border-stone-200/60 flex items-center justify-between text-xs">
                  <span className="text-[11px] text-stone-500 font-medium">
                    {product.variants.length} {isAr ? 'خيارات مخصصة' : 'custom options'}
                  </span>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => openEditModal(product)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white hover:bg-stone-100 border border-stone-200 rounded-lg text-stone-800 font-bold transition-colors cursor-pointer text-xs shadow-2xs"
                    >
                      <Edit3 className="w-3 h-3 text-stone-600" />
                      <span>{isAr ? 'تعديل' : 'Edit'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteProduct(product)}
                      disabled={deletingProductId === product.id}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg text-rose-700 font-bold transition-colors cursor-pointer text-xs disabled:opacity-50"
                      title={isAr ? 'حذف المنتج نهائياً' : 'Delete Product'}
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>{deletingProductId === product.id ? (isAr ? 'جارٍ الحذف...' : 'Deleting...') : (isAr ? 'حذف' : 'Delete')}</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Store Orders & Commission Statements Table */}
      <div className="bg-white rounded-2xl border border-stone-200 p-4 sm:p-5 space-y-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-stone-100">
          <div>
            <h3 className="font-bold text-stone-900 text-sm sm:text-base flex items-center gap-2">
              <Package className="w-4 h-4 text-amber-800" />
              <span>{isAr ? `طلبيات المتجر وتفاصيل احتساب العمولة (${vendorOrderItems.length})` : `Store Orders & Commission Breakdown (${vendorOrderItems.length})`}</span>
            </h3>
            <p className="text-xs text-stone-500">
              {isAr ? `تُحسب عمولة المنصة بنسبة ${commRate}% تلقائياً على كل صنف، ويتم تسليم المستحقات بعد التسليم.` : `Platform take rate (${commRate}%) is automatically computed on each line item.`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold px-3 py-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl">
              {isAr ? `صافي المستحقات: $${totalVendorPayout.toFixed(2)}` : `Net Payout: $${totalVendorPayout.toFixed(2)}`}
            </span>
          </div>
        </div>

        {vendorOrderItems.length === 0 ? (
          <div className="text-center py-10 px-4 bg-stone-50/70 border border-dashed border-stone-200 rounded-2xl space-y-2">
            <div className="w-12 h-12 bg-amber-100/70 text-amber-800 rounded-2xl flex items-center justify-center mx-auto">
              <Package className="w-6 h-6" />
            </div>
            <h4 className="font-bold text-stone-800 text-sm">
              {isAr ? 'لا توجد طلبيات مسجلة لمتجرك حتى الآن' : 'No orders recorded for your store yet'}
            </h4>
            <p className="text-xs text-stone-500 max-w-md mx-auto leading-relaxed">
              {isAr 
                ? `فور قيام أي زبون بإتمام طلب لمنتجات متجرك من الواجهة، ستظهر تفاصيل الطلبية هنا فوراً مع احتساب نسبة العمولة (${commRate}%) بالدولار، وتحديد صافي ربحك، وكود الاستلام لتسليمه لسائق التوصيل.`
                : `As soon as customers place an order for your boutique, line items will appear here with the exact ${commRate}% commission deducted and net payout displayed.`}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-start text-xs border-collapse">
              <thead>
                <tr className="bg-stone-50/90 text-stone-600 border-b border-stone-200 text-start">
                  <th className="py-2.5 px-3 font-bold text-start">{isAr ? 'كود الاستلام' : 'Pickup Code'}</th>
                  <th className="py-2.5 px-3 font-bold text-start">{isAr ? 'الكمية والسعر' : 'Qty & Price'}</th>
                  <th className="py-2.5 px-3 font-bold text-start">{isAr ? 'إجمالي الصنف' : 'Gross Total'}</th>
                  <th className="py-2.5 px-3 font-bold text-start text-amber-800">{isAr ? `العمولة المضافة (+${commRate}%)` : `Added Fee (+${commRate}%)`}</th>
                  <th className="py-2.5 px-3 font-bold text-start text-emerald-800">{isAr ? 'مستحقات متجرك (كاملة)' : 'Full Payout'}</th>
                  <th className="py-2.5 px-3 font-bold text-start">{isAr ? 'حالة التجهيز' : 'Status'}</th>
                  <th className="py-2.5 px-3 font-bold text-start">{isAr ? 'إجراء' : 'Action'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {vendorOrderItems.map((item) => {
                  const lineTotal = Number(item.unit_price || 0) * Number(item.quantity || 1);
                  const itemPayout = (item.vendor_payout !== undefined && item.vendor_payout !== null && Number(item.vendor_payout) > 0)
                    ? Number(item.vendor_payout)
                    : Number((lineTotal / (1 + (commRate / 100))).toFixed(2));
                  const itemComm = (item.commission_amount !== undefined && item.commission_amount !== null && Number(item.commission_amount) > 0)
                    ? Number(item.commission_amount)
                    : Number((lineTotal - itemPayout).toFixed(2));

                  return (
                    <tr key={item.id} className="hover:bg-stone-50/50 transition-colors">
                      <td className="py-3 px-3">
                        <span className="font-mono font-black text-amber-900 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200 text-xs">
                          {item.pickup_code || 'PU-PENDING'}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-semibold text-stone-900 block">{item.quantity}x @ ${Number(item.unit_price || 0).toFixed(2)}</span>
                      </td>
                      <td className="py-3 px-3 font-bold text-stone-900 font-mono">
                        ${lineTotal.toFixed(2)}
                      </td>
                      <td className="py-3 px-3 font-bold text-amber-800 font-mono">
                        +${itemComm.toFixed(2)}
                      </td>
                      <td className="py-3 px-3 font-black text-emerald-700 font-mono">
                        ${itemPayout.toFixed(2)}
                      </td>
                      <td className="py-3 px-3">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                          item.item_status === 'confirmed' || item.item_status === 'at_hub'
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : item.item_status === 'picked_up'
                            ? 'bg-blue-50 text-blue-800 border border-blue-200'
                            : item.item_status === 'out_of_stock'
                            ? 'bg-rose-50 text-rose-800 border border-rose-200'
                            : 'bg-amber-50 text-amber-800 border border-amber-200'
                        }`}>
                          {item.item_status === 'awaiting_vendor' ? (isAr ? '⏳ بانتظار تجهيزك' : 'Awaiting Prep') :
                           item.item_status === 'confirmed' ? (isAr ? '✅ جاهز للاستلام' : 'Ready') :
                           item.item_status === 'picked_up' ? (isAr ? '🚚 استلمه السائق' : 'Picked Up') :
                           item.item_status === 'out_of_stock' ? (isAr ? '❌ نفد من المخزون' : 'Out of Stock') :
                           item.item_status}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        {item.item_status === 'awaiting_vendor' && onUpdateItemStatus ? (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => onUpdateItemStatus(item.id, 'confirmed')}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold cursor-pointer transition-colors"
                            >
                              {isAr ? 'تأكيد الجاهزية' : 'Ready'}
                            </button>
                            <button
                              type="button"
                              onClick={() => onUpdateItemStatus(item.id, 'out_of_stock')}
                              className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-[11px] font-bold cursor-pointer transition-colors"
                            >
                              {isAr ? 'نفد' : 'Out'}
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-stone-400 font-semibold">{isAr ? 'تم الإجراء' : 'Processed'}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Danger Zone: Permanent Account & Store Deletion */}
      <div className="bg-rose-50/50 border border-rose-200/90 rounded-3xl p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0 shadow-2xs mt-0.5">
              <Trash2 className="w-5 h-5 text-rose-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-sm sm:text-base text-rose-950">
                  {isAr ? 'حذف الحساب والمتجر كلياً' : 'Permanently Delete Account & Store'}
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-200 text-rose-900 uppercase tracking-wider">
                  {isAr ? 'منطقة الخطر' : 'Danger Zone'}
                </span>
              </div>
              <p className="text-xs text-rose-800/80 leading-relaxed max-w-2xl mt-1">
                {isAr
                  ? `سيؤدي حذف الحساب إلى إزالة متجر "${currentVendor?.store_name}"، وجميع المنتجات المرتبطة به، وحساب الدخول نهائياً وبلا رجعة من قاعدة البيانات.`
                  : `Permanently removes store "${currentVendor?.store_name}", products, and login credentials from the database.`}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setDeleteConfirmationText('');
              setDeleteAccountError(null);
              setIsDeleteAccountModalOpen(true);
            }}
            className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white rounded-xl text-xs font-black transition-all cursor-pointer shrink-0 shadow-md shadow-rose-600/20"
          >
            {isAr ? 'حذف الحساب نهائياً' : 'Delete Account'}
          </button>
        </div>
      </div>

      {/* Edit Product Modal */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200 overflow-y-auto">
          <div className="w-full max-w-xl bg-white rounded-2xl sm:rounded-3xl shadow-2xl p-5 sm:p-6 space-y-4 text-start max-h-[92vh] overflow-y-auto" dir={dir}>
            <div className="flex items-center justify-between pb-3 border-b border-stone-100 sticky top-0 bg-white z-10">
              <h3 className="font-black text-stone-900 text-base">
                {isAr ? 'تعديل تفاصيل المنتج والخصائص بحسب القسم' : 'Edit Product Details & Options'}
              </h3>
              <button 
                onClick={() => setEditingProduct(null)}
                className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-stone-700 mb-1">
                  {isAr ? 'اسم المنتج:' : 'Product Title:'}
                </label>
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-stone-900 focus:bg-white focus:outline-none focus:border-stone-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-stone-700 mb-1">
                    {isAr ? 'سعر المتجر المطلوب ($ USD):' : 'Store Desired Payout ($):'}
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="1"
                    required
                    value={editPrice}
                    onChange={(e) => setEditPrice(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl font-mono text-stone-900 focus:bg-white focus:outline-none focus:border-stone-800"
                  />
                  <div className="mt-1 text-[11px] text-stone-600 bg-amber-50/80 p-2 rounded-lg border border-amber-200">
                    <span className="block font-semibold text-amber-950">
                      {isAr ? `تضاف عمولة المنصة (${commRate}%) فوق سعرك:` : `+${commRate}% fee added:`}
                    </span>
                    <span className="font-mono text-stone-700">
                      ${editPrice.toFixed(2)} + ${(editPrice * commRate / 100).toFixed(2)} = <strong className="text-emerald-700">${(editPrice * (1 + commRate / 100)).toFixed(2)} للزبون</strong>
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-stone-700 mb-1">
                    {isAr ? 'القسم (يحدد خانات الخصائص تلقائياً):' : 'Category (Auto-configures fields):'}
                  </label>
                  <select
                    value={editCategory}
                    onChange={(e) => handleCategoryChangeForEdit(e.target.value)}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-stone-900 focus:bg-white focus:outline-none font-semibold"
                  >
                    <option value="Clothes">{isAr ? '👗 أزياء وملابس (مقاسات وألوان)' : 'Clothes & Fashion'}</option>
                    <option value="Jewelry">{isAr ? '💍 مجوهرات وإكسسوارات (عيار ومقاس)' : 'Jewelry & Accessories'}</option>
                    <option value="Beauty">{isAr ? '🧴 عناية وعطور ومكياج (أحجام وسعات)' : 'Beauty & Perfumes'}</option>
                    <option value="Tech">{isAr ? '📱 كفرات وإلكترونيات (موديلات وألوان)' : 'Tech & Cases'}</option>
                    <option value="Gifts">{isAr ? '🎁 هدايا وديكور وحرف (خامات وأحجام)' : 'Gifts & Home Décor'}</option>
                  </select>
                </div>
              </div>

              {/* Dynamic Attributes & Options Builder for Edit Modal */}
              <DynamicAttributesEditor
                isAr={isAr}
                fields={editFields}
                onChangeFields={setEditFields}
                variantsList={editVariantsList}
                onChangeVariantsList={setEditVariantsList}
              />

              <div>
                <label className="block font-bold text-stone-700 mb-1">
                  {isAr ? 'وصف المنتج ومواصفاته التفصيلية:' : 'Description & Details:'}
                </label>
                <textarea
                  rows={2}
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-stone-900 focus:bg-white focus:outline-none focus:border-stone-800"
                />
              </div>

              {/* Multiple Images Picker for Edit Modal */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block font-bold text-stone-700">
                    {isAr ? 'صور المنتج (يمكنك رفع عدة صور للمعرض):' : 'Product Photos (Multiple Gallery Images):'}
                  </label>
                  <span className="text-[11px] font-bold text-stone-500">
                    {editImages.length} {isAr ? 'صور' : 'photos'}
                  </span>
                </div>

                {/* Grid of current photos */}
                {editImages.length > 0 && (
                  <div className="flex flex-wrap gap-2.5 p-2 bg-stone-50 rounded-2xl border border-stone-200">
                    {editImages.map((img, idx) => (
                      <div key={idx} className="relative w-20 h-20 rounded-xl overflow-hidden border border-stone-300 shadow-2xs group shrink-0">
                        <img src={img} alt={`Preview ${idx + 1}`} className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => {
                            const filtered = editImages.filter((_, i) => i !== idx);
                            setEditImages(filtered);
                            setEditImageUrl(filtered[0] || '');
                          }}
                          className="absolute top-1 end-1 w-5 h-5 bg-black/75 hover:bg-rose-600 text-white rounded-full flex items-center justify-center text-xs transition-colors cursor-pointer"
                          title={isAr ? 'حذف الصورة' : 'Remove'}
                        >
                          ✕
                        </button>
                        {idx === 0 && (
                          <span className="absolute bottom-0 inset-x-0 bg-black/70 text-white text-[9px] font-bold text-center py-0.5">
                            {isAr ? 'الرئيسية' : 'Cover'}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Add Photo Button */}
                <label className="flex items-center justify-center gap-2 p-3 border-2 border-dashed border-amber-300 hover:border-amber-400 bg-amber-50/40 hover:bg-amber-50/70 rounded-2xl cursor-pointer transition-all">
                  <Upload className="w-4 h-4 text-amber-800" />
                  <span className="text-xs font-bold text-stone-900">
                    {isAr ? '📸 اضغط هنا لإضافة صورة جديدة للمنتج من المعرض' : '📸 Tap to add photo from gallery'}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={async (e) => {
                      const files = e.target.files;
                      if (files && files.length > 0) {
                        for (const file of Array.from(files)) {
                          const res = await compressImageFile(file);
                          if (res) {
                            setEditImages((prev) => [...prev, res]);
                            setEditImageUrl(res);
                          }
                        }
                      }
                    }}
                  />
                </label>
              </div>

              {/* Stock Status Selection */}
              <div>
                <label className="block font-bold text-stone-700 mb-1.5">
                  {isAr ? 'حالة التوفر في المخزون (Stock Status):' : 'Stock Availability:'}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditInStock(true)}
                    className={`py-2 px-3 rounded-xl font-bold border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      editInStock
                        ? 'bg-emerald-500 text-white border-emerald-600 shadow-xs'
                        : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100'
                    }`}
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{isAr ? 'متوفر (In Stock)' : 'In Stock'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditInStock(false)}
                    className={`py-2 px-3 rounded-xl font-bold border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      !editInStock
                        ? 'bg-rose-500 text-white border-rose-600 shadow-xs'
                        : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100'
                    }`}
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>{isAr ? 'نفدت الكمية (Out of Stock)' : 'Out of Stock'}</span>
                  </button>
                </div>
              </div>

              <div className="pt-3 flex items-center justify-between gap-2 border-t border-stone-100 sticky bottom-0 bg-white">
                <button
                  type="button"
                  onClick={() => handleDeleteProduct(editingProduct)}
                  disabled={deletingProductId === editingProduct.id}
                  className="px-3.5 py-2.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold cursor-pointer flex items-center gap-1.5 text-xs transition-colors disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{deletingProductId === editingProduct.id ? (isAr ? 'جارٍ الحذف...' : 'Deleting...') : (isAr ? 'حذف المنتج نهائياً' : 'Delete')}</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingProduct(null)}
                    className="px-4 py-2.5 rounded-xl border border-stone-300 text-stone-700 hover:bg-stone-100 font-bold cursor-pointer"
                  >
                    {isAr ? 'إلغاء' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-black hover:bg-stone-800 text-white font-bold cursor-pointer shadow-sm"
                  >
                    {isAr ? 'حفظ التعديلات' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add New Product Modal */}
      {isAddingNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200 overflow-y-auto">
          <div className="w-full max-w-xl bg-white rounded-2xl sm:rounded-3xl shadow-2xl p-5 sm:p-6 space-y-4 text-start max-h-[92vh] overflow-y-auto" dir={dir}>
            <div className="flex items-center justify-between pb-3 border-b border-stone-100 sticky top-0 bg-white z-10">
              <h3 className="font-black text-stone-900 text-base">
                {isAr ? 'إضافة منتج جديد وتحديد الخانات بحسب القسم' : 'Add New Product & Category Options'}
              </h3>
              <button 
                onClick={() => setIsAddingNew(false)}
                className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateProduct} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-stone-700 mb-1">
                  {isAr ? 'اسم المنتج الجديد:' : 'Product Title:'}
                </label>
                <input
                  type="text"
                  required
                  placeholder={isAr ? 'مثال: فستان كتان صيفي، عطر عنبر شرقي، سوار لؤلؤ...' : 'e.g. Linen Summer Dress, Amber Perfume...'}
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-stone-900 focus:bg-white focus:outline-none focus:border-stone-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-stone-700 mb-1">
                    {isAr ? 'سعر المتجر المطلوب ($ USD):' : 'Store Desired Payout ($):'}
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="1"
                    required
                    value={newPrice}
                    onChange={(e) => setNewPrice(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl font-mono text-stone-900 focus:bg-white focus:outline-none focus:border-stone-800"
                  />
                  <div className="mt-1 text-[11px] text-stone-600 bg-amber-50/80 p-2 rounded-lg border border-amber-200">
                    <span className="block font-semibold text-amber-950">
                      {isAr ? `تضاف عمولة المنصة (${commRate}%) فوق سعرك:` : `+${commRate}% fee added:`}
                    </span>
                    <span className="font-mono text-stone-700">
                      ${newPrice.toFixed(2)} + ${(newPrice * commRate / 100).toFixed(2)} = <strong className="text-emerald-700">${(newPrice * (1 + commRate / 100)).toFixed(2)} للزبون</strong>
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-stone-700 mb-1">
                    {isAr ? 'القسم (يحدد خانات الخصائص تلقائياً):' : 'Category (Auto-configures fields):'}
                  </label>
                  <select
                    value={newCategory}
                    onChange={(e) => handleCategoryChangeForNew(e.target.value)}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-stone-900 focus:bg-white focus:outline-none font-semibold"
                  >
                    <option value="Clothes">{isAr ? '👗 أزياء وملابس (مقاسات وألوان)' : 'Clothes & Fashion'}</option>
                    <option value="Jewelry">{isAr ? '💍 مجوهرات وإكسسوارات (عيار ومقاس)' : 'Jewelry & Accessories'}</option>
                    <option value="Beauty">{isAr ? '🧴 عناية وعطور ومكياج (أحجام وسعات)' : 'Beauty & Perfumes'}</option>
                    <option value="Tech">{isAr ? '📱 كفرات وإلكترونيات (موديلات وألوان)' : 'Tech & Cases'}</option>
                    <option value="Gifts">{isAr ? '🎁 هدايا وديكور وحرف (خامات وأحجام)' : 'Gifts & Home Décor'}</option>
                  </select>
                </div>
              </div>

              {/* Dynamic Attributes & Options Builder for Add Modal */}
              <DynamicAttributesEditor
                isAr={isAr}
                fields={newFields}
                onChangeFields={setNewFields}
                variantsList={newVariantsList}
                onChangeVariantsList={setNewVariantsList}
              />

              {/* Multiple Images Picker for Add New Product Modal */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block font-bold text-stone-700">
                    {isAr ? 'صور المنتج (يمكنك رفع عدة صور للمعرض):' : 'Product Photos (Multiple Gallery Images):'}
                  </label>
                  <span className="text-[11px] font-bold text-stone-500">
                    {newImages.length} {isAr ? 'صور' : 'photos'}
                  </span>
                </div>

                {/* Grid of chosen photos */}
                {newImages.length > 0 && (
                  <div className="flex flex-wrap gap-2.5 p-2 bg-stone-50 rounded-2xl border border-stone-200">
                    {newImages.map((img, idx) => (
                      <div key={idx} className="relative w-20 h-20 rounded-xl overflow-hidden border border-stone-300 shadow-2xs group shrink-0">
                        <img src={img} alt={`Preview ${idx + 1}`} className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => {
                            const filtered = newImages.filter((_, i) => i !== idx);
                            setNewImages(filtered);
                            setNewImageUrl(filtered[0] || '');
                          }}
                          className="absolute top-1 end-1 w-5 h-5 bg-black/75 hover:bg-rose-600 text-white rounded-full flex items-center justify-center text-xs transition-colors cursor-pointer"
                          title={isAr ? 'حذف الصورة' : 'Remove'}
                        >
                          ✕
                        </button>
                        {idx === 0 && (
                          <span className="absolute bottom-0 inset-x-0 bg-black/70 text-white text-[9px] font-bold text-center py-0.5">
                            {isAr ? 'الرئيسية' : 'Cover'}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Add Photo Button */}
                <label className="flex items-center justify-center gap-2 p-3.5 border-2 border-dashed border-amber-400/80 hover:border-amber-500 bg-amber-50/50 hover:bg-amber-50/80 rounded-2xl cursor-pointer transition-all">
                  <Upload className="w-5 h-5 text-amber-800" />
                  <span className="text-xs font-bold text-stone-900">
                    {isAr ? '📸 اضغط هنا لإضافة صور من المعرض أو الكاميرا (يمكن اختيار عدة صور)' : '📸 Tap to add photos from gallery (select multiple)'}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={async (e) => {
                      const files = e.target.files;
                      if (files && files.length > 0) {
                        for (const file of Array.from(files)) {
                          const res = await compressImageFile(file);
                          if (res) {
                            setNewImages((prev) => [...prev, res]);
                            setNewImageUrl(res);
                          }
                        }
                      }
                    }}
                  />
                </label>
              </div>

              <div>
                <label className="block font-bold text-stone-700 mb-1">
                  {isAr ? 'وصف المنتج ومواصفاته التفصيلية:' : 'Description & Details:'}
                </label>
                <textarea
                  rows={2}
                  placeholder={isAr ? 'مواصفات القطعة، الخامة، طريقة الاستخدام، المقاسات...' : 'Product material, specifications, details...'}
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-stone-900 focus:bg-white focus:outline-none focus:border-stone-800"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-stone-100 sticky bottom-0 bg-white">
                <button
                  type="button"
                  onClick={() => setIsAddingNew(false)}
                  className="px-4 py-2.5 rounded-xl border border-stone-300 text-stone-700 hover:bg-stone-100 font-bold cursor-pointer"
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-black hover:bg-stone-800 text-white font-bold cursor-pointer shadow-sm"
                >
                  {isAr ? 'نشر المنتج في المتجر' : 'Publish Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add New Store Modal (Owned by Current Vendor) */}
      {isAddStoreModalOpen && (
        <div className="fixed inset-0 z-50 bg-stone-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-lg shadow-2xl border border-stone-200 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-stone-100 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-900 flex items-center justify-center">
                  <Store className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-lg text-stone-900">
                    {isAr ? 'تسجيل متجر جديد تابع لحسابك' : 'Register New Store (Owned by You)'}
                  </h3>
                  <p className="text-xs text-stone-500">
                    {isAr ? 'سيتم ربط المتجر الجديد تلقائياً بحسابك وبصلاحية المالك' : 'Automatically linked to your account as owner'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddStoreModalOpen(false)}
                className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {createStoreError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-800 text-xs font-semibold">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{createStoreError}</span>
              </div>
            )}

            <form onSubmit={handleCreateNewStore} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-stone-800 mb-1">
                  {isAr ? 'اسم المتجر الجديد:' : 'Store Name:'}
                </label>
                <input
                  type="text"
                  required
                  placeholder={isAr ? 'مثال: بوتيك أوركيد بيروت، دار الحرير...' : 'e.g. Orchid Boutique Beirut'}
                  value={newStoreName}
                  onChange={(e) => setNewStoreName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-300 rounded-xl text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-900/10"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-stone-800 mb-1">
                    {isAr ? 'المدينة / المنطقة:' : 'City / Region:'}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Beirut / Mount Lebanon"
                    value={newStoreCity}
                    onChange={(e) => setNewStoreCity(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-300 rounded-xl text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-900/10"
                  />
                </div>

                <div>
                  <label className="block font-bold text-stone-800 mb-1">
                    {isAr ? 'رقم هاتف المتجر (واتساب):' : 'WhatsApp Phone:'}
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="96170123456"
                    value={newStorePhone}
                    onChange={(e) => setNewStorePhone(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-300 rounded-xl text-stone-900 font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-900/10"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-stone-800 mb-1">
                  {isAr ? 'عنوان الاستلام بالتفصيل (Pickup Address):' : 'Pickup Address:'}
                </label>
                <input
                  type="text"
                  required
                  placeholder={isAr ? 'الشارع، المبنى، الطابق...' : 'Street, Building, Floor...'}
                  value={newStoreAddress}
                  onChange={(e) => setNewStoreAddress(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-300 rounded-xl text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-900/10"
                />
              </div>

              <div>
                <label className="block font-bold text-stone-800 mb-1">
                  {isAr ? 'حساب إنستغرام المتجر (اختياري):' : 'Instagram Handle (Optional):'}
                </label>
                <input
                  type="text"
                  placeholder="@your_boutique"
                  value={newStoreInstagram}
                  onChange={(e) => setNewStoreInstagram(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-300 rounded-xl text-stone-900 font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-900/10"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setIsAddStoreModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-stone-300 text-stone-700 hover:bg-stone-100 font-bold cursor-pointer"
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={isCreatingStore}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-800 to-amber-900 hover:from-amber-700 hover:to-amber-800 text-white font-black cursor-pointer shadow-md disabled:opacity-50"
                >
                  {isCreatingStore ? (isAr ? 'جارِ التسجيل...' : 'Creating...') : (isAr ? 'تأكيد تسجيل المتجر' : 'Register Store')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Permanent Account Deletion Confirmation Modal */}
      {isDeleteAccountModalOpen && (
        <div className="fixed inset-0 z-50 bg-stone-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-rose-200 text-start space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center">
                  <Trash2 className="w-5 h-5 text-rose-600" />
                </div>
                <div>
                  <h3 className="font-black text-base text-stone-900">
                    {isAr ? 'تأكيد حذف الحساب نهائياً' : 'Confirm Permanent Deletion'}
                  </h3>
                  <span className="text-[11px] font-bold text-rose-600 uppercase tracking-wide">
                    {isAr ? 'إجراء لا رجعة فيه' : 'Irreversible Action'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsDeleteAccountModalOpen(false)}
                className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-900 space-y-1.5 font-medium leading-relaxed">
              <p className="font-bold flex items-center gap-1.5 text-rose-950">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{isAr ? 'تحذير هام جداً:' : 'Critical Warning:'}</span>
              </p>
              <p>
                {isAr
                  ? `أنت على وشك حذف متجر "${currentVendor?.store_name}" بالكامل. سيتم مسح بيانات المتجر، وجميع المنتجات المعروضة، ومعلومات الدخول نهائياً من قاعدة البيانات.`
                  : `You are about to permanently delete "${currentVendor?.store_name}". All products and profile data will be permanently wiped.`}
              </p>
            </div>

            {deleteAccountError && (
              <div className="p-3 bg-rose-100 border border-rose-300 rounded-xl text-xs text-rose-950 font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{deleteAccountError}</span>
              </div>
            )}

            <div className="space-y-2">
              <label className="block text-xs font-bold text-stone-800">
                {isAr
                  ? 'لتأكيد العملية، يرجى كتابة كلمة "حذف" في الخانة أدناه:'
                  : 'To confirm, please type "DELETE" below:'}
              </label>
              <input
                type="text"
                placeholder={isAr ? 'اكتب كلمة: حذف' : 'Type: DELETE'}
                value={deleteConfirmationText}
                onChange={(e) => setDeleteConfirmationText(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-300 focus:border-rose-600 focus:ring-2 focus:ring-rose-600/10 rounded-xl text-sm font-bold text-stone-900 transition-all outline-none"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-2 border-t border-stone-100">
              <button
                type="button"
                disabled={isDeletingAccount}
                onClick={() => setIsDeleteAccountModalOpen(false)}
                className="px-4 py-2.5 rounded-xl border border-stone-300 text-stone-700 hover:bg-stone-100 font-bold text-xs cursor-pointer disabled:opacity-50"
              >
                {isAr ? 'إلغاء التراجع' : 'Cancel'}
              </button>
              <button
                type="button"
                disabled={
                  isDeletingAccount ||
                  (isAr
                    ? deleteConfirmationText.trim() !== 'حذف' && deleteConfirmationText.trim().toUpperCase() !== 'DELETE'
                    : deleteConfirmationText.trim().toUpperCase() !== 'DELETE')
                }
                onClick={() => handleDeleteAccount(currentVendor.id)}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-black text-xs cursor-pointer shadow-md shadow-rose-600/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1.5"
              >
                {isDeletingAccount ? (
                  <span>{isAr ? 'جارِ الحذف...' : 'Deleting...'}</span>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5 text-white" />
                    <span>{isAr ? 'نعم، احذف الحساب نهائياً' : 'Delete Account Now'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VendorDashboard;
