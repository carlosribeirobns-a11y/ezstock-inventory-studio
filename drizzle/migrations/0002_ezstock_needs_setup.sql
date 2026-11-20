
CREATE OR REPLACE FUNCTION public.needs_setup()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin')
$$;
REVOKE EXECUTE ON FUNCTION public.needs_setup() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.needs_setup() TO anon, authenticated, service_role;
