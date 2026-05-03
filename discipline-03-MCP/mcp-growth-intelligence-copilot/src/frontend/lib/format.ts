export function formatDate(value?: string) {
  if (!value) return 'Never';
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

export function priorityLabel(priority: string) {
  return priority[0].toUpperCase() + priority.slice(1);
}
