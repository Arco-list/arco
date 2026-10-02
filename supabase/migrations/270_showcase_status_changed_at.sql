-- Showcased companies had a Last change of "today". Fix the estimate.
--
-- Migration 269's backfill fell through to updated_at for anything that
-- was not 'added' or 'listed', and updated_at on a showcased company is
-- never old: sync-platform-prospects touches those rows every fifteen
-- minutes. So 67 companies all read as having moved today, which is the
-- one thing we know they did not do.
--
-- The real moment survived in a place I had already emptied. Migration
-- 267 cleared listed_at for every ownerless company, because a showcase
-- page going live is not a company reaching Listed — correct for that
-- column, and it happened to be the only record of WHEN those pages
-- went live.
--
-- Thirty-three of them shared listed_at to the microsecond
-- (2026-07-11 05:07:38.948081) while their created_at values span
-- November 2025 to May 2026. A backfill computing LEAST(created_at,
-- updated_at) would have produced thirty-three different answers. One
-- identical timestamp across rows created months apart can only be one
-- statement running at that moment, with the trigger stamping now() —
-- so it is a measured event: thirty-three showcase pages published in a
-- single operation.
--
-- That makes the old listed_at the best estimate available, and far
-- better than created_at, which for most of these is the day they were
-- imported into the catalogue — months before anyone built them a page.
--
-- 39 of 67 carry such a stamp. The remaining 28 never had one, and for
-- those created_at is the fallback: still a guess, still better than
-- "today".

