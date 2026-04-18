import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/button';
import { publicUrl } from '../../utils/publicUrl';
import { runConfettiCelebration } from '../../utils/confettiCelebration';
import './OnboardingCongrats.css';

export default function OnboardingCongrats() {
  const navigate = useNavigate();
  const { user, loading, vendorProfile } = useAuth();
  useEffect(() => {
    if (loading) return;
    if (!user) navigate('/login', { replace: true });
  }, [loading, user, navigate]);

  useEffect(() => {
    if (loading || !user) return undefined;
    return runConfettiCelebration();
  }, [loading, user]);

  const storeName = useMemo(() => {
    const title = String(vendorProfile?.title || '').trim();
    return title || 'your store';
  }, [vendorProfile?.title]);

  return (
    <div className="onboarding-congrats onboarding-congrats--welcome relative flex min-h-[100dvh] w-full flex-1 flex-col bg-white">
      <div className="onboarding-congrats__stack relative w-full flex-1 px-4 pb-10 pt-6 sm:pt-8 md:pt-10">
        <div className="onboarding-congrats__logo">
          <img
            src={publicUrl('logosideleaves.jpeg')}
            alt="BestBy Bites Merchant"
            width={300}
            height={120}
            decoding="async"
            fetchPriority="high"
          />
        </div>

        <h1 className="onboarding-congrats__title">
          <span className="onboarding-congrats__title-line">Congratulations!</span>
          <span className="onboarding-congrats__title-line onboarding-congrats__title-line--second">
            <span className="break-words">{storeName}</span>
            {' '}
            is created.
          </span>
        </h1>

        <Button
          type="button"
          className="onboarding-congrats__cta"
          onClick={() => navigate('/create-bag?firstBag=1', { replace: true })}
          disabled={loading || !user}
        >
          Continue to create Surprise Bag →
        </Button>
      </div>
    </div>
  );
}
