// A profile photo, read on the device. In the mock it never leaves the device;
// when the backend lands it uploads, and photo moderation comes with it.

export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const SIZE = 256;

export type PhotoResult = { ok: true; dataUrl: string } | { ok: false; error: string };

export async function readPhoto(file: File): Promise<PhotoResult> {
  if (!file.type.startsWith('image/')) return { ok: false, error: 'Choose a photo: JPEG, PNG, WebP or HEIC.' };
  if (file.size > MAX_PHOTO_BYTES) return { ok: false, error: 'That photo is over 5 MB. Try a smaller one.' };
  try {
    // Shrink to a small square so it stays light wherever it shows (and in storage).
    if (typeof createImageBitmap === 'function') return { ok: true, dataUrl: await square(file) };
    return { ok: true, dataUrl: await asDataUrl(file) };
  } catch {
    return { ok: false, error: "Couldn't read that photo. Try another one." };
  }
}

async function square(file: File): Promise<string> {
  const image = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no canvas');
  const side = Math.min(image.width, image.height);
  ctx.drawImage(image, (image.width - side) / 2, (image.height - side) / 2, side, side, 0, 0, SIZE, SIZE);
  image.close();
  return canvas.toDataURL('image/jpeg', 0.85);
}

function asDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
