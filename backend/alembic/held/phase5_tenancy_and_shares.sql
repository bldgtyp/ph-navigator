-- Held DDL — access-capability-model Phase 5 (tenancy + certifier shares).
--
-- Finalized, NOT applied. Alembic does not scan this directory; see
-- alembic/held/README.md. Apply by pasting into a real revision when the
-- multi-tenant teams + certifier-share features land (the RBC trigger).
--
-- Source of truth: planning/refactor/access-capability-model/PRD.md §5.1/§5.3,
-- decision D9 (reserve schema now, enforce when the consumer exists). Phase 1
-- already added projects.team_id as a plain nullable column; the foreign key to
-- teams is deferred to here so the column could land before the table existed.

-- 5.1 Tenancy --------------------------------------------------------------

CREATE TABLE public.teams (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    membership_status text NOT NULL DEFAULT 'active',   -- active|suspended|lapsed
    seat_limit integer,                                  -- NULL = unlimited
    membership_expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    created_by uuid,
    updated_by uuid,
    deleted_by uuid,
    CONSTRAINT pk_teams PRIMARY KEY (id),
    CONSTRAINT ck_teams_membership_status_allowed
        CHECK (membership_status = ANY (ARRAY['active'::text, 'suspended'::text, 'lapsed'::text]))
);

CREATE TABLE public.team_members (
    team_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role text NOT NULL DEFAULT 'member',                 -- admin|member
    joined_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT pk_team_members PRIMARY KEY (team_id, user_id),
    CONSTRAINT ck_team_members_role_allowed CHECK (role = ANY (ARRAY['admin'::text, 'member'::text])),
    CONSTRAINT fk_team_members_team FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE,
    CONSTRAINT fk_team_members_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE
);
-- Start one-team-per-user; drop this unique index later for multi-team membership.
CREATE UNIQUE INDEX uq_team_members_one_team_per_user ON public.team_members (user_id);

-- Attach the deferred foreign key for the column Phase 1 already added.
ALTER TABLE public.projects
    ADD CONSTRAINT fk_projects_team FOREIGN KEY (team_id) REFERENCES public.teams(id);

-- 5.3 Viewer shares (certifier vs client + version scope) ------------------

CREATE TABLE public.project_shares (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    audience text NOT NULL,                              -- client|certifier
    version_scope text NOT NULL DEFAULT 'latest',        -- latest|pinned
    pinned_version_id uuid,
    token_hash text NOT NULL,                            -- SHA-256 of the link secret (mirror mcp_tokens)
    label text,                                          -- "Client: the Smiths" / "Certifier: PHI R2"
    expires_at timestamp with time zone,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    revoked_at timestamp with time zone,
    CONSTRAINT pk_project_shares PRIMARY KEY (id),
    CONSTRAINT ck_project_shares_audience_allowed
        CHECK (audience = ANY (ARRAY['client'::text, 'certifier'::text])),
    CONSTRAINT ck_project_shares_version_scope_allowed
        CHECK (version_scope = ANY (ARRAY['latest'::text, 'pinned'::text])),
    CONSTRAINT fk_project_shares_project FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE,
    CONSTRAINT fk_project_shares_pinned_version
        FOREIGN KEY (pinned_version_id) REFERENCES public.project_versions(id),
    CONSTRAINT fk_project_shares_created_by FOREIGN KEY (created_by) REFERENCES public.users(id)
);
CREATE UNIQUE INDEX uq_project_shares_token_hash ON public.project_shares (token_hash);
CREATE INDEX ix_project_shares_project_active
    ON public.project_shares (project_id, created_at) WHERE revoked_at IS NULL;
