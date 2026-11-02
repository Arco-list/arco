-- outbound_contact_log krijgt een eigen onderwerpkolom.
--
-- `body` betekende twee dingen tegelijk. Bij een telefoontje is het de
-- notitie ("Morgen terug bellen") — precies waar de kolom voor bedoeld
-- is. Bij een mail propte recordSend er het ONDERWERP in, want de
-- verstuurde tekst had nergens een plek. De tijdlijn klapte zo'n regel
-- open en toonde dan de onderwerpregel nog een keer, in plaats van de
-- mail.
--
-- Met een aparte kolom betekent `body` weer één ding: de inhoud. Het
-- onderwerp staat op de kopregel, de tekst eronder.
alter table public.outbound_contact_log
  add column if not exists subject text;

comment on column public.outbound_contact_log.subject is
  'Onderwerpregel, alleen voor kind=''email''. Bij een telefoontje of notitie blijft dit leeg en draagt body de notitie.';

-- De zes e-mailregels die hier al staan zijn vandaag met de hand
-- aangemaakt, nadat bleek dat recordSend ze nooit had weggeschreven
-- (outcome='sent' bestaat niet in outbound_outcome, en de fout werd
-- ingeslikt). Hun `body` is dus de onderwerpregel: verhuis die naar de
-- nieuwe kolom. De werkelijke tekst van die mails is nergens
-- vastgelegd, dus die blijft leeg — vanaf nu wordt hij meegeschreven.
update public.outbound_contact_log
set subject = body,
    body = null
where kind = 'email'
  and subject is null
  and body is not null;
