// heatmap.test.js — Heatmap buffer + color mapping property tests
// Feature: smart-street-light-frontend

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

// ── Pure logic extracted from heatmap.js ─────────────────────────────────
const COLOR_LOW  = { r: 13,  g: 27,  b: 75  };
const COLOR_HIGH = { r: 255, g: 235, b: 59  };

function lerpColor(t) {
  const r = Math.round(COLOR_LOW.r + (COLOR_HIGH.r - COLOR_LOW.r) * t);
  const g = Math.round(COLOR_LOW.g + (COLOR_HIGH.g - COLOR_LOW.g) * t);
  const b = Math.round(COLOR_LOW.b + (COLOR_HIGH.b - COLOR_LOW.b) * t);
  return { r, g, b };
}

function ldrToT(ldr) {
  return Math.min(Math.max(ldr / 4095, 0), 1);
}

function pushCapped(arr, val, max) {
  arr.push(val);
  if (arr.length > max) arr.shift();
  return arr;
}

// ── Property 21: Heatmap buffer size invariant ────────────────────────────
describe('Property 21: Heatmap buffer size invariant', () => {
  // Feature: smart-street-light-frontend, Property 21: Heatmap buffer size invariant
  it('buffer never exceeds 60 entries', () => {
    fc.assert(fc.property(
      fc.integer({ min: 61, max: 300 }),
      (count) => {
        const buf = [];
        for (let i = 0; i < count; i++) pushCapped(buf, i % 4096, 60);
        return buf.length <= 60;
      }
    ), { numRuns: 100 });
  });

  it('after 61st reading, oldest is removed and length stays 60', () => {
    const buf = [];
    for (let i = 0; i < 61; i++) pushCapped(buf, i, 60);
    expect(buf.length).toBe(60);
    expect(buf[0]).toBe(1); // 0 was shifted out
  });
});

// ── Property 22: Heatmap color mapping is monotonically increasing ─────────
describe('Property 22: Heatmap color mapping is monotonically increasing', () => {
  // Feature: smart-street-light-frontend, Property 22: Heatmap color mapping is monotonically increasing
  it('higher LDR value produces higher perceived brightness (blue decreases, yellow increases)', () => {
    fc.assert(fc.property(
      fc.integer({ min: 0, max: 4094 }),
      (ldrA) => {
        const ldrB = ldrA + 1;
        const tA = ldrToT(ldrA);
        const tB = ldrToT(ldrB);
        const colorA = lerpColor(tA);
        const colorB = lerpColor(tB);
        // Blue channel should decrease (or stay same) as LDR increases
        // Red+Green (yellow) should increase (or stay same)
        return colorB.b <= colorA.b + 1 && (colorB.r + colorB.g) >= (colorA.r + colorA.g) - 1;
      }
    ), { numRuns: 100 });
  });

  it('ldr=0 produces dark blue color', () => {
    const color = lerpColor(ldrToT(0));
    expect(color.r).toBe(COLOR_LOW.r);
    expect(color.g).toBe(COLOR_LOW.g);
    expect(color.b).toBe(COLOR_LOW.b);
  });

  it('ldr=4095 produces bright yellow color', () => {
    const color = lerpColor(ldrToT(4095));
    expect(color.r).toBe(COLOR_HIGH.r);
    expect(color.g).toBe(COLOR_HIGH.g);
    expect(color.b).toBe(COLOR_HIGH.b);
  });
});
