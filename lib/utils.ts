import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function normalizePublicImageUrl(url: string | null | undefined) {
  if (!url) return url;

  return url.replace(
    "https://pub-3ff77cba2e6f472094c4271d8b4e68a9.r2.dev",
    "https://images.vooy.shop"
  );
}
