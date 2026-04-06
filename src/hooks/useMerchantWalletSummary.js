import { useCallback, useEffect, useState } from 'react';
import { db } from '../firebase/config';
import { loadMerchantWalletSummary } from '../services/merchantWallet';

/**
 * @param {string | null} vendorId resolved merchant / vendor document id
 * @param {number} [reloadTick] increment to refetch
 */
export function useMerchantWalletSummary(vendorId, reloadTick = 0) {
  const [loading, setLoading] = useState(true);
  const [walletBalance, setWalletBalance] = useState(null);
  const [pendingInPayouts, setPendingInPayouts] = useState(0);
  const [lastPayoutLabel, setLastPayoutLabel] = useState(null);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    if (!vendorId) {
      setWalletBalance(null);
      setPendingInPayouts(0);
      setLastPayoutLabel(null);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const s = await loadMerchantWalletSummary(db, vendorId);
      setWalletBalance(s.walletBalance);
      setPendingInPayouts(s.pendingInPayouts);
      setLastPayoutLabel(s.lastPayoutLabel);
    } catch (e) {
      console.error('useMerchantWalletSummary', e);
      setError(e);
      setWalletBalance(null);
      setPendingInPayouts(0);
      setLastPayoutLabel(null);
    } finally {
      setLoading(false);
    }
  }, [vendorId]);

  useEffect(() => {
    refresh();
  }, [refresh, reloadTick]);

  return {
    loading,
    walletBalance,
    pendingInPayouts,
    lastPayoutLabel,
    error,
    refresh,
  };
}
