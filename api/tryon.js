// Vercel Serverless Function — AI 가상 피팅
// POST /api/tryon
// body: { personImageUrl, garmentImageUrl, garmentDescription }

const Replicate = require('replicate');

module.exports = async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { personImageUrl, garmentImageUrl, garmentDescription } = req.body || {};

  if (!personImageUrl || !garmentImageUrl) {
    return res.status(400).json({ error: '사람 사진과 옷 사진 URL이 필요합니다.' });
  }

  const apiKey = process.env.REPLICATE_API_TOKEN;
  if (!apiKey) {
    return res.status(500).json({ error: 'REPLICATE_API_TOKEN 환경변수가 설정되지 않았습니다.' });
  }

  try {
    const replicate = new Replicate({ auth: apiKey });

    // IDM-VTON: 현재 가장 좋은 오픈소스 가상 피팅 모델
    const output = await replicate.run(
      'yisol/idm-vton:906425dbca90663ff5427624839572cc56ea7d380343d13e2a4c4b09d3f0c30f',
      {
        input: {
          human_img: personImageUrl,
          garm_img:  garmentImageUrl,
          garment_des: garmentDescription || '아이 옷',
          is_checked: true,
          is_checked_crop: false,
          denoise_steps: 30,
          seed: 42,
        }
      }
    );

    // output은 이미지 URL 또는 Buffer
    let resultUrl = output;
    if (Array.isArray(output)) resultUrl = output[0];

    return res.status(200).json({ success: true, resultUrl });

  } catch (err) {
    console.error('Replicate error:', err);
    return res.status(500).json({ error: err.message || 'AI 처리 중 오류가 발생했습니다.' });
  }
};
