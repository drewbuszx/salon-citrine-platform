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
