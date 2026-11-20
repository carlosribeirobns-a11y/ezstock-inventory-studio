
INSERT INTO public.categories (name) VALUES
  ('Cabelos'), ('Maquiagem'), ('Unhas'), ('Corpo e banho'), ('Cuidados faciais'), ('Acessórios')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.suppliers (name, phone, email) VALUES
  ('Bella Cosméticos Distribuidora', '(11) 3456-7820', 'contato@bellacosmeticos.com.br'),
  ('Essenza Atacado', '(19) 3264-1108', 'vendas@essenza.com.br'),
  ('Nova Beleza Comercial', '(31) 3347-9022', 'pedidos@novabeleza.com.br'),
  ('Mundo dos Cabelos', '(21) 2589-4430', 'comercial@mundodoscabelos.com.br');

INSERT INTO public.products (name, sku, category_id, stock, min_stock, price, active)
SELECT v.name, v.sku, c.id, v.stock, v.min_stock, v.price, v.active
FROM (VALUES
  ('Shampoo Nutritivo 300ml', 'CAB-0012', 'Cabelos', 24, 8, 32.90, true),
  ('Esmalte Cremoso Carmim', 'UNH-0084', 'Unhas', 4, 6, 8.50, true),
  ('Hidratante Corporal Flor de Cerejeira', 'COR-0031', 'Corpo e banho', 0, 5, 27.90, true),
  ('Máscara Capilar Reconstrução 500g', 'CAB-0047', 'Cabelos', 12, 4, 48.90, true),
  ('Batom Matte Rosé', 'MAQ-0108', 'Maquiagem', 7, 10, 21.90, true),
  ('Kit Pincéis Essenciais', 'ACE-0029', 'Acessórios', 18, 5, 59.90, true),
  ('Sérum Facial Vitamina C', 'FAC-0062', 'Cuidados faciais', 9, 5, 42.50, false)
) AS v(name, sku, category, stock, min_stock, price, active)
JOIN public.categories c ON c.name = v.category
ON CONFLICT (sku) DO NOTHING;
