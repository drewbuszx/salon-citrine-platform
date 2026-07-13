/// <reference types="astro/client" />

import type { SupabaseClient, User } from "@supabase/supabase-js";

export type StaffRole = "owner" | "stylist" | "esthetician" | "front_desk";

export type PhotoCrop = {
  x: number;
  y: number;
  scale: number;
};

export type StaffProfile = {
  id: string;
  slug: string;
  name: string;
  role: StaffRole;
  bio?: string | null;
  phone?: string | null;
  photo_url?: string | null;
  photo_crop?: PhotoCrop | null;
  access_status?: "active";
  /** Capability keys granted to this staff member's role (owner always has manage_team). */
  capabilities?: string[];
};

declare global {
  namespace App {
    interface Locals {
      supabase: SupabaseClient;
      user: User | null;
      staff: StaffProfile | null;
      cspNonce: string;
    }
  }
}

interface ImportMetaEnv {
  readonly SUPABASE_URL: string;
  readonly SUPABASE_ANON_KEY: string;
  readonly PUBLIC_SUPABASE_URL?: string;
  readonly PUBLIC_SUPABASE_ANON_KEY?: string;
  readonly SUPABASE_SERVICE_ROLE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
