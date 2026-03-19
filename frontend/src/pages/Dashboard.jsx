import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../services/authStore.js";

const C = { white:"#FFFFFF",gray50:"#F8F9FA",gray100:"#F1F3F4",gray200:"#E8EAED",gray300:"#DADCE0",gray500:"#9AA0A6",gray600:"#80868B",gray700:"#5F6368",gray800:"#3C4043",gray900:"#202124",blue:"#1A73E8",blueLt:"#E8F0FE",blueDk:"#1557B0",red:"#EA4335",green:"#34A853",greenLt:"#E6F4EA" };

function genCode() {
  const a = () => Math.random().toString(36).slice(2,5).toUpperCase();
  return `${a()}-${a()}`;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [joinCode,  setJoinCode]  = useState("");
  const [newCode]                 = useState(genCode);
  const [showMenu,  setShowMenu]  = useState(false);
  const [copied,    setCopied]    = useState(false);

  const name = user?.name || user?.email?.split("@")[0] || "User";
  const initials = name.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase();

  function copyCode() {
    navigator.clipboard?.writeText(newCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const recent = [
    { code:"TEAM-001", title:"Weekly Standup",       time:"Yesterday, 10:00 AM", dur:"42 min", people:4 },
    { code:"MED-229",  title:"Patient Consultation",  time:"Dec 10, 2:30 PM",    dur:"28 min", people:2 },
    { code:"DEMO-007", title:"Product Demo",          time:"Dec 9, 4:00 PM",     dur:"55 min", people:6 },
  ];

  return (
    <div style={{ minHeight:"100vh", background:C.gray50, fontFamily:"'Google Sans','Roboto',sans-serif" }}>
      {/* Nav */}
      <nav style={{ height:64, padding:"0 clamp(16px,4vw,32px)", display:"flex", alignItems:"center", justifyContent:"space-between", background:C.white, borderBottom:`1px solid ${C.gray200}`, position:"sticky", top:0, zIndex:100 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:34, height:34, borderRadius:8, background:C.blue, display:"flex", alignItems:"center", justifyContent:"center", fontSize:17 }}>📹</div>
          <span style={{ fontSize:20, fontWeight:400, color:C.gray800 }}>Vibe<span style={{ color:C.blue, fontWeight:600 }}>Call</span></span>
        </div>
        <div style={{ position:"relative" }}>
          <button onClick={()=>setShowMenu(v=>!v)} style={{ width:36, height:36, borderRadius:"50%", background:C.blue, border:"none", display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:500, color:C.white, cursor:"pointer" }}>
            {initials}
          </button>
          {showMenu && (
            <div style={{ position:"absolute", top:44, right:0, background:C.white, border:`1px solid ${C.gray200}`, borderRadius:10, boxShadow:"0 4px 20px rgba(0,0,0,.12)", padding:"6px 0", minWidth:180, zIndex:200 }}>
              <div style={{ padding:"10px 16px", borderBottom:`1px solid ${C.gray200}` }}>
                <div style={{ fontSize:13, fontWeight:500, color:C.gray900 }}>{name}</div>
                <div style={{ fontSize:12, color:C.gray600, marginTop:2 }}>{user?.email}</div>
              </div>
              <button onClick={()=>navigate("/")} style={{ width:"100%", padding:"10px 16px", background:"none", border:"none", textAlign:"left", fontSize:13, color:C.gray800, cursor:"pointer" }}>🏠 Home</button>
              <button onClick={async()=>{ await logout(); navigate("/"); }} style={{ width:"100%", padding:"10px 16px", background:"none", border:"none", textAlign:"left", fontSize:13, color:C.red, cursor:"pointer" }}>Sign out</button>
            </div>
          )}
        </div>
      </nav>

      <div style={{ maxWidth:900, margin:"0 auto", padding:"clamp(24px,4vh,40px) clamp(16px,3vw,32px)" }}>
        <h1 style={{ fontSize:"clamp(22px,3vw,28px)", fontWeight:400, color:C.gray900, marginBottom:6 }}>Welcome back, {name.split(" ")[0]} 👋</h1>
        <p style={{ fontSize:14, color:C.gray600, marginBottom:32 }}>Start a new meeting or join an existing one.</p>

        {/* Action cards */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(min(280px,100%),1fr))", gap:14, marginBottom:36 }}>
          {/* New meeting */}
          <div style={{ background:C.white, borderRadius:14, padding:"24px 22px", border:`1px solid ${C.gray200}`, display:"flex", flexDirection:"column", gap:16 }}>
            <div style={{ width:44, height:44, borderRadius:12, background:C.blueLt, display:"flex", alignItems:"center", justifyContent:"center", fontSize:22 }}>📹</div>
            <div>
              <h3 style={{ fontSize:15, fontWeight:500, color:C.gray900, margin:"0 0 5px" }}>New meeting</h3>
              <p style={{ fontSize:13, color:C.gray600, margin:0, lineHeight:1.6 }}>Start an instant meeting with a shareable link.</p>
            </div>
            {/* Generated room code */}
            <div style={{ background:C.gray50, borderRadius:8, padding:"10px 12px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <span style={{ fontFamily:"'Roboto Mono',monospace", fontSize:14, fontWeight:500, color:C.gray900, letterSpacing:".04em" }}>{newCode}</span>
              <button onClick={copyCode} style={{ background:"none", border:"none", cursor:"pointer", fontSize:16, color:copied?C.green:C.gray600 }} title="Copy code">{copied?"✓":"📋"}</button>
            </div>
            <button onClick={()=>navigate(`/room/${newCode}`)}
              style={{ padding:"12px", borderRadius:24, border:"none", background:C.blue, color:C.white, fontSize:14, fontWeight:500, cursor:"pointer" }}>
              Start meeting →
            </button>
          </div>

          {/* Join meeting */}
          <div style={{ background:C.white, borderRadius:14, padding:"24px 22px", border:`1px solid ${C.gray200}`, display:"flex", flexDirection:"column", gap:16 }}>
            <div style={{ width:44, height:44, borderRadius:12, background:C.greenLt, display:"flex", alignItems:"center", justifyContent:"center", fontSize:22 }}>🔗</div>
            <div>
              <h3 style={{ fontSize:15, fontWeight:500, color:C.gray900, margin:"0 0 5px" }}>Join a meeting</h3>
              <p style={{ fontSize:13, color:C.gray600, margin:0, lineHeight:1.6 }}>Enter a room code to join someone else's call.</p>
            </div>
            <input value={joinCode} onChange={e=>setJoinCode(e.target.value.toUpperCase())}
              placeholder="Enter room code (e.g. ABC-XYZ)"
              onKeyDown={e=>e.key==="Enter"&&joinCode&&navigate(`/room/${joinCode}`)}
              style={{ padding:"11px 14px", border:`1px solid ${C.gray300}`, borderRadius:8, fontFamily:"'Roboto Mono',monospace", fontSize:14, letterSpacing:".04em", outline:"none", color:C.gray900 }}
              onFocus={e=>e.target.style.borderColor=C.blue} onBlur={e=>e.target.style.borderColor=C.gray300}
            />
            <button onClick={()=>joinCode&&navigate(`/room/${joinCode}`)} disabled={!joinCode}
              style={{ padding:"12px", borderRadius:24, border:"none", background:joinCode?C.green:"#E6F4EA", color:joinCode?C.white:C.green, fontSize:14, fontWeight:500, cursor:joinCode?"pointer":"not-allowed" }}>
              Join →
            </button>
          </div>

          {/* Subscription status */}
          <div style={{ background:C.white, borderRadius:14, padding:"24px 22px", border:`1px solid ${C.gray200}`, display:"flex", flexDirection:"column", gap:14 }}>
            <div style={{ width:44, height:44, borderRadius:12, background:"#F3E8FF", display:"flex", alignItems:"center", justifyContent:"center", fontSize:22 }}>⭐</div>
            <div>
              <h3 style={{ fontSize:15, fontWeight:500, color:C.gray900, margin:"0 0 5px" }}>Your plan</h3>
              <div style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"3px 10px", borderRadius:999, background:C.blueLt }}>
                <span style={{ fontSize:11, fontWeight:500, color:C.blue }}>PRO — Active</span>
              </div>
            </div>
            {["Unlimited participants","Cloud recording 10hr/mo","AI meeting summaries","E2E encrypted always"].map(f=>(
              <div key={f} style={{ display:"flex", gap:8, alignItems:"center" }}>
                <span style={{ color:C.green, fontSize:12 }}>✓</span>
                <span style={{ fontSize:13, color:C.gray700 }}>{f}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent meetings */}
        <div>
          <h2 style={{ fontSize:16, fontWeight:500, color:C.gray900, marginBottom:14 }}>Recent meetings</h2>
          <div style={{ background:C.white, borderRadius:14, border:`1px solid ${C.gray200}`, overflow:"hidden" }}>
            {recent.map((m,i) => (
              <div key={m.code} style={{ display:"flex", alignItems:"center", gap:14, padding:"14px 18px", borderBottom:i<recent.length-1?`1px solid ${C.gray100}`:"none" }}>
                <div style={{ width:38, height:38, borderRadius:10, background:C.blueLt, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0 }}>📹</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:14, fontWeight:500, color:C.gray900, marginBottom:2 }}>{m.title}</div>
                  <div style={{ fontSize:12, color:C.gray600, display:"flex", gap:10, flexWrap:"wrap" }}>
                    <span>{m.time}</span>
                    <span>·</span>
                    <span>{m.dur}</span>
                    <span>·</span>
                    <span>{m.people} people</span>
                  </div>
                </div>
                <div style={{ display:"flex", gap:8, flexShrink:0 }}>
                  <button onClick={()=>navigate(`/room/${m.code}`)}
                    style={{ padding:"7px 14px", borderRadius:20, border:`1px solid ${C.gray300}`, background:C.white, color:C.blue, fontSize:13, fontWeight:500, cursor:"pointer" }}>
                    Rejoin
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
