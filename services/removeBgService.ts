
const REMOVE_BG_API_KEY = 'PCH4kRJRG4gQQjhhpG6yNSi6';
const API_URL = 'https://api.remove.bg/v1.0/removebg';

export const removeBackground = async (imageFile: File): Promise<string> => {
  try {
    const formData = new FormData();
    formData.append('image_file', imageFile);
    formData.append('size', 'auto');

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'X-Api-Key': REMOVE_BG_API_KEY,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.errors?.[0]?.title || `Error ${response.status}: Failed to remove background.`);
    }

    const blob = await response.blob();
    return URL.createObjectURL(blob);
  } catch (error) {
    console.error("Remove Background Error:", error);
    throw error;
  }
};
