// timeline.test.js — Event logging property tests
// Feature: smart-street-light-frontend

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

// ── Pure timeline logic ───────────────────────────────────────────────────
function createLedEntry(ledKey, newState, timestamp) {
  return {
    id: `${ledKey}_${Date.now()}`,
    timestamp,
    type: 'LED',
    label: `${ledKey.toUpperCase()} turned ${newState === 1 ? 'ON' : 'OFF'}`
  };
}

function createMotionEntry(irKey, newState, timestamp) {
  return {
    id: `${irKey}_${Date.now()}`,
    timestamp,
    type: 'Motion',
    label: `${irKey.toUpperCase()} ${newState === 1 ? 'MOTION detected' : 'CLEAR'}`
  };
}

function createAlertEntry(sensor, value, direction, threshold, timestamp) {
  return {
    id: `${sensor}_alert_${Date.now()}`,
    timestamp,
    type: 'Alert',
    label: `${sensor.toUpperCase()} ${direction}: ${value} (threshold: ${threshold})`
  };
}

function addToTimeline(timeline, entry, max = 200) {
  timeline.unshift(entry);
  if (timeline.length > max) timeline.pop();
  return timeline;
}

function filterTimeline(timeline, activeFilters) {
  return timeline.filter(e => activeFilters.has(e.type));
}

// ── Property 23: Timeline records all event types correctly ───────────────
describe('Property 23: Timeline records all event types correctly', () => {
  // Feature: smart-street-light-frontend, Property 23: Timeline records all event types correctly
  it('LED entry has type LED, non-empty label, valid ISO timestamp', () => {
    fc.assert(fc.property(
      fc.constantFrom('led1', 'led2'),
      fc.constantFrom(0, 1),
      (ledKey, state) => {
        const ts = new Date().toISOString();
        const entry = createLedEntry(ledKey, state, ts);
        return entry.type === 'LED' &&
               entry.label.length > 0 &&
               !isNaN(Date.parse(entry.timestamp));
      }
    ), { numRuns: 100 });
  });

  it('Motion entry has type Motion, non-empty label, valid ISO timestamp', () => {
    fc.assert(fc.property(
      fc.constantFrom('ir1', 'ir2'),
      fc.constantFrom(0, 1),
      (irKey, state) => {
        const ts = new Date().toISOString();
        const entry = createMotionEntry(irKey, state, ts);
        return entry.type === 'Motion' &&
               entry.label.length > 0 &&
               !isNaN(Date.parse(entry.timestamp));
      }
    ), { numRuns: 100 });
  });

  it('Alert entry has type Alert, non-empty label, valid ISO timestamp', () => {
    fc.assert(fc.property(
      fc.constantFrom('temp', 'hum', 'ldr'),
      fc.float({ min: 0, max: 100, noNaN: true }),
      fc.constantFrom('HIGH', 'LOW'),
      fc.float({ min: 0, max: 100, noNaN: true }),
      (sensor, value, direction, threshold) => {
        const ts = new Date().toISOString();
        const entry = createAlertEntry(sensor, value, direction, threshold, ts);
        return entry.type === 'Alert' &&
               entry.label.length > 0 &&
               !isNaN(Date.parse(entry.timestamp));
      }
    ), { numRuns: 100 });
  });
});

// ── Property 24: Timeline size invariant and ordering ─────────────────────
describe('Property 24: Timeline size invariant and ordering', () => {
  // Feature: smart-street-light-frontend, Property 24: Timeline size invariant and ordering
  it('timeline never exceeds 200 entries', () => {
    fc.assert(fc.property(
      fc.integer({ min: 201, max: 500 }),
      (count) => {
        const timeline = [];
        for (let i = 0; i < count; i++) {
          addToTimeline(timeline, { id: `e_${i}`, timestamp: new Date().toISOString(), type: 'LED', label: `event ${i}` });
        }
        return timeline.length <= 200;
      }
    ), { numRuns: 100 });
  });

  it('most recently added entry is at index 0 (reverse-chronological)', () => {
    fc.assert(fc.property(
      fc.integer({ min: 2, max: 50 }),
      (count) => {
        const timeline = [];
        for (let i = 0; i < count; i++) {
          addToTimeline(timeline, { id: `e_${i}`, timestamp: new Date().toISOString(), type: 'LED', label: `event ${i}` });
        }
        return timeline[0].id === `e_${count - 1}`;
      }
    ), { numRuns: 100 });
  });
});

// ── Property 25: Timeline filter returns only matching event types ─────────
describe('Property 25: Timeline filter returns only matching event types', () => {
  // Feature: smart-street-light-frontend, Property 25: Timeline filter returns only matching event types
  it('filtered timeline contains only entries with matching type', () => {
    const allTypes = ['LED', 'Motion', 'Alert'];
    fc.assert(fc.property(
      fc.subarray(allTypes, { minLength: 1 }),
      (selectedTypes) => {
        const timeline = [
          { id: '1', timestamp: new Date().toISOString(), type: 'LED',    label: 'LED ON' },
          { id: '2', timestamp: new Date().toISOString(), type: 'Motion', label: 'Motion' },
          { id: '3', timestamp: new Date().toISOString(), type: 'Alert',  label: 'Alert' },
          { id: '4', timestamp: new Date().toISOString(), type: 'LED',    label: 'LED OFF' },
        ];
        const filters = new Set(selectedTypes);
        const filtered = filterTimeline(timeline, filters);
        return filtered.every(e => filters.has(e.type));
      }
    ), { numRuns: 100 });
  });
});
