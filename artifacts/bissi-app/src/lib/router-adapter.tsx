'use client';

import React from 'react';
import NextLink from 'next/link';
import { usePathname, useRouter, useParams as useNextParams } from 'next/navigation';

export function Link({ href, children, className, onClick, style, ...props }: any) {
  return (
    <NextLink href={href || '/'} className={className} onClick={onClick} style={style} {...props}>
      {children}
    </NextLink>
  );
}

export function useLocation(): [string, (to: string) => void] {
  const pathname = usePathname();
  const router = useRouter();
  const setLocation = (to: string) => {
    router.push(to);
  };
  return [pathname || '/', setLocation];
}

export function useParams<T extends Record<string, string | string[]>>(): T {
  const nextParams = useNextParams();
  const pathname = usePathname();

  if (nextParams && Object.keys(nextParams).length > 0 && nextParams.id) {
    return nextParams as unknown as T;
  }

  if (pathname) {
    const parts = pathname.split('/').filter(Boolean);
    const lastPart = parts[parts.length - 1];
    if (lastPart && /^\d+$/.test(lastPart)) {
      return { id: lastPart, ...nextParams } as unknown as T;
    }
  }

  if (typeof window !== 'undefined') {
    const parts = window.location.pathname.split('/').filter(Boolean);
    const lastPart = parts[parts.length - 1];
    if (lastPart && /^\d+$/.test(lastPart)) {
      return { id: lastPart, ...nextParams } as unknown as T;
    }
  }

  return (nextParams || {}) as unknown as T;
}
