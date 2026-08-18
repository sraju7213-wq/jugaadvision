import { isSSRFSafeUrl } from './_lib/security';

export default function handler(req: any, res: any) {
  res.status(200).json({
    pong: true,
    safe: isSSRFSafeUrl('https://example.com'),
    timestamp: Date.now(),
  });
}
