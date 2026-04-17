import { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { Button } from "../../components/ui/button";
import AuthBrandMark from "../Auth/AuthBrandMark";

export default function OnboardingCongrats() {
  const navigate = useNavigate();
  const { user, loading, vendorProfile } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!user) navigate("/login", { replace: true });
  }, [loading, user, navigate]);

  const storeName = useMemo(() => {
    const title = String(vendorProfile?.title || "").trim();
    return title || "your store";
  }, [vendorProfile?.title]);

  return (
    <div className="min-h-screen bg-white flex flex-col items-center px-4 pt-10 pb-16 md:pt-14 md:pb-20">
      <div className="w-full max-w-[720px] flex flex-col items-center">
        <div className="w-full flex justify-center shrink-0">
          <AuthBrandMark />
        </div>
        <br />

        <div className="mt-14 md:mt-20">
          <div className="h-16 w-16 rounded-full bg-[#03c55b]/15 flex items-center justify-center mx-auto">
            <CheckCircle className="h-8 w-8 text-[#03c55b]" />
          </div>
        </div>
        <br />

        <h2 className="text-center text-3xl md:text-4xl font-extrabold tracking-tight text-gray-900 mt-12 md:mt-14">
          Congratulations!
          <br />
          <span className="text-[#03c55b]">{storeName}</span> is created.
        </h2>
        <br />

        <p className="text-center text-gray-500 mt-8 md:mt-10 max-w-[560px] leading-relaxed">
          Next, create your first Surprise Bag so customers can discover your store.
        </p>
<br />
        <Button
          type="button"
          className="auth-btn-primary w-full max-w-[520px] mt-12 md:mt-14"
          onClick={() => navigate("/create-bag?firstBag=1", { replace: true })}
          disabled={loading || !user}
        >
          Continue to create Surprise Bag →
        </Button>
      </div>
    </div>
  );
}

