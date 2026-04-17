-- Fix the signup trigger: column is user_types (text[]), not user_type (enum).
-- The old function referenced a non-existent column and a non-existent enum,
-- causing every signup to fail with "Could not create account."
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, first_name, last_name, user_types, preferred_language)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'first_name',
    NEW.raw_user_meta_data ->> 'last_name',
    ARRAY[COALESCE(NEW.raw_user_meta_data ->> 'user_type', 'client')]::text[],
    NEW.raw_user_meta_data ->> 'preferred_language'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
