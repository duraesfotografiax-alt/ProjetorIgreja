import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lerLinkYoutube } from '../src/youtube.js';

test('entende os formatos de link do YouTube', () => {
  const id = 'dQw4w9WgXcQ';
  for (const link of [
    `https://www.youtube.com/watch?v=${id}`,
    `https://youtube.com/watch?v=${id}&t=30s`,
    `https://m.youtube.com/watch?v=${id}`,
    `https://youtu.be/${id}?si=abc`,
    `https://www.youtube.com/live/${id}?feature=share`,
    `https://www.youtube.com/shorts/${id}`,
    `https://www.youtube.com/embed/${id}`,
    `  https://www.youtube.com/watch?v=${id}  `,
  ]) assert.deepEqual(lerLinkYoutube(link), { videoId: id }, link);
});

test('canal ao vivo pelo id do canal', () => {
  const canal = 'UC' + 'a'.repeat(22);
  assert.deepEqual(lerLinkYoutube(`https://www.youtube.com/channel/${canal}`), { canal });
});

test('recusa o que não é link de vídeo do YouTube', () => {
  for (const link of ['', 'oi', 'https://vimeo.com/123', 'https://www.youtube.com/@igreja',
    'https://www.youtube.com/watch?v=curto', 'https://youtube.com.golpe.com/watch?v=dQw4w9WgXcQ']) {
    assert.equal(lerLinkYoutube(link), null, link);
  }
});
