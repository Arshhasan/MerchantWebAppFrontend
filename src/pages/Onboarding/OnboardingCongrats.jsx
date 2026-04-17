import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/button';
import { publicUrl } from '../../utils/publicUrl';
import { runConfettiCelebration } from '../../utils/confettiCelebration';

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
    <div className="onboarding-congrats grid min-h-[100dvh] w-full flex-1 grid-rows-[auto_1fr] bg-white">
      <div className="flex justify-center px-4 pt-6 sm:pt-8 md:pt-10">
        <img
          src={publicUrl('logosideleaves.jpeg')}
          alt="BestBy Bites Merchant"
          className="h-auto w-[300px] max-w-[92vw] object-contain object-top"
          width={300}
          height={120}
          decoding="async"
          fetchPriority="high"
        />
      </div>

      {/* Second row fills remaining viewport height; content is vertically centered in that space */}
      <div className="flex min-h-0 w-full max-w-[720px] flex-col items-center justify-center justify-self-center gap-8 overflow-y-auto px-4 pb-10 md:justify-start md:gap-0 md:pt-10 md:pb-10">
        <div className="shrink-0">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#03c55b]/15">
            <CheckCircle className="h-8 w-8 text-[#03c55b]" />
          </div>
        </div>
<br />
<h2 className="mt-0 text-center font-extrabold tracking-tight text-gray-900
               text-4xl md:text-6xl">
  <span className="block text-[1.125em] md:text-[1.5em]">
    Congratulations!
  </span>

  <br />

  <span className="text-[#03c55b]">
    {storeName}
  </span> is created.
</h2>

        
<br />
        <Button
          type="button"
          className="auth-btn-primary mt-0 w-full max-w-[520px] shrink-0 md:mt-14"
          onClick={() => navigate('/create-bag?firstBag=1', { replace: true })}
          disabled={loading || !user}
        >
          Continue to create Surprise Bag →
        </Button>
      </div>
    </div>
  );
}
