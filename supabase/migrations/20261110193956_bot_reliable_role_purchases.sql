-- An order is the durable receipt for a Discord interaction. Balance, stock and
-- ledger move in one transaction; Discord delivery happens outside that lock.
CREATE TABLE public.bot_shop_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  interaction_id text UNIQUE NOT NULL,
  guild_id uuid NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  user_name text,
  item_id uuid NOT NULL,
  item_name text NOT NULL,
  role_id text,
  price bigint NOT NULL CHECK (price BETWEEN 0 AND 9007199254740991),
  reserved_stock boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'rejected' CHECK (status IN ('rejected','pending','processing','delivered','refunded','manual_review')),
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count BETWEEN 0 AND 5),
  attempted_delivery boolean NOT NULL DEFAULT false,
  delivery_uncertain boolean NOT NULL DEFAULT false,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  lease_token uuid,
  lease_expires_at timestamptz,
  last_error text,
  debit_ledger_id uuid,
  refund_ledger_id uuid,
  purchase_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE UNIQUE INDEX bot_shop_one_active_role ON public.bot_shop_orders(guild_id,user_id,role_id)
  WHERE role_id IS NOT NULL AND status IN ('pending','processing','manual_review');
CREATE INDEX bot_shop_orders_due ON public.bot_shop_orders(status,next_attempt_at,lease_expires_at)
  WHERE status IN ('pending','processing');
CREATE INDEX bot_shop_orders_guild ON public.bot_shop_orders(guild_id,created_at DESC);
ALTER TABLE public.bot_shop_orders ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bot_shop_orders FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.bot_shop_orders TO service_role;
GRANT SELECT ON public.bot_shop_orders TO authenticated;
CREATE POLICY bot_shop_order_read ON public.bot_shop_orders FOR SELECT TO authenticated USING (
  public.has_admin_or_staff_role((SELECT auth.uid())) OR EXISTS (
    SELECT 1 FROM public.user_guilds ug WHERE ug.guild_id=bot_shop_orders.guild_id
      AND ug.user_id=(SELECT auth.uid()) AND ug.has_admin_permission
  )
);
ALTER TABLE public.economy_purchases ADD COLUMN shop_order_id uuid UNIQUE REFERENCES public.bot_shop_orders(id) ON DELETE SET NULL;

