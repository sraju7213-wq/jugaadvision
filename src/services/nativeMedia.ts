/**
 * Native Media, Haptics & Sharing Service
 *
 * Provides unified native Android capabilities with seamless Web fallbacks:
 * - Native Camera & Gallery Photo Picker (@capacitor/camera)
 * - Native System Share Sheet (@capacitor/share)
 * - Tactile Haptic Feedback (@capacitor/haptics)
 * - Platform detection (@capacitor/core)
 */

import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Share } from '@capacitor/share';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

export function isNativeMobile(): boolean {
  return Capacitor.isNativePlatform();
}

// ── Tactile Haptic Feedback ──────────────────────────────────────────────────

export async function triggerHaptic(
  type: 'light' | 'medium' | 'heavy' | 'selection' | 'success' | 'warning' | 'error' = 'light'
): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    switch (type) {
      case 'light':
        await Haptics.impact({ style: ImpactStyle.Light });
        break;
      case 'medium':
        await Haptics.impact({ style: ImpactStyle.Medium });
        break;
      case 'heavy':
        await Haptics.impact({ style: ImpactStyle.Heavy });
        break;
      case 'selection':
        await Haptics.selectionStart();
        break;
      case 'success':
        await Haptics.notification({ type: NotificationType.Success });
        break;
      case 'warning':
        await Haptics.notification({ type: NotificationType.Warning });
        break;
      case 'error':
        await Haptics.notification({ type: NotificationType.Error });
        break;
    }
  } catch {
    // Ignore haptic failures silently
  }
}

// ── Native System Share ──────────────────────────────────────────────────────

export interface ShareOptions {
  title?: string;
  text?: string;
  url?: string;
  dialogTitle?: string;
}

export async function shareContent(options: ShareOptions): Promise<{ shared: boolean; method: 'native' | 'web-share' | 'clipboard' }> {
  triggerHaptic('light');

  // 1. Try Capacitor Native Share
  if (Capacitor.isNativePlatform()) {
    try {
      const canShare = await Share.canShare();
      if (canShare.value) {
        await Share.share({
          title: options.title || 'Jugaad Visuals',
          text: options.text || '',
          url: options.url,
          dialogTitle: options.dialogTitle || 'Share Prompt',
        });
        triggerHaptic('success');
        return { shared: true, method: 'native' };
      }
    } catch (err: any) {
      if (err.name === 'AbortError' || err.message?.includes('cancel')) {
        return { shared: false, method: 'native' };
      }
    }
  }

  // 2. Try Web Share API
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({
        title: options.title || 'Jugaad Visuals',
        text: options.text || '',
        url: options.url,
      });
      triggerHaptic('success');
      return { shared: true, method: 'web-share' };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return { shared: false, method: 'web-share' };
      }
    }
  }

  // 3. Fallback to Clipboard Copy
  if (typeof navigator !== 'undefined' && navigator.clipboard && options.text) {
    await navigator.clipboard.writeText(options.text);
    triggerHaptic('success');
    return { shared: true, method: 'clipboard' };
  }

  return { shared: false, method: 'clipboard' };
}

// ── Native Camera / Photo Picker ─────────────────────────────────────────────

export interface PickedImageResult {
  base64: string;
  mimeType: string;
  dataUrl: string;
  fileName?: string;
}

export async function pickImageFromDevice(
  source: 'prompt' | 'camera' | 'photos' = 'prompt'
): Promise<PickedImageResult | null> {
  triggerHaptic('selection');

  if (Capacitor.isNativePlatform()) {
    try {
      const capSource =
        source === 'camera'
          ? CameraSource.Camera
          : source === 'photos'
          ? CameraSource.Photos
          : CameraSource.Prompt;

      const photo = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.Base64,
        source: capSource,
      });

      if (!photo.base64String) return null;

      const format = photo.format || 'jpeg';
      const mimeType = `image/${format === 'jpg' ? 'jpeg' : format}`;
      const dataUrl = `data:${mimeType};base64,${photo.base64String}`;

      triggerHaptic('success');
      return {
        base64: photo.base64String,
        mimeType,
        dataUrl,
        fileName: `mobile_${Date.now()}.${format}`,
      };
    } catch (err: any) {
      if (err.message?.includes('cancelled') || err.message?.includes('User cancelled')) {
        return null;
      }
      console.warn('[nativeMedia] Camera plugin error, falling back to web file input:', err);
    }
  }

  // Fallback: Web browser file picker
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    if (source === 'camera') {
      input.capture = 'environment';
    }

    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const mimeType = file.type || 'image/jpeg';
        const base64 = dataUrl.split(',')[1] || '';
        triggerHaptic('success');
        resolve({
          base64,
          mimeType,
          dataUrl,
          fileName: file.name,
        });
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    };

    input.click();
  });
}
