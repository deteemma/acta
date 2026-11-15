-- Liens des pages (phase 2, ticket 25, décision 04, point 5). Règles dans
-- @app/shared (links.ts, pages.ts, roles.ts), reproduites ici comme seconde
-- barrière (ADR-0006).
--
-- Une page se lie, sans nature, à des tickets de tout type, des besoins et des
-- exigences de la même initiative (clés composites) ; jamais à une autre page (pas
-- de table pour cela). Un seul lien par paire (clé primaire). Une page liée, ou un
-- objet lié à une page, ne se supprime pas (clés sans ON DELETE : l'API traduit le
-- refus en `pageLinked`, `ticketLinked`, `linked`, `needLinked` ou
-- `requirementLinked`) ; supprimer l'initiative emporte tout. Aucun déclencheur :
-- un lien ne crée aucun enregistrement de la page et ne figure dans aucun
-- historique. Tables hors de la publication PowerSync : absentes du téléphone.

CREATE TABLE page_ticket (
  initiative_id uuid NOT NULL REFERENCES initiative (id) ON DELETE CASCADE,
  page_id       uuid NOT NULL,
  ticket_id     uuid NOT NULL,
  PRIMARY KEY (page_id, ticket_id),
  CONSTRAINT page_ticket_page_fkey
    FOREIGN KEY (initiative_id, page_id) REFERENCES page (initiative_id, id),
  CONSTRAINT page_ticket_ticket_fkey
    FOREIGN KEY (initiative_id, ticket_id) REFERENCES ticket (initiative_id, id)
);
CREATE INDEX page_ticket_ticket_id_idx ON page_ticket (ticket_id);

CREATE TABLE page_need (
  initiative_id uuid NOT NULL REFERENCES initiative (id) ON DELETE CASCADE,
  page_id       uuid NOT NULL,
  need_id       uuid NOT NULL,
  PRIMARY KEY (page_id, need_id),
  CONSTRAINT page_need_page_fkey
    FOREIGN KEY (initiative_id, page_id) REFERENCES page (initiative_id, id),
  CONSTRAINT page_need_need_fkey
    FOREIGN KEY (initiative_id, need_id) REFERENCES need (initiative_id, id)
);
CREATE INDEX page_need_need_id_idx ON page_need (need_id);

CREATE TABLE page_requirement (
  initiative_id  uuid NOT NULL REFERENCES initiative (id) ON DELETE CASCADE,
  page_id        uuid NOT NULL,
  requirement_id uuid NOT NULL,
  PRIMARY KEY (page_id, requirement_id),
  CONSTRAINT page_requirement_page_fkey
    FOREIGN KEY (initiative_id, page_id) REFERENCES page (initiative_id, id),
  CONSTRAINT page_requirement_requirement_fkey
    FOREIGN KEY (initiative_id, requirement_id) REFERENCES requirement (initiative_id, id)
);
CREATE INDEX page_requirement_requirement_id_idx ON page_requirement (requirement_id);

-- Row Level Security : tout membre consulte ; propriétaires et contributeurs
-- créent et retirent les liens ; initiative archivée : lecture seule. Un lien ne
-- se modifie pas : on le retire et on en crée un autre.
ALTER TABLE page_ticket ENABLE ROW LEVEL SECURITY;
CREATE POLICY page_ticket_select ON page_ticket FOR SELECT
  USING (has_initiative_role(initiative_id, 'reader'));
CREATE POLICY page_ticket_insert ON page_ticket FOR INSERT
  WITH CHECK (has_initiative_role(initiative_id, 'contributor') AND NOT initiative_is_archived(initiative_id));
CREATE POLICY page_ticket_delete ON page_ticket FOR DELETE
  USING (has_initiative_role(initiative_id, 'contributor') AND NOT initiative_is_archived(initiative_id));

ALTER TABLE page_need ENABLE ROW LEVEL SECURITY;
CREATE POLICY page_need_select ON page_need FOR SELECT
  USING (has_initiative_role(initiative_id, 'reader'));
CREATE POLICY page_need_insert ON page_need FOR INSERT
  WITH CHECK (has_initiative_role(initiative_id, 'contributor') AND NOT initiative_is_archived(initiative_id));
CREATE POLICY page_need_delete ON page_need FOR DELETE
  USING (has_initiative_role(initiative_id, 'contributor') AND NOT initiative_is_archived(initiative_id));

ALTER TABLE page_requirement ENABLE ROW LEVEL SECURITY;
CREATE POLICY page_requirement_select ON page_requirement FOR SELECT
  USING (has_initiative_role(initiative_id, 'reader'));
CREATE POLICY page_requirement_insert ON page_requirement FOR INSERT
  WITH CHECK (has_initiative_role(initiative_id, 'contributor') AND NOT initiative_is_archived(initiative_id));
CREATE POLICY page_requirement_delete ON page_requirement FOR DELETE
  USING (has_initiative_role(initiative_id, 'contributor') AND NOT initiative_is_archived(initiative_id));
