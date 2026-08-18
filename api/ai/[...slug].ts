import { forwardToHandler } from '../_helper';

export const config = {
  maxDuration: 60,
  api: {
    bodyParser: {
      sizeLimit: '15mb',
    },
  },
};

export default async function handler(req: any, res: any) {
  let path = '/api/ai';
  if (req.query?.slug) {
    const slugStr = Array.isArray(req.query.slug) ? req.query.slug.join('/') : req.query.slug;
    path = `/api/ai/${slugStr}`;
  }
  return forwardToHandler(path, req, res);
}
