import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { GitFork, Search } from "lucide-react";

import { githubConnectionApi, type ExternalConnection, type GitHubRepo } from "../api/githubConnection";
import { fadeUp } from "../lib/motion";
import { useLenis } from "../lib/useLenis";

type Props = {
  accessToken: string;
  workspaceId: string;
  onSelectRepo: (fullName: string) => void;
};

export function GitHubRepoPicker({ accessToken, workspaceId, onSelectRepo }: Props) {
  const [connection, setConnection] = useState<ExternalConnection | null>(null);
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [connecting, setConnecting] = useState(false);

  async function refresh() {
    const connections = await githubConnectionApi.listExternalConnections(accessToken, workspaceId);
    const active = connections.find((c) => c.provider === "github" && c.status === "active") || null;
    setConnection(active);
    if (active) {
      const result = await githubConnectionApi.repos(accessToken, workspaceId, active.id);
      if (result.status === "completed") setRepos(result.data);
      else if (result.status === "approval_required") setMessage("Listing your repos requires workspace approval — check the Approval inbox.");
      else setMessage("reason" in result ? result.reason : "error" in result ? result.error : "Could not list repositories.");
    }
  }

  useEffect(() => {
    refresh().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, workspaceId]);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.data?.type === "orbital-github-connected") {
        setConnecting(false);
        void refresh();
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, workspaceId]);

  async function connect() {
    setConnecting(true);
    setMessage("");
    try {
      let pending = connection;
      if (!pending) {
        const connections = await githubConnectionApi.listExternalConnections(accessToken, workspaceId);
        pending = connections.find((c) => c.provider === "github" && c.status !== "revoked") || null;
      }
      if (!pending) {
        const created = await githubConnectionApi.startGithubConnection(accessToken, workspaceId);
        if ("decision" in created) {
          setMessage("Connecting GitHub requires workspace approval — check the Approval inbox.");
          setConnecting(false);
          return;
        }
        pending = created;
      }
      const { authorize_url } = await githubConnectionApi.authorizeUrl(accessToken, workspaceId, pending.id);
      window.open(authorize_url, "orbital-github-connect", "width=640,height=720");
    } catch {
      setMessage("Could not start the GitHub connection.");
      setConnecting(false);
    }
  }

  const filtered = repos.filter((r) => r.full_name.toLowerCase().includes(search.toLowerCase()));
  const listRef = useRef<HTMLDivElement>(null);
  useLenis(listRef);

  if (!connection) {
    return (
      <motion.div className="github-picker" initial="hidden" animate="show" variants={fadeUp}>
        <button type="button" className="dialog-primary" onClick={() => void connect()} disabled={connecting}>
          <GitFork size={16} /> {connecting ? "Waiting for GitHub…" : "Connect GitHub to browse your repos"}
        </button>
        {message && <p className="project-empty">{message}</p>}
      </motion.div>
    );
  }

  return (
    <motion.div className="github-picker" initial="hidden" animate="show" variants={fadeUp}>
      <div className="github-picker-search">
        <Search size={14} />
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search your repositories…" aria-label="Search your repositories" />
      </div>
      {message && <p className="project-empty">{message}</p>}
      <div className="github-picker-list" ref={listRef}>
        {filtered.slice(0, 50).map((repo) => (
          <button key={repo.id} type="button" className="github-picker-row" onClick={() => onSelectRepo(repo.full_name)}>
            <strong>{repo.full_name}</strong>
            <small>{repo.private ? "Private" : "Public"} {repo.language ? `· ${repo.language}` : ""}</small>
          </button>
        ))}
        {filtered.length === 0 && <p className="project-empty">No matching repositories.</p>}
      </div>
    </motion.div>
  );
}
