-- v_thread_list doit s'exécuter avec les droits de l'utilisateur connecté,
-- sinon la RLS sur threads/messages/listings est contournée (fuite inbox).
-- Idempotent : safe si déjà appliqué manuellement en prod.
ALTER VIEW public.v_thread_list SET (security_invoker = true);
