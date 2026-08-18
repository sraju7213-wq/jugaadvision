import { forwardToHandler } from './_helper';

export const config = {
  maxDuration: 60,
  api: {
    bodyParser: {
      sizeLimit: '2mb',
    },
  },
};

export default async function handler(req: any, res: any) {
  return forwardToHandler('/api/creative-mix', req, res);
}
