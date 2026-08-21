import { lazy, Suspense, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { AuthScreen } from "./components/AuthScreen";
import { LandingPage } from "./components/LandingPage";
import { supabase } from "./lib/supabase";

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [showAuth, setShowAuth] = useState(false);
  const [showLanding, setShowLanding] = useState(false);
  useEffect(() => { supabase.auth.getSession().then(({ data }) => setSession(data.session)); return supabase.auth.onAuthStateChange((_event, next) => setSession(next)).data.subscription.unsubscribe; }, []);
  async function signOut() {
    await supabase.auth.signOut();
    setShowAuth(false);
    setShowLanding(true);
  }
  if (session && !showLanding) {
    return <Suspense fallback={<main className="chat-shell" aria-busy="true" /> }><ChatApp accessToken={session.access_token} onNavigateHome={() => setShowLanding(true)} onSignOut={() => void signOut()} /></Suspense>;
  }
  return <>
    <LandingPage onStart={() => session ? setShowLanding(false) : setShowAuth(true)} onSignOut={session ? () => void signOut() : undefined} />
    {showAuth && !session && <AuthScreen onClose={() => setShowAuth(false)} />}
  </>;
}
const ChatApp = lazy(() => import("./components/ChatApp").then((module) => ({ default: module.ChatApp })));
