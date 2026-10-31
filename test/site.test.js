import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lerLinkSite, nomeDoSite } from '../src/site.js';

test('aceita endereços http(s), com ou sem https://', () => {
  assert.equal(lerLinkSite('https://www.univervideo.com/watch/live/terapia-do-amor-20h'),
    'https://www.univervideo.com/watch/live/terapia-do-amor-20h');
  assert.equal(lerLinkSite('  univervideo.com/watch/live/x  '), 'https://univervideo.com/watch/live/x');
  assert.equal(lerLinkSite('http://exemplo.com.br/a?b=1&c=2'), 'http://exemplo.com.br/a?b=1&c=2');
});

test('recusa o que não é página da internet', () => {
  for (const ruim of ['', 'oi', 'javascript:alert(1)', 'file:///c:/windows', 'ftp://exemplo.com/a', 'https://localhost']) {
    assert.equal(lerLinkSite(ruim), null, ruim);
  }
});

test('nome do site vem do endereço, sem www', () => {
  assert.equal(nomeDoSite('https://www.univervideo.com/watch/x'), 'univervideo.com');
});
