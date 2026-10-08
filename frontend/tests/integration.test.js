// integration.test.js — DOM structure example tests
// Feature: smart-street-light-frontend

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(resolve(__dirname, '../index.html'), 'utf-8');

// Simple DOM query helpers using regex/string search
function hasId(id) {
  return html.includes(`id="${id}"`);
}

function hasInputId(id) {
  return html.includes(`id="${id}"`) && html.includes('type="number"');
}

describe('DOM structure: Motion indicators', () => {
  it('IR1 indicator element exists', () => {
    expect(hasId('ir1-indicator')).toBe(true);
  });

  it('IR2 indicator element exists', () => {
    expect(hasId('ir2-indicator')).toBe(true);
  });
});

describe('DOM structure: Threshold input fields', () => {
  it('temp high threshold input exists', () => {
    expect(hasId('th-temp-high')).toBe(true);
  });

  it('temp low threshold input exists', () => {
    expect(hasId('th-temp-low')).toBe(true);
  });

  it('hum high threshold input exists', () => {
    expect(hasId('th-hum-high')).toBe(true);
  });

  it('hum low threshold input exists', () => {
    expect(hasId('th-hum-low')).toBe(true);
  });

  it('ldr high threshold input exists', () => {
    expect(hasId('th-ldr-high')).toBe(true);
  });

  it('ldr low threshold input exists', () => {
    expect(hasId('th-ldr-low')).toBe(true);
  });
});

describe('DOM structure: Heatmap', () => {
  it('heatmap canvas element exists', () => {
    expect(hasId('heatmap-canvas')).toBe(true);
  });

  it('heatmap legend element exists', () => {
    expect(hasId('heatmap-legend')).toBe(true);
  });
});

describe('DOM structure: Chart containers', () => {
  it('temp/hum chart canvas exists', () => {
    expect(hasId('chart-temphum')).toBe(true);
  });

  it('LDR chart canvas exists', () => {
    expect(hasId('chart-ldr')).toBe(true);
  });

  it('IR chart canvas exists', () => {
    expect(hasId('chart-ir')).toBe(true);
  });
});

describe('DOM structure: CDN dependencies', () => {
  it('loads Chart.js from CDN (not node_modules)', () => {
    expect(html).toContain('cdn.jsdelivr.net');
    expect(html).not.toContain('node_modules/chart.js');
  });

  it('loads GSAP from CDN (not node_modules)', () => {
    expect(html).toContain('cdnjs.cloudflare.com');
    expect(html).not.toContain('node_modules/gsap');
  });

  it('loads Google Fonts', () => {
    expect(html).toContain('fonts.googleapis.com');
  });
});
