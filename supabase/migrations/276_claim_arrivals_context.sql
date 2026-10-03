-- Leg vast waarop de scannerfilter beslist.
--
-- trackClaimArrival keerde terug ZONDER te schrijven zodra
-- isLikelyMailScannerVisit aansloeg. Daarmee bestond er een filter die
-- beslissingen nam die niemand achteraf kon controleren: de tabel had
-- channel, email, company_id en created_at, en het land en de
-- user-agent waarop de beslissing viel waren weg zodra de functie
-- klaar was.
--
-- Dat werd zichtbaar op 3 oktober. De server telde 59 unieke adressen
-- op /claim, PostHog zag er 14 — een kwart. Van de gemailde aankomsten
-- kwam 86% binnen tien minuten na verzending, en 34 van de 68
-- herhaalbezoeken binnen twee seconden na het vorige van hetzelfde
-- adres. Dat is machineverkeer dat door de filter heen komt, en de
-- reden is te raden maar niet te bewijzen: de filter weert alles van
-- buiten NL/BE, en Azure's West Europe-regio staat in Amsterdam.
--
-- Vanaf nu wordt ELKE aankomst geschreven, met de feiten waarop is
-- geoordeeld en het oordeel zelf. Dezelfde vorm als de Resend-webhook
-- sinds gisteren: het ruwe feit blijft staan, de vlag houdt het uit de
-- tellers. Een filter die wegggooit kan niet worden bijgesteld; een
-- filter die markeert wel.

ALTER TABLE public.claim_arrivals
  ADD COLUMN IF NOT EXISTS country        text,
  ADD COLUMN IF NOT EXISTS user_agent     text,
  ADD COLUMN IF NOT EXISTS machine_reason text;

COMMENT ON COLUMN public.claim_arrivals.country IS
  'x-vercel-ip-country op het moment van aankomst. Null bij lokale of niet-Vercel requests.';

COMMENT ON COLUMN public.claim_arrivals.user_agent IS
  'User-agent van de aankomst, afgekapt op 300 tekens. Bewaard om de filter achteraf te kunnen beoordelen, niet om op te matchen.';

COMMENT ON COLUMN public.claim_arrivals.machine_reason IS
  'Null = telt mee als bezoeker. Anders waarom niet: geo (buiten NL/BE), user_agent (scannerpatroon), burst (tweede aankomst van hetzelfde adres binnen twee seconden). Lees-kant filtert hierop; de rij blijft staan zodat de regel later bij te stellen is.';

-- Lezen gebeurt bijna altijd "alleen de echte, op datum".
CREATE INDEX IF NOT EXISTS claim_arrivals_machine_idx
  ON public.claim_arrivals (machine_reason, created_at DESC);

-- Historie: de burst-regel is met terugwerkende kracht te berekenen,
-- want hij gebruikt alleen wat er al staat. Geo en user_agent niet —
-- die zijn nooit opgeslagen en blijven voor oude rijen onbekend.
--
-- Dit verandert het aantal Pro Visitors nauwelijks: die telt unieke
-- adressen, en de eerste aankomst van elke burst blijft staan. Het
-- maakt de tabel wel eerlijk over wat één bezoek was en wat niet.
WITH burst AS (
  SELECT id
  FROM (
    SELECT id,
           extract(epoch FROM (created_at - lag(created_at)
             OVER (PARTITION BY lower(email) ORDER BY created_at))) AS gap
      FROM public.claim_arrivals
     WHERE email IS NOT NULL
  ) t
  WHERE gap IS NOT NULL AND gap < 2
)
UPDATE public.claim_arrivals a
   SET machine_reason = 'burst'
  FROM burst b
 WHERE a.id = b.id AND a.machine_reason IS NULL;