CREATE FUNCTION public.bot_shop_reserve(
  p_interaction_id text,p_guild_id uuid,p_user_id text,p_user_name text,p_item_id uuid,
  p_expected_role_id text,p_expected_price bigint
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $body$
DECLARE
  receipt public.bot_shop_orders%ROWTYPE;
  item public.economy_shop_items%ROWTYPE;
  account public.economy_accounts%ROWTYPE;
  inserted integer;
  constraint_name text;
BEGIN
  IF p_interaction_id IS NULL OR p_interaction_id !~ '^[0-9]{1,20}$'
    OR p_user_id IS NULL OR p_user_id !~ '^[0-9]{1,20}$'
    OR p_guild_id IS NULL OR p_item_id IS NULL OR length(coalesce(p_user_name,''))>128
    OR p_expected_price IS NULL OR p_expected_price<0 OR p_expected_price>9007199254740991
    OR (p_expected_role_id IS NOT NULL AND p_expected_role_id !~ '^[0-9]{16,22}$') THEN
    RETURN jsonb_build_object('ok',false,'reason','invalid_input');
  END IF;
  INSERT INTO public.bot_shop_orders(interaction_id,guild_id,user_id,user_name,item_id,item_name,role_id,price)
    VALUES(p_interaction_id,p_guild_id,p_user_id,p_user_name,p_item_id,'',p_expected_role_id,p_expected_price)
    ON CONFLICT(interaction_id) DO NOTHING;
  GET DIAGNOSTICS inserted=ROW_COUNT;
  SELECT * INTO STRICT receipt FROM public.bot_shop_orders WHERE interaction_id=p_interaction_id FOR UPDATE;
  IF receipt.guild_id<>p_guild_id OR receipt.user_id<>p_user_id OR receipt.item_id<>p_item_id THEN
    RAISE EXCEPTION 'Interaction already belongs to another shop request' USING ERRCODE='22023';
  END IF;
  IF inserted=0 THEN
    RETURN jsonb_build_object('ok',receipt.status<>'rejected','reason',receipt.last_error,'replayed',true,'order',to_jsonb(receipt));
  END IF;

  BEGIN
    -- All shop transactions acquire item then account, including refunds.
    SELECT * INTO item FROM public.economy_shop_items WHERE id=p_item_id AND guild_id=p_guild_id FOR UPDATE;
    IF NOT FOUND OR NOT item.enabled THEN
      RAISE EXCEPTION USING ERRCODE='P0201',MESSAGE='item_unavailable';
    END IF;
    IF item.price<>p_expected_price OR item.role_id IS DISTINCT FROM p_expected_role_id THEN
      RAISE EXCEPTION USING ERRCODE='P0201',MESSAGE='item_changed';
    END IF;
    IF item.stock IS NOT NULL AND item.stock<=0 THEN
      RAISE EXCEPTION USING ERRCODE='P0201',MESSAGE='out_of_stock';
    END IF;
    IF EXISTS(SELECT 1 FROM public.bot_shop_orders WHERE guild_id=p_guild_id AND user_id=p_user_id
      AND role_id=item.role_id AND status IN ('pending','processing','manual_review')) THEN
      RAISE EXCEPTION USING ERRCODE='P0201',MESSAGE='purchase_pending';
    END IF;
    SELECT * INTO account FROM public.economy_accounts WHERE guild_id=p_guild_id AND user_id=p_user_id FOR UPDATE;
    IF (NOT FOUND AND item.price>0) OR account.wallet<item.price OR account.wallet<0 THEN
      RAISE EXCEPTION USING ERRCODE='P0201',MESSAGE='insufficient';
    END IF;
    IF FOUND THEN
      UPDATE public.economy_accounts SET wallet=wallet-item.price WHERE id=account.id;
    END IF;
    IF item.stock IS NOT NULL THEN
      UPDATE public.economy_shop_items SET stock=stock-1 WHERE id=item.id;
    END IF;
    INSERT INTO public.economy_transactions(guild_id,from_user_id,to_user_id,amount,transaction_type,description)
      VALUES(p_guild_id,p_user_id,p_user_id,item.price,'shop_purchase','Butik: '||left(item.name,150))
      RETURNING id INTO receipt.debit_ledger_id;
    UPDATE public.bot_shop_orders SET item_name=item.name,reserved_stock=item.stock IS NOT NULL,
      debit_ledger_id=receipt.debit_ledger_id,status=CASE WHEN item.role_id IS NULL THEN 'delivered' ELSE 'pending' END,
      completed_at=CASE WHEN item.role_id IS NULL THEN now() ELSE NULL END,updated_at=now()
      WHERE id=receipt.id RETURNING * INTO receipt;
    IF item.role_id IS NULL THEN
      INSERT INTO public.economy_purchases(guild_id,user_id,user_name,item_id,shop_order_id)
        VALUES(p_guild_id,p_user_id,p_user_name,item.id,receipt.id) RETURNING id INTO receipt.purchase_id;
      UPDATE public.bot_shop_orders SET purchase_id=receipt.purchase_id WHERE id=receipt.id RETURNING * INTO receipt;
    END IF;
  EXCEPTION
    WHEN SQLSTATE 'P0201' THEN
      UPDATE public.bot_shop_orders SET status='rejected',last_error=SQLERRM,updated_at=now()
        WHERE id=receipt.id RETURNING * INTO receipt;
    WHEN unique_violation THEN
      GET STACKED DIAGNOSTICS constraint_name=CONSTRAINT_NAME;
      IF constraint_name<>'bot_shop_one_active_role' THEN RAISE; END IF;
      UPDATE public.bot_shop_orders SET status='rejected',last_error='purchase_pending',updated_at=now()
        WHERE id=receipt.id RETURNING * INTO receipt;
  END;
  RETURN jsonb_build_object('ok',receipt.status<>'rejected','reason',receipt.last_error,'replayed',false,'order',to_jsonb(receipt));
END $body$;

CREATE FUNCTION public.bot_shop_claim(p_id uuid,p_lease_seconds integer DEFAULT 90)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $body$
DECLARE receipt public.bot_shop_orders%ROWTYPE; was_exhausted boolean;
BEGIN
  SELECT * INTO receipt FROM public.bot_shop_orders WHERE id=p_id FOR UPDATE SKIP LOCKED;
  IF NOT FOUND OR receipt.status NOT IN ('pending','processing') THEN RETURN NULL; END IF;
  IF receipt.status='pending' AND receipt.next_attempt_at>clock_timestamp() THEN RETURN NULL; END IF;
  IF receipt.status='processing' AND receipt.lease_expires_at>clock_timestamp() THEN RETURN NULL; END IF;
  was_exhausted:=receipt.attempt_count>=5;
  UPDATE public.bot_shop_orders SET status='processing',attempt_count=LEAST(5,attempt_count+1),
    delivery_uncertain=delivery_uncertain OR (receipt.status='processing' AND attempted_delivery),
    lease_token=gen_random_uuid(),lease_expires_at=clock_timestamp()+make_interval(secs=>GREATEST(30,LEAST(300,p_lease_seconds))),
    updated_at=clock_timestamp() WHERE id=p_id RETURNING * INTO receipt;
  RETURN to_jsonb(receipt)||jsonb_build_object('exhausted',was_exhausted);
END $body$;

CREATE FUNCTION public.bot_shop_extend(p_id uuid,p_token uuid,p_lease_seconds integer DEFAULT 90)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $body$
DECLARE changed integer;
BEGIN
  UPDATE public.bot_shop_orders SET lease_expires_at=clock_timestamp()+make_interval(secs=>GREATEST(30,LEAST(300,p_lease_seconds)))
    WHERE id=p_id AND lease_token=p_token AND status='processing' AND lease_expires_at>clock_timestamp();
  GET DIAGNOSTICS changed=ROW_COUNT; RETURN changed=1;
END $body$;

CREATE FUNCTION public.bot_shop_mark_attempted(p_id uuid,p_token uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $body$
DECLARE changed integer;
BEGIN
  UPDATE public.bot_shop_orders SET attempted_delivery=true,updated_at=clock_timestamp()
    WHERE id=p_id AND lease_token=p_token AND status='processing' AND lease_expires_at>clock_timestamp();
  GET DIAGNOSTICS changed=ROW_COUNT; RETURN changed=1;
END $body$;

CREATE FUNCTION public.bot_shop_finish(p_id uuid,p_token uuid,p_outcome text,p_error text DEFAULT NULL,p_uncertain boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $body$
DECLARE receipt public.bot_shop_orders%ROWTYPE; account public.economy_accounts%ROWTYPE;
  final_outcome text:=p_outcome; item_exists boolean;
BEGIN
  IF p_outcome IS NULL OR p_outcome NOT IN ('delivered','refund','retry','manual_review') THEN RAISE EXCEPTION 'Invalid shop outcome'; END IF;
  SELECT * INTO receipt FROM public.bot_shop_orders WHERE id=p_id AND lease_token=p_token AND status='processing' FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  receipt.delivery_uncertain:=receipt.delivery_uncertain OR coalesce(p_uncertain,false);
  IF final_outcome='retry' AND receipt.attempt_count>=5 THEN
    final_outcome:=CASE WHEN receipt.delivery_uncertain THEN 'manual_review' ELSE 'refund' END;
  END IF;
  -- A delayed request may still have added the role. Never give a free role by
  -- refunding an ambiguous delivery; reconciliation may still mark it delivered.
  IF final_outcome='refund' AND receipt.delivery_uncertain THEN final_outcome:='manual_review'; END IF;
  IF final_outcome IN ('refund','delivered') THEN
    PERFORM id FROM public.economy_shop_items WHERE id=receipt.item_id AND guild_id=receipt.guild_id FOR UPDATE;
    item_exists:=FOUND;
  END IF;
  IF final_outcome='refund' THEN
    IF receipt.price>0 THEN
      INSERT INTO public.economy_accounts(guild_id,user_id,discord_username,wallet)
        VALUES(receipt.guild_id,receipt.user_id,receipt.user_name,0) ON CONFLICT(guild_id,user_id) DO NOTHING;
      SELECT * INTO STRICT account FROM public.economy_accounts WHERE guild_id=receipt.guild_id AND user_id=receipt.user_id FOR UPDATE;
    END IF;
    IF receipt.price>0 AND account.wallet>9007199254740991-receipt.price THEN
      final_outcome:='manual_review'; p_error:='Saldoen kræver manuel tilbagebetaling.';
    ELSE
      IF receipt.price>0 THEN
        UPDATE public.economy_accounts SET wallet=wallet+receipt.price WHERE id=account.id;
      END IF;
      IF receipt.reserved_stock AND item_exists THEN
        UPDATE public.economy_shop_items SET stock=stock+1 WHERE id=receipt.item_id AND stock IS NOT NULL;
      END IF;
      INSERT INTO public.economy_transactions(guild_id,from_user_id,to_user_id,amount,transaction_type,description)
        VALUES(receipt.guild_id,NULL,receipt.user_id,receipt.price,'shop_refund','Tilbagebetaling: '||left(receipt.item_name,150))
        RETURNING id INTO receipt.refund_ledger_id;
    END IF;
  ELSIF final_outcome='delivered' AND item_exists THEN
    INSERT INTO public.economy_purchases(guild_id,user_id,user_name,item_id,shop_order_id)
      VALUES(receipt.guild_id,receipt.user_id,receipt.user_name,receipt.item_id,receipt.id)
      ON CONFLICT(shop_order_id) DO NOTHING RETURNING id INTO receipt.purchase_id;
  END IF;
  UPDATE public.bot_shop_orders SET status=CASE final_outcome WHEN 'refund' THEN 'refunded' WHEN 'retry' THEN 'pending' ELSE final_outcome END,
    next_attempt_at=CASE WHEN final_outcome='retry' THEN clock_timestamp()+make_interval(secs=>30*(2^(attempt_count-1))::integer) ELSE next_attempt_at END,
    delivery_uncertain=receipt.delivery_uncertain,refund_ledger_id=receipt.refund_ledger_id,purchase_id=receipt.purchase_id,
    last_error=CASE WHEN final_outcome='delivered' THEN NULL ELSE left(coalesce(p_error,'Ukendt leveringsfejl'),500) END,
    lease_token=NULL,lease_expires_at=NULL,updated_at=clock_timestamp(),
    completed_at=CASE WHEN final_outcome IN ('delivered','refund') THEN clock_timestamp() ELSE NULL END
    WHERE id=p_id RETURNING * INTO receipt;
  RETURN to_jsonb(receipt);
END $body$;

REVOKE ALL ON FUNCTION public.bot_shop_reserve(text,uuid,text,text,uuid,text,bigint) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.bot_shop_claim(uuid,integer) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.bot_shop_extend(uuid,uuid,integer) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.bot_shop_mark_attempted(uuid,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.bot_shop_finish(uuid,uuid,text,text,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bot_shop_reserve(text,uuid,text,text,uuid,text,bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.bot_shop_claim(uuid,integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.bot_shop_extend(uuid,uuid,integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.bot_shop_mark_attempted(uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.bot_shop_finish(uuid,uuid,text,text,boolean) TO service_role;
NOTIFY pgrst,'reload schema';
