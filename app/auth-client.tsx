"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import NeutralDashboardClient from "./neutral-dashboard-client";
import { apiFetch, supabase } from "./supabase-client";

type Mode = "login" | "signup" | "forgot" | "recovery";

type CurrentUser = {
  email: string;
  name: string;
  role: string;
};

const OFFICIAL_SITE_URL = "https://www.sistemavotof