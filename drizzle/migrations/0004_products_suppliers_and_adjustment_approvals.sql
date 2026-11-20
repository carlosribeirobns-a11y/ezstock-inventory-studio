ALTER TABLE public.products ADD COLUMN supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL;
ALTER TABLE public.products ADD COLUMN deleted_at timestamptz;
CREATE INDEX products_supplier_idx ON public.products(supplier_id);
GRANT UPDATE (supplier_id) ON public.products TO authenticated;

CREATE TYPE public.adjustment_status AS ENUM ('pendente', 'aprovado', 'recusado');

CREATE TABLE public.adjustment_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id),
  counted integer NOT NULL,
  system_stock integer NOT NULL,
  reason text NOT NULL,
  status public.adjustment_status NOT NULL DEFAULT 'pendente',
  requested_by uuid REFERENCES public.profiles(id),
  reviewed_by uuid REFERENCES public.profiles(id),
  review_note text,
  reviewed_at timestamptz,
  movement_id uuid REFERENCES public.movements(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.adjustment_requests TO authenticated;
GRANT ALL ON public.adjustment_requests TO service_role;
ALTER TABLE public.adjustment_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins and requesters read adjustment requests" ON public.adjustment_requests
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR (requested_by = auth.uid() AND public.is_member(auth.uid())));

CREATE OR REPLACE FUNCTION public._apply_adjustment(_product_id uuid, _counted integer, _reason text, _user uuid)
RETURNS public.movements LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p public.products; m public.movements;
BEGIN
  IF _counted IS NULL OR _counted < 0 THEN RAISE EXCEPTION 'Informe uma quantidade física válida, sem casas decimais.'; END IF;
  IF _reason IS NULL OR length(trim(_reason)) = 0 THEN RAISE EXCEPTION 'Informe o motivo do ajuste para manter a rastreabilidade.'; END IF;
  IF length(_reason) > 240 THEN RAISE EXCEPTION 'O motivo pode ter no máximo 240 caracteres.'; END IF;
  SELECT * INTO p FROM public.products WHERE id = _product_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND OR NOT p.active THEN RAISE EXCEPTION 'Selecione um produto ativo.'; END IF;
  IF _counted = p.stock THEN RAISE EXCEPTION 'A quantidade física é igual ao saldo atual. Nenhum ajuste é necessário.'; END IF;
  UPDATE public.products SET stock = _counted WHERE id = p.id;
  INSERT INTO public.movements (product_id, type, quantity, previous_stock, new_stock, reason, user_id)
  VALUES (p.id, 'ajuste', _counted - p.stock, p.stock, _counted, trim(_reason), _user)
  RETURNING * INTO m;
  RETURN m;
END; $$;
REVOKE EXECUTE ON FUNCTION public._apply_adjustment(uuid, integer, text, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.adjust_inventory(_product_id uuid, _counted integer, _reason text)
RETURNS public.movements LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Somente administradores ajustam o inventário diretamente. Envie uma solicitação de ajuste.';
  END IF;
  RETURN public._apply_adjustment(_product_id, _counted, _reason, auth.uid());
END; $$;

CREATE OR REPLACE FUNCTION public.request_adjustment(_product_id uuid, _counted integer, _reason text)
RETURNS public.adjustment_requests LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p public.products; r public.adjustment_requests;
BEGIN
  IF NOT public.is_member(auth.uid()) THEN RAISE EXCEPTION 'Você não tem permissão para solicitar ajustes.'; END IF;
  IF _counted IS NULL OR _counted < 0 THEN RAISE EXCEPTION 'Informe uma quantidade física válida, sem casas decimais.'; END IF;
  IF _reason IS NULL OR length(trim(_reason)) = 0 THEN RAISE EXCEPTION 'Informe o motivo do ajuste para manter a rastreabilidade.'; END IF;
  IF length(_reason) > 240 THEN RAISE EXCEPTION 'O motivo pode ter no máximo 240 caracteres.'; END IF;
  SELECT * INTO p FROM public.products WHERE id = _product_id AND deleted_at IS NULL;
  IF NOT FOUND OR NOT p.active THEN RAISE EXCEPTION 'Selecione um produto ativo.'; END IF;
  IF _counted = p.stock THEN RAISE EXCEPTION 'A quantidade física é igual ao saldo atual. Nenhum ajuste é necessário.'; END IF;
  IF EXISTS (SELECT 1 FROM public.adjustment_requests WHERE product_id = p.id AND status = 'pendente') THEN
    RAISE EXCEPTION 'Já existe uma solicitação de ajuste pendente para este produto.';
  END IF;
  INSERT INTO public.adjustment_requests (product_id, counted, system_stock, reason, requested_by)
  VALUES (p.id, _counted, p.stock, trim(_reason), auth.uid()) RETURNING * INTO r;
  RETURN r;
END; $$;

CREATE OR REPLACE FUNCTION public.review_adjustment(_request_id uuid, _approve boolean, _note text)
RETURNS public.adjustment_requests LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.adjustment_requests; m public.movements;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Somente administradores analisam solicitações de ajuste.'; END IF;
  SELECT * INTO r FROM public.adjustment_requests WHERE id = _request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitação não encontrada.'; END IF;
  IF r.status <> 'pendente' THEN RAISE EXCEPTION 'Esta solicitação já foi analisada.'; END IF;
  IF NOT _approve AND (_note IS NULL OR length(trim(_note)) = 0) THEN
    RAISE EXCEPTION 'Informe o motivo da recusa.';
  END IF;
  IF _approve THEN
    m := public._apply_adjustment(r.product_id, r.counted, r.reason, r.requested_by);
  END IF;
  UPDATE public.adjustment_requests
     SET status = CASE WHEN _approve THEN 'aprovado'::public.adjustment_status ELSE 'recusado'::public.adjustment_status END,
         reviewed_by = auth.uid(), reviewed_at = now(), review_note = NULLIF(trim(coalesce(_note, '')), ''),
         movement_id = m.id
   WHERE id = r.id RETURNING * INTO r;
  RETURN r;
END; $$;

CREATE OR REPLACE FUNCTION public.delete_product(_product_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p public.products;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Somente administradores excluem produtos.'; END IF;
  SELECT * INTO p FROM public.products WHERE id = _product_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Produto não encontrado.'; END IF;
  IF p.active THEN RAISE EXCEPTION 'Inative o produto antes de excluí-lo.'; END IF;
  IF p.stock <> 0 THEN RAISE EXCEPTION 'Somente produtos com saldo zero podem ser excluídos.'; END IF;
  IF EXISTS (SELECT 1 FROM public.adjustment_requests WHERE product_id = p.id AND status = 'pendente') THEN
    RAISE EXCEPTION 'Há uma solicitação de ajuste pendente para este produto.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.movements WHERE product_id = p.id)
     OR EXISTS (SELECT 1 FROM public.adjustment_requests WHERE product_id = p.id) THEN
    UPDATE public.products SET deleted_at = now() WHERE id = p.id;
    RETURN 'arquivado';
  END IF;
  DELETE FROM public.products WHERE id = p.id;
  RETURN 'excluido';
END; $$;

REVOKE EXECUTE ON FUNCTION public.request_adjustment(uuid, integer, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.review_adjustment(uuid, boolean, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.delete_product(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_adjustment(uuid, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_adjustment(uuid, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_product(uuid) TO authenticated;