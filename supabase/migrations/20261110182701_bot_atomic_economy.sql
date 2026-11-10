-- Discord interaction receipts make retries idempotent. This is backend-only;
-- the existing dashboard read policies on accounts/transactions stay intact.
CREATE TABLE public.bot_economy_operations (
  interaction_id text PRIMARY KEY,
  guild_id uuid NOT NULL REFERENCES public.guilds(id) ON DELETE CASCADE,
  request jsonb NOT NULL,
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX bot_economy_operations_guild_idx ON public.bot_economy_operations(guild_id);
ALTER TABLE public.bot_economy_operations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bot_economy_operations FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bot_economy_operations TO service_role;

CREATE FUNCTION public.bot_economy_operation(
  p_operation text,
  p_interaction_id text,
  p_guild_id uuid,
  p_user_id text,
  p_amount bigint DEFAULT NULL,
  p_target_user_id text DEFAULT NULL,
  p_username text DEFAULT NULL,
  p_target_username text DEFAULT NULL,
  p_description text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $function$
DECLARE
  v_request jsonb;
  v_receipt public.bot_economy_operations%ROWTYPE;
  v_account public.economy_accounts%ROWTYPE;
  v_target public.economy_accounts%ROWTYPE;
  v_settings public.economy_settings%ROWTYPE;
  v_result jsonb;
  v_now timestamptz;
  v_retry_at timestamptz;
  v_amount bigint;
  v_starting bigint;
  v_min integer;
  v_max integer;
  v_type text;
  v_from text;
  v_to text;
  v_description text;
  v_outcome text;
  v_ledger_id uuid;
  v_limit constant bigint := 9007199254740991;
BEGIN
  IF p_operation IS NULL OR p_operation NOT IN ('transfer','deposit','withdraw','daily','work','rob')
     OR p_interaction_id IS NULL OR p_interaction_id !~ '^[0-9]{1,20}$'
     OR p_user_id IS NULL OR p_user_id !~ '^[0-9]{1,20}$'
     OR p_guild_id IS NULL OR length(coalesce(p_username,'')) > 128
     OR length(coalesce(p_target_username,'')) > 128 OR length(coalesce(p_description,'')) > 256 THEN
    RETURN jsonb_build_object('ok',false,'reason','invalid_input');
  END IF;
  IF p_operation IN ('transfer','deposit','withdraw') AND
     (p_amount IS NULL OR p_amount <= 0 OR p_amount > v_limit) THEN
    RETURN jsonb_build_object('ok',false,'reason','invalid_amount');
  END IF;
  IF p_operation IN ('daily','work','rob') AND p_amount IS NOT NULL THEN
    RETURN jsonb_build_object('ok',false,'reason','invalid_amount');
  END IF;
  IF p_operation IN ('transfer','rob') AND
     (p_target_user_id IS NULL OR p_target_user_id !~ '^[0-9]{1,20}$' OR p_target_user_id = p_user_id) THEN
    RETURN jsonb_build_object('ok',false,'reason','invalid_target');
  END IF;
  IF p_operation NOT IN ('transfer','rob') AND p_target_user_id IS NOT NULL THEN
    RETURN jsonb_build_object('ok',false,'reason','invalid_target');
  END IF;

  v_request := jsonb_build_object('operation',p_operation,'guild_id',p_guild_id,
    'user_id',p_user_id,'target_user_id',p_target_user_id,'amount',p_amount);
  INSERT INTO public.bot_economy_operations(interaction_id,guild_id,request)
    VALUES(p_interaction_id,p_guild_id,v_request) ON CONFLICT (interaction_id) DO NOTHING;
  SELECT * INTO STRICT v_receipt FROM public.bot_economy_operations
    WHERE interaction_id = p_interaction_id FOR UPDATE;
  IF v_receipt.request <> v_request THEN
    RAISE EXCEPTION 'Interaction already belongs to another economy request' USING ERRCODE = '22023';
  END IF;
  IF v_receipt.result IS NOT NULL THEN
    RETURN v_receipt.result || jsonb_build_object('replayed',true);
  END IF;

  -- Business failures roll back account creation as well as balance changes.
  -- Unexpected errors (including a failed ledger insert) escape and roll back
  -- the entire transaction, including its receipt, so a safe retry is possible.
  BEGIN
    IF p_operation IN ('daily','work') THEN
      SELECT * INTO v_settings FROM public.economy_settings WHERE guild_id = p_guild_id;
      v_starting := coalesce(v_settings.starting_balance,0);
      IF v_starting < 0 THEN
        RAISE EXCEPTION USING ERRCODE='P0101', MESSAGE='{"ok":false,"reason":"invalid_config"}';
      END IF;
      INSERT INTO public.economy_accounts(guild_id,user_id,discord_username,wallet)
        VALUES(p_guild_id,p_user_id,p_username,v_starting)
        ON CONFLICT(guild_id,user_id) DO NOTHING;
    ELSIF p_operation = 'transfer' THEN
      IF NOT EXISTS (SELECT 1 FROM public.economy_accounts WHERE guild_id=p_guild_id AND user_id=p_user_id) THEN
        RAISE EXCEPTION USING ERRCODE='P0101', MESSAGE='{"ok":false,"reason":"not_found"}';
      END IF;
      INSERT INTO public.economy_accounts(guild_id,user_id,discord_username,wallet)
        VALUES(p_guild_id,p_target_user_id,p_target_username,0)
        ON CONFLICT(guild_id,user_id) DO NOTHING;
    ELSIF p_operation = 'rob' THEN
      IF NOT EXISTS (SELECT 1 FROM public.economy_accounts WHERE guild_id=p_guild_id AND user_id=p_target_user_id) THEN
        RAISE EXCEPTION USING ERRCODE='P0101', MESSAGE='{"ok":false,"reason":"not_found"}';
      END IF;
      INSERT INTO public.economy_accounts(guild_id,user_id,discord_username,wallet)
        VALUES(p_guild_id,p_user_id,p_username,0) ON CONFLICT(guild_id,user_id) DO NOTHING;
    END IF;

    -- Every two-account operation locks the same guild/user ordering. A->B
    -- and B->A can wait for each other but cannot lock the pair backwards.
    PERFORM a.id FROM public.economy_accounts a
      WHERE a.guild_id=p_guild_id AND
        (a.user_id=p_user_id OR (p_operation IN ('transfer','rob') AND a.user_id=p_target_user_id))
      ORDER BY a.user_id FOR UPDATE;
    SELECT * INTO v_account FROM public.economy_accounts WHERE guild_id=p_guild_id AND user_id=p_user_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION USING ERRCODE='P0101', MESSAGE='{"ok":false,"reason":"not_found"}';
    END IF;
    IF p_operation IN ('transfer','rob') THEN
      SELECT * INTO v_target FROM public.economy_accounts WHERE guild_id=p_guild_id AND user_id=p_target_user_id;
      IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE='P0101', MESSAGE='{"ok":false,"reason":"not_found"}';
      END IF;
    END IF;
    IF v_account.wallet < 0 OR v_account.bank < 0 OR v_target.wallet < 0 OR v_target.bank < 0 THEN
      RAISE EXCEPTION USING ERRCODE='P0101', MESSAGE='{"ok":false,"reason":"invalid_balance"}';
    END IF;

    v_now := clock_timestamp();
    v_amount := p_amount;
    v_from := p_user_id;
    v_to := p_user_id;
    v_type := p_operation;
    IF p_operation = 'transfer' THEN
      IF v_account.wallet < v_amount THEN
        RAISE EXCEPTION USING ERRCODE='P0101', MESSAGE='{"ok":false,"reason":"insufficient"}';
      END IF;
      IF v_target.wallet > v_limit-v_amount THEN
        RAISE EXCEPTION USING ERRCODE='P0101', MESSAGE='{"ok":false,"reason":"balance_limit"}';
      END IF;
      UPDATE public.economy_accounts SET wallet=wallet-v_amount,discord_username=coalesce(p_username,discord_username) WHERE id=v_account.id;
      UPDATE public.economy_accounts SET wallet=wallet+v_amount,discord_username=coalesce(p_target_username,discord_username) WHERE id=v_target.id;
      v_to := p_target_user_id;
      v_description := 'Betaling fra ' || coalesce(p_username,p_user_id);
    ELSIF p_operation = 'deposit' THEN
      IF v_account.wallet < v_amount THEN
        RAISE EXCEPTION USING ERRCODE='P0101', MESSAGE='{"ok":false,"reason":"insufficient"}';
      END IF;
      IF v_account.bank > v_limit-v_amount THEN
        RAISE EXCEPTION USING ERRCODE='P0101', MESSAGE='{"ok":false,"reason":"balance_limit"}';
      END IF;
      UPDATE public.economy_accounts SET wallet=wallet-v_amount,bank=bank+v_amount WHERE id=v_account.id;
      v_description := 'Indsat i banken';
    ELSIF p_operation = 'withdraw' THEN
      IF v_account.bank < v_amount THEN
        RAISE EXCEPTION USING ERRCODE='P0101', MESSAGE='{"ok":false,"reason":"insufficient"}';
      END IF;
      IF v_account.wallet > v_limit-v_amount THEN
        RAISE EXCEPTION USING ERRCODE='P0101', MESSAGE='{"ok":false,"reason":"balance_limit"}';
      END IF;
      UPDATE public.economy_accounts SET wallet=wallet+v_amount,bank=bank-v_amount WHERE id=v_account.id;
      v_description := 'Hævet fra banken';
    ELSIF p_operation IN ('daily','work') THEN
      IF p_operation = 'daily' THEN
        v_amount := coalesce(v_settings.daily_amount,100);
        IF coalesce(v_settings.daily_cooldown_hours,24) < 0 THEN
          RAISE EXCEPTION USING ERRCODE='P0101', MESSAGE='{"ok":false,"reason":"invalid_config"}';
        END IF;
        v_retry_at := v_account.last_daily_at + make_interval(hours=>coalesce(v_settings.daily_cooldown_hours,24));
        v_description := 'Daglig belønning';
      ELSE
        v_min := coalesce(v_settings.work_min,10);
        v_max := coalesce(v_settings.work_max,50);
        IF v_min < 0 OR v_max < v_min OR coalesce(v_settings.work_cooldown_minutes,30) < 0 THEN
          RAISE EXCEPTION USING ERRCODE='P0101', MESSAGE='{"ok":false,"reason":"invalid_config"}';
        END IF;
        v_amount := floor(random()*(v_max::bigint-v_min+1))::bigint+v_min;
        v_retry_at := v_account.last_work_at + make_interval(mins=>coalesce(v_settings.work_cooldown_minutes,30));
        v_description := 'Arbejdede som ' || coalesce(nullif(p_description,''),'medarbejder');
      END IF;
      IF v_retry_at > v_now THEN
        RAISE EXCEPTION USING ERRCODE='P0101', MESSAGE=jsonb_build_object('ok',false,'reason','cooldown','retry_at',v_retry_at)::text;
      END IF;
      IF v_amount < 0 OR v_account.wallet > v_limit-v_amount OR v_account.total_earned > v_limit-v_amount THEN
        RAISE EXCEPTION USING ERRCODE='P0101', MESSAGE='{"ok":false,"reason":"balance_limit"}';
      END IF;
      UPDATE public.economy_accounts SET wallet=wallet+v_amount,total_earned=total_earned+v_amount,
        discord_username=coalesce(p_username,discord_username),
        last_daily_at=CASE WHEN p_operation='daily' THEN v_now ELSE last_daily_at END,
        last_work_at=CASE WHEN p_operation='work' THEN v_now ELSE last_work_at END WHERE id=v_account.id;
      v_from := NULL;
    ELSE -- rob: randomness is part of the committed result, never a retried JS roll.
      IF v_target.wallet < 10 THEN
        RAISE EXCEPTION USING ERRCODE='P0101', MESSAGE='{"ok":false,"reason":"insufficient"}';
      END IF;
      IF random() < 0.4 THEN
        v_amount := floor(random()*least(v_target.wallet,200))::bigint+1;
        IF v_account.wallet > v_limit-v_amount THEN
          RAISE EXCEPTION USING ERRCODE='P0101', MESSAGE='{"ok":false,"reason":"balance_limit"}';
        END IF;
        UPDATE public.economy_accounts SET wallet=wallet-v_amount WHERE id=v_target.id;
        UPDATE public.economy_accounts SET wallet=wallet+v_amount WHERE id=v_account.id;
        v_from := p_target_user_id;
        v_description := 'Røvede ' || coalesce(p_target_username,p_target_user_id);
        v_outcome := 'robbed';
      ELSE
        v_amount := least(v_account.wallet,floor(random()*50)::bigint+10);
        UPDATE public.economy_accounts SET wallet=wallet-v_amount WHERE id=v_account.id;
        v_type := 'rob_fine';
        v_description := 'Bøde for røveri';
        v_outcome := 'fined';
      END IF;
    END IF;

    INSERT INTO public.economy_transactions(guild_id,from_user_id,to_user_id,amount,transaction_type,description)
      VALUES(p_guild_id,v_from,v_to,v_amount,v_type,v_description) RETURNING id INTO v_ledger_id;
    SELECT * INTO v_account FROM public.economy_accounts WHERE id=v_account.id;
    v_result := jsonb_build_object('ok',true,'amount',v_amount,'ledger_id',v_ledger_id,
      'account',jsonb_build_object('id',v_account.id,'wallet',v_account.wallet,'bank',v_account.bank));
    IF p_operation = 'work' THEN
      v_result := v_result || jsonb_build_object('job',coalesce(nullif(p_description,''),'medarbejder'));
    ELSIF p_operation = 'rob' THEN
      v_result := v_result || jsonb_build_object('outcome',v_outcome);
    END IF;
  EXCEPTION WHEN SQLSTATE 'P0101' THEN
    v_result := SQLERRM::jsonb;
  END;

  UPDATE public.bot_economy_operations SET result=v_result WHERE interaction_id=p_interaction_id;
  RETURN v_result || jsonb_build_object('replayed',false);
END;
$function$;
REVOKE ALL ON FUNCTION public.bot_economy_operation(text,text,uuid,text,bigint,text,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bot_economy_operation(text,text,uuid,text,bigint,text,text,text,text) TO service_role;
