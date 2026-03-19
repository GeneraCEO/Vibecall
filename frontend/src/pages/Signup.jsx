import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuthStore } from "../services/authStore.js";

const C = { white:"#FFFFFF",gray100:"#F1F3F4",gray200:"#E8EAED",gray300:"#DADCE0",gray500:"#9AA0A6",gray600:"#80868B",gray700:"#5F6368",gray800:"#3C4043",gray900:"#202124",blue:"#1A73E8",blueLt:"#E8F0FE",red:"#EA4335",redLt:"#FCE8E6",green:"#34A853",greenLt:"#E6F4EA" };

export default function Signup() {
  const navigate = useNavigate();
  const { register, loading, error, clearError, user } = useAuthStore();

  const [name,     setName]     = useState("");
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [showPw,   setShowPw]   = useState(false);
  const [agreed,   setAgreed]   = useState(false);

  useEffect(() => { if (user) navigate("/dashboard", { replace: true }); }, [user]);
  useEffect(() => { clearError(); }, []);

  const strong = password.length >= 8;

  async function submit(e) {
    e.preventDefault();
    if (!agreed) return;
    const ok = await register(name, email, password);
    if (ok) navigate("/dashboard", { replace: true });
  }

  return (
    <div style={{ minHeight:"100vh", background:C.gray100, display:"flex", alignItems:"center", justifyContent:"center", padding:16, fontFamily:"'Google Sans','Roboto',sans-serif" }}>
      <div style={{ background:C.white, borderRadius:14, padding:"clamp(28px,5vw,44px)", width:"100%", maxWidth:420, boxShadow:"0 2px 10px rgba(0,0,0,.08)" }}>
        <div style={{ textAlign:"center", marginBottom:26 }}>
          <div style={{ width:44, height:44, borderRadius:12, background:C.blue, display:"inline-flex", alignItems:"center", justifyContent:"center", fontSize:22, marginBottom:12 }}>📹</div>
          <h1 style={{ fontSize:24, fontWeight:400, color:C.gray900, margin:"0 0 6px" }}>Create your account</h1>
          <p style={{ fontSize:14, color:C.gray600, margin:0 }}>Start your 3-day free trial · No card needed</p>
        </div>

        {error && (
          <div style={{ background:C.redLt, border:`1px solid rgba(234,67,53,.25)`, borderRadius:8, padding:"10px 14px", marginBottom:16, fontSize:13, color:C.red, display:"flex", gap:8 }}>
            <span>⚠</span><span>{error}</span>
          </div>
        )}

        <form onSubmit={submit} style={{ display:"flex", flexDirection:"column", gap:14 }}>
          {[
            { label:"Full name",  type:"text",     val:name,     set:setName,     ph:"Alex Johnson" },
            { label:"Email",      type:"email",    val:email,    set:setEmail,    ph:"you@example.com" },
          ].map(f => (
            <div key={f.label}>
              <label style={{ fontSize:12, fontWeight:500, color:C.gray700, display:"block", marginBottom:5 }}>{f.label}</label>
              <input type={f.type} value={f.val} onChange={e => f.set(e.target.value)} required placeholder={f.ph}
                style={{ width:"100%", padding:"11px 14px", border:`1px solid ${C.gray300}`, borderRadius:8, fontSize:14, color:C.gray900, outline:"none", boxSizing:"border-box" }}
                onFocus={e => e.target.style.borderColor=C.blue} onBlur={e => e.target.style.borderColor=C.gray300}
              />
            </div>
          ))}

          <div>
            <label style={{ fontSize:12, fontWeight:500, color:C.gray700, display:"block", marginBottom:5 }}>Password</label>
            <div style={{ position:"relative" }}>
              <input type={showPw?"text":"password"} value={password} onChange={e => setPassword(e.target.value)} required minLength={8}
                placeholder="At least 8 characters"
                style={{ width:"100%", padding:"11px 44px 11px 14px", border:`1px solid ${password&&!strong?C.red:C.gray300}`, borderRadius:8, fontSize:14, color:C.gray900, outline:"none", boxSizing:"border-box" }}
                onFocus={e => e.target.style.borderColor=C.blue} onBlur={e => e.target.style.borderColor=password&&!strong?C.red:C.gray300}
              />
              <button type="button" onClick={()=>setShowPw(v=>!v)} style={{ position:"absolute", right:10, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", fontSize:16, color:C.gray500 }}>
                {showPw?"🙈":"👁"}
              </button>
            </div>
            {password && (
              <div style={{ marginTop:6, display:"flex", alignItems:"center", gap:6 }}>
                <div style={{ height:3, flex:1, borderRadius:2, background:strong?C.green:"#EA4335" }}/>
                <span style={{ fontSize:11, color:strong?C.green:C.red }}>{strong?"Strong":"Too short (min 8)"}</span>
              </div>
            )}
          </div>

          <label style={{ display:"flex", gap:10, alignItems:"flex-start", cursor:"pointer", marginTop:2 }}>
            <input type="checkbox" checked={agreed} onChange={e=>setAgreed(e.target.checked)} style={{ marginTop:2, accentColor:C.blue, flexShrink:0 }}/>
            <span style={{ fontSize:13, color:C.gray700, lineHeight:1.55 }}>
              I agree to VibeCall's <span style={{ color:C.blue }}>Terms of Service</span> and <span style={{ color:C.blue }}>Privacy Policy</span>
            </span>
          </label>

          <button type="submit" disabled={loading||!name||!email||!strong||!agreed}
            style={{ padding:"13px", borderRadius:24, border:"none", background:loading||!name||!email||!strong||!agreed?C.gray200:C.blue, color:loading||!name||!email||!strong||!agreed?C.gray500:C.white, fontSize:15, fontWeight:500, cursor:"pointer", transition:"all .15s", marginTop:2 }}>
            {loading ? "Creating account…" : "Create account · Start free trial"}
          </button>
        </form>

        <div style={{ marginTop:18, textAlign:"center", fontSize:14, color:C.gray600 }}>
          Already have an account?{" "}
          <Link to="/login" style={{ color:C.blue, fontWeight:500, textDecoration:"none" }}>Sign in</Link>
        </div>
      </div>
    </div>
  );
}
