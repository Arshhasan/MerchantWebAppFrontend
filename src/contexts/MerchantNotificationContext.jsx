import {
  createContext,
  useContext,
  useState,
  useMemo,
  useCallback,
  useEffect,
} from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from './AuthContext';
import { resolveMerchantVendorId } from '../services/merchantVendor';
import { subscribeToVendorOrders } from '../services/orderQuery';
import { subscribeToCollection } from '../firebase/firestore';
import { buildMerchantActivityItems } from '../services/merchantActivityFeed';

const MerchantNotificationContext = createContext(null);

export function MerchantNotificationProvider({ children }) {
  const { user, userProfile, vendorProfile } = useAuth();
  const [open, setOpen] = useState(false);
  const [resolvedVendorId, setResolvedVendorId] = useState(null);
  const [orders, setOrders] = useState([]);
  const [draftBags, setDraftBags] = useState([]);
  const [publishedBags, setPublishedBags] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [nowTick, setNowTick] = useState(() => Date.now());

  useEffect(() => {
    const t = window.setInterval(() => setNowTick(Date.now()), 60_000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    if (!user) {
      setResolvedVendorId(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const vid = await resolveMerchantVendorId(user.uid);
        if (!cancelled) setResolvedVendorId(vid);
      } catch (e) {
        console.error('[MerchantNotification] resolveMerchantVendorId', e);
        if (!cancelled) setResolvedVendorId(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!user) {
      setOrders([]);
      return;
    }
    const unsub = subscribeToVendorOrders([resolvedVendorId, user.uid], setOrders, (err) => {
      console.error('[MerchantNotification] orders subscription', err);
      setOrders([]);
    });
    return unsub;
  }, [user, resolvedVendorId]);

  useEffect(() => {
    if (!user?.uid) {
      setDraftBags([]);
      setPublishedBags([]);
      return;
    }
    const unsubDrafts = subscribeToCollection(
      'merchant_surprise_bag',
      [
        { field: 'merchantId', operator: '==', value: user.uid },
        { field: 'status', operator: '==', value: 'draft' },
      ],
      setDraftBags,
      () => setDraftBags([])
    );
    const unsubPublished = subscribeToCollection(
      'merchant_surprise_bag',
      [
        { field: 'merchantId', operator: '==', value: user.uid },
        { field: 'status', operator: '==', value: 'published' },
      ],
      setPublishedBags,
      () => setPublishedBags([])
    );
    return () => {
      unsubDrafts();
      unsubPublished();
    };
  }, [user?.uid]);

  useEffect(() => {
    if (!user) {
      setPayouts([]);
      return;
    }
    const mid = resolvedVendorId || userProfile?.vendorID || user.uid;
    if (!mid) {
      setPayouts([]);
      return;
    }
    const q = query(collection(db, 'payout_requests'), where('merchantId', '==', mid));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setPayouts(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      (err) => {
        console.error('[MerchantNotification] payout_requests subscription', err);
        setPayouts([]);
      }
    );
    return () => unsub();
  }, [user, resolvedVendorId, userProfile?.vendorID]);

  const items = useMemo(
    () =>
      buildMerchantActivityItems(
        {
          orders,
          draftBags,
          publishedBags,
          payouts,
          now: nowTick,
        },
        vendorProfile
      ),
    [orders, draftBags, publishedBags, payouts, nowTick, vendorProfile]
  );

  /** Activity in the rolling 24h window — used for the bell badge. */
  const unreadCount = items.length;

  const markRead = useCallback(() => {}, []);

  const value = useMemo(
    () => ({
      open,
      setOpen,
      items,
      unreadCount,
      markRead,
    }),
    [open, items, unreadCount, markRead]
  );

  return (
    <MerchantNotificationContext.Provider value={value}>
      {children}
    </MerchantNotificationContext.Provider>
  );
}

export function useMerchantNotifications() {
  const ctx = useContext(MerchantNotificationContext);
  if (!ctx) {
    throw new Error('useMerchantNotifications must be used within MerchantNotificationProvider');
  }
  return ctx;
}
