import { isSSRFSafeUrl } from '../server/ai/security';

export default function handler(req: any, res: any) {
  res.status(200).json({
    pong: true,
    safe: isSSRFSafeUrl('https://api.openai.com'),
    timestamp: Date.now(),
  });
}
