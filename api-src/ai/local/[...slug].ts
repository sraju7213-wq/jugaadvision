import { forwardToHandler } from '../../_helper';

export const config = {
  maxDuration: 300,
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

export default async function handler(req: any, res: any) {
  let path = '/api/ai/local';
  if (req.query?.slug) {
    const slugStr = Array.isArray(req.query.slug) ? req.query.slug.join('/') : req.query.slug;
    path = `/api/ai/local/${slugStr}`;
  }
  return forwardToHandler(path, req, res);
}
