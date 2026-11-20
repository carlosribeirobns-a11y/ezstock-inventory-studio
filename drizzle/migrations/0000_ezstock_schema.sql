
-- Roles
CREATE TYPE public.app_role AS ENUM ('admin', 'colaborador');
CREATE TYPE public.movement_type AS ENUM ('entrada', 'saida', 'ajuste');

-- Profiles
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- User roles
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_member(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id)
$$;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_member(uuid) TO authenticated, service_role;

CREATE POLICY "Members see team profiles" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_member(auth.uid()));
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE POLICY "Users see own role, admins see all" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Profile creation on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), COALESCE(NEW.email, ''))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Categories
CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE CHECK (length(trim(name)) > 0),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read categories" ON public.categories FOR SELECT TO authenticated USING (public.is_member(auth.uid()));
CREATE POLICY "Admins insert categories" ON public.categories FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update categories" ON public.categories FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete categories" ON public.categories FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Suppliers
CREATE TABLE public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(trim(name)) > 0),
  phone text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppliers TO authenticated;
GRANT ALL ON public.suppliers TO service_role;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read suppliers" ON public.suppliers FOR SELECT TO authenticated USING (public.is_member(auth.uid()));
CREATE POLICY "Admins insert suppliers" ON public.suppliers FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update suppliers" ON public.suppliers FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete suppliers" ON public.suppliers FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Products (stock only changes through movement functions)
CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(trim(name)) > 0),
  sku text NOT NULL UNIQUE CHECK (length(trim(sku)) > 0),
  category_id uuid REFERENCES public.categories(id) ON DELETE RESTRICT,
  stock integer NOT NULL DEFAULT 0 CHECK (stock >= 0),
  min_stock integer NOT NULL DEFAULT 0 CHECK (min_stock >= 0),
  price numeric(12,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.products TO authenticated;
GRANT INSERT (name, sku, category_id, stock, min_stock, price, active) ON public.products TO authenticated;
GRANT UPDATE (name, sku, category_id, min_stock, price, active) ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read products" ON public.products FOR SELECT TO authenticated USING (public.is_member(auth.uid()));
CREATE POLICY "Admins insert products" ON public.products FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update products" ON public.products FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE INDEX products_category_idx ON public.products (category_id);

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER products_touch_updated_at BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Movements (append-only history)
CREATE TABLE public.movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  type public.movement_type NOT NULL,
  quantity integer NOT NULL,
  previous_stock integer NOT NULL,
  new_stock integer NOT NULL CHECK (new_stock >= 0),
  reason text,
  note text,
  movement_date date NOT NULL DEFAULT current_date,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.movements TO authenticated;
GRANT ALL ON public.movements TO service_role;
ALTER TABLE public.movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read movements" ON public.movements FOR SELECT TO authenticated USING (public.is_member(auth.uid()));
CREATE INDEX movements_created_idx ON public.movements (created_at DESC);
CREATE INDEX movements_product_idx ON public.movements (product_id);

-- Initial stock of a new product is recorded as an entry
CREATE OR REPLACE FUNCTION public.log_initial_stock()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.stock > 0 THEN
    INSERT INTO public.movements (product_id, type, quantity, previous_stock, new_stock, note, user_id)
    VALUES (NEW.id, 'entrada', NEW.stock, 0, NEW.stock, 'Estoque inicial', auth.uid());
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER products_log_initial_stock AFTER INSERT ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.log_initial_stock();

-- Entry / exit
CREATE OR REPLACE FUNCTION public.register_movement(
  _product_id uuid, _type public.movement_type, _quantity integer,
  _note text DEFAULT NULL, _movement_date date DEFAULT current_date
) RETURNS public.movements
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  p public.products;
  m public.movements;
  next_stock integer;
BEGIN
  IF NOT public.is_member(auth.uid()) THEN
    RAISE EXCEPTION 'Você não tem permissão para registrar movimentações.';
  END IF;
  IF _type NOT IN ('entrada', 'saida') THEN
    RAISE EXCEPTION 'Tipo de movimentação inválido.';
  END IF;
  IF _quantity IS NULL OR _quantity < 1 THEN
    RAISE EXCEPTION 'Informe uma quantidade maior que zero.';
  END IF;
  SELECT * INTO p FROM public.products WHERE id = _product_id FOR UPDATE;
  IF NOT FOUND OR NOT p.active THEN
    RAISE EXCEPTION 'Selecione um produto ativo.';
  END IF;
  IF _type = 'saida' AND _quantity > p.stock THEN
    RAISE EXCEPTION 'Saída não permitida. O estoque disponível é de % unidades.', p.stock;
  END IF;
  next_stock := CASE WHEN _type = 'entrada' THEN p.stock + _quantity ELSE p.stock - _quantity END;
  UPDATE public.products SET stock = next_stock WHERE id = p.id;
  INSERT INTO public.movements (product_id, type, quantity, previous_stock, new_stock, note, movement_date, user_id)
  VALUES (p.id, _type, _quantity, p.stock, next_stock, NULLIF(trim(_note), ''), COALESCE(_movement_date, current_date), auth.uid())
  RETURNING * INTO m;
  RETURN m;
END;
$$;

-- Inventory adjustment
CREATE OR REPLACE FUNCTION public.adjust_inventory(
  _product_id uuid, _counted integer, _reason text
) RETURNS public.movements
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  p public.products;
  m public.movements;
BEGIN
  IF NOT public.is_member(auth.uid()) THEN
    RAISE EXCEPTION 'Você não tem permissão para ajustar o inventário.';
  END IF;
  IF _counted IS NULL OR _counted < 0 THEN
    RAISE EXCEPTION 'Informe uma quantidade física válida, sem casas decimais.';
  END IF;
  IF _reason IS NULL OR length(trim(_reason)) = 0 THEN
    RAISE EXCEPTION 'Informe o motivo do ajuste para manter a rastreabilidade.';
  END IF;
  IF length(_reason) > 240 THEN
    RAISE EXCEPTION 'O motivo pode ter no máximo 240 caracteres.';
  END IF;
  SELECT * INTO p FROM public.products WHERE id = _product_id FOR UPDATE;
  IF NOT FOUND OR NOT p.active THEN
    RAISE EXCEPTION 'Selecione um produto ativo.';
  END IF;
  IF _counted = p.stock THEN
    RAISE EXCEPTION 'A quantidade física é igual ao saldo atual. Nenhum ajuste é necessário.';
  END IF;
  UPDATE public.products SET stock = _counted WHERE id = p.id;
  INSERT INTO public.movements (product_id, type, quantity, previous_stock, new_stock, reason, user_id)
  VALUES (p.id, 'ajuste', _counted - p.stock, p.stock, _counted, trim(_reason), auth.uid())
  RETURNING * INTO m;
  RETURN m;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.register_movement(uuid, public.movement_type, integer, text, date) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.adjust_inventory(uuid, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_movement(uuid, public.movement_type, integer, text, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.adjust_inventory(uuid, integer, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_initial_stock() FROM PUBLIC, anon, authenticated;
