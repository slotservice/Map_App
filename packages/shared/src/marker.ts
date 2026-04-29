import { MarkerColor, TaskStatus } from './enums.js';

/**
 * Map-marker colour state machine. Pure function so it's covered by
 * unit tests in `@map-app/shared` and reused identically by the API
 * (`StoresService.computeMarker`) and any client that wants to render
 * a marker offline (the mobile app does this implicitly via the API
 * but having a single source of truth keeps the state machine
 * unambiguous).
 *
 * See REBUILD_PLAN Appendix E.
 */
export interface MarkerInputs {
  tasks: ReadonlyArray<{
    initialStatus: TaskStatus;
    currentStatus: TaskStatus;
  }>;
  hasCompletion: boolean;
}

export function computeMarkerColor(input: MarkerInputs): MarkerColor {
  const { tasks, hasCompletion } = input;

  // No tasks → blue (legacy convention: a fresh import without a Task column).
  if (tasks.length === 0) return MarkerColor.BLUE;

  const allComplete = tasks.every(
    (t) => t.currentStatus === TaskStatus.SCHEDULED_OR_COMPLETE,
  );
  // Red = all tasks done AND a completion record exists. The
  // completion check is what distinguishes "store with tasks pre-imported
  // as already done" (orange) from "store the worker actually completed"
  // (red).
  if (allComplete && hasCompletion) return MarkerColor.RED;

  const allInitiallyNeedsScheduled = tasks.every(
    (t) => t.initialStatus === TaskStatus.NEEDS_SCHEDULED,
  );
  if (allInitiallyNeedsScheduled) {
    const anyCompletedThisVisit = tasks.some(
      (t) =>
        t.currentStatus === TaskStatus.SCHEDULED_OR_COMPLETE &&
        t.initialStatus === TaskStatus.NEEDS_SCHEDULED,
    );
    return anyCompletedThisVisit ? MarkerColor.YELLOW : MarkerColor.BLUE;
  }
  // Mix of pre-existing completes + needs-scheduled.
  return MarkerColor.ORANGE;
}
