// charts.test.js — Buffer invariant + timestamp format property tests
// Feature: smart-street-light-frontend

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

// ── Pure logic extracted from charts.js ──────────────────────────────────
function formatTime(d) {
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  const s = String(d.getSeconds()).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

function pushCapped(arr, val, max) {
  arr.push(val);
  if (arr.length > max) arr.shift();
  return arr;
}

// ── Property 11: Chart history buffer size invariant ──────────────────────
describe('Property 11: Chart history buffer size invariant', () => {
  // Feature: smart-street-light-frontend, Property 11: Chart history buffer size invariant
  it('buffer never exceeds 100 entries', () => {
    fc.assert(fc.property(
      fc.integer({ min: 101, max: 500 }),
      (count) => {
        const buf = [];
        for (let i = 0; i < count; i++) pushCapped(buf, i, 100);
        return buf.length <= 100;
      }
    ), { numRuns: 100 });
  });

  it('after 101st point, oldest is removed and length stays 100', () => {
    const buf = [];
    for (let i = 0; i < 101; i++) pushCapped(buf, i, 100);
    expect(buf.length).toBe(100);
    expect(buf[0]).toBe(1); // 0 was shifted out
  });
});

// ── Property 12: Timestamp label format ──────────────────────────────────
describe('Property 12: Timestamp label format', () => {
  // Feature: smart-street-light-frontend, Property 12: Timestamp label format
  it('formatted timestamp matches HH:MM:SS pattern', () => {
    fc.assert(fc.property(
      fc.date({ min: new Date(0), max: new Date('2099-12-31') }),
      (date) => {
        const label = formatTime(date);
        return /^\d{2}:\d{2}:\d{2}$/.test(label);
      }
    ), { numRuns: 100 });
  });

  it('hours, minutes, seconds are zero-padded to 2 digits', () => {
    // Midnight: 00:00:00
    const midnight = new Date('2024-01-01T00:00:00');
    expect(formatTime(midnight)).toMatch(/^\d{2}:\d{2}:\d{2}$/);
  });
});
