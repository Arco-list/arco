-- Status remodel step 2/2: migrate existing rows onto the new model.
-- companies.'created' meant claimed-with-owner — that is OWNED now.
update companies set status = 'owned' where status = 'created';

-- prospects: 'company' (old: company created/claimed) becomes VERIFIED
-- only where no account exists; with an account it is OWNED. 'signup'
-- (old top acquisition stage) becomes OWNED.
update prospects set status = 'owned'
  where status = 'signup' or (status = 'company' and (signed_up_at is not null or user_id is not null));
update prospects set status = 'verified' where status = 'company';
