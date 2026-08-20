CREATE OR REPLACE FUNCTION public.message_blocked_contact_kind(p_body text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_body IS NULL OR btrim(p_body) = '' THEN
    RETURN NULL;
  END IF;

  -- URLs (toujours)
  IF p_body ~* '(https?://|www\.)[^\s]+' THEN
    RETURN 'url';
  END IF;

  -- Apps de messagerie externes (toujours)
  IF p_body ~* '\m(whats?[[:space:]]*app|whatsapp|telegram|signal|snapchat|w\.?[[:space:]]*a\.?)\M' THEN
    RETURN 'external_contact';
  END IF;

  -- Emails
  IF p_body ~* '\m[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\M' THEN
    RETURN 'email';
  END IF;

  -- Téléphones internationaux CH/FR/DE/IT ou locaux 0X…
  IF p_body ~* '(\+|00)?(41|33|49|39)[[:space:]./\-]?([[:digit:][:space:]./\-()]){8,14}' THEN
    RETURN 'phone';
  END IF;
  IF p_body ~* '\m0[1-9]([[:space:]./\-]?[[:digit:]]){8,10}\M' THEN
    RETURN 'phone';
  END IF;

  -- Adresses (voie + n°)
  IF p_body ~* '\m(rue|avenue|av\.?|chemin|route|boulevard|bd\.?|place|impasse|all[eé]e|quai|strasse|str\.?|weg|gasse|via|viale)[[:space:]]+[A-Za-zÀ-ÿ0-9''’.\-[:space:]]{2,40}[[:space:]]+[[:digit:]]{1,4}\M' THEN
    RETURN 'address';
  END IF;

  -- NPA suisse + ville (ex. 1200 Genève)
  IF p_body ~* '\m[1-9][[:digit:]]{3}[[:space:]]+[A-ZÀ-Ÿ][a-zà-ÿ''’\-]+([-[:space:]][A-ZÀ-Ÿ]?[a-zà-ÿ''’\-]+)*\M' THEN
    RETURN 'address';
  END IF;

  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.message_contains_blocked_contact_info(p_body text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT public.message_blocked_contact_kind(p_body) IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION public.thread_has_paid_order(p_thread_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.threads t
    JOIN public.orders o
      ON o.listing_id = t.listing_id
     AND o.buyer_id = t.buyer_id
    WHERE t.id = p_thread_id
      AND lower(o.status::text) IN (
        'pending', 'completed', 'confirmed', 'shipped', 'delivered'
      )
      AND lower(coalesce(o.payment_status::text, '')) NOT IN ('cancelled', 'refunded')
  );
$$;

CREATE OR REPLACE FUNCTION public.enforce_messages_contact_info_gate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  kind text;
  paid boolean;
BEGIN
  -- Ne pas filtrer les messages système / events / offres
  IF NEW.is_system IS TRUE THEN
    RETURN NEW;
  END IF;
  IF lower(coalesce(NEW.type, 'text')) IN ('system', 'offer') THEN
    RETURN NEW;
  END IF;
  IF NEW.body IS NOT NULL AND NEW.body LIKE '@@bloomi:event:v1:%' THEN
    RETURN NEW;
  END IF;

  kind := public.message_blocked_contact_kind(NEW.body);
  IF kind IS NULL THEN
    RETURN NEW;
  END IF;

  -- URLs et apps externes : toujours refusés
  IF kind IN ('url', 'external_contact') THEN
    RAISE EXCEPTION 'BLOOMI_PII_BLOCKED'
      USING ERRCODE = 'P0001',
            HINT = 'External links and messaging apps are not allowed.';
  END IF;

  -- Tél / email / adresse : autorisés seulement après paiement
  paid := public.thread_has_paid_order(NEW.thread_id);
  IF NOT paid THEN
    RAISE EXCEPTION 'BLOOMI_PII_BLOCKED'
      USING ERRCODE = 'P0001',
            HINT = 'Pay on Bloomi before sharing contact details.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_messages_contact_info_gate ON public.messages;
CREATE TRIGGER trg_messages_contact_info_gate
  BEFORE INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_messages_contact_info_gate();

COMMENT ON FUNCTION public.message_blocked_contact_kind(text) IS
  'Retourne url|phone|email|address|external_contact si le message contient des infos bloquables.';
COMMENT ON FUNCTION public.message_contains_blocked_contact_info(text) IS
  'True si le message contient tél / email / adresse / URL / apps externes.';
COMMENT ON FUNCTION public.thread_has_paid_order(uuid) IS
  'True si une commande active (payée) existe pour le listing/buyer du thread.';
COMMENT ON FUNCTION public.enforce_messages_contact_info_gate() IS
  'Empêche le partage de coordonnées avant paiement Bloomi; bloque toujours liens et apps externes.';
