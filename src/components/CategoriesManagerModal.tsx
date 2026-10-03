'use client';

import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  X, 
  Plus, 
  Edit3, 
  Trash2, 
  Check, 
  Image as ImageIcon, 
  Palette, 
  RotateCcw, 
  Save, 
  ExternalLink,
  Layers,
  ArrowRight,
  ArrowLeft
} from 'lucide-react';
import { 
  CategoryItem, 
  DEFAULT_CATEGORIES, 
  CATEGORY_IMAGE_PRESETS, 
  GRADIENT_PRESETS,
  fetchCategoriesFromDB,
  saveCategoriesToDB
} from '../lib/categoriesService';
import { useI18n } from '../lib/i18nContext';

interface CategoriesManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCategoriesUpdated?: (categories: CategoryItem[]) => void;
}

export const CategoriesManagerModal: React.FC<CategoriesManagerModalProps> = ({
  isOpen,
  onClose,
  onCategoriesUpdated
}) => {
  const { locale, dir } = useI18n();
  const isAr = locale === 'ar';

  const [categories, setCategories] = useState<CategoryItem[]>(DEFAULT_CATEGORIES);
  const [editingCategory, setEditingCategory] = useState<CategoryItem | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Form states for active edit/add
  const [formId, setFormId] = useState('');
  const [formLabelAr, setFormLabelAr] = useState('');
  const [formLabelEn, setFormLabelEn] = useState('');
  const [formImage, setFormImage] = useState('');
  const [formGradient, setFormGradient] = useState(GRADIENT_PRESETS[0].class);

  useEffect(() => {
    if (isOpen) {
      fetchCategoriesFromDB().then(data => {
        if (data && data.length > 0) {
          setCategories(data);
        }
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const showNotification = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 3500);
  };

  const handleStartEdit = (cat: CategoryItem) => {
    setEditingCategory(cat);
    setIsAddingNew(false);
    setFormId(cat.id);
    setFormLabelAr(cat.labelAr);
    setFormLabelEn(cat.labelEn);
    setFormImage(cat.image);
    setFormGradient(cat.gradient);
  };

  const handleStartAdd = () => {
    setIsAddingNew(true);
    setEditingCategory(null);
    const newId = `Cat_${Date.now().toString(36)}`;
    setFormId(newId);
    setFormLabelAr('');
    setFormLabelEn('');
    setFormImage(CATEGORY_IMAGE_PRESETS[0].url);
    setFormGradient(GRADIENT_PRESETS[0].class);
  };

  const handleCancelForm = () => {
    setEditingCategory(null);
    setIsAddingNew(false);
  };

  const handleSaveForm = async () => {
    if (!formLabelAr.trim() || !formImage.trim()) {
      alert(isAr ? 'يرجى كتابة اسم القسم وتحديد رابط الصورة' : 'Please provide category name and image URL');
      return;
    }

    const updatedItem: CategoryItem = {
      id: formId.trim() || `cat_${Date.now()}`,
      labelAr: formLabelAr.trim(),
      labelEn: formLabelEn.trim() || formLabelAr.trim(),
      image: formImage.trim(),
      gradient: formGradient
    };

    let updatedList: CategoryItem[];
    if (isAddingNew) {
      updatedList = [...categories, updatedItem];
    } else {
      updatedList = categories.map(c => c.id === formId ? updatedItem : c);
    }

    setCategories(updatedList);
    setEditingCategory(null);
    setIsAddingNew(false);

    setIsSaving(true);
    await saveCategoriesToDB(updatedList);
    setIsSaving(false);

    if (onCategoriesUpdated) {
      onCategoriesUpdated(updatedList);
    }

    showNotification(isAr ? 'تم حفظ التعديلات بنجاح وستظهر مباشرة في المتجر!' : 'Category updated and live on storefront!');
  };

  const handleDeleteCategory = async (id: string) => {
    if (id === 'All') {
      alert(isAr ? 'لا يمكن حذف قسم "الكل"' : 'Cannot delete "All Drops" category');
      return;
    }

    if (!confirm(isAr ? 'هل أنت متأكد من حذف هذا القسم من المتجر؟' : 'Are you sure you want to remove this category?')) {
      return;
    }

    const filtered = categories.filter(c => c.id !== id);
    setCategories(filtered);

    setIsSaving(true);
    await saveCategoriesToDB(filtered);
    setIsSaving(false);

    if (onCategoriesUpdated) {
      onCategoriesUpdated(filtered);
    }

    showNotification(isAr ? 'تم حذف القسم بنجاح' : 'Category removed');
  };

  const handleResetDefaults = async () => {
    if (!confirm(isAr ? 'هل تريد استعادة الأقسام والصور الافتراضية؟' : 'Reset categories to default?')) {
      return;
    }

    setCategories(DEFAULT_CATEGORIES);
    setIsSaving(true);
    await saveCategoriesToDB(DEFAULT_CATEGORIES);
    setIsSaving(false);

    if (onCategoriesUpdated) {
      onCategoriesUpdated(DEFAULT_CATEGORIES);
    }

    showNotification(isAr ? 'تمت استعادة الأقسام والصور الافتراضية' : 'Reset to default categories successfully');
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6" dir={dir}>
      <div className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Modal Header */}
        <div className="p-4 sm:p-6 bg-gradient-to-r from-stone-900 via-stone-850 to-stone-900 text-white flex items-center justify-between border-b border-stone-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-pink-500 to-amber-500 flex items-center justify-center text-white shadow-md shadow-pink-500/30">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black tracking-tight flex items-center gap-2">
                <span>{isAr ? 'إدارة أقسام وقصص المتجر (Visual Story Categories)' : 'Storefront Story Categories Manager'}</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-pink-500/20 text-pink-300 border border-pink-500/30">
                  Super Admin
                </span>
              </h2>
              <p className="text-xs text-stone-400">
                {isAr 
                  ? 'تحكم بالدوائر والقصص التي تظهر في الواجهة الرئيسية للمشترين، عدّل الصور، أو أضف أقساماً جديدة.' 
                  : 'Customize the circular story bubbles on the storefront, update category images, or add new collections.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-stone-300 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Toast alert */}
        {successToast && (
          <div className="bg-emerald-600 text-white text-xs font-bold px-4 py-2.5 flex items-center justify-between shadow-md">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4" />
              <span>{successToast}</span>
            </div>
            <button onClick={() => setSuccessToast(null)} className="text-white/80 hover:text-white text-xs font-mono">✕</button>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-6">
          
          {/* Active Edit / Add Section */}
          {(editingCategory || isAddingNew) ? (
            <div className="bg-stone-50 border-2 border-pink-500/30 rounded-2xl p-4 sm:p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-stone-200">
                <div className="flex items-center gap-2 text-stone-900 font-bold text-sm">
                  <Edit3 className="w-4 h-4 text-pink-600" />
                  <span>
                    {isAddingNew 
                      ? (isAr ? 'إضافة قسم متجر جديد' : 'Add New Category')
                      : (isAr ? `تعديل قسم: ${editingCategory?.labelAr}` : `Edit Category: ${editingCategory?.labelEn}`)}
                  </span>
                </div>
                <button
                  onClick={handleCancelForm}
                  className="text-xs text-stone-500 hover:text-stone-800 font-bold transition-colors cursor-pointer"
                >
                  {isAr ? 'إلغاء التعديل' : 'Cancel'}
                </button>
              </div>

              {/* Form Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    {isAr ? 'اسم القسم بالعربية (مثال: عناية ومكياج):' : 'Arabic Title:'}
                  </label>
                  <input
                    type="text"
                    value={formLabelAr}
                    onChange={(e) => setFormLabelAr(e.target.value)}
                    placeholder="عناية ومكياج"
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs font-bold text-stone-900 focus:outline-none focus:ring-2 focus:ring-pink-500/30 focus:border-pink-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    {isAr ? 'اسم القسم بالإنجليزية (اختياري):' : 'English Title:'}
                  </label>
                  <input
                    type="text"
                    value={formLabelEn}
                    onChange={(e) => setFormLabelEn(e.target.value)}
                    placeholder="Beauty & Skincare"
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs font-semibold text-stone-900 focus:outline-none focus:ring-2 focus:ring-pink-500/30 focus:border-pink-500"
                  />
                </div>
              </div>

              {/* Image URL & Live Preview */}
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5 text-pink-600" />
                    <span>{isAr ? 'رابط الصورة المباشر (Direct Image URL):' : 'Direct Image URL:'}</span>
                  </span>
                  <span className="text-[10px] text-stone-400">
                    {isAr ? 'يمكنك لصق أي رابط أو الاختيار من الصور الجاهزة أدناه' : 'Paste any URL or pick from curated presets below'}
                  </span>
                </label>
                
                <div className="flex gap-3 items-center">
                  {/* Live Story Ring Preview */}
                  <div className={`p-0.5 rounded-full shrink-0 bg-gradient-to-tr ${formGradient} shadow-md`}>
                    <div className="w-14 h-14 rounded-full overflow-hidden bg-white p-0.5">
                      <img
                        src={formImage || 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=300&q=80'}
                        alt="Preview"
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover rounded-full"
                        onError={(e) => {
                          e.currentTarget.src = 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=300&q=80';
                        }}
                      />
                    </div>
                  </div>

                  <input
                    type="url"
                    value={formImage}
                    onChange={(e) => setFormImage(e.target.value)}
                    placeholder="https://images.unsplash.com/..."
                    className="flex-1 px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs font-mono text-stone-900 focus:outline-none focus:ring-2 focus:ring-pink-500/30 focus:border-pink-500"
                  />
                </div>
              </div>

              {/* Curated High-Res Image Presets */}
              <div>
                <span className="text-xs font-bold text-stone-700 block mb-2">
                  {isAr ? '✨ صور عالية الدقة مقترحة للمتاجر اللبنانية (انقر للاختيار الفوري):' : '✨ Curated High-Res Presets (Click to apply immediately):'}
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {CATEGORY_IMAGE_PRESETS.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setFormImage(preset.url)}
                      className={`flex items-center gap-2 p-1.5 rounded-xl border text-xs text-start transition-all cursor-pointer ${
                        formImage === preset.url
                          ? 'bg-pink-50 border-pink-500 text-pink-900 font-bold ring-2 ring-pink-500/20'
                          : 'bg-white border-stone-200 hover:border-stone-400 text-stone-700'
                      }`}
                    >
                      <img 
                        src={preset.url} 
                        alt={preset.label} 
                        referrerPolicy="no-referrer"
                        className="w-8 h-8 rounded-lg object-cover shrink-0" 
                      />
                      <span className="truncate text-[11px]">{preset.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Gradient Ring Presets */}
              <div>
                <span className="text-xs font-bold text-stone-700 block mb-1.5">
                  {isAr ? 'إطار التدرج اللوني الدائري (Story Ring Gradient):' : 'Ring Gradient Color:'}
                </span>
                <div className="flex flex-wrap gap-2">
                  {GRADIENT_PRESETS.map((grad, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setFormGradient(grad.class)}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border transition-all cursor-pointer ${
                        formGradient === grad.class 
                          ? 'border-black bg-stone-900 text-white font-bold' 
                          : 'border-stone-200 bg-white text-stone-700 hover:border-stone-400'
                      }`}
                    >
                      <span className={`w-3.5 h-3.5 rounded-full bg-gradient-to-tr ${grad.class}`} />
                      <span>{grad.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Action Buttons for Form */}
              <div className="pt-3 border-t border-stone-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={handleCancelForm}
                  className="px-4 py-2 bg-white hover:bg-stone-100 border border-stone-300 text-stone-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="button"
                  onClick={handleSaveForm}
                  disabled={isSaving}
                  className="px-5 py-2 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 text-white rounded-xl text-xs font-black shadow-md shadow-pink-500/25 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSaving ? (isAr ? 'جارِ الحفظ...' : 'Saving...') : (isAr ? 'تأكيد وحفظ القسم' : 'Save Category')}</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-black text-stone-900 text-sm sm:text-base">
                  {isAr ? 'الأقسام المعروضة حالياً على واجهة المتجر:' : 'Current Live Categories on Storefront:'}
                </h3>
                <p className="text-xs text-stone-500">
                  {isAr 
                    ? `إجمالي الأقسام: ${categories.length} أقسام. يمكنك النقر على أي قسم لتعديل اسمه أو صورته فوراً.`
                    : `${categories.length} total categories. Click edit on any category to change image or names.`}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleResetDefaults}
                  className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{isAr ? 'استعادة الافتراضي' : 'Reset Defaults'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleStartAdd}
                  className="px-4 py-1.5 bg-stone-900 hover:bg-black text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>{isAr ? 'إضافة قسم جديد' : 'Add Category'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Categories Grid List */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {categories.map((cat, idx) => {
              const isDefaultAll = cat.id === 'All';

              return (
                <div
                  key={cat.id}
                  className="bg-white rounded-2xl border border-stone-200 p-3.5 shadow-2xs hover:shadow-md transition-all flex items-center justify-between gap-3 text-start"
                >
                  {/* Left: Circular story preview */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`p-0.5 rounded-full shrink-0 bg-gradient-to-tr ${cat.gradient} shadow-xs`}>
                      <div className="w-12 h-12 rounded-full overflow-hidden bg-white p-0.5">
                        <img
                          src={cat.image}
                          alt={cat.labelAr}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover rounded-full"
                          onError={(e) => {
                            e.currentTarget.src = 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=300&q=80';
                          }}
                        />
                      </div>
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-extrabold text-stone-900 text-sm truncate">
                          {cat.labelAr}
                        </span>
                        <span className="text-[10px] font-mono text-stone-400 bg-stone-100 px-1.5 py-0.2 rounded">
                          #{idx + 1}
                        </span>
                      </div>
                      <span className="text-xs text-stone-500 block truncate">
                        {cat.labelEn}
                      </span>
                    </div>
                  </div>

                  {/* Actions: Edit & Delete */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleStartEdit(cat)}
                      className="p-2 text-stone-600 hover:text-pink-600 hover:bg-pink-50 rounded-xl transition-colors cursor-pointer"
                      title={isAr ? 'تعديل هذا القسم والصورة' : 'Edit this category'}
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>

                    {!isDefaultAll && (
                      <button
                        type="button"
                        onClick={() => handleDeleteCategory(cat.id)}
                        className="p-2 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                        title={isAr ? 'حذف هذا القسم' : 'Delete category'}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-stone-50 border-t border-stone-200 flex items-center justify-between text-xs text-stone-500">
          <span>
            {isAr ? '💡 يتم حفظ وتحديث الأقسام والصور مباشرة لجميع زوار المتجر.' : '💡 Category changes sync live for all shoppers in real-time.'}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-stone-900 hover:bg-black text-white font-bold rounded-xl transition-colors cursor-pointer"
          >
            {isAr ? 'إغلاق والعودة' : 'Done'}
          </button>
        </div>

      </div>
    </div>
  );
};
