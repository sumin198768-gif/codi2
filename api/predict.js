// POST /api/predict — Replicate(유료) 또는 HuggingFace Space(무료) 사용
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

module.exports = async (req, res) => {
  Object.entries(corsHeaders).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { personImageUrl, garmentImageUrl, garmentDescription, token, hfToken } = req.body || {};
  if (!personImageUrl || !garmentImageUrl) return res.status(400).json({ error: 'Missing image URLs' });

  const apiKey = token || process.env.REPLICATE_API_TOKEN;

  // Replicate 토큰이 있으면 Replicate 사용
  if (apiKey) {
    const desc = (garmentDescription || '').toLowerCase();
    const category = (desc.includes('dress') || desc.includes('원피스') || desc.includes('jumpsuit')) ? 'dresses'
      : (desc.includes('pants') || desc.includes('skirt') || desc.includes('하의') || desc.includes('팬츠') || desc.includes('스커트')) ? 'lower_body'
      : 'upper_body';

    const createRes = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        version: '0513734a452173b8173e907e3a59d19a36266e55b48528559432bd21c7d7e985',
        input: {
          human_img: personImageUrl,
          garm_img: garmentImageUrl,
          garment_des: garmentDescription || 'toddler girl outfit',
          category,
          crop: false,
          steps: 30,
          seed: 42,
        }
      })
    });

    const prediction = await createRes.json();
    if (!createRes.ok) return res.status(createRes.status).json({ error: prediction.detail || 'Replicate API error' });
    return res.status(200).json({ id: prediction.id, status: prediction.status, provider: 'replicate' });
  }

  // 토큰 없으면 HuggingFace Space 무료 사용
  const sessionHash = Math.random().toString(36).substring(2, 12);
  const hfHeaders = { 'Content-Type': 'application/json' };
  if (hfToken) hfHeaders['Authorization'] = `Bearer ${hfToken}`;

  const makeFileData = (url) => ({
    path: url,
    url,
    orig_name: url.split('/').pop().split('?')[0] || 'image.jpg',
    meta: { _type: 'gradio.FileData' }
  });

  const joinRes = await fetch('https://yisol-idm-vton.hf.space/queue/join', {
    method: 'POST',
    headers: hfHeaders,
    body: JSON.stringify({
      fn_index: 2,
      api_name: '/tryon',
      data: [
        { background: makeFileData(personImageUrl), layers: [], composite: null },
        makeFileData(garmentImageUrl),
        garmentDescription || 'outfit',
        true,   // is_checked (auto masking)
        false,  // is_checked_crop
        30,     // denoise_steps
        42,     // seed
      ],
      session_hash: sessionHash,
      event_data: null
    })
  });

  if (!joinRes.ok) {
    const err = await joinRes.text();
    return res.status(joinRes.status).json({ error: `HF Space error: ${err.substring(0, 200)}` });
  }

  const joinData = await joinRes.json();
  return res.status(200).json({
    id: sessionHash,
    status: 'starting',
    provider: 'hf',
    queue_size: joinData.queue_size,
    event_id: joinData.event_id
  });
};
