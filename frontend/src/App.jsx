/**
 * App.jsx — VibeCall Root Router
 * Routes:
 *   /              → Landing page (home)
 *   /login         → Login
 *   /signup        → Register
 *   /dashboard     → User dashboard (protected)
 *   /room/:code    → Live meeting room (protected)
 */
import { useEffect, Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useParams } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { useAuthStore } from "./services/authStore.js";
import VibeCallRoom from "./components/VibeCallRoom.jsx";

// Lazy-loaded pages (code-split per route)
const Home      = lazy(() => import("./pages/Home.jsx"));
const Login     = lazy(() => import("./pages/Login.jsx"));
const Signup    = lazy(() => import("./pages/Signup.jsx"));
const Dashboard = lazy(() => import("./pages/Dashboard.jsx"));

const API_BASE = import.meta.env.VITE_API_URL || "";

// ── Protected route wrapper ───────────────────────────────────────────────────
function Protected({ children }) {
  const user = useAuthStore(s => s.user);
  const loading = useAuthStore(s => s.loading);
  if (loading) return <PageLoader/>;
  if (!user) return <Navigate to="/login" replace/>;
  return children;
}

// ── Room page — pulls code from URL ──────────────────────────────────────────
function RoomPage() {
  const { code } = useParams();
  const user = useAuthStore(s => s.user);
  const navigate = useNavigate();
  return (
    <VibeCallRoom
      apiBase={API_BASE}
      roomCode={code || "ROOM-001"}
      userName={user?.name || user?.email?.split("@")[0] || "Guest"}
      onLeave={() => navigate("/dashboard")}
    />
  );
}

// ── Spinner ───────────────────────────────────────────────────────────────────
function PageLoader() {
  return (
    <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F8F9FA" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: "#1A73E8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>📹</div>
        <div style={{ fontSize: 14, color: "#80868B", fontFamily: "'Google Sans',sans-serif" }}>Loading…</div>
      </div>
    </div>
  );
}

// ── App Shell ────────────────────────────────────────────────────────────────
function AppShell() {
  const checkSession = useAuthStore(s => s.checkSession);

  // Check if user is already logged in on mount
  useEffect(() => { checkSession(); }, []);

  return (
    <Suspense fallback={<PageLoader/>}>
      <Routes>
        {/* Public */}
        <Route path="/"       element={<Home/>}/>
        <Route path="/login"  element={<Login/>}/>
        <Route path="/signup" element={<Signup/>}/>

        {/* Protected */}
        <Route path="/dashboard" element={<Protected><Dashboard/></Protected>}/>
        <Route path="/room/:code" element={<Protected><RoomPage/></Protected>}/>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace/>}/>
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <HelmetProvider>
      <BrowserRouter>
        <AppShell/>
      </BrowserRouter>
    </HelmetProvider>
  );
}
