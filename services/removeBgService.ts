/**
 * Background Removal Service
 * Completely secure: Zero API keys in frontend code.
 * Routes through the protected server AI gateway (/api/ai/remove-bg).
 */

export const removeBackground = async (imageFile: File): Promise<string> => {
  try {
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Failed to read image file.'));
      reader.readAsDataURL(imageFile);
    });

    const response = await fetch('/api/ai/remove-bg', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        imageBase64: base64,
        size: 'auto',
      }),
    });

    const contentType = response.headers.get('content-type') || '';
    const data = contentType.includes('application/json')
      ? await response.json()
      : { success: false, error: await response.text() };

    if (!response.ok || !data.success) {
      throw new Error(data.error || `Error ${response.status}: Failed to remove background.`);
    }

    return data.imageBase64;
  } catch (error: any) {
    console.error('[RemoveBackground] Service Error:', error);
    throw error;
  }
};
