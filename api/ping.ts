import { maskApiKey, redactSecrets } from './_lib/pools/keyPool';
import { capabilityClassifier } from './_lib/classification/capabilityClassifier';
import { isSSRFSafeUrl, sanitizeInput } from './_lib/security';

export default function handler(req: any, res: any) {
  try {
    const masked = maskApiKey('test-key-12345');
    const ssrf = isSSRFSafeUrl('https://api.openai.com');
    res.status(200).json({
      pong: true,
      masked,
      ssrf,
      timestamp: Date.now(),
    });
  } catch (err: any) {
    res.status(200).json({
      error: err?.message,
      stack: err?.stack,
    });
  }
}
