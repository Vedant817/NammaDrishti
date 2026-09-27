// src/utils/imageOptimizer.js
/**
 * Compresses and downscales user hazard photo uploads on the client side using HTML5 Canvas.
 * Reduces 4K/12MP mobile photos (4-10MB) to ~70-120KB for instantaneous upload & storage.
 */
export const compressImage = (file, maxWidthOrOptions = 1200, maxHeight = 1200, quality = 0.72) => {
  return new Promise((resolve, reject) => {
    if (!file || !file.type || !file.type.startsWith('image/')) {
      return reject(new Error('Invalid image file format'));
    }

    let targetMaxWidth = 1200;
    let targetMaxHeight = 1200;
    let targetQuality = 0.72;

    if (typeof maxWidthOrOptions === 'object' && maxWidthOrOptions !== null) {
      targetMaxWidth = maxWidthOrOptions.maxWidth || 1200;
      targetMaxHeight = maxWidthOrOptions.maxHeight || targetMaxWidth;
      targetQuality = maxWidthOrOptions.quality !== undefined ? maxWidthOrOptions.quality : 0.72;
    } else if (typeof maxWidthOrOptions === 'number') {
      targetMaxWidth = maxWidthOrOptions;
      targetMaxHeight = typeof maxHeight === 'number' ? maxHeight : 1200;
      targetQuality = typeof quality === 'number' ? quality : 0.72;
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
          if (width > targetMaxWidth) {
            height = Math.round((height * targetMaxWidth) / width);
            width = targetMaxWidth;
          }
        } else {
          if (height > targetMaxHeight) {
            width = Math.round((width * targetMaxHeight) / height);
            height = targetMaxHeight;
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
        const compressedDataUrl = canvas.toDataURL('image/jpeg', targetQuality);
        const compressedSizeKb = Math.round((compressedDataUrl.length * 3) / 4 / 1024);

        resolve({
          dataUrl: compressedDataUrl,
          originalSizeKb,
          compressedSizeKb,
          width,
          height,
        });
      };

      img.onerror = () => {
        reject(new Error('Failed to load image for canvas compression'));
      };
    };

    reader.onerror = (err) => {
      reject(err);
    };
  });
};
