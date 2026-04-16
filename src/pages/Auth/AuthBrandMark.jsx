import { publicUrl } from "../../utils/publicUrl";

/** Logo used on login / register (public asset, base-aware for /merchant/ deploy). */
export default function AuthBrandMark() {
  return (
    <div className="auth-brand-mark">
      <img
        src={publicUrl("lgo.jpeg")}
        alt="BestBy Bites Merchant"
        className="auth-brand-logo"
        width="150"
        height="150"
        decoding="async"
        fetchPriority="high"
        loading="eager"
      />
    </div>
  );
}
