import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useAuthStore } from "../services/authStore.js";

const C = { white:"#FFFFFF",gray100:"#F1F3F4",gray200:"#E8EAED",gray300:"#DADCE0",gray500:"#9AA0A6",gray600:"#80868B",gray700:"#5F6368",gray800:"#3C4043",gray900:"#202124",blue:"#1A73E8",blueLt:"#E8F0FE",red:"#EA4335",redLt:"#FCE8E6" };

export default function Login() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { login, loading, error, clearError, user } = useAuthStore();

  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [showPw,   setShowPw]   = useState(false);

  const redirect = params.get("redirect") || "/dashboard";

  // Already logged in → redirect
  useEffect(() => { if (user) navigate(redirect, { replace: true }); }, [user]);
  useEffect(() => { clearError(); }, []);

  async function submit(e) {
    e.preventDefault();
    const ok = await login(email, password);
    if (ok) navigate(redirect, { replace: true });
  }

  return (
    <div style={{ minHeight:"100vh", background:C.gray100, display:"flex", alignItems:"center", justifyContent:"center", padding:16, fontFamily:"'Google Sans','Roboto',sans-serif" }}>
      <div style={{ background:C.white, borderRadius:14, padding:"clamp(28px,5vw,44px)", width:"100%", maxWidth:400, boxShadow:"0 2px 10px rgba(0,0,0,.08)" }}>
        {/* Logo */}
        <div style={{ textAlign:"center", marginBottom:28 }}>
          <div style={{ width:44, height:44, borderRadius:12, background:C.blue, display:"inline-flex", alignItems:"center", justifyContent:"center", fontSize:22, marginBottom:12 }}>📹</div>
          <h1 style={{ fontSize:24, fontWeight:400, color:C.gray900, margin:"0 0 6px" }}>Sign in to VibeCall</h1>
          <p style={{ fontSize:14, color:C.gray600, margin:0 }}>Use your VibeCall account</p>
        </div>

        {/* Error banner */}
        {error && (
          <div style={{ background:C.redLt, border:`1px solid rgba(234,67,53,.25)`, borderRadius:8, padding:"10px 14px", marginBottom:18, fontSize:13, color:C.red, display:"flex", gap:8, alignItems:"flex-start" }}>
            <span>⚠</span><span>{error}</span>
          </div>
        )}

        <form onSubmit={submit} style={{ display:"flex", flexDirection:"column", gap:16 }}>
          <div>
            <label style={{ fontSize:12, fontWeight:500, color:C.gray700, display:"block", marginBottom:5 }}>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoFocus
              placeholder="you@example.com"
              style={{ width:"100%", padding:"12px 14px", border:`1px solid ${C.gray300}`, borderRadius:8, fontSize:14, color:C.gray900, outline:"none", boxSizing:"border-box" }}
              onFocus={e => e.target.style.borderColor = C.blue}
              onBlur={e => e.target.style.borderColor = C.gray300}
            />
          </div>

          <div>
            <label style={{ fontSize:12, fontWeight:500, color:C.gray700, display:"block", marginBottom:5 }}>Password</label>
            <div style={{ position:"relative" }}>
              <input type={showPw?"text":"password"} value={password} onChange={e => setPassword(e.target.value)} required
                placeholder="••••••••"
                style={{ width:"100%", padding:"12px 44px 12px 14px", border:`1px solid ${C.gray300}`, borderRadius:8, fontSize:14, color:C.gray900, outline:"none", boxSizing:"border-box" }}
                onFocus={e => e.target.style.borderColor = C.blue}
                onBlur={e => e.target.style.borderColor = C.gray300}
              />
              <button type="button" onClick={() => setShowPw(v=>!v)}
                style={{ position:"absolute", right:10, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", fontSize:16, color:C.gray500, padding:4 }}>
                {showPw ? "🙈" : "👁"}
              </button>
            </div>
          </div>

          <button type="submit" disabled={loading || !email || !password}
            style={{ padding:"13px", borderRadius:24, border:"none", background:loading||!email||!password ? C.gray200 : C.blue, color:loading||!email||!password ? C.gray500 : C.white, fontSize:15, fontWeight:500, cursor:loading||!email||!password?"not-allowed":"pointer", transition:"all .15s" }}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <div style={{ marginTop:20, display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ flex:1, height:1, background:C.gray200 }}/>
          <span style={{ fontSize:12, color:C.gray500 }}>New to VibeCall?</span>
          <div style={{ flex:1, height:1, background:C.gray200 }}/>
        </div>

        <div style={{ marginTop:16, textAlign:"center" }}>
          <Link to="/signup" style={{ fontSize:14, color:C.blue, fontWeight:500, textDecoration:"none" }}>
            Create an account →
          </Link>
        </div>

        <div style={{ marginTop:24, padding:"12px 14px", background:C.blueLt, borderRadius:8, display:"flex", gap:8, alignItems:"flex-start" }}>
          <span style={{ fontSize:14 }}>🔒</span>
          <p style={{ fontSize:12, color:C.blue, margin:0, lineHeight:1.6 }}>
            Your sessions are end-to-end encrypted. VibeCall cannot access your meetings.
          </p>
        </div>
      </div>
    </div>
  );
}
