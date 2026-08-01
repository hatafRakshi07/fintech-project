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

export function useParams<T extends Record<string, string | string[]>>() {
  return useNextParams() as T;
}
