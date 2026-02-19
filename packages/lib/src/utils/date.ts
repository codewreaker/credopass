/**
 * Date Utilities
 * Helper functions for date/time operations
 */

export function getGreeting(): string {
  const GREETINGS: Record<string, string> = {
    morning: 'Good morning',
    afternoon: 'Good afternoon',
    evening: 'Good evening',
  };
  const hour = new Date().getHours();
  if (hour < 12) return GREETINGS.morning;
  if (hour < 17) return GREETINGS.afternoon;
  return GREETINGS.evening;
}

export function formatDate(date: Date, options?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat('en-US', options).format(date);
}

export function isToday(date: Date): boolean {
  const today = new Date();
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}

export function isFuture(date: Date): boolean {
  return date.getTime() > Date.now();
}

export function isPast(date: Date): boolean {
  return date.getTime() < Date.now();
}
