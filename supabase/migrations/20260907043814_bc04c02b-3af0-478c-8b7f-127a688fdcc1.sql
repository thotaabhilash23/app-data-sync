ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS birth_date date;

CREATE OR REPLACE FUNCTION public.staff_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if public.is_admin() then return new; end if;
  new.id := old.id;
  new.auth_user_id := old.auth_user_id;
  new.name := old.name;
  new.role := old.role;
  new.department := old.department;
  new.join_date := old.join_date;
  new.birth_date := old.birth_date;
  new.status := old.status;
  new.login_id := old.login_id;
  new.avatar_color := old.avatar_color;
  return new;
end $function$;