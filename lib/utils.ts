import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Convert any code key (camelCase, snake_case, or mixed) to a readable Title Case label.
 *  "approaching_fit" → "Approaching Fit"
 *  "healthScore"     → "Health Score"
 *  "csExpansionPlaybook" → "Cs Expansion Playbook"
 */
export function formatLabel(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, c => c.toUpperCase());
}
