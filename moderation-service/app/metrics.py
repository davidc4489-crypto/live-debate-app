"""Compteurs en mémoire pour observer la modération en production."""

from __future__ import annotations

import threading
import time
from collections import Counter, deque


class Metrics:
    def __init__(self, window: int = 512) -> None:
        self._lock = threading.Lock()
        self._actions: Counter[str] = Counter()
        self._languages: Counter[str] = Counter()
        self._categories: Counter[str] = Counter()
        self._latencies: deque[float] = deque(maxlen=window)
        self._cache_hits = 0
        self._requests = 0
        self._degraded = 0
        self._started_at = time.time()

    def record(
        self,
        action: str,
        language: str,
        categories: list[str],
        latency_ms: float,
        cached: bool,
        degraded: bool,
    ) -> None:
        with self._lock:
            self._requests += 1
            self._actions[action] += 1
            self._languages[language] += 1
            for category in categories:
                self._categories[category] += 1
            self._latencies.append(latency_ms)
            if cached:
                self._cache_hits += 1
            if degraded:
                self._degraded += 1

    def snapshot(self) -> dict:
        with self._lock:
            latencies = sorted(self._latencies)
            requests = self._requests

            def percentile(ratio: float) -> float:
                if not latencies:
                    return 0.0
                index = min(len(latencies) - 1, int(len(latencies) * ratio))
                return round(latencies[index], 2)

            return {
                "uptime_s": round(time.time() - self._started_at, 1),
                "requests": requests,
                "actions": dict(self._actions),
                "languages": dict(self._languages),
                "categories": dict(self._categories),
                "cache_hit_rate": round(self._cache_hits / requests, 4) if requests else 0.0,
                "degraded_rate": round(self._degraded / requests, 4) if requests else 0.0,
                "latency_ms": {
                    "p50": percentile(0.5),
                    "p95": percentile(0.95),
                    "p99": percentile(0.99),
                    "samples": len(latencies),
                },
                "block_rate": round(self._actions["block"] / requests, 4) if requests else 0.0,
                "warn_rate": round(self._actions["warn"] / requests, 4) if requests else 0.0,
            }

    def reset(self) -> None:
        with self._lock:
            self._actions.clear()
            self._languages.clear()
            self._categories.clear()
            self._latencies.clear()
            self._cache_hits = 0
            self._requests = 0
            self._degraded = 0
            self._started_at = time.time()


METRICS = Metrics()
