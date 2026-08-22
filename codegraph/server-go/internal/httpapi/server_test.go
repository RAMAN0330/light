package httpapi

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"codeflow/server/internal/config"
)

func testConfig(analysisURL string) config.Config {
	return config.Config{ClientOrigin: "http://localhost:5173", FastAPIURL: analysisURL, LegacyAPIURL: analysisURL, MaxBodyBytes: 1024,
		RateLimitPerSecond: 100, MaxConcurrentRequests: 100, ReadTimeout: time.Second, WriteTimeout: time.Second, IdleTimeout: time.Second}
}

func TestHealthAndReadiness(t *testing.T) {
	analysis := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusOK) }))
	defer analysis.Close()
	api := New(testConfig(analysis.URL))
	for _, path := range []string{"/health/live", "/health/ready"} {
		request := httptest.NewRequest(http.MethodGet, path, nil)
		response := httptest.NewRecorder()
		api.ServeHTTP(response, request)
		if response.Code != http.StatusOK {
			t.Fatalf("%s returned %d", path, response.Code)
		}
	}
}

func TestReadinessFailsWhenAnalysisUnavailable(t *testing.T) {
	api := New(testConfig("http://127.0.0.1:1"))
	response := httptest.NewRecorder()
	api.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/health/ready", nil))
	if response.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503, got %d", response.Code)
	}
}

func TestRepositoryValidation(t *testing.T) {
	api := New(testConfig("http://127.0.0.1:1"))
	request := httptest.NewRequest(http.MethodPost, "/api/github/repo", strings.NewReader(`{"owner":"bad/name","repo":"repo"}`))
	response := httptest.NewRecorder()
	api.ServeHTTP(response, request)
	if response.Code != http.StatusUnprocessableEntity {
		t.Fatalf("expected 422, got %d", response.Code)
	}
}

func TestRequestBodyLimit(t *testing.T) {
	cfg := testConfig("http://127.0.0.1:1")
	cfg.MaxBodyBytes = 16
	request := httptest.NewRequest(http.MethodPost, "/api/github/repo", strings.NewReader(strings.Repeat("x", 100)))
	response := httptest.NewRecorder()
	New(cfg).ServeHTTP(response, request)
	if response.Code != http.StatusRequestEntityTooLarge && response.Code != http.StatusBadRequest {
		t.Fatalf("expected bounded request failure, got %d", response.Code)
	}
}

func TestRateLimit(t *testing.T) {
	cfg := testConfig("http://127.0.0.1:1")
	cfg.RateLimitPerSecond = 1
	api := New(cfg)
	first := httptest.NewRecorder()
	api.ServeHTTP(first, httptest.NewRequest(http.MethodPost, "/api/github/repo", strings.NewReader(`{}`)))
	second := httptest.NewRecorder()
	api.ServeHTTP(second, httptest.NewRequest(http.MethodPost, "/api/github/repo", strings.NewReader(`{}`)))
	if first.Code != http.StatusUnprocessableEntity || second.Code != http.StatusTooManyRequests {
		t.Fatalf("expected 422 then 429, got %d then %d", first.Code, second.Code)
	}
}

func TestAnalysisProxy(t *testing.T) {
	analysis := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/analyze" {
			t.Errorf("unexpected path %s", r.URL.Path)
		}
		writeJSON(w, http.StatusAccepted, map[string]string{"task_id": "test"})
	}))
	defer analysis.Close()
	request := httptest.NewRequest(http.MethodPost, "/api/analyze", strings.NewReader(`{"url":"https://example.test/repo"}`))
	response := httptest.NewRecorder()
	New(testConfig(analysis.URL)).ServeHTTP(response, request)
	if response.Code != http.StatusAccepted {
		t.Fatalf("expected 202, got %d", response.Code)
	}
}

func TestArchitectureEnrichmentProxy(t *testing.T) {
	legacy := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/architecture/enrich" || r.Method != http.MethodPost {
			t.Errorf("unexpected request %s %s", r.Method, r.URL.Path)
		}
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "not configured"})
	}))
	defer legacy.Close()
	request := httptest.NewRequest(http.MethodPost, "/api/architecture/enrich", strings.NewReader(`{"graph":{}}`))
	response := httptest.NewRecorder()
	New(testConfig(legacy.URL)).ServeHTTP(response, request)
	if response.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected proxied 503, got %d", response.Code)
	}
}
