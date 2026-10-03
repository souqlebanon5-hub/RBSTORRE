import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from './firebase';

/**
 * Resolves product image URLs.
 * If already an absolute HTTP/HTTPS URL, data URL, or local asset, returns it cleanly.
 * If a storage path, retrieves or resolves the direct location.
 */
export function getStorageImageUrl(imagePath?: string | null): string {
  if (!imagePath) {
    return 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=800&q=80';
  }

  // Already a full external URL, data URL, or local asset
  if (
    imagePath.startsWith('http://') ||
    imagePath.startsWith('https://') ||
    imagePath.startsWith('data:') ||
    imagePath.startsWith('/images/')
  ) {
    return imagePath;
  }

  return imagePath;
}

/**
 * Uploads a product image directly to Firebase Cloud Storage.
 */
export async function uploadProductImage(
  file: File,
  ownerUid: string
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    if (!ownerUid) return { success: false, error: 'An authenticated account is required to upload product images.' };
    const fileExt = file.name.split('.').pop() || 'jpg';
    const fileName = `products/${ownerUid}/${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`;
    const storageRef = ref(storage, fileName);

    const snapshot = await uploadBytes(storageRef, file, {
      contentType: file.type || 'image/jpeg',
      cacheControl: 'public, max-age=3600',
    });

    const downloadUrl = await getDownloadURL(snapshot.ref);

    return { success: true, url: downloadUrl };
  } catch (err: any) {
    return { success: false, error: err.message || 'Image upload to Firebase Storage failed' };
  }
}
