// GET /api/status?id=xxx — poll Replicate prediction status
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

module.exports = async (req, res) => {
  Object.entries(corsHeaders).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { id, token } = req.query;
  const apiKey = token || process.env.REPLICATE_API_TOKEN;

  if (!id) return res.status(400).json({ error: 'Missing prediction id' });
  if (!apiKey) return res.status(400).json({ error: 'Missing token' });

  const pollRes = await fetch(`https://api.replicate.com/v1/predictions/${id}`, {
    headers: { 'Authorization': `Bearer ${apiKey}` }
  });

  const data = await pollRes.json();
  return res.status(pollRes.ok ? 200 : pollRes.status).json(data);
};
