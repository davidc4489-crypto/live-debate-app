import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  SetMetadata,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";

export interface RateLimitOptions {
  /** Nombre de requêtes autorisées dans la fenêtre. */
  limit: number;
  /** Taille de la fenêtre en millisecondes. */
  windowMs: number;
}

export const RATE_LIMIT_KEY = "rate-limit-options";

/** Limite le nombre d'appels par IP sur une route (anti brute-force). */
export const RateLimit = (limit: number, windowMs: number) =>
  SetMetadata(RATE_LIMIT_KEY, { limit, windowMs } satisfies RateLimitOptions);

/** Sous-ensemble d'`express.Request` utilisé ici (évite la dépendance de types). */
interface RequestLike {
  headers: Record<string, string | string[] | undefined>;
  ip?: string;
}

interface Bucket {
  hits: number[];
}

/**
 * Compteur en mémoire par IP + route.
 *
 * Suffisant pour une instance unique (déploiement Render actuel). Pour
 * plusieurs instances, remplacer le `Map` par Redis — l'interface ne change pas.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly buckets = new Map<string, Bucket>();
  private lastPrune = Date.now();

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const options = this.reflector.getAllAndOverride<RateLimitOptions | undefined>(
      RATE_LIMIT_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!options) return true;

    const request = context.switchToHttp().getRequest<RequestLike>();
    const key = `${this.clientIp(request)}:${context.getClass().name}.${context.getHandler().name}`;
    const now = Date.now();

    this.pruneIfNeeded(now, options.windowMs);

    const bucket = this.buckets.get(key) ?? { hits: [] };
    bucket.hits = bucket.hits.filter((at) => now - at < options.windowMs);

    if (bucket.hits.length >= options.limit) {
      this.buckets.set(key, bucket);
      const retryAfterMs = options.windowMs - (now - bucket.hits[0]);
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: `Trop de tentatives. Réessayez dans ${Math.ceil(retryAfterMs / 1000)} s.`,
          retryAfterMs,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    bucket.hits.push(now);
    this.buckets.set(key, bucket);
    return true;
  }

  private clientIp(request: RequestLike): string {
    // Render/Vercel placent l'IP réelle dans X-Forwarded-For.
    const forwarded = request.headers["x-forwarded-for"];
    const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    return raw?.split(",")[0]?.trim() || request.ip || "inconnu";
  }

  private pruneIfNeeded(now: number, windowMs: number): void {
    if (now - this.lastPrune < 60_000) return;
    this.lastPrune = now;
    for (const [key, bucket] of this.buckets) {
      if (bucket.hits.every((at) => now - at >= windowMs)) {
        this.buckets.delete(key);
      }
    }
  }
}
