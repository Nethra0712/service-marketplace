'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard' },
  { href: '/providers', label: 'Providers' },
  { href: '/categories', label: 'Service categories' },
  { href: '/bookings', label: 'Bookings' },
  { href: '/payments', label: 'Payments' },
  { href: '/payouts', label: 'Payouts' },
  { href: '/reviews', label: 'Reviews' },
  { href: '/users', label: 'Users' },
  { href: '/audit-log', label: 'Audit log' },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <nav className="flex h-full w-56 shrink-0 flex-col border-r border-slate-200 bg-white px-3 py-4">
      <div className="mb-4 px-2 text-sm font-semibold text-slate-900">Service Marketplace</div>
      <ul className="space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`block rounded-md px-2.5 py-2 text-sm font-medium transition-colors ${
                  active ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
