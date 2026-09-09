import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * shadcn's class helper: clsx for conditionals, tailwind-merge to let a
 * caller's `className` override a component's own utilities instead of both
 * landing in the class list and CSS source order deciding the winner.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
