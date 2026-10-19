/**
 * Media, Sharing & Feedback Service (web-only)
 *
 * Browser-native capabilities with graceful fallbacks:
 * - share:     Web Share API → clipboard copy fallback
 * - file pick: <input type=file> (with `capture` for camera-capable devices)
 * - haptics:   no-op on the web (kept as a no-op so call sites stay simple)
 */

// ── Tactile Feedback ─────────────────────────────────────────────────────────

/** No-op on the web. Kept so call sites don't need platform conditionals. */
export async function triggerHaptic(
  _type: 'light' | 'medium' | 'heavy' | 'selection' | 'success' | 'warning' | 'error' = 'light'
): Promise<void> {
  // Intentionally empty — the website has no haptic hardware.
}

// ── System Share ─────────────────────────────────────────────────────────────

export interface ShareOptions {
  title?: string;
  text?: string;
  url?: string;
  dialogTitle?: string;
}

export async function shareContent(
  options: ShareOptions
): Promise<{ shared: boolean; method: 'web-share' | 'clipboard' }> {
  // 1. Try Web Share API (available on most mobile browsers + some desktops)
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({
        title: options.title || 'Jugaad Visuals',
        text: options.text || '',
        url: options.url,
      });
      return { shared: true, method: 'web-share' };
    } catch (err: any) {
      // User dismissed the share sheet — not an error.
      if (err?.name === 'AbortError') {
        return { shared: false, method: 'web-share' };
      }
    }
  }

  // 2. Fallback: copy text to clipboard
  if (typeof navigator !== 'undefined' && navigator.clipboard && options.text) {
    try {
      await navigator.clipboard.writeText(options.text);
      return { shared: true, method: 'clipboard' };
    } catch {
      return { shared: false, method: 'clipboard' };
    }
  }

  return { shared: false, method: 'clipboard' };
}

// ── Photo / File Picker ──────────────────────────────────────────────────────

export interface PickedImageResult {
  base64: string;
  mimeType: string;
  dataUrl: string;
  fileName?: string;
}

export async function pickImageFromDevice(
  source: 'prompt' | 'camera' | 'photos' = 'prompt'
): Promise<PickedImageResult | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    if (source === 'camera') {
      // Hint mobile browsers to open the camera directly.
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

    // The file dialog was dismissed without choosing (best-effort detection).
    input.oncancel = () => resolve(null);

    input.click();
  });
}
