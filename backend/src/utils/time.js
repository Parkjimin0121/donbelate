export function nowIso() {
  return new Date().toISOString();
}

export function minutesLate(scheduledAt, arrivedAt) {
  const diffMs = new Date(arrivedAt).getTime() - new Date(scheduledAt).getTime();
  return Math.max(0, Math.ceil(diffMs / 60000));
}
