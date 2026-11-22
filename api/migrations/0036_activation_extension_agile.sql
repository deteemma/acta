-- Activation de l'Extension Agile sur une initiative (Extension Agile, ticket 03 ;
-- spécification D10 à D12). Règles dans @app/shared (roles.ts : toggleAgileExtension,
-- schemas.ts : canToggleAgileExtension), reproduites ici comme seconde barrière (ADR-0006).

-- Désactivée à la création, et pour les initiatives existantes (D10). Indépendante
-- de l'approche d'analyse (D12) : aucun lien entre les deux colonnes.
ALTER TABLE initiative ADD COLUMN agile_extension_enabled boolean NOT NULL DEFAULT false;

-- Même déclencheur que la migration 0004, avec l'Extension Agile parmi les
-- changements réservés au propriétaire (D11). L'initiative archivée reste en
-- lecture seule : le module n'y change pas non plus (D11).
CREATE OR REPLACE FUNCTION enforce_initiative_update_rules() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  -- Changer le code, l'Extension Agile, archiver ou désarchiver : propriétaire seulement.
  IF (NEW.code IS DISTINCT FROM OLD.code
      OR NEW.agile_extension_enabled IS DISTINCT FROM OLD.agile_extension_enabled
      OR NEW.archived_at IS DISTINCT FROM OLD.archived_at
      OR NEW.archived_by IS DISTINCT FROM OLD.archived_by)
     AND NOT has_initiative_role(OLD.id, 'owner') THEN
    RAISE EXCEPTION 'réservé au propriétaire de l’initiative' USING ERRCODE = 'insufficient_privilege';
  END IF;
  -- Initiative archivée : lecture seule, sauf pour la désarchiver.
  IF OLD.archived_at IS NOT NULL AND NEW.archived_at IS NOT NULL THEN
    RAISE EXCEPTION 'initiative archivée : lecture seule' USING ERRCODE = 'insufficient_privilege';
  END IF;
  -- Archiver ou désarchiver ne modifie rien d'autre dans la même requête.
  IF NEW.archived_at IS DISTINCT FROM OLD.archived_at
     AND to_jsonb(NEW) - '{archived_at,archived_by,updated_at}'::text[]
         IS DISTINCT FROM to_jsonb(OLD) - '{archived_at,archived_by,updated_at}'::text[] THEN
    RAISE EXCEPTION 'archiver ou désarchiver sans autre modification' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END
$$;
