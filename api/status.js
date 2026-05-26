// GET /api/status?id=xxx&provider=hf|replicate — poll prediction status
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

module.exports = async (req, res) => {
  Object.entries(corsHeaders).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { id, token, provider, hfToken } = req.query;
  if (!id) return res.status(400).json({ error: 'Missing id' });

  if (provider === 'hf') {
    return handleHuggingFace(res, id, hfToken);
  }

  // Replicate polling
  const apiKey = token || process.env.REPLICATE_API_TOKEN;
  if (!apiKey) return res.status(400).json({ error: 'Missing token' });

  const pollRes = await fetch(`https://api.replicate.com/v1/predictions/${id}`, {
    headers: { 'Authorization': `Bearer ${apiKey}` }
  });
  const data = await pollRes.json();
  return res.status(pollRes.ok ? 200 : pollRes.status).json(data);
};

async function handleHuggingFace(res, sessionHash, hfToken) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  try {
    const headers = {};
    if (hfToken) headers['Authorization'] = `Bearer ${hfToken}`;

    const sseRes = await fetch(
      `https://yisol-idm-vton.hf.space/queue/data?session_hash=${sessionHash}`,
      { headers, signal: controller.signal }
    );

    if (!sseRes.ok) {
      return res.json({ status: 'failed', error: `HF status ${sseRes.status}` });
    }

    const reader = sseRes.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let lastStatus = { status: 'starting', provider: 'hf' };

    while (true) {
      let chunk;
      try {
        chunk = await reader.read();
      } catch (e) {
        break;
      }
      if (chunk.done) break;

      buffer += decoder.decode(chunk.value, { stream: true });
      const parts = buffer.split('\n\n');
      buffer = parts.pop();

      for (const part of parts) {
        const line = part.trim();
        if (!line.startsWith('data: ')) continue;
        try {
          const event = JSON.parse(line.slice(6));

          if (event.msg === 'process_completed') {
            reader.cancel().catch(() => {});
            const outputData = event.output?.data;
            let imageUrl = null;
            if (Array.isArray(outputData) && outputData[0]) {
              const first = outputData[0];
              imageUrl = first.url || (first.path ? `https://yisol-idm-vton.hf.space/file=${first.path}` : null);
            }
            return res.json({ status: 'succeeded', output: [imageUrl], provider: 'hf' });
          }

          if (event.msg === 'process_starts' || event.msg === 'process_generating') {
            lastStatus = { status: 'processing', provider: 'hf' };
          } else if (event.msg === 'estimation') {
            lastStatus = { status: 'starting', queue_size: event.rank, provider: 'hf' };
          } else if (event.msg === 'queue_full') {
            return res.json({ status: 'failed', error: 'HF 대기열 가득 참, 잠시 후 다시 시도하세요', provider: 'hf' });
          }
        } catch (e) { /* ignore parse errors */ }
      }
    }

    return res.json(lastStatus);
  } catch (e) {
    if (e.name === 'AbortError') {
      return res.json({ status: 'processing', provider: 'hf' });
    }
    return res.json({ status: 'failed', error: e.message, provider: 'hf' });
  } finally {
    clearTimeout(timer);
  }
}
