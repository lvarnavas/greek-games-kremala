import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { manifest } from '../pwa.manifest';

const dist = path.resolve(__dirname, '../dist');

describe('PWA / offline', () => {
  it('manifest στα ελληνικά, εγκαταστάσιμο, με εικονίδια που υπάρχουν', () => {
    expect(manifest.lang).toBe('el');
    expect(manifest.name).toContain('Κρεμάλα');
    expect(manifest.display).toBe('standalone');
    expect(manifest.start_url).toBe('/');
    for (const icon of manifest.icons ?? []) {
      expect(fs.existsSync(path.resolve(__dirname, '../public', icon.src.slice(1))), icon.src).toBe(true);
    }
    expect((manifest.icons ?? []).some((i) => i.purpose === 'maskable')).toBe(true);
  });
  it.skipIf(!fs.existsSync(path.join(dist, 'sw.js')))('το build περιέχει service worker που προ-αποθηκεύει την εφαρμογή', () => {
    const sw = fs.readFileSync(path.join(dist, 'sw.js'), 'utf8');
    expect(sw).toContain('index.html');
    expect(sw).toMatch(/assets\/index-[\w-]+\.js/);
    expect(fs.existsSync(path.join(dist, 'manifest.webmanifest'))).toBe(true);
  });
});
