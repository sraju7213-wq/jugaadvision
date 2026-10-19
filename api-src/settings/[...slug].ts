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
  const querySlug = req.query?.slug
    ? (Array.isArray(req.query.slug) ? req.query.slug.join('/') : req.query.slug)
    : '';
  const urlSlug = typeof req.url === 'string'
    ? (req.url.split('?')[0].match(/^\/api\/settings\/(.+)$/)?.[1] || '')
    : '';
  const slug = querySlug || urlSlug;
  const path = slug ? `/api/settings/${slug}` : '/api/settings';
  return forwardToHandler(path, req, res);
}
