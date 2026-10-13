import type { Item } from '../../../shared/schemas';

const DAY_MS = 86400000;

type RotationEditFields = Pick<
  Item,
  'value' | 'rotationDueAt' | 'rotationIntervalDays' | 'rotationLastAt'
>;

export function applyRotationOnEdit(
  existing: RotationEditFields | null,
  incoming: RotationEditFields,
  now: number
): { rotationDueAt: number; rotationLastAt: number } {
  if (existing && existing.value !== incoming.value) {
    const dueTouchedByUser = (incoming.rotationDueAt || 0) !== (existing.rotationDueAt || 0);
    const intervalDays = incoming.rotationIntervalDays || 0;
    return {
      rotationDueAt: dueTouchedByUser
        ? incoming.rotationDueAt || 0
        : intervalDays > 0
          ? now + intervalDays * DAY_MS
          : 0,
      rotationLastAt: now,
    };
  }

  return {
    rotationDueAt: incoming.rotationDueAt || 0,
    rotationLastAt: incoming.rotationLastAt || 0,
  };
}
