-- Liens (phase 2, ticket 19, décision 04). Règles dans @app/shared (links.ts,
-- roles.ts), reproduites ici comme seconde barrière (ADR-0006).
--
-- Les liens d'un ticket vers les besoins et les exigences existent déjà
-- (ticket_need, ticket_requirement, reprises de l'action au ticket 16) : leur
-- clé vise le ticket, de tout type, et rien n'y change.

-- Lien entre deux tickets de la même initiative, avec une nature de la liste fixe
-- (LINK_KINDS) : la source « bloque » ou « duplique » la cible ; « est lié à » n'est
-- pas orienté. Un seul lien par paire, quel que soit son sens ; pas de lien vers
-- soi-même. Un ticket lié ne se supprime pas (clés sans ON DELETE : l'API traduit
-- le refus en `ticketLinked` ou `linked`) ; supprimer l'initiative emporte tout.
-- Aucun déclencheur : un lien ne figure dans aucun historique.
CREATE TABLE ticket_link (
  initiative_id uuid NOT NULL REFERENCES initiative (id) ON DELETE CASCADE,
  source_id     uuid NOT NULL,
  target_id     uuid NOT NULL,
  kind          text NOT NULL CHECK (kind IN ('blocks', 'duplicates', 'relates_to')),
  PRIMARY KEY (source_id, target_id),
  CONSTRAINT ticket_link_not_self CHECK (source_id <> target_id),
  CONSTRAINT ticket_link_source_fkey
    FOREIGN KEY (initiative_id, source_id) REFERENCES ticket (initiative_id, id),
  CONSTRAINT ticket_link_target_fkey
    FOREIGN KEY (initiative_id, target_id) REFERENCES ticket (initiative_id, id)
);
CREATE UNIQUE INDEX ticket_link_pair_key ON ticket_link (least(source_id, target_id), greatest(source_id, target_id));
CREATE INDEX ticket_link_target_id_idx ON ticket_link (target_id);

-- Row Level Security : tout membre consulte ; propriétaires et contributeurs
-- créent et retirent les liens ; initiative archivée : lecture seule. Un lien ne
-- se modifie pas : on le retire et on en crée un autre.
ALTER TABLE ticket_link ENABLE ROW LEVEL SECURITY;

CREATE POLICY ticket_link_select ON ticket_link FOR SELECT
  USING (has_initiative_role(initiative_id, 'reader'));
CREATE POLICY ticket_link_insert ON ticket_link FOR INSERT
  WITH CHECK (has_initiative_role(initiative_id, 'contributor') AND NOT initiative_is_archived(initiative_id));
CREATE POLICY ticket_link_delete ON ticket_link FOR DELETE
  USING (has_initiative_role(initiative_id, 'contributor') AND NOT initiative_is_archived(initiative_id));
