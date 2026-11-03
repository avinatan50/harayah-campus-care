import { describe, expect, it } from 'vitest';
import { approvedAmount, resolutionDestination, resolutionStatus } from '@/lib/task-resolution';
import { normalizeStatus, STATUS_ORDER } from '@/lib/tasks';

describe('Task resolution rules', () => {
  it('approval sets approved regardless of requested next status', () => {
    expect(resolutionStatus('approved', 'closed')).toBe('approved');
  });
  it('decisions require task or fault as their destination', () => {
    expect(resolutionDestination('waiting_decision', 'task')).toBe('task');
    expect(resolutionDestination('waiting_decision', 'fault')).toBe('fault');
    expect(() => resolutionDestination('waiting_decision', '')).toThrow();
    expect(() => resolutionDestination('waiting_decision', 'request')).toThrow();
  });
  it('approval does not change item type', () => {
    expect(resolutionDestination('waiting_approval', 'fault')).toBeUndefined();
  });
  it('empty amount stays absent and zero is retained', () => {
    expect(approvedAmount('')).toBeUndefined();
    expect(approvedAmount('0')).toBe(0);
  });
  it('offers the nine statuses in the requested order', () => {
    expect(STATUS_ORDER).toEqual(['new','in_progress','waiting_approval','waiting_decision','waiting_external','approved','closed','paused','cancelled']);
  });
  it('normalizes retired statuses without discarding original task links', () => {
    expect(normalizeStatus('done_pending_close')).toBe('closed');
    expect(normalizeStatus('recurring_fault')).toBe('new');
  });
});
import { requiresResolution } from '@/lib/task-resolution';
describe('requiresResolution', () => {
  it('locks only waiting approval/decision', () => {
    expect(requiresResolution('waiting_approval')).toBe(true);
    expect(requiresResolution('waiting_decision')).toBe(true);
    expect(requiresResolution('in_progress')).toBe(false);
    expect(requiresResolution('approved')).toBe(false);
  });
});
