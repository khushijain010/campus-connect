import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './lib/auth.jsx';
import { Spinner } from './components/ui.jsx';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Onboarding from './pages/Onboarding.jsx';
import Home from './pages/Home.jsx';
import PostDetail from './pages/PostDetail.jsx';
import SearchPage from './pages/SearchPage.jsx';
import Profile from './pages/Profile.jsx';
import Culture from './pages/Culture.jsx';
import Discover from './pages/Discover.jsx';
import ActivityPage from './pages/ActivityPage.jsx';
import CommunityPage from './pages/CommunityPage.jsx';
import Personal from './pages/Personal.jsx';
import EditProfile from './pages/EditProfile.jsx';
import Chats from './pages/Chats.jsx';

// The landing page (and its three.js scene) loads as a separate chunk, only for logged-out visitors.
const Landing = lazy(() => import('./pages/Landing.jsx'));
const fullPageSpinner = <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}><Spinner /></div>;

function RequireAuth({ children }) {
  const { user } = useAuth();
  const loc = useLocation();
  if (!user) {
    // Visiting the site root logged out shows the landing page; any other app URL asks you to log in.
    if (loc.pathname === '/') return <Suspense fallback={fullPageSpinner}><Landing /></Suspense>;
    return <Navigate to="/login" replace state={{ from: loc }} />;
  }
  return children;
}

function PublicOnly({ children }) {
  const { user } = useAuth();
  return user ? <Navigate to="/" replace /> : children;
}

export default function App() {
  const { ready } = useAuth();
  if (!ready) return fullPageSpinner;
  return (
    <Routes>
      <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
      <Route path="/signup" element={<PublicOnly><Onboarding /></PublicOnly>} />
      <Route element={<RequireAuth><Layout /></RequireAuth>}>
        <Route index element={<Home />} />
        <Route path="post/:id" element={<PostDetail />} />
        <Route path="search" element={<SearchPage />} />
        <Route path="u/:handle" element={<Profile />} />
        <Route path="culture" element={<Culture />} />
        <Route path="discover" element={<Discover />} />
        <Route path="activity/:id" element={<ActivityPage />} />
        <Route path="community/:id" element={<CommunityPage />} />
        <Route path="chats" element={<Chats />} />
        <Route path="personal" element={<Personal />} />
        <Route path="personal/edit" element={<EditProfile />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
