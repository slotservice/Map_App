import { describe, expect, it } from 'vitest';
import { computeMarkerColor, MarkerColor, TaskStatus } from '../src/index.js';

const NS = TaskStatus.NEEDS_SCHEDULED;
const SC = TaskStatus.SCHEDULED_OR_COMPLETE;

describe('computeMarkerColor', () => {
  it('blue when there are no tasks at all', () => {
    expect(computeMarkerColor({ tasks: [], hasCompletion: false })).toBe(MarkerColor.BLUE);
    // Even with hasCompletion=true, no tasks → still blue. There's nothing to "complete."
    expect(computeMarkerColor({ tasks: [], hasCompletion: true })).toBe(MarkerColor.BLUE);
  });

  it('blue when every task is needs-scheduled and the worker has not started', () => {
    expect(
      computeMarkerColor({
        tasks: [
          { initialStatus: NS, currentStatus: NS },
          { initialStatus: NS, currentStatus: NS },
        ],
        hasCompletion: false,
      }),
    ).toBe(MarkerColor.BLUE);
  });

  it('yellow when worker has completed at least one task in a visit but not all', () => {
    expect(
      computeMarkerColor({
        tasks: [
          { initialStatus: NS, currentStatus: SC },
          { initialStatus: NS, currentStatus: NS },
        ],
        hasCompletion: false,
      }),
    ).toBe(MarkerColor.YELLOW);
  });

  it('orange when initial tasks are mixed needs-scheduled + already-complete (legacy import case)', () => {
    expect(
      computeMarkerColor({
        tasks: [
          { initialStatus: NS, currentStatus: NS },
          { initialStatus: SC, currentStatus: SC },
        ],
        hasCompletion: false,
      }),
    ).toBe(MarkerColor.ORANGE);
  });

  it('red when every task is complete AND a completion record exists', () => {
    expect(
      computeMarkerColor({
        tasks: [
          { initialStatus: NS, currentStatus: SC },
          { initialStatus: NS, currentStatus: SC },
        ],
        hasCompletion: true,
      }),
    ).toBe(MarkerColor.RED);
  });

  it('does NOT go red just because all tasks were imported as already-complete (no real visit)', () => {
    // This is the subtle case: a freshly imported map where every task
    // column was set to "COMPLETE or SCHEDULED ALREADY" should NOT show
    // red — the worker hasn't actually visited yet.
    expect(
      computeMarkerColor({
        tasks: [{ initialStatus: SC, currentStatus: SC }],
        hasCompletion: false,
      }),
    ).toBe(MarkerColor.ORANGE);
  });

  it('yellow → red transition when the last task ticks over and the completion record lands', () => {
    const tasks = [{ initialStatus: NS, currentStatus: SC }];
    expect(
      computeMarkerColor({ tasks, hasCompletion: false }),
    ).toBe(MarkerColor.YELLOW);
    expect(
      computeMarkerColor({ tasks, hasCompletion: true }),
    ).toBe(MarkerColor.RED);
  });
});
