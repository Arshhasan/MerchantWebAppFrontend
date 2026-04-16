import { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { Button } from "../../components/ui/button";
import AuthBrandMark from "./AuthBrandMark";
import "./Auth.css";

export default function LoginWelcome() {
  const navigate = useNavigate();
  const { user, userProfile, loading } = useAuth();

  const displayName = useMemo(() => {
    const first = String(userProfile?.firstName || "").trim();
    if (first) return first;
    const fromAuth = String(user?.displayName || "").trim();
    if (fromAuth) return fromAuth.split(" ")[0] || fromAuth;
    const email = String(user?.email || "").trim();
    if (email) return email.split("@")[0] || email;
    return "there";
  }, [user?.displayName, user?.email, userProfile?.firstName]);

  useEffect(() => {
    if (loading) return;
    if (!user) navigate("/login", { replace: true });
  }, [loading, user, navigate]);

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4">
      <div className="w-full max-w-[720px] flex flex-col items-center">
        <div
          className="mt-2"
          style={{ transform: "translateY(-150px) scale(2)", transformOrigin: "center top" }}
        >
          <AuthBrandMark />
        </div>
<br/>
        <div className="mt-16 mb-3">
          <div className="h-16 w-16 rounded-full bg-[#03c55b]/15 flex items-center justify-center">
            <CheckCircle className="h-8 w-8 text-[#03c55b]" />
          </div>
        </div>
<br />
        <h2 className="text-center text-3xl md:text-4xl font-extrabold tracking-tight text-gray-900">
          Welcome to
          <br />
          BestbyBites, <span className="text-[#03c55b]">{displayName}!</span>
        </h2>

        {/* <p className="text-center text-gray-500 mt-3 mb-10 max-w-[520px]">
          Your account is ready. Set your location to discover
          <br />
          surplus food near you.
        </p> */}
<br />
        <Button
          type="button"
          className="auth-btn-primary w-full max-w-[520px]"
          onClick={() => navigate("/dashboard", { replace: true })}
          disabled={loading || !user}
        >
          Continue →
        </Button>
      </div>
    </div>
  );
}

