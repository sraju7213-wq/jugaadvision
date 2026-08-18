import { forwardToHandler } from '../_helper';

export const config = {
  maxDuration: 60,
};

export default async function handler(req: any, res: any) {
  return forwardToHandler('/api/settings/custom-endpoint', req, res);
}
