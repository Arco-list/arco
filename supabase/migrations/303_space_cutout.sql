-- 303: uitsnede per ruimte voor de cirkels op de projecten-discover.
-- Een object op een egale (witte) achtergrond — een bad, een bank, een
-- keukeneiland — dat op de beige schijf wordt getoond, zoals de
-- dienstpictogrammen op de professionals-discover. image_url blijft het
-- sfeerbeeld (homecarrousel); cutout_url is het losse object. De schijf
-- legt het beeld met mix-blend-mode: multiply, zodat een witte
-- achtergrond wegvalt zonder echte transparantie.
ALTER TABLE public.spaces ADD COLUMN IF NOT EXISTS cutout_url text;
COMMENT ON COLUMN public.spaces.cutout_url IS 'Uitsnede (object op witte of transparante achtergrond) voor de cirkel op /projects; wordt met multiply op de schijf gelegd.';
