import type { TaskStatus, TaskType } from '@/lib/tasks';

export type ResolutionOutcome = 'approved' | 'rejected' | 'instruction';
export const resolutionStatus = (outcome: ResolutionOutcome, next: TaskStatus): TaskStatus =>
  outcome === 'approved' ? 'approved' : next;
export function resolutionDestination(status: TaskStatus, destination: TaskType | ''): 'task' | 'fault' | undefined {
  if (status !== 'waiting_decision') return undefined;
  if (destination !== 'task' && destination !== 'fault') throw new Error('יש לבחור משימה או תקלה');
  return destination;
}
export const approvedAmount = (value: string): number | undefined => {
  if (!value.trim()) return undefined;
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) throw new Error('סכום לא תקין');
  return amount;
};/** Waiting items change status only through the documented approval/decision RPC (DB trigger enforces it too). */
export const requiresResolution = (status: TaskStatus): boolean => status === 'waiting_approval' || status === 'waiting_decision';
