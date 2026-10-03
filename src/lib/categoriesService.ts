import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';

export interface CategoryItem {
  id: string;
  labelEn: string;
  labelAr: string;
  image: string;
  gradient: string;
}

export const DEFAULT_CATEGORIES: CategoryItem[] = [
  { 
    id: 'All', 
    labelEn: 'All Drops', 
    labelAr: 'الكل 🔥', 
    image: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=300&q=80',
    gradient: 'from-amber-500 via-rose-500 to-fuchsia-600' 
  },
  { 
    id: 'Clothes', 
    labelEn: 'Clothes', 
    labelAr: 'أزياء', 
    image: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=300&q=80',
    gradient: 'from-pink-500 to-rose-500' 
  },
  { 
    id: 'Accessories', 
    labelEn: 'Accessories', 
    labelAr: 'إكسسوارات', 
    image: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=300&q=80',
    gradient: 'from-purple-500 to-pink-500' 
  },
  { 
    id: 'Tech', 
    labelEn: 'Tech & Cases', 
    labelAr: 'كفرات وتيك', 
    image: 'https://images.unsplash.com/photo-1580910051074-3eb694886505?auto=format&fit=crop&w=300&q=80',
    gradient: 'from-cyan-500 to-blue-600' 
  },
  { 
    id: 'Beauty', 
    labelEn: 'Beauty & Skincare', 
    labelAr: 'عناية ومكياج', 
    image: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=300&q=80',
    gradient: 'from-rose-400 to-pink-600' 
  },
  { 
    id: 'Gifts', 
    labelEn: 'Gifts & Home', 
    labelAr: 'هدايا وديكور', 
    image: 'https://images.unsplash.com/photo-1590736969955-71cc94801759?auto=format&fit=crop&w=300&q=80',
    gradient: 'from-emerald-400 to-teal-600' 
  }
];

// Curated high quality presets for Lebanese boutiques
export const CATEGORY_IMAGE_PRESETS = [
  { label: '💄 عناية ومكياج (مستحضرات وعطور)', url: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=300&q=80' },
  { label: '✨ ميك اب وسيروم فاخر', url: 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=300&q=80' },
  { label: '🧴 كريمات وعناية بالبشرة', url: 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&w=300&q=80' },
  { label: '👗 فساتين وأزياء راقية', url: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=300&q=80' },
  { label: '💍 مجوهرات وذهب وألماس', url: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=300&q=80' },
  { label: '📱 كفرات آيفون وإلكترونيات', url: 'https://images.unsplash.com/photo-1580910051074-3eb694886505?auto=format&fit=crop&w=300&q=80' },
  { label: '🕯️ شموع وهدايا منزلية', url: 'https://images.unsplash.com/photo-1590736969955-71cc94801759?auto=format&fit=crop&w=300&q=80' },
  { label: '👜 حقائب جلدية نسائية', url: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=300&q=80' },
  { label: '👠 أحذية وترند', url: 'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?auto=format&fit=crop&w=300&q=80' },
];

export const GRADIENT_PRESETS = [
  { label: 'وردي أنيق', class: 'from-pink-500 to-rose-500' },
  { label: 'أحمر وياقوت', class: 'from-rose-400 to-pink-600' },
  { label: 'بنفسجي ملكي', class: 'from-purple-500 to-pink-500' },
  { label: 'سماوي وأزرق', class: 'from-cyan-500 to-blue-600' },
  { label: 'أخضر وزمرد', class: 'from-emerald-400 to-teal-600' },
  { label: 'ذهبي وغروب', class: 'from-amber-500 via-rose-500 to-fuchsia-600' },
  { label: 'أسود وفضي', class: 'from-stone-700 to-stone-900' },
];

/**
 * Fetch categories from Firestore or fallback to DEFAULT_CATEGORIES
 */
export async function fetchCategoriesFromDB(): Promise<CategoryItem[]> {
  try {
    const docRef = doc(db, 'settings', 'categories');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      if (Array.isArray(data.items) && data.items.length > 0) {
        return data.items as CategoryItem[];
      }
    }
  } catch (err) {
    console.warn('Notice loading categories from Firestore:', err);
  }

  return DEFAULT_CATEGORIES;
}

/**
 * Save categories to Firestore
 */
export async function saveCategoriesToDB(categories: CategoryItem[]): Promise<boolean> {
  try {
    const docRef = doc(db, 'settings', 'categories');
    await setDoc(docRef, {
      items: categories,
      updated_at: new Date().toISOString()
    }, { merge: true });
    return true;
  } catch (err) {
    console.warn('Could not save categories to Firestore doc:', err);
    return false;
  }
}

/**
 * Real-time listener for categories
 */
export function subscribeToCategories(
  onUpdate: (cats: CategoryItem[]) => void
): () => void {
  try {
    const docRef = doc(db, 'settings', 'categories');
    return onSnapshot(docRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (Array.isArray(data.items) && data.items.length > 0) {
          onUpdate(data.items);
          return;
        }
      }
      onUpdate(DEFAULT_CATEGORIES);
    }, (err) => {
      console.warn('Categories subscription fallback to defaults:', err);
      onUpdate(DEFAULT_CATEGORIES);
    });
  } catch {
    return () => {};
  }
}
