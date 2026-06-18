const Redis = require('ioredis');

let redis;

function getRedis() {
  if (!redis) {
    redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
      lazyConnect: true,
      retryStrategy: (times) => Math.min(times * 100, 3000),
    });
    redis.on('error', (e) => console.warn('[Redis] error:', e.message));
  }
  return redis;
}

async function setCursor(roomId, userId, data) {
  try {
    const r = getRedis();
    await r.hset(`cursors:${roomId}`, userId, JSON.stringify(data));
    await r.expire(`cursors:${roomId}`, 3600);
  } catch {}
}

async function getCursors(roomId) {
  try {
    const r = getRedis();
    const raw = await r.hgetall(`cursors:${roomId}`);
    if (!raw) return {};
    return Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, JSON.parse(v)]));
  } catch { return {}; }
}

async function removeCursor(roomId, userId) {
  try { await getRedis().hdel(`cursors:${roomId}`, userId); } catch {}
}

module.exports = { setCursor, getCursors, removeCursor };
