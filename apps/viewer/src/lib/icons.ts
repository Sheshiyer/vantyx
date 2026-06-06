import { Sun, Moon, Sunset, Sunrise, Clock, type LucideIcon } from "lucide-react";

// Map a config time `icon` string (or id) to a lucide icon. Falls back to a clock.
const ICONS: Record<string, LucideIcon> = {
  sunrise: Sunrise,
  morning: Sunrise,
  sun: Sun,
  day: Sun,
  noon: Sun,
  sunset: Sunset,
  evening: Sunset,
  moon: Moon,
  night: Moon,
};

export function timeIcon(icon?: string): LucideIcon {
  return (icon ? ICONS[icon] : undefined) ?? Clock;
}
