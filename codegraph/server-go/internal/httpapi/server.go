package httpapi

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"
	"sync"
	"time"

	"codeflow/server/internal/config"
)

type API struct {
	cfg      config.Config
	client   *http.Client
	analysis http.Handler
	legacy   http.Handler
	cache    sync.Map
}

type cacheEntry struct {
	body    []byte
	expires time.Time
}

func New(cfg config.Config) http.Handler {
	target, _ := url.Parse(cfg.FastAPIURL)
	legacyTarget, _ := url.Parse(cfg.LegacyAPIURL)
	api := &API{cfg: cfg, client: &http.Client{Timeout: 20 * time.Second}, analysis: newReverseProxy(target), legacy: newReverseProxy(legacyTarget)}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health/live", api.live)
	mux.HandleFunc("GET /health/ready", api.ready)
	mux.HandleFunc("POST /api/github/repo", api.repositoryTree)
	mux.Handle("POST /api/analyze", api.analysis)
	mux.Handle("GET /api/tasks/{taskId}", api.analysis)
	mux.Handle("/auth/", api.legacy)
	mux.Handle("/api/db/", api.legacy)
	mux.Handle("/api/architecture/", api.legacy)
	mux.Handle("GET /api/github/repos", api.legacy)
	return chain(http.MaxBytesHandler(mux, cfg.MaxBodyBytes), recoverer, requestLog, concurrencyLimit(cfg.MaxConcurrentRequests), rateLimit(cfg.RateLimitPerSecond), cors(cfg.ClientOrigin))
}

func newReverseProxy(target *url.URL) *httputil.ReverseProxy {
	proxy := httputil.NewSingleHostReverseProxy(target)
	proxy.ModifyResponse = func(response *http.Response) error {
		response.Header.Del("Access-Control-Allow-Origin")
		response.Header.Del("Access-Control-Allow-Credentials")
		return nil
	}
	proxy.ErrorHandler = func(w http.ResponseWriter, _ *http.Request, _ error) {
		writeError(w, http.StatusBadGateway, "upstream unavailable")
	}
	return proxy
}

func (a *API) live(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, 200, map[string]string{"status": "ok"})
}
func (a *API) ready(w http.ResponseWriter, r *http.Request) {
	dependencies := map[string]string{"analysis": a.cfg.FastAPIURL + "/", "legacy_api": a.cfg.LegacyAPIURL + "/auth/me"}
	for name, endpoint := range dependencies {
		req, _ := http.NewRequestWithContext(r.Context(), http.MethodGet, endpoint, nil)
		response, err := a.client.Do(req)
		if err != nil || response.StatusCode >= 500 {
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{"status": "not_ready", "dependency": name})
			return
		}
		response.Body.Close()
	}
	writeJSON(w, 200, map[string]string{"status": "ready"})
}

func (a *API) repositoryTree(w http.ResponseWriter, r *http.Request) {
	var input struct{ Owner, Repo, Token string }
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, 400, "invalid JSON")
		return
	}
	if !safeSegment(input.Owner) || !safeSegment(input.Repo) {
		writeError(w, 422, "invalid repository")
		return
	}
	cacheKey := strings.ToLower(input.Owner + "/" + input.Repo)
	if input.Token == "" {
		if cached, ok := a.cache.Load(cacheKey); ok {
			entry := cached.(cacheEntry)
			if time.Now().Before(entry.expires) {
				w.Header().Set("Content-Type", "application/json")
				w.Header().Set("X-Cache", "HIT")
				_, _ = w.Write(entry.body)
				return
			}
			a.cache.Delete(cacheKey)
		}
	}
	req, _ := http.NewRequestWithContext(r.Context(), http.MethodGet, "https://api.github.com/repos/"+url.PathEscape(input.Owner)+"/"+url.PathEscape(input.Repo)+"/git/trees/HEAD?recursive=1", nil)
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("User-Agent", "CodeFlow-App")
	if input.Token != "" {
		req.Header.Set("Authorization", "Bearer "+input.Token)
	}
	response, err := a.client.Do(req)
	if err != nil {
		writeError(w, 502, "GitHub unavailable")
		return
	}
	defer response.Body.Close()
	body, err := io.ReadAll(io.LimitReader(response.Body, 25<<20))
	if err != nil {
		writeError(w, 502, "invalid GitHub response")
		return
	}
	if input.Token == "" && response.StatusCode == http.StatusOK {
		a.cache.Store(cacheKey, cacheEntry{body: body, expires: time.Now().Add(time.Minute)})
	}
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("X-Cache", "MISS")
	w.WriteHeader(response.StatusCode)
	_, _ = w.Write(body)
}

func safeSegment(value string) bool { return value != "" && !strings.ContainsAny(value, "/\\?%") }
func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}
func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}
