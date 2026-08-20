import { lazy, Suspense, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { AuthScreen } from "./components/AuthScreen";
import { supabase } from "./lib/supabase";

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  useEffect(() => { supabase.auth.getSession().then(({ data }) => setSession(data.session)); return supabase.auth.onAuthStateChange((_event, next) => setSession(next)).data.subscription.unsubscribe; }, []);
  return session ? <Suspense fallback={<main className="chat-shell" aria-busy="true" /> }><ChatApp accessToken={session.access_token} /></Suspense> : <AuthScreen />;
}
const ChatApp = lazy(() => import("./components/ChatApp").then((module) => ({ default: module.ChatApp })));
