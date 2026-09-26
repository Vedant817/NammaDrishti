// src/utils/imageOptimizer.js
/**
 * Compresses and downscales user hazard photo uploads on the client side using HTML5 Canvas.
 * Reduces 4K/12MP mobile photos (4-10MB) to ~70-120KB for instantaneous upload & storage.
 */
export const compressImage = (file, maxWidth = 1200, maxHeight = 1200, quality = 0.72) => {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) {
      return reject(new Error('Invalid image file format'));
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);

    reader.onload = (readerEvent) => {
      const img = new Image();
      img.src = readerEvent.target.result;

      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Calculate aspect-ratio-preserving dimensions
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((height * maxHeight) / height);
            height = maxHeight;
          }
        }

        const originalSizeKb = Math.round(file.size / 1024);

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          // Fallback retaining expected object shape if canvas context is unavailable
          return resolve({
            dataUrl: readerEvent.target.result,
            originalSizeKb,
            compressedSizeKb: originalSizeKb,
            width,
            height,
          });
        }

        // Draw and compress to JPEG format
        ctx.drawImage(img, 0, 0, width, height);
        const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
        const compressedSizeKb = Math.round((compressedDataUrl.length * 3) / 4 / 1024);

        resolve({
          dataUrl: compressedDataUrl,
          originalSizeKb,
          compressedSizeKb,
          width,
          height,
        });
      };

      img.onerror = (err) => reject(err);
    };

    reader.onerror = (err) => reject(err);
  });
};