UPDATE public.companies c
   SET status_changed_at = v.moment
  FROM (VALUES
('1ddebfcd-bdd7-4372-8f5a-d7faccb86968'::uuid, '2026-07-11T05:07:38.948081+00:00'::timestamptz),
  ('3b5d5f09-96e8-4521-a7f7-bff8510f5496'::uuid, '2026-08-23T06:21:21.518204+00:00'::timestamptz),
  ('8e5f35e4-2a9e-491a-a73d-80d120c58495'::uuid, '2026-08-22T06:20:36.588734+00:00'::timestamptz),
  ('10040ad7-0341-4051-b7f3-c8673c8f93bc'::uuid, '2026-07-09T12:24:39.03621+00:00'::timestamptz),
  ('10867bab-4b60-42d7-abea-78c8953b61a7'::uuid, '2026-09-14T04:58:23.762011+00:00'::timestamptz),
  ('fa96280a-cdf3-4418-a7ec-d7c129c87733'::uuid, '2026-08-19T12:01:45.182595+00:00'::timestamptz),
  ('cffd3511-0435-4f32-9cb6-3eb30c52936a'::uuid, '2026-09-14T05:00:43.127232+00:00'::timestamptz),
  ('b0dd40f0-9740-4be4-b9c8-da7e949bf76a'::uuid, '2026-05-18T14:24:21.858194+00:00'::timestamptz),
  ('3b99b705-f6d8-4b5a-8d7c-e93ce9c23115'::uuid, '2026-05-18T14:24:21.858194+00:00'::timestamptz),
  ('303beed2-bf95-4473-b92a-e72f74dba50b'::uuid, '2026-08-13T07:26:51.601847+00:00'::timestamptz),
  ('0b3b44d9-92aa-40e2-94e4-972038f8be50'::uuid, '2026-07-11T05:07:38.948081+00:00'::timestamptz),
  ('5da306e0-daa8-4251-bea6-fe3e53f88d1e'::uuid, '2026-08-20T13:49:14.301131+00:00'::timestamptz),
  ('2ecf208f-334b-4ee3-83bd-5cca10e24955'::uuid, '2026-07-11T05:07:38.948081+00:00'::timestamptz),
  ('36e8a79f-4115-4ad1-89ef-c9347a395e88'::uuid, '2026-07-11T10:08:41.176134+00:00'::timestamptz),
  ('5b2afe4a-f621-461a-ba85-fcff5ee57684'::uuid, '2026-08-11T12:28:57.83865+00:00'::timestamptz),
  ('dff81e08-880a-4b63-b1e9-564aa130df70'::uuid, '2026-08-22T07:34:24.664927+00:00'::timestamptz),
  ('2874efa9-1bfc-4e8f-ad9c-fc621a01e655'::uuid, '2026-07-08T15:04:28.708554+00:00'::timestamptz),
  ('1eb4c5e4-d2fb-4e56-8cac-d306628fd08c'::uuid, '2026-07-11T05:07:25.908505+00:00'::timestamptz),
  ('0e953faa-9f8d-498e-a7f9-8ed282d7570a'::uuid, '2026-09-24T13:38:13.458247+00:00'::timestamptz),
  ('3e221637-e862-455c-b20c-831becbd6009'::uuid, '2026-08-23T06:40:58.263699+00:00'::timestamptz),
  ('5718b0d7-8a14-4e35-a0b0-260987cc1073'::uuid, '2026-07-11T05:07:38.948081+00:00'::timestamptz),
  ('87e9a827-a9f3-4188-8915-de4a2b6db59c'::uuid, '2026-07-11T05:07:38.948081+00:00'::timestamptz),
  ('751aa116-9cf1-417c-a2ce-7335918fdc44'::uuid, '2026-07-11T05:07:38.948081+00:00'::timestamptz),
  ('f7551a09-9da3-4824-99c3-d67f2d6f6999'::uuid, '2026-09-14T05:03:00.910705+00:00'::timestamptz),
  ('220245f9-e982-4cdf-b470-0b79eb01926c'::uuid, '2026-08-23T06:23:52.420744+00:00'::timestamptz),
  ('5d616936-f5b5-4e35-b704-8811c4f69f17'::uuid, '2026-07-11T05:07:38.948081+00:00'::timestamptz),
  ('ada75613-329e-4702-851c-69b153984dc5'::uuid, '2026-07-11T05:07:38.948081+00:00'::timestamptz),
  ('f82427d4-cc0d-4128-853f-d8e5cebd3b0a'::uuid, '2026-07-11T05:07:38.948081+00:00'::timestamptz),
  ('9ab39b5d-d06e-41d3-ba28-16ca5f066dd8'::uuid, '2026-05-18T14:24:21.858194+00:00'::timestamptz),
  ('5b2ba66f-c922-4476-a96e-3d86691596d4'::uuid, '2026-08-20T04:53:29.901621+00:00'::timestamptz),
  ('82785060-11b2-43af-81db-975525d74ce5'::uuid, '2026-07-11T05:07:38.948081+00:00'::timestamptz),
  ('02b2bcc1-165d-490e-9686-3f8b5f0eac0c'::uuid, '2026-07-11T05:07:38.948081+00:00'::timestamptz),
  ('23518be8-f788-4d40-aa15-8bcaaa0d7daf'::uuid, '2026-07-11T05:07:38.948081+00:00'::timestamptz),
  ('32926189-9bb4-4ef3-b71b-4435a040a9b7'::uuid, '2026-08-21T05:50:49.594889+00:00'::timestamptz),
  ('4606c592-ed57-4ae3-a858-4e315332b12a'::uuid, '2026-07-11T05:07:38.948081+00:00'::timestamptz),
  ('2464b6dc-7806-4608-87b2-bfb516e91985'::uuid, '2026-05-18T14:24:21.858194+00:00'::timestamptz),
  ('ba766c26-dbd9-4423-bbc1-712c7c006a9f'::uuid, '2026-09-24T14:30:10.138188+00:00'::timestamptz),
  ('5c73b166-7586-4989-820d-43b3130e0b7e'::uuid, '2026-07-11T05:07:38.948081+00:00'::timestamptz),
  ('05f3af57-6f67-435f-b588-aea3ad46678f'::uuid, '2026-07-11T05:07:38.948081+00:00'::timestamptz),
  ('a710e024-8c71-4565-a5ff-144716690ac9'::uuid, '2026-08-13T08:01:18.326759+00:00'::timestamptz),
  ('5ccf59c9-0964-4ae2-8001-182a8b0a1903'::uuid, '2026-08-22T06:26:29.744694+00:00'::timestamptz),
  ('03512108-bd67-4199-99b9-3db3290579a4'::uuid, '2026-08-21T05:52:24.293513+00:00'::timestamptz),
  ('226c59d4-bc4d-441f-83f4-cad38941971e'::uuid, '2026-08-11T13:04:11.282996+00:00'::timestamptz),
  ('2f9c3a1b-f721-433e-bbdb-b6c583b08c1d'::uuid, '2026-07-11T05:07:38.948081+00:00'::timestamptz),
  ('338c58e1-d11a-49b2-8031-0826a88b0d47'::uuid, '2026-07-11T05:07:38.948081+00:00'::timestamptz),
  ('18ae1f82-397f-483d-9b80-8b21225b0112'::uuid, '2026-08-19T14:32:01.926078+00:00'::timestamptz),
  ('a1f4a4f1-c1ff-4cf2-88dc-eab7d876bfb2'::uuid, '2026-09-14T05:00:38.901947+00:00'::timestamptz),
  ('edf55adf-2be7-432f-b2b1-0f5d60565f64'::uuid, '2026-08-13T08:01:18.729082+00:00'::timestamptz),
  ('0fe13e41-d20d-4580-94ac-ab2eadaf081f'::uuid, '2026-08-21T05:52:35.793112+00:00'::timestamptz),
  ('6340fcb2-593e-4ed9-be5a-2b470475eb7f'::uuid, '2026-07-11T05:07:38.948081+00:00'::timestamptz),
  ('c1ca766b-13b1-4f74-a080-21a217bee2ab'::uuid, '2026-08-13T07:59:43.860787+00:00'::timestamptz),
  ('4af796e7-ed39-4272-91c9-686fd1ee01ca'::uuid, '2026-08-21T05:52:12.734108+00:00'::timestamptz),
  ('eb2c0291-d06a-4682-9639-7d3dfb5f013b'::uuid, '2026-07-11T05:07:38.948081+00:00'::timestamptz),
  ('f10107c0-e1d6-4a7e-8854-82b626c8918c'::uuid, '2026-07-11T05:07:38.948081+00:00'::timestamptz),
  ('2f7da636-8c24-4d86-9943-1edd5e12117e'::uuid, '2026-09-14T04:57:19.685541+00:00'::timestamptz),
  ('f35fafcd-2285-484d-8051-d76e5ad7a852'::uuid, '2026-07-11T05:07:38.948081+00:00'::timestamptz),
  ('b88efe14-3727-4bad-90bb-0841b4816870'::uuid, '2026-09-14T04:56:21.046118+00:00'::timestamptz),
  ('16d1805e-1e92-4e16-80a6-ffa911052a24'::uuid, '2026-08-20T07:44:40.656762+00:00'::timestamptz),
  ('3b1adfa2-721b-4103-92bb-2453ece93d39'::uuid, '2026-05-18T14:24:21.858194+00:00'::timestamptz),
  ('7f5afad7-0b5e-4920-9328-5c1ed7f6330b'::uuid, '2026-09-14T04:08:24.125551+00:00'::timestamptz),
  ('6a9332f3-444a-4ba2-8855-ec8af55e792c'::uuid, '2026-07-11T05:07:38.948081+00:00'::timestamptz),
  ('bea0ae2a-f89e-4813-b303-30c8341bfde5'::uuid, '2026-07-11T05:07:38.948081+00:00'::timestamptz),
  ('81028f3d-ab84-4fd2-90ff-870d77cdfe76'::uuid, '2026-08-19T19:11:17.235996+00:00'::timestamptz),
  ('c18c7bdf-9746-44bf-8c57-3426b8575160'::uuid, '2026-08-19T19:11:01.640196+00:00'::timestamptz),
  ('f78afef2-827b-46b9-bc62-608b0fa9df2b'::uuid, '2026-07-11T05:07:38.948081+00:00'::timestamptz),
  ('5fe26ae9-ee64-49f3-9916-34e59d7ba23e'::uuid, '2026-09-14T05:04:20.604437+00:00'::timestamptz),
  ('4426ae44-b385-45a1-ae80-9fb2873e9584'::uuid, '2026-07-11T05:07:38.948081+00:00'::timestamptz)
  ) AS v(id, moment)
 WHERE c.id = v.id;
