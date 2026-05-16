import { Injectable, OnModuleInit } from "@nestjs/common";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

@Injectable()
export class SupabaseService implements OnModuleInit {
  private client!: SupabaseClient;
  private serviceClient!: SupabaseClient;

  onModuleInit() {
    const url = process.env.SUPABASE_URL?.replace(/\/+$/, "");
    const anonKey = process.env.SUPABASE_ANON_KEY;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !anonKey) {
      throw new Error(
        "SUPABASE_URL et SUPABASE_ANON_KEY sont requis dans les variables d'environnement",
      );
    }

    this.client = createClient(url, anonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    if (serviceRoleKey) {
      this.serviceClient = createClient(url, serviceRoleKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });
    }
  }

  getClient(): SupabaseClient {
    return this.client;
  }

  getServiceClient(): SupabaseClient {
    if (!this.serviceClient) {
      throw new Error(
        "SUPABASE_SERVICE_ROLE_KEY est requis pour certaines opérations auth",
      );
    }
    return this.serviceClient;
  }

  getClientWithToken(accessToken: string): SupabaseClient {
    const url = process.env.SUPABASE_URL!;
    const anonKey = process.env.SUPABASE_ANON_KEY!;

    return createClient(url, anonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    });
  }
}
