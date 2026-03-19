/**
 * pages/Home.jsx — Mobile-first landing page with SEO + schema markup
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../services/authStore.js';

const C = {
  white:'#FFFFFF',gray50:'#F8F9FA',gray100:'#F1F3F4',gray200:'#E8EAED',
  gray300:'#DADCE0',gray600:'#80868B',gray700:'#5F6368',gray800:'#3C4043',
  gray900:'#202124',blue:'#1A73E8',blueDk:'#1557B0',blueLt:'#E8F0FE',
  red:'#EA4335',green:'#34A853',
};

export default function Home() {
  const navigate  = useNavigate();
  const user      = useAuthStore(s => s.user);
  const [code,    setCode]    = useState('');
  const [openFaq, setOpenFaq] = useState(null);

  useEffect(() => {
    document.title = 'VibeCall — Encrypted Video Calls. AI co-pilot. $40/year.';
    const set = (n, v, p) => {
      let el = document.querySelector(p ? `meta[property="${n}"]` : `meta[name="${n}"]`);
      if (!el) { el = document.createElement('meta'); p ? el.setAttribute('property',n) : (el.name=n); document.head.appendChild(el); }
      el.content = v;
    };
    set('description','AES-256-GCM encrypted video calls. AI co-pilot, live transcription, HIPAA. 73% cheaper than Zoom.');
    set('og:title','VibeCall — Encrypted Video Calls',true);
    set('og:description','E2E encrypted. AI meeting notes. No Google account. $40/year.',true);
    set('og:type','website',true);
    set('twitter:card','summary_large_image');
    const ld = document.getElementById('ld-json') || (() => { const s=document.createElement('script'); s.type='application/ld+json'; s.id='ld-json'; document.head.appendChild(s); return s; })();
    ld.textContent = JSON.stringify({'@context':'https://schema.org','@type':'SoftwareApplication',name:'VibeCall',applicationCategory:'VideoCommunication',offers:{'@type':'Offer',price:'40',priceCurrency:'USD'},description:'E2E encrypted video calling with AI co-pilot.'});
  },[]);

  const join = () => {
    const c = code.trim().toUpperCase() || `ROOM-${Math.random().toString(36).slice(2,6).toUpperCase()}`;
    user ? navigate(`/room/${c}`) : navigate(`/login?redirect=/room/${c}`);
  };

  return (
    <div style={{minHeight:'100vh',background:C.white,fontFamily:"'Google Sans','Roboto',sans-serif",overflowX:'hidden'}}>
      <style>{`
        *{box-sizing:border-box}html{scroll-behavior:smooth}
        @media(max-width:600px){
          .ht{font-size:clamp(28px,9vw,40px)!important}
          .hrow{flex-direction:column!important}
          .hrow>*{width:100%!important;flex:none!important}
          .fg{grid-template-columns:1fr!important}
          .pg{grid-template-columns:1fr!important}
          .nlinks{display:none!important}
          .strow{gap:18px!important}
        }
      `}</style>

      {/* Nav */}
      <nav style={{position:'sticky',top:0,zIndex:100,background:'rgba(255,255,255,.96)',backdropFilter:'blur(8px)',borderBottom:`1px solid ${C.gray200}`}}>
        <div style={{maxWidth:1100,margin:'0 auto',height:56,padding:'0 16px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer'}} onClick={()=>navigate('/')}>
            <div style={{width:30,height:30,borderRadius:7,background:C.blue,display:'flex',alignItems:'center',justifyContent:'center',fontSize:15}}>📹</div>
            <span style={{fontSize:18,fontWeight:400,color:C.gray800}}>Vibe<span style={{color:C.blue,fontWeight:600}}>Call</span></span>
          </div>
          <div className="nlinks" style={{display:'flex',gap:22,alignItems:'center'}}>
            {[['Pricing','#pricing'],['vs Zoom','#compare'],['HIPAA','#features']].map(([l,h])=>(
              <a key={l} href={h} style={{fontSize:13,color:C.gray700,textDecoration:'none',fontWeight:500}}>{l}</a>
            ))}
          </div>
          <div style={{display:'flex',gap:8}}>
            {user ? (
              <button onClick={()=>navigate('/dashboard')} style={{padding:'7px 16px',borderRadius:20,border:`1px solid ${C.gray300}`,background:C.white,color:C.blue,fontSize:13,fontWeight:500,cursor:'pointer'}}>Dashboard →</button>
            ) : (<>
              <button onClick={()=>navigate('/login')} style={{padding:'7px 12px',border:'none',background:'none',color:C.blue,fontSize:13,fontWeight:500,cursor:'pointer'}}>Sign in</button>
              <button onClick={()=>navigate('/signup')} style={{padding:'7px 18px',borderRadius:20,border:'none',background:C.blue,color:C.white,fontSize:13,fontWeight:500,cursor:'pointer'}}>Try free</button>
            </>)}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section style={{padding:'clamp(44px,8vh,88px) 16px 0',textAlign:'center',maxWidth:800,margin:'0 auto'}}>
        <div style={{display:'inline-flex',alignItems:'center',gap:6,padding:'4px 14px',borderRadius:999,background:C.blueLt,marginBottom:18}}>
          <span style={{fontSize:11,color:C.blue,fontWeight:500}}>🤖 Live AI co-pilot · 🔒 AES-256-GCM · Zero data collection</span>
        </div>
        <h1 className="ht" style={{fontSize:'clamp(32px,5.5vw,56px)',fontWeight:400,color:C.gray900,margin:'0 0 14px',lineHeight:1.15,letterSpacing:'-.02em'}}>
          Video calls that protect<br/><span style={{color:C.blue,fontWeight:500}}>and think with you.</span>
        </h1>
        <p style={{fontSize:16,color:C.gray600,maxWidth:480,margin:'0 auto 30px',lineHeight:1.7}}>
          E2E encrypted · Live AI co-pilot · Real-time transcription<br/>
          <strong style={{color:C.gray800}}>$40/year</strong> — not $149 like Zoom.
        </p>
        <div className="hrow" style={{display:'flex',gap:10,justifyContent:'center',flexWrap:'wrap',maxWidth:460,margin:'0 auto 10px'}}>
          <button onClick={join} style={{padding:'13px 26px',borderRadius:24,border:'none',background:C.blue,color:C.white,fontSize:14,fontWeight:500,cursor:'pointer',boxShadow:`0 2px 8px ${C.blue}44`,flex:'0 0 auto'}}>+ New meeting</button>
          <div style={{display:'flex',border:`1px solid ${C.gray300}`,borderRadius:24,overflow:'hidden',flex:'1 1 150px',minWidth:150}}>
            <input value={code} onChange={e=>setCode(e.target.value.toUpperCase())} onKeyDown={e=>e.key==='Enter'&&join()} placeholder="Enter a code"
              style={{flex:1,padding:'11px 13px',border:'none',outline:'none',fontFamily:"'Roboto Mono',monospace",fontSize:13,color:C.gray900,minWidth:0}}/>
            <button onClick={join} style={{padding:'11px 15px',border:'none',borderLeft:`1px solid ${C.gray300}`,background:'none',color:C.blue,fontWeight:500,fontSize:13,cursor:'pointer',whiteSpace:'nowrap'}}>Join</button>
          </div>
        </div>
        <p style={{fontSize:11,color:C.gray600,marginBottom:40}}>Guests join with just a code — no account, no install ever.</p>
        <div className="strow" style={{display:'flex',justifyContent:'center',gap:'clamp(16px,4vw,44px)',flexWrap:'wrap',padding:'20px 0 44px',borderTop:`1px solid ${C.gray200}`}}>
          {[['10,000+','calls/day'],['99.9%','uptime'],['4.9/5','rating'],['$40/yr','vs $149 Zoom']].map(([n,l])=>(
            <div key={l} style={{textAlign:'center'}}>
              <div style={{fontSize:'clamp(18px,3vw,24px)',fontWeight:600,color:C.blue}}>{n}</div>
              <div style={{fontSize:11,color:C.gray600,marginTop:2}}>{l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* AI strip */}
      <div style={{background:C.blue,padding:'14px 16px',textAlign:'center'}}>
        <span style={{fontSize:12,color:'rgba(255,255,255,.9)',fontWeight:500}}>
          🤖 AI co-pilot surfaces insights live · 📝 Real-time Deepgram transcription · 📊 Post-call sentiment analytics
        </span>
      </div>

      {/* Features */}
      <section id="features" style={{padding:'clamp(44px,6vh,76px) 16px',background:C.gray50}}>
        <div style={{maxWidth:1100,margin:'0 auto'}}>
          <h2 style={{fontSize:'clamp(20px,3.5vw,34px)',fontWeight:400,color:C.gray900,textAlign:'center',marginBottom:'clamp(24px,4vw,46px)',letterSpacing:'-.01em'}}>
            Built different — not just another video tool
          </h2>
          <div className="fg" style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(270px,1fr))',gap:14}}>
            {[
              {i:'🤖',t:'Live AI co-pilot',d:'Surfaces insights, docs, and context mid-call as topics are spoken. No competitor has this.'},
              {i:'🔒',t:'True E2E encryption',d:'AES-256-GCM always on. Unlike Zoom (caught lying about E2E), we literally cannot access your calls.'},
              {i:'📝',t:'Real-time transcription',d:'Deepgram Nova-2 streams every word with speaker labels. 97% accuracy. $0.26 per 1hr call.'},
              {i:'📊',t:'Sentiment & talk-time',d:'Post-call: who spoke how much, sentiment arc, filler word count, engagement score.'},
              {i:'🎨',t:'Virtual backgrounds',d:'Blur + 6 real-world scenes. Runs in browser via MediaPipe — your video never leaves your device.'},
              {i:'🏥',t:'HIPAA compliant',d:'Waiting room, signed BAA, audit logs. $249/seat/yr for healthcare professionals.'},
            ].map(f=>(
              <div key={f.t} style={{background:C.white,borderRadius:12,padding:'18px',border:`1px solid ${C.gray200}`}}>
                <div style={{fontSize:24,marginBottom:9}}>{f.i}</div>
                <h3 style={{fontSize:14,fontWeight:500,color:C.gray900,margin:'0 0 6px'}}>{f.t}</h3>
                <p style={{fontSize:13,color:C.gray600,margin:0,lineHeight:1.6}}>{f.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison */}
      <section id="compare" style={{padding:'clamp(44px,6vh,76px) 16px'}}>
        <div style={{maxWidth:820,margin:'0 auto'}}>
          <h2 style={{fontSize:'clamp(20px,3.5vw,34px)',fontWeight:400,color:C.gray900,textAlign:'center',marginBottom:6}}>The honest comparison</h2>
          <p style={{textAlign:'center',color:C.gray600,fontSize:13,marginBottom:'clamp(22px,4vw,40px)'}}>vs Zoom Pro & Google Workspace</p>
          <div style={{overflowX:'auto',borderRadius:12,border:`1px solid ${C.gray200}`}}>
            <table style={{width:'100%',borderCollapse:'collapse',minWidth:400,fontSize:13}}>
              <thead>
                <tr style={{background:C.gray50}}>
                  {['Feature','VibeCall','Zoom','Google Meet'].map((h,i)=>(
                    <th key={h} style={{padding:'11px 13px',textAlign:i===0?'left':'center',fontWeight:500,color:i===1?C.blue:C.gray700,borderBottom:`1px solid ${C.gray200}`,background:i===1?C.blueLt:'transparent'}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  ['Price/year','$40','$149.90','$72+'],
                  ['Time limit','None','40 min free','60 min free'],
                  ['AI meeting notes','Included','$19.99/mo extra','Workspace only'],
                  ['Guest needs account','Never','Sometimes','Yes'],
                  ['True E2E encryption','Always','Optional','No'],
                  ['HIPAA BAA','Yes ($249/seat)','Enterprise','Enterprise'],
                ].map((row,i)=>(
                  <tr key={row[0]} style={{background:i%2===0?C.white:C.gray50}}>
                    <td style={{padding:'10px 13px',color:C.gray800,borderBottom:`1px solid ${C.gray200}`}}>{row[0]}</td>
                    {[row[1],row[2],row[3]].map((v,j)=>(
                      <td key={j} style={{padding:'10px 13px',textAlign:'center',fontWeight:j===0?500:400,color:j===0?C.green:C.gray700,background:j===0?`${C.blue}03`:'transparent',borderBottom:`1px solid ${C.gray200}`}}>
                        {j===0?`✓ ${v}`:v}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" style={{padding:'clamp(44px,6vh,76px) 16px',background:C.gray50}}>
        <div style={{maxWidth:950,margin:'0 auto'}}>
          <h2 style={{fontSize:'clamp(20px,3.5vw,34px)',fontWeight:400,color:C.gray900,textAlign:'center',marginBottom:6}}>Simple, honest pricing</h2>
          <p style={{textAlign:'center',color:C.gray600,fontSize:13,marginBottom:'clamp(22px,4vw,40px)'}}>3-day free trial · No credit card required</p>
          <div className="pg" style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(230px,1fr))',gap:14}}>
            {[
              {name:'Free',price:'$0',period:'forever',badge:null,features:['10 participants','No time limits','E2E encrypted','Guest joining'],cta:'Start free',sec:true},
              {name:'PRO',price:'$40',period:'/year',badge:'Most popular',features:['Everything free','AI co-pilot','Live transcription','Virtual backgrounds','Recording','HIPAA compliant'],cta:'Start 3-day trial',sec:false},
              {name:'Healthcare',price:'$249',period:'/seat/yr',badge:'HIPAA',features:['Everything PRO','Signed BAA','Waiting room','Audit logs','Priority support'],cta:'Contact sales',sec:true},
            ].map(p=>(
              <div key={p.name} style={{background:C.white,borderRadius:12,padding:'22px',border:p.badge==='Most popular'?`2px solid ${C.blue}`:`1px solid ${C.gray200}`,position:'relative',display:'flex',flexDirection:'column'}}>
                {p.badge&&<div style={{position:'absolute',top:-11,left:'50%',transform:'translateX(-50%)',background:p.badge==='Most popular'?C.blue:C.green,color:C.white,fontSize:10,fontWeight:500,padding:'3px 12px',borderRadius:999,whiteSpace:'nowrap'}}>{p.badge}</div>}
                <div style={{marginBottom:16}}>
                  <div style={{fontSize:13,fontWeight:500,color:C.gray800,marginBottom:5}}>{p.name}</div>
                  <div style={{fontSize:'clamp(26px,4vw,36px)',fontWeight:400,color:C.gray900}}>{p.price}<span style={{fontSize:12,color:C.gray600}}>{p.period}</span></div>
                </div>
                <ul style={{listStyle:'none',padding:0,margin:'0 0 18px',flex:1,display:'flex',flexDirection:'column',gap:7}}>
                  {p.features.map(f=><li key={f} style={{display:'flex',gap:6,fontSize:13,color:C.gray700}}><span style={{color:C.green}}>✓</span>{f}</li>)}
                </ul>
                <button onClick={()=>navigate('/signup')} style={{padding:'11px',borderRadius:22,border:p.sec?`1px solid ${C.gray300}`:'none',background:p.sec?C.white:C.blue,color:p.sec?C.blue:C.white,fontSize:13,fontWeight:500,cursor:'pointer'}}>{p.cta}</button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section style={{padding:'clamp(44px,6vh,76px) 16px'}}>
        <div style={{maxWidth:680,margin:'0 auto'}}>
          <h2 style={{fontSize:'clamp(20px,3.5vw,32px)',fontWeight:400,color:C.gray900,textAlign:'center',marginBottom:'clamp(22px,4vw,40px)'}}>Common questions</h2>
          {[
            {q:'Do guests need an account?',a:'No. Guests join with name + code only. No Google account, no app install.'},
            {q:'Is VibeCall actually E2E encrypted?',a:'Yes — AES-256-GCM, always on. Zoom lied about E2E encryption for years. We use LiveKit which has independent security audits.'},
            {q:'What is the AI co-pilot?',a:'A sidebar that watches your live conversation and surfaces relevant insights, action items, and data as topics are spoken. Nothing like this exists in Zoom or Meet.'},
            {q:'Is there a time limit?',a:'Never. Zoom cuts free calls at 40 min. VibeCall has zero time limits at any tier.'},
            {q:'Is VibeCall HIPAA compliant?',a:'Yes — waiting room, BAA signing, audit logs, and no PHI in transit. $249/seat/year for healthcare.'},
          ].map((f,i)=>(
            <div key={f.q} style={{border:`1px solid ${C.gray200}`,borderRadius:8,overflow:'hidden',marginBottom:6}}>
              <button onClick={()=>setOpenFaq(openFaq===i?null:i)} style={{width:'100%',display:'flex',justifyContent:'space-between',alignItems:'center',padding:'14px 15px',background:C.white,border:'none',cursor:'pointer',textAlign:'left',gap:10}}>
                <span style={{fontSize:14,fontWeight:500,color:C.gray900,lineHeight:1.4}}>{f.q}</span>
                <span style={{color:C.gray600,fontSize:17,flexShrink:0,transition:'transform .2s',transform:openFaq===i?'rotate(45deg)':'none'}}>+</span>
              </button>
              {openFaq===i&&<div style={{padding:'0 15px 13px',fontSize:13,color:C.gray700,lineHeight:1.7}}>{f.a}</div>}
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section style={{padding:'clamp(44px,6vh,70px) 16px',background:C.blue,textAlign:'center'}}>
        <h2 style={{fontSize:'clamp(20px,4vw,38px)',fontWeight:400,color:C.white,margin:'0 0 10px'}}>Ready to call privately?</h2>
        <p style={{fontSize:'clamp(13px,1.8vw,15px)',color:'rgba(255,255,255,.75)',margin:'0 0 24px',maxWidth:420,marginLeft:'auto',marginRight:'auto'}}>3-day free trial. No credit card. Cancel anytime.</p>
        <div style={{display:'flex',gap:10,justifyContent:'center',flexWrap:'wrap'}}>
          <button onClick={()=>navigate('/signup')} style={{padding:'12px 28px',borderRadius:22,border:'none',background:C.white,color:C.blue,fontSize:14,fontWeight:500,cursor:'pointer'}}>Start free trial</button>
          <button onClick={()=>navigate('/login')} style={{padding:'12px 24px',borderRadius:22,border:'1px solid rgba(255,255,255,.4)',background:'transparent',color:C.white,fontSize:14,fontWeight:500,cursor:'pointer'}}>Sign in</button>
        </div>
      </section>

      {/* Footer */}
      <footer style={{padding:'clamp(26px,4vw,40px) 16px',background:C.gray900}}>
        <div style={{maxWidth:1100,margin:'0 auto'}}>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))',gap:24,marginBottom:24}}>
            <div>
              <div style={{fontSize:16,color:C.white,marginBottom:8}}>Vibe<span style={{color:C.blue}}>Call</span></div>
              <p style={{fontSize:11,color:'rgba(255,255,255,.35)',lineHeight:1.7,margin:0}}>E2E encrypted. No ads. No surveillance.</p>
            </div>
            {[
              {t:'Product',l:[['Features','#features'],['Pricing','#pricing'],['vs Zoom','#compare']]},
              {t:'Company',l:[['About','/about'],['Security','/security'],['Blog','/blog']]},
              {t:'Legal',l:[['Privacy','/privacy'],['Terms','/terms'],['Contact','mailto:hello@vibecall.io']]},
            ].map(col=>(
              <div key={col.t}>
                <div style={{fontSize:10,fontWeight:500,color:'rgba(255,255,255,.35)',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:10}}>{col.t}</div>
                <div style={{display:'flex',flexDirection:'column',gap:7}}>
                  {col.l.map(([l,h])=><a key={l} href={h} style={{fontSize:12,color:'rgba(255,255,255,.5)',textDecoration:'none'}}>{l}</a>)}
                </div>
              </div>
            ))}
          </div>
          <div style={{borderTop:'1px solid rgba(255,255,255,.07)',paddingTop:16,display:'flex',justifyContent:'space-between',flexWrap:'wrap',gap:8}}>
            <span style={{fontSize:11,color:'rgba(255,255,255,.25)'}}>© 2025 VibeCall</span>
            <span style={{fontSize:11,color:'rgba(255,255,255,.25)'}}>🔒 E2E encrypted · No ads · No tracking</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
