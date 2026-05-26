// POST /api/predict — create Replicate prediction
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

module.exports = async (req, res) => {
  Object.entries(corsHeaders).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { personImageUrl, garmentImageUrl, garmentDescription, token } = req.body || {};
  const apiKey = token || process.env.REPLICATE_API_TOKEN;

  if (!personImageUrl || !garmentImageUrl) return res.status(400).json({ error: 'Missing image URLs' });
  if (!apiKey) return res.status(400).json({ error: 'Missing Replicate API token' });

  const createRes = await fetch('https://api.replicate.com/v1/models/yisol/idm-vton/predictions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      input: {
        human_img: personImageUrl,
        garm_img: garmentImageUrl,
        garment_des: garmentDescription || 'toddler girl outfit',
        is_checked: true,
        is_checked_crop: false,
        denoise_steps: 30,
        seed: 42,
      }
    })
  });

  const prediction = await createRes.json();
  if (!createRes.ok) return res.status(createRes.status).json({ error: prediction.detail || 'API error' });

  return res.status(200).json({ id: prediction.id, status: prediction.status });
};
