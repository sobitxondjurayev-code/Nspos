BEGIN;

DROP VIEW IF EXISTS v_product_margin;

ALTER TABLE products ALTER COLUMN cost_price TYPE numeric(14,4);
ALTER TABLE sale_items ALTER COLUMN cost_price TYPE numeric(14,4);

CREATE VIEW v_product_margin WITH (security_invoker = true) AS
  SELECT p.company_id, p.id AS product_id, p.name,
         sum(i.total)                          AS revenue,
         sum(i.qty * i.cost_price)             AS cogs,
         sum(i.total - i.qty * i.cost_price)   AS profit,
         sum(i.qty)                            AS qty
    FROM sale_items i
    JOIN sales s   ON s.id = i.sale_id AND s.type = 'sale'
    JOIN products p ON p.id = i.product_id
   GROUP BY 1, 2, 3;

COMMIT;
