import { useEffect, useState } from 'react';
import {
  createManualPayoutRequestCallable,
  isCallableNotDeployedError,
} from '../../services/manualPayoutService';
import '../../pages/Accounting/Accounting.css';
import './WithdrawModal.css';

/**
 * @param {object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {number} props.maxAmount - wallet balance (withdrawable)
 * @param {(n: number) => string} props.formatCurrency
 * @param {{ paypal?: { email?: string }, stripe?: { accountId?: string } } | null} props.withdrawMethod
 * @param {() => void} [props.onSuccess]
 */
const WithdrawModal = ({
  open,
  onClose,
  maxAmount,
  formatCurrency,
  withdrawMethod,
  onSuccess,
}) => {
  const [step, setStep] = useState('amount');
  const [amountInput, setAmountInput] = useState('');
  const [method, setMethod] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState(null);

  const hasPayPal = Boolean(withdrawMethod?.paypal?.email);
  const hasStripe = Boolean(withdrawMethod?.stripe?.accountId);
  const hasBoth = hasPayPal && hasStripe;

  useEffect(() => {
    if (!open) return;
    setStep('amount');
    setAmountInput('');
    setMethod(hasPayPal && !hasStripe ? 'paypal' : hasStripe && !hasPayPal ? 'stripe' : null);
    setLocalError(null);
    setSubmitting(false);
  }, [open, hasPayPal, hasStripe]);

  if (!open) return null;

  const parsedAmount = parseFloat(String(amountInput).replace(/,/g, ''));
  const amountValid =
    Number.isFinite(parsedAmount) && parsedAmount > 0 && parsedAmount <= maxAmount + 1e-9;

  const handleUseFullBalance = () => {
    if (!Number.isFinite(maxAmount) || maxAmount <= 0) return;
    const rounded = Math.round(maxAmount * 100) / 100;
    setAmountInput(String(rounded));
    setLocalError(null);
  };

  const goConfirm = () => {
    setLocalError(null);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setLocalError('Enter an amount greater than zero.');
      return;
    }
    if (parsedAmount > maxAmount + 1e-9) {
      setLocalError(`Amount cannot exceed ${formatCurrency(maxAmount)}.`);
      return;
    }
    if (hasBoth) {
      setStep('choose');
    } else if (hasPayPal) {
      setMethod('paypal');
      setStep('confirm');
    } else if (hasStripe) {
      setMethod('stripe');
      setStep('confirm');
    } else {
      setLocalError('Add PayPal or Stripe in Wallet first.');
    }
  };

  const handleSubmit = async () => {
    if (!method || !Number.isFinite(parsedAmount) || parsedAmount <= 0) return;
    setSubmitting(true);
    setLocalError(null);
    try {
      await createManualPayoutRequestCallable({
        amount: Math.round(parsedAmount * 100) / 100,
        payoutMethod: method,
      });
      onSuccess?.();
      onClose();
    } catch (err) {
      console.error('createManualPayoutRequestCallable', err);
      if (isCallableNotDeployedError(err)) {
        setLocalError(
          'Withdraw is not available yet — the payout service is still being set up. Try again later or contact support.'
        );
      } else {
        setLocalError(err?.message || 'Could not submit withdrawal request.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="payout-modal-overlay"
      role="dialog"
      aria-modal
      aria-labelledby="withdraw-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <div className="payout-modal-dialog" onClick={(e) => e.stopPropagation()}>
        {step === 'amount' && (
          <>
            <h2 id="withdraw-modal-title" className="payout-modal-title">
              Withdraw
            </h2>
            <p className="payout-modal-text">
              Enter how much to withdraw from your wallet balance (max {formatCurrency(maxAmount)}).
            </p>
            <div className="withdraw-modal-field">
              <label htmlFor="withdraw-amount" className="withdraw-modal-label">
                Amount
              </label>
              <input
                id="withdraw-amount"
                type="text"
                inputMode="decimal"
                className="withdraw-modal-input"
                value={amountInput}
                onChange={(e) => {
                  setAmountInput(e.target.value);
                  setLocalError(null);
                }}
                placeholder="0.00"
                autoComplete="off"
              />
              <button type="button" className="withdraw-modal-full-btn" onClick={handleUseFullBalance}>
                Use full balance
              </button>
            </div>
            {localError ? <p className="withdraw-modal-error">{localError}</p> : null}
            <div className="payout-modal-actions payout-modal-actions--row">
              <button
                type="button"
                className="payout-modal-btn-secondary"
                disabled={submitting}
                onClick={onClose}
              >
                Cancel
              </button>
              <button
                type="button"
                className="payout-modal-btn-primary"
                disabled={submitting || !Number.isFinite(maxAmount) || maxAmount <= 0}
                onClick={goConfirm}
              >
                Continue
              </button>
            </div>
          </>
        )}

        {step === 'choose' && (
          <>
            <h2 id="withdraw-modal-title" className="payout-modal-title">
              Payout method
            </h2>
            <p className="payout-modal-text">
              Withdraw {formatCurrency(Math.round(parsedAmount * 100) / 100)} to:
            </p>
            <div className="payout-modal-actions payout-modal-actions--grid">
              <button
                type="button"
                className="payout-modal-choice payout-modal-choice--paypal"
                disabled={submitting}
                onClick={() => {
                  setMethod('paypal');
                  setStep('confirm');
                }}
              >
                PayPal
              </button>
              <button
                type="button"
                className="payout-modal-choice payout-modal-choice--stripe"
                disabled={submitting}
                onClick={() => {
                  setMethod('stripe');
                  setStep('confirm');
                }}
              >
                Stripe
              </button>
            </div>
            <button
              type="button"
              className="payout-modal-btn-secondary payout-modal-full"
              disabled={submitting}
              onClick={() => setStep('amount')}
            >
              Back
            </button>
          </>
        )}

        {step === 'confirm' && method && (
          <>
            <h2 id="withdraw-modal-title" className="payout-modal-title">
              Confirm withdrawal
            </h2>
            {method === 'paypal' && (
              <p className="payout-modal-text">Payout will be sent to your PayPal on file:</p>
            )}
            {method === 'stripe' && (
              <p className="payout-modal-text">Payout will be sent to your Stripe account on file:</p>
            )}
            {method === 'paypal' && withdrawMethod?.paypal?.email && (
              <p className="payout-modal-highlight payout-mono">{withdrawMethod.paypal.email}</p>
            )}
            {method === 'stripe' && withdrawMethod?.stripe?.accountId && (
              <p className="payout-modal-highlight payout-mono">{withdrawMethod.stripe.accountId}</p>
            )}
            <p className="payout-modal-meta">
              Amount: <strong>{formatCurrency(Math.round(parsedAmount * 100) / 100)}</strong>
            </p>
            {localError ? <p className="withdraw-modal-error">{localError}</p> : null}
            <div className="payout-modal-actions payout-modal-actions--row">
              {hasBoth && (
                <button
                  type="button"
                  className="payout-modal-btn-secondary"
                  disabled={submitting}
                  onClick={() => setStep('choose')}
                >
                  Back
                </button>
              )}
              {!hasBoth && (
                <button
                  type="button"
                  className="payout-modal-btn-secondary"
                  disabled={submitting}
                  onClick={() => setStep('amount')}
                >
                  Back
                </button>
              )}
              <button
                type="button"
                className="payout-modal-btn-secondary"
                disabled={submitting}
                onClick={onClose}
              >
                Cancel
              </button>
              <button
                type="button"
                className="payout-modal-btn-primary"
                disabled={submitting || !amountValid}
                onClick={handleSubmit}
              >
                {submitting ? 'Submitting…' : 'Confirm'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default WithdrawModal;
