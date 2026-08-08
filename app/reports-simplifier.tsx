"use client";

import { useEffect } from "react";
import { apiFetch } from "./supabase-client";

type Summary = {
  total: number;
  voters: number;
  leaders: number;
  districtsReached: number;
};

type SessionUser = {
  email?: string;
  role?: string;
};

const ADMIN_ROLES = new Set(["master", "gestor", "lider", "admin"]);
const numberFormatter = new Intl.NumberFormat("pt-BR");

function formatNumber(value: number) {
  return numberFormatter.format(Math.max(0, Math.round(value)));
}

export default function ReportsSimplifier() {
  useEffect(() => {
    let cancelled = false;
    let observer: MutationObserver | null = null;
    let fallbackScope = "";
    let requestVersion = 0;

    const resolve