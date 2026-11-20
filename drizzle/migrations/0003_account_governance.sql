ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin';
ALTER TABLE public.profiles ADD COLUMN active boolean NOT NULL DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN deleted_at timestamptz;
ALTER TABLE public.user_roles ADD COLUMN is_primary_superadmin boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX one_primary_superadmin ON public.user_roles (is_primary_superadmin) WHERE is_primary_superadmin;
REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (full_name) ON public.profiles TO authenticated;
CREATE OR REPLACE FUNCTION public.is_member(_user_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS (SELECT 1 FROM public.user_roles r JOIN public.profiles p ON p.id=r.user_id WHERE r.user_id=_user_id AND p.active AND p.deleted_at IS NULL)
$$;
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS (SELECT 1 FROM public.user_roles r JOIN public.profiles p ON p.id=r.user_id WHERE r.user_id=_user_id AND p.active AND p.deleted_at IS NULL AND (r.role=_role OR (_role::text='admin' AND r.role::text='super_admin')))
$$;
CREATE OR REPLACE FUNCTION public.needs_setup() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role::text IN ('admin','super_admin'))
$$;
CREATE OR REPLACE FUNCTION public.protect_primary_role() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF OLD.is_primary_superadmin THEN
   IF TG_OP='DELETE' THEN RAISE EXCEPTION 'O Superadministrador titular não pode ser excluído.'; END IF;
   IF NEW.role::text <> 'super_admin' OR NOT NEW.is_primary_superadmin OR NEW.user_id<>OLD.user_id THEN RAISE EXCEPTION 'O Superadministrador titular não pode perder seu perfil.'; END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER protect_primary_role BEFORE UPDATE OR DELETE ON public.user_roles FOR EACH ROW EXECUTE FUNCTION public.protect_primary_role();
CREATE OR REPLACE FUNCTION public.protect_primary_profile() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=OLD.id AND is_primary_superadmin) THEN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'O Superadministrador titular não pode ser excluído.'; END IF;
  IF NOT NEW.active OR NEW.deleted_at IS NOT NULL OR NEW.id<>OLD.id THEN RAISE EXCEPTION 'O Superadministrador titular não pode ser inativado.'; END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER protect_primary_profile BEFORE UPDATE OR DELETE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.protect_primary_profile();
CREATE OR REPLACE FUNCTION public.manage_team_account(_user_id uuid, _action text, _role text DEFAULT NULL, _full_name text DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE actor_primary boolean; target_primary boolean; target_role text;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtext('ezstock-team-governance'));
 IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Somente administradores ativos podem gerenciar usuários.'; END IF;
 SELECT is_primary_superadmin INTO actor_primary FROM public.user_roles WHERE user_id=auth.uid() ORDER BY is_primary_superadmin DESC LIMIT 1;
 SELECT role::text,is_primary_superadmin INTO target_role,target_primary FROM public.user_roles WHERE user_id=_user_id ORDER BY is_primary_superadmin DESC, CASE WHEN role::text='super_admin' THEN 0 WHEN role::text='admin' THEN 1 ELSE 2 END LIMIT 1;
 IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id=_user_id AND deleted_at IS NULL) THEN RAISE EXCEPTION 'Conta não encontrada.'; END IF;
 IF _action NOT IN ('edit','deactivate','reactivate','delete') THEN RAISE EXCEPTION 'Ação inválida.'; END IF;
 IF target_primary AND (_action<>'edit' OR _role IS DISTINCT FROM 'super_admin') THEN RAISE EXCEPTION 'O Superadministrador titular está protegido.'; END IF;
 IF _user_id=auth.uid() AND _action<>'edit' THEN RAISE EXCEPTION 'Você não pode inativar ou excluir sua própria conta.'; END IF;
 IF (target_role IN ('admin','super_admin') OR _role='super_admin') AND NOT COALESCE(actor_primary,false) THEN RAISE EXCEPTION 'Somente o Superadministrador titular pode gerenciar administradores ou conceder o perfil Superadministrador.'; END IF;
 IF _action='edit' THEN
  IF _role IS NULL OR _role NOT IN ('admin','colaborador','super_admin') OR _full_name IS NULL OR length(trim(_full_name))<2 OR length(trim(_full_name))>120 THEN RAISE EXCEPTION 'Informe nome e perfil válidos.'; END IF;
  IF NOT target_primary THEN
   DELETE FROM public.user_roles WHERE user_id=_user_id;
   INSERT INTO public.user_roles(user_id,role) VALUES(_user_id,_role::public.app_role);
  END IF;
  UPDATE public.profiles SET full_name=trim(_full_name) WHERE id=_user_id;
 ELSE
  UPDATE public.profiles SET active=(_action='reactivate'), deleted_at=CASE WHEN _action='delete' THEN now() ELSE deleted_at END WHERE id=_user_id;
 END IF;
END $$;
REVOKE ALL ON FUNCTION public.manage_team_account(uuid,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.manage_team_account(uuid,text,text,text) TO authenticated;
