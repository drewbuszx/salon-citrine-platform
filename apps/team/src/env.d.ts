/// <reference types="astro/client" />

import type { SupabaseClient, User } from "@supabase/supabase-js";

export type StaffRole = "owner" | "stylist" | "esthetician" | "front_desk";

export type StaffProfile = {
  id: string;
  slug: string;
  name: string;
  role: StaffRole;
};

declare global {
  namespace App {
    interface Locals {
      supabase: SupabaseClient;
      user: User | null;
      staff: StaffProfile | null;
    }
  }
}

interface ImportMetaEnv {
  readonly SUPABASE_URL: string;
  readonly SUPABASE_ANON_KEY: string;
  readonly PUBLIC_SUPABASE_URL?: string;
  readonly PUBLIC_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
