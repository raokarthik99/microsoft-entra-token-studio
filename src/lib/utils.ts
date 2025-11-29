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
    const diffMinutes = (expiresOn.getTime() - now.getTime()) / 60000;
    const isPast = diffMinutes < 0;
    const minutes = Math.round(Math.abs(diffMinutes));

    if (minutes === 0) return 'now';

    if (minutes < 60) {
        return `${minutes} min${minutes === 1 ? '' : 's'}${isPast ? ' ago' : ''}`;
    }

    const hours = Math.round(minutes / 60);
    if (hours < 24) {
        return `${hours} hr${hours === 1 ? '' : 's'}${isPast ? ' ago' : ''}`;
    }

    const days = Math.round(hours / 24);
    return `${days} day${days === 1 ? '' : 's'}${isPast ? ' ago' : ''}`;
}

export function getTokenStatus(expiresOn: Date, now: Date) {
    const minutes = Math.round((expiresOn.getTime() - now.getTime()) / 60000);
    if (minutes < 0) return { label: 'Expired', variant: 'destructive' as const, minutes };
    if (minutes <= 5) return { label: 'Expiring', variant: 'secondary' as const, minutes };
    return { label: 'Valid', variant: 'outline' as const, minutes };
}
