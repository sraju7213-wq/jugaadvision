import { forwardToHandler } from '../_helper';

export const config = {
  maxDuration: 60,
  api: {
    bodyParser: {
      sizeLimit: '2mb',
    },
  },
};

export default async function handler(req: any, res: any) {
  let path = '/api/settings';
  if (req.query?.slug) {
    const slugStr = Array.isArray(req.query.slug) ? req.query.slug.join('/') : req.query.slug;
    path = `/api/settings/${slugStr}`;
  }
  return forwardToHandler(path, req, res);
}
