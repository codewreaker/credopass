import { useCallback, useMemo } from 'react'
import Cookies from 'js-cookie'


export const useCookies = (cookieName: string): [
    value: string | undefined,
    setCookie: (value: string, options?: Cookies.CookieAttributes) => void,
    deleteCookie: (options?: Cookies.CookieAttributes) => void,
    cookies: { [key: string]: string }
] => {

    const cookies = useMemo(() => (Cookies.get()), []);
    const value = useMemo(() => (Cookies.get(cookieName)), [cookieName]);

    const setCookie = useCallback((value: string, options?: Cookies.CookieAttributes) => {
        Cookies.set(cookieName, value, options);
    }, [cookieName]);

    const deleteCookie = useCallback((options?: Cookies.CookieAttributes) => {
        Cookies.remove(cookieName, options);
    }, [cookieName]);


    return [
        value,
        setCookie,
        deleteCookie,
        cookies
    ];
}
