package config

import (
	"fmt"
	"os"
	"time"
)

type Config struct {
	Address, ClientOrigin, FastAPIURL, LegacyAPIURL string
	ReadTimeout, WriteTimeout, IdleTimeout          time.Duration
	MaxBodyBytes                                    int64
	RateLimitPerSecond                              int
	MaxConcurrentRequests                           int
}

func Load() Config {
	port := value("PORT", "5000")
	return Config{
		Address: ":" + port, ClientOrigin: value("CLIENT_ORIGIN", "http://localhost:5173"),
		FastAPIURL: value("FASTAPI_URL", "http://localhost:8000"), MaxBodyBytes: 10 << 20,
		LegacyAPIURL:          value("LEGACY_API_URL", "http://localhost:5001"),
		RateLimitPerSecond:    integer("RATE_LIMIT_RPS", 50),
		MaxConcurrentRequests: integer("MAX_CONCURRENT_REQUESTS", 256),
		ReadTimeout:           15 * time.Second, WriteTimeout: 30 * time.Second, IdleTimeout: 60 * time.Second,
	}
}

func integer(key string, fallback int) int {
	var parsed int
	if _, err := fmt.Sscanf(value(key, ""), "%d", &parsed); err != nil || parsed <= 0 {
		return fallback
	}
	return parsed
}

func (c Config) Validate() error {
	if c.ClientOrigin == "*" {
		return fmt.Errorf("CLIENT_ORIGIN must be explicit")
	}
	return nil
}

func value(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
