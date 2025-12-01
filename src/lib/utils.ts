import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { jwtDecode } from 'jwt-decode';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function parseJwt(token: string) {
    try {
        return jwtDecode(token);
    } catch (e) {
        return null;
    }
}

export function getReadableExpiry(expiresOn: Date, now: Date) {
    const minutes = Math.round((expiresOn.getTime() - now.getTime()) / 60000);
    if (minutes < 0) return `${Math.abs(minutes)} min ago`;
    if (minutes <= 1) return 'now';
    if (minutes < 60) return `${minutes} min`;
    return `${Math.round(minutes / 60)} hr`;
}

export function getTokenStatus(expiresOn: Date, now: Date) {
    const minutes = Math.round((expiresOn.getTime() - now.getTime()) / 60000);
    if (minutes < 0) return { label: 'Expired', variant: 'destructive' as const, minutes };
    if (minutes <= 5) return { label: 'Expiring', variant: 'secondary' as const, minutes };
    return { label: 'Valid', variant: 'outline' as const, minutes };
}
