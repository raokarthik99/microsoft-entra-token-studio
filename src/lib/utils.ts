import { jwtDecode } from 'jwt-decode';

export function parseJwt(token: string) {
    try {
        return jwtDecode(token);
    } catch (e) {
        return null;
    }
}
