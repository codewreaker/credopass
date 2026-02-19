import { useCallback, useMemo } from 'react'
import Cookies from 'js-cookie'


const useCookies = (cookieName: string ) => {

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

export default useCookies;
