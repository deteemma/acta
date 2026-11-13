-- Administration de la limite de pièces jointes (phase 2, ticket 31, décision 14
-- point 4). Règle dans @app/shared (attachmentQuotaInputSchema). Seconde barrière
-- (ADR-0006) : require_admin() ci-dessous, et la contrainte
-- app_settings_attachment_quota de la migration 0024, qui borne déjà la valeur
-- entre 10 et 1 024 Mo.
--
-- Valable pour toute l'application. La baisser ne supprime aucun fichier : les
-- contrôles d'ajout (enforce_attachment, migrations 0024 et 0028) relisent la
-- limite à chaque envoi et ne refusent que les ajouts.
--
-- La RLS reste celle de la migration 0024 : lecture par tous, aucune écriture
-- directe par le compte applicatif, seulement par la fonction ci-dessous.
CREATE FUNCTION admin_set_attachment_quota(p_quota_mb integer) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM require_admin();
  UPDATE app_settings SET attachment_quota_mb = p_quota_mb;
END
$$;
