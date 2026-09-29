-- Impede chamadas diretas via Data API à função privilegiada do trigger.
-- O trigger interno continua executando normalmente sob o contexto do banco.
revoke execute on function public.vf_mirror_team_division_response() from public, anon, authenticated;
