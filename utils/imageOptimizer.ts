/**
 * Image Optimization Utilities
 * Handles compression, thumbnail generation, and caching for improved performance
 */

export interface ImageCompressionOptions {
    maxWidth?: number;
    maxHeight?: number;
    quality?: number;
    mimeType?: string;
}

export interface OptimizedImage {
    base64: string;
    mimeType: string;
    originalSize: number;
    compressedSize: number;
    width: number;
    height: number;
}

/**
 * Compress an image file to reduce size while maintaining quality
 */
export const compressImage = async (
    file: File,
    options: ImageCompressionOptions = {}
): Promise<OptimizedImage> => {
    const {
        maxWidth = 2048,
        maxHeight = 2048,
        quality = 0.85,
        mimeType = file.type,
    } = options;

    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            const img = new Image();

            img.onload = () => {
                // Calculate new dimensions while maintaining aspect ratio
                let { width, height } = img;

                if (width > maxWidth || height > maxHeight) {
                    const aspectRatio = width / height;

                    if (width > height) {
                        width = maxWidth;
                        height = Math.round(width / aspectRatio);
                    } else {
                        height = maxHeight;
                        width = Math.round(height * aspectRatio);
                    }
                }

                // Create canvas for compression
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    reject(new Error('Failed to get canvas context'));
                    return;
                }

                // Enable image smoothing for better quality
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';

                // Draw compressed image
                ctx.drawImage(img, 0, 0, width, height);

                // Convert to base64
                canvas.toBlob(
                    (blob) => {
                        if (!blob) {
                            reject(new Error('Failed to compress image'));
                            return;
                        }

                        const compressedReader = new FileReader();
                        compressedReader.onloadend = () => {
                            const base64 = (compressedReader.result as string).split(',')[1];

                            resolve({
                                base64,
                                mimeType,
                                originalSize: file.size,
                                compressedSize: blob.size,
                                width,
                                height,
                            });
                        };
                        compressedReader.onerror = reject;
                        compressedReader.readAsDataURL(blob);
                    },
                    mimeType,
                    quality
                );
            };

            img.onerror = () => reject(new Error('Failed to load image'));
            img.src = e.target?.result as string;
        };

        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};

/**
 * Generate a thumbnail for instant preview
 */
export const generateThumbnail = async (
    file: File,
    maxSize: number = 400
): Promise<string> => {
    const result = await compressImage(file, {
        maxWidth: maxSize,
        maxHeight: maxSize,
        quality: 0.7,
    });

    return `data:${result.mimeType};base64,${result.base64}`;
};

/**
 * Generate a hash for cache key
 */
export const generateImageHash = async (
    file: File,
    styles: string[]
): Promise<string> => {
    const fileData = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', fileData);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // Include styles in hash for unique cache key
    const styleKey = styles.sort().join('-');
    return `${hashHex.substring(0, 16)}-${styleKey}`;
};

/**
 * Cache interface for image-to-prompt results
 */
interface CachedPrompt {
    hash: string;
    prompt: string;
    timestamp: number;
    styles: string[];
}

const CACHE_KEY = 'image-to-prompt-cache';
const MAX_CACHE_SIZE = 5;
const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Get cached prompt result
 */
export const getCachedPrompt = (hash: string): string | null => {
    try {
        const cache = sessionStorage.getItem(CACHE_KEY);
        if (!cache) return null;

        const cached: CachedPrompt[] = JSON.parse(cache);
        const entry = cached.find(c => c.hash === hash);

        if (!entry) return null;

        // Check expiry
        if (Date.now() - entry.timestamp > CACHE_EXPIRY) {
            return null;
        }

        return entry.prompt;
    } catch (error) {
        console.error('Cache read error:', error);
        return null;
    }
};

/**
 * Save prompt to cache
 */
export const setCachedPrompt = (
    hash: string,
    prompt: string,
    styles: string[]
): void => {
    try {
        let cache: CachedPrompt[] = [];

        const existing = sessionStorage.getItem(CACHE_KEY);
        if (existing) {
            cache = JSON.parse(existing);
        }

        // Remove existing entry with same hash
        cache = cache.filter(c => c.hash !== hash);

        // Add new entry
        cache.unshift({
            hash,
            prompt,
            timestamp: Date.now(),
            styles,
        });

        // Limit cache size
        if (cache.length > MAX_CACHE_SIZE) {
            cache = cache.slice(0, MAX_CACHE_SIZE);
        }

        sessionStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    } catch (error) {
        console.error('Cache write error:', error);
    }
};

/**
 * Clear all cached prompts
 */
export const clearPromptCache = (): void => {
    try {
        sessionStorage.removeItem(CACHE_KEY);
    } catch (error) {
        console.error('Cache clear error:', error);
    }
};

/**
 * Get cache statistics
 */
export const getCacheStats = (): { count: number; totalSize: number } => {
    try {
        const cache = sessionStorage.getItem(CACHE_KEY);
        if (!cache) return { count: 0, totalSize: 0 };

        const cached: CachedPrompt[] = JSON.parse(cache);
        return {
            count: cached.length,
            totalSize: new Blob([cache]).size,
        };
    } catch (error) {
        return { count: 0, totalSize: 0 };
    }
};
