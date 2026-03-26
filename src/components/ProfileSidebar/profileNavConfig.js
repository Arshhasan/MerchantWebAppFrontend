export const profileNavSections = [
  {
    title: 'Manage Store',
    items: [
      { label: 'Outlet info', icon: 'info', path: '/outlet-info' },
      { label: 'Outlet timings', icon: 'clock', path: '/outlet-timings' },
      { label: 'Phone numbers', icon: 'phone', path: '/phone-numbers' },
      { label: 'Manage staff', icon: 'staff', path: '/manage-staff' },
    ],
  },
  {
    title: 'Settings',
    items: [
      { label: 'Settings', icon: 'settings', path: '/settings' },
      { label: 'Manage Communication', icon: 'bell', path: '/manage-communication' },
      { label: 'Schedule off', icon: 'schedule', path: '/schedule-off' },
    ],
  },
  {
    title: 'Orders',
    items: [
      { label: 'Order history', icon: 'history', path: '/order-history' },
      { label: 'Complaints', icon: 'complaint', path: '/complaints' },
      { label: 'Reviews', icon: 'review', path: '/reviews' },
    ],
  },
  {
    title: 'Accounting',
    items: [
      { label: 'Payout', icon: 'payout', path: '/payout' },
      { label: 'Invoices', icon: 'invoice', path: '/invoices', aliases: ['/invoice-taxes'] },
      { label: 'Taxes', icon: 'tax', path: '/taxes', aliases: ['/invoice-taxes'] },
    ],
  },
  {
    title: 'Help',
    items: [
      { label: 'Help centre', icon: 'help', path: '/help-centre' },
      { label: 'Learning centre', icon: 'learning', path: '/learning-centre' },
      { label: 'Share your feedback', icon: 'feedback', path: '/share-feedback' },
    ],
  },
];

