package httpapi

import (
	"log/slog"
	"net"
	"net/http"
	"runtime/debug"
	"strings"
	"sync"
	"time"
)

type middleware func(http.Handler) http.Handler

func concurrencyLimit(maximum int) middleware {
	semaphore := make(chan struct{}, maximum)
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if strings.HasPrefix(r.URL.Path, "/health/") {
				next.ServeHTTP(w, r)
				return
			}
			select {
			case semaphore <- struct{}{}:
				defer func() { <-semaphore }()
				next.ServeHTTP(w, r)
			default:
				w.Header().Set("Retry-After", "1")
				writeError(w, http.StatusServiceUnavailable, "server is busy")
			}
		})
	}
}

func chain(handler http.Handler, middleware ...middleware) http.Handler {
	for i := len(middleware) - 1; i >= 0; i-- {
		handler = middleware[i](handler)
	}
	return handler
}

func rateLimit(requestsPerSecond int) middleware {
	type visitor struct {
		count  int
		window time.Time
	}
	visitors := make(map[string]visitor)
	var mu sync.Mutex
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if strings.HasPrefix(r.URL.Path, "/health/") {
				next.ServeHTTP(w, r)
				return
			}
			now := time.Now()
			key, _, err := net.SplitHostPort(r.RemoteAddr)
			if err != nil {
				key = r.RemoteAddr
			}
			mu.Lock()
			current := visitors[key]
			if now.Sub(current.window) >= time.Second {
				current = visitor{window: now}
			}
			current.count++
			visitors[key] = current
			allowed := current.count <= requestsPerSecond
			mu.Unlock()
			if !allowed {
				w.Header().Set("Retry-After", "1")
				writeError(w, http.StatusTooManyRequests, "rate limit exceeded")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

func recoverer(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if err := recover(); err != nil {
				slog.Error("panic", "error", err, "stack", string(debug.Stack()))
				writeError(w, 500, "internal server error")
			}
		}()
		next.ServeHTTP(w, r)
	})
}

func requestLog(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		next.ServeHTTP(w, r)
		slog.Info("request", "method", r.Method, "path", r.URL.Path, "duration", time.Since(start))
	})
}

func cors(origin string) middleware {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Access-Control-Allow-Credentials", "true")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
			if r.Method == http.MethodOptions {
				w.WriteHeader(http.StatusNoContent)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
