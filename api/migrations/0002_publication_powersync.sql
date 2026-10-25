-- Tables répliquées vers les mobiles par PowerSync (profil mobile-hors-ligne,
-- ADR-0004). Sans effet si PowerSync n'est pas démarré.
CREATE PUBLICATION powersync FOR TABLE project, project_member;
