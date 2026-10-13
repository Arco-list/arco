-- Twee kolommen uit de tijd dat Arco opdrachten modelleerde in plaats van
-- gerealiseerd werk.
--
-- start_date en completion_date zijn 0 van 214 projecten gevuld — niet alleen
-- bij de gepubliceerde, bij alle. Ze komen niet voor in mv_project_summary,
-- niet in project_search_documents en niet in search_projects, en er is geen
-- enkele codeverwijzing naar projects.start_date. (Grep op "start_date" geeft
-- wel treffers, maar die gaan over Stripe-abonnementsfases: een ander veld in
-- een ander domein.)
--
-- Een project op Arco is af. Wanneer het begon is geen vraag die iemand hier
-- stelt, en het jaar van oplevering staat al in project_year.
--
-- Zonder afhankelijkheden, dus dit kan blind.

ALTER TABLE public.projects
  DROP COLUMN IF EXISTS start_date,
  DROP COLUMN IF EXISTS completion_date;
