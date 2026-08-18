export default function handler(req: any, res: any) {
  if (res && typeof res.setHeader === 'function') {
    res.setHeader('Content-Type', 'application/json');
    res.statusCode = 200;
    res.end(JSON.stringify({ pong: true, timestamp: Date.now() }));
    return;
  }
  return new Response(JSON.stringify({ pong: true, timestamp: Date.now() }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
