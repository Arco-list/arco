-- Pin search_path on the 13 public functions flagged by the Supabase security
-- linter (lint 0011 — function_search_path_mutable). Without this, a role
-- could set their own search_path before calling the function and shadow
-- objects the function references (e.g. inject a malicious `companies` table
-- in their own schema). Pinning to `public` disables that vector while still
-- including pg_catalog implicitly.

alter function public.check_redirect_chain(text, text, integer)                                                                                                                                                set search_path = public;
alter function public.count_professionals(text, text, text, text[], uuid[], uuid[], numeric, numeric, boolean)                                                                                                  set search_path = public;
alter function public.enqueue_homeowner_welcome()                                                                                                                                                                set search_path = public;
alter function public.get_project_cities()                                                                                                                                                                       set search_path = public;
alter function public.get_prospect_funnel()                                                                                                                                                                      set search_path = public;
alter function public.refresh_all_materialized_views()                                                                                                                                                           set search_path = public;
alter function public.search_professionals(text, text, text, text[], uuid[], uuid[], numeric, numeric, boolean, integer, integer)                                                                              set search_path = public;
alter function public.search_professionals_optimized(text, text, uuid, boolean, boolean, numeric, text, integer, integer)                                                                                       set search_path = public;
alter function public.search_projects(text, text, uuid, project_budget_level, text, text[], text[], boolean, integer, integer)                                                                                  set search_path = public;
alter function public.sync_project_features()                                                                                                                                                                    set search_path = public;
alter function public.update_company_ratings()                                                                                                                                                                   set search_path = public;
alter function public.update_company_services(uuid, uuid, text[], text[], text[])                                                                                                                                set search_path = public;
alter function public.validate_project_redirect()                                                                                                                                                                set search_path = public;
