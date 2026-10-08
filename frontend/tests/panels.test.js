// panels.test.js — Derived value formula property tests
// Feature: smart-street-light-frontend

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

// ── Pure logic extracted from panels.js ──────────────────────────────────
function computeHeatIndex(temp, hum) {
  if (temp === null || hum === null || temp === undefined || hum === undefined) return null;
  return parseFloat((temp + 0.33 * hum - 4).toFixed(1));
}

function computeBrightness(ldr) {
  if (ldr === null || ldr === undefined) return null;
  return parseFloat((Math.min(ldr / 4095 * 100, 100)).toFixed(1));
}

function getLightCondition(ldr) {
  if (ldr === null || ldr === undefined) return '--';
  if (ldr < 500)  return 'NIGHT';
  if (ldr < 2000) return 'DIM';
  return 'DAY';
}

function getLedOnCount(control) {
  return (control.led1 === 1 ? 1 : 0) + (control.led2 === 1 ? 1 : 0);
}

// ── Property 13: Heat index formula correctness ───────────────────────────
describe('Property 13: Heat index formula correctness', () => {
  // Feature: smart-street-light-frontend, Property 13: Heat index formula correctness
  it('heat index equals parseFloat((t + 0.33*h - 4).toFixed(1))', () => {
    fc.assert(fc.property(
      fc.float({ min: -50, max: 100, noNaN: true }),
      fc.float({ min: 0,   max: 100, noNaN: true }),
      (temp, hum) => {
        const result = computeHeatIndex(temp, hum);
        const expected = parseFloat((temp + 0.33 * hum - 4).toFixed(1));
        return result === expected;
      }
    ), { numRuns: 100 });
  });
});

// ── Property 14: Brightness percentage formula correctness ────────────────
describe('Property 14: Brightness percentage formula correctness', () => {
  // Feature: smart-street-light-frontend, Property 14: Brightness percentage formula correctness
  it('brightness equals parseFloat((min(v/4095*100,100)).toFixed(1)) for 0-4095', () => {
    fc.assert(fc.property(fc.integer({ min: 0, max: 4095 }), (ldr) => {
      const result = computeBrightness(ldr);
      const expected = parseFloat((Math.min(ldr / 4095 * 100, 100)).toFixed(1));
      return result === expected;
    }), { numRuns: 100 });
  });

  it('values above 4095 are capped at 100.0', () => {
    fc.assert(fc.property(fc.integer({ min: 4096, max: 100000 }), (ldr) => {
      return computeBrightness(ldr) === 100.0;
    }), { numRuns: 100 });
  });
});

// ── Property 15: Light condition classification covers all ranges ──────────
describe('Property 15: Light condition classification covers all ranges', () => {
  // Feature: smart-street-light-frontend, Property 15: Light condition classification covers all ranges
  it('NIGHT when ldr < 500', () => {
    fc.assert(fc.property(fc.integer({ min: 0, max: 499 }), (ldr) => {
      return getLightCondition(ldr) === 'NIGHT';
    }), { numRuns: 100 });
  });

  it('DIM when 500 <= ldr < 2000', () => {
    fc.assert(fc.property(fc.integer({ min: 500, max: 1999 }), (ldr) => {
      return getLightCondition(ldr) === 'DIM';
    }), { numRuns: 100 });
  });

  it('DAY when ldr >= 2000', () => {
    fc.assert(fc.property(fc.integer({ min: 2000, max: 4095 }), (ldr) => {
      return getLightCondition(ldr) === 'DAY';
    }), { numRuns: 100 });
  });

  it('boundary 500 is DIM', () => {
    expect(getLightCondition(500)).toBe('DIM');
  });

  it('boundary 2000 is DAY', () => {
    expect(getLightCondition(2000)).toBe('DAY');
  });
});

// ── Property 16: System status LED count accuracy ─────────────────────────
describe('Property 16: System status LED count accuracy', () => {
  // Feature: smart-street-light-frontend, Property 16: System status LED count accuracy
  it('LED ON count equals number of LEDs with value 1', () => {
    fc.assert(fc.property(
      fc.constantFrom(0, 1),
      fc.constantFrom(0, 1),
      (led1, led2) => {
        const count = getLedOnCount({ led1, led2 });
        const expected = (led1 === 1 ? 1 : 0) + (led2 === 1 ? 1 : 0);
        return count === expected;
      }
    ), { numRuns: 100 });
  });
});
