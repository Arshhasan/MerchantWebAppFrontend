import { useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useMerchantNotifications } from '../../contexts/MerchantNotificationContext';
import './MerchantNotificationDrawer.css';

function NotificationIcon({ accent }) {
  const bg =
    accent === 'teal'
      ? '#0d9488'
      : accent === 'green'
        ? 'var(--primary-green, #03c55b)'
        : accent === 'blue'
          ? '#2563eb'
          : accent === 'amber'
            ? '#d97706'
            : '#64748b';
  return (
    <span className="merchant-notif-item__icon" style={{ background: bg }} aria-hidden="true">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M7 10V8C7 5.79086 8.79086 4 11 4H13C15.2091 4 17 5.79086 17 8V10"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M5 10H19L18 20H6L5 10Z"
          stroke="white"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

/** Bell control — place in mobile header and desktop top nav (shared state via context). */
export function NotificationBellButton() {
  const { open, setOpen, unreadCount } = useMerchantNotifications();
  const badgeText = unreadCount > 9 ? '9+' : String(unreadCount);

  return (
    <button
      type="button"
      className="merchant-notif-bell"
      onClick={() => setOpen(true)}
      aria-label={
        unreadCount > 0
          ? `Notifications, ${unreadCount} from the last 24 hours`
          : 'Notifications'
      }
      aria-expanded={open}
      aria-haspopup="dialog"
    >
      <svg
        className="merchant-notif-bell__svg"
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
      >
        <path
          d="M18 8C18 6.4087 17.3679 4.88258 16.2426 3.75736C15.1174 2.63214 13.5913 2 12 2C10.4087 2 8.88258 2.63214 7.75736 3.75736C6.63214 4.88258 6 6.4087 6 8C6 15 3 17 3 17H21C21 17 18 15 18 8Z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M13.73 21C13.5542 21.3031 13.3019 21.5547 12.9982 21.7295C12.6946 21.9044 12.3504 21.9965 12 21.9965C11.6496 21.9965 11.3054 21.9044 11.0018 21.7295C10.6982 21.5547 10.4458 21.3031 10.27 21"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {unreadCount > 0 ? (
        <span className="merchant-notif-bell__badge">{badgeText}</span>
      ) : null}
    </button>
  );
}

/** Right drawer — render once at Layout root (fixed overlay). */
export function NotificationDrawerPanel() {
  const { open, setOpen, items, markRead } = useMerchantNotifications();

  const close = useCallback(() => setOpen(false), [setOpen]);

  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);

  if (!open) return null;

  return (
    <div className="merchant-notif-drawer" role="presentation">
      <button
        type="button"
        className="merchant-notif-drawer__backdrop"
        aria-label="Close notifications"
        onClick={close}
      />
      <aside
        className="merchant-notif-drawer__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="merchant-notif-heading"
      >
        <div className="merchant-notif-drawer__header">
          <div>
            <h2 id="merchant-notif-heading" className="merchant-notif-drawer__title">
              Notifications
            </h2>
            <p className="merchant-notif-drawer__subtitle">Last 24 hours</p>
          </div>
          <button
            type="button"
            className="merchant-notif-drawer__close"
            onClick={close}
            aria-label="Close"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
              <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="merchant-notif-drawer__body">
          {items.length === 0 ? (
            <p className="merchant-notif-drawer__empty">No activity in the last 24 hours.</p>
          ) : (
            <ul className="merchant-notif-list">
              {items.map((n) => (
                <li
                  key={n.id}
                  className={`merchant-notif-item ${!n.read ? 'merchant-notif-item--unread' : ''}`}
                >
                  <NotificationIcon accent={n.accent} />
                  <div className="merchant-notif-item__text">
                    <div className="merchant-notif-item__title">{n.title}</div>
                    <div className="merchant-notif-item__body">{n.body}</div>
                    {n.timeLabel ? (
                      <div className="merchant-notif-item__time">{n.timeLabel}</div>
                    ) : null}
                  </div>
                  {n.actionHref ? (
                    <Link
                      to={n.actionHref}
                      className="merchant-notif-item__action"
                      onClick={() => {
                        markRead(n.id);
                        close();
                      }}
                    >
                      {n.actionLabel}
                    </Link>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </div>
  );
}
