# Pivot — Supabase Migration Guide

This document describes the full database schema for migrating from SQLite (`pivot.db`) to Supabase (PostgreSQL).

---

## Migration Notes

| SQLite | Supabase (PostgreSQL) |
|---|---|
| `TEXT PRIMARY KEY` | `UUID PRIMARY KEY DEFAULT gen_random_uuid()` |
| `DATETIME DEFAULT CURRENT_TIMESTAMP` | `TIMESTAMPTZ DEFAULT NOW()` |
| `TEXT` (JSON columns) | `JSONB` for structured JSON, `TEXT` for free-form |
| No built-in auth | Use `auth.users` table from Supabase Auth |
| No RLS | Enable Row Level Security on every table |

---

## Tables

### 1. `users`
Maps to Supabase Auth users. Create this as a profile table that mirrors `auth.users`.

```sql
CREATE TABLE public.users (
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email        TEXT UNIQUE NOT NULL,
  name         TEXT,
  role         TEXT DEFAULT 'MEMBER',
  organization_id UUID,              -- default/active org FK (set after org creation)
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own profile"
  ON public.users FOR SELECT
  USING (auth.uid() = id);
CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE
  USING (auth.uid() = id);
```

---

### 2. `organizations`
One row per business. A user can own/belong to multiple organizations.

```sql
CREATE TABLE public.organizations (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                   TEXT NOT NULL,
  website                TEXT,
  industry               TEXT,
  revenue_range          TEXT,
  business_model         TEXT,
  key_concerns           TEXT,
  one_decision           TEXT,
  primary_objective      TEXT,
  owner_user_id          UUID REFERENCES public.users(id),
  icon_url               TEXT,         -- favicon URL (null = show initial letter)
  theme_color            TEXT,         -- hex color e.g. "#3B82F6"
  agent_memory_json      JSONB,        -- AgentMemory object (~600 words, for ARIA)
  website_analysis_json  JSONB,        -- WebsiteAnalysis object
  created_at             TIMESTAMPTZ DEFAULT NOW(),
  updated_at             TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_organizations_owner ON public.organizations(owner_user_id);

-- RLS
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members can read their orgs"
  ON public.organizations FOR SELECT
  USING (
    id IN (
      SELECT org_id FROM public.user_organizations WHERE user_id = auth.uid()
    )
  );
CREATE POLICY "Org owners can update their orgs"
  ON public.organizations FOR UPDATE
  USING (owner_user_id = auth.uid());
CREATE POLICY "Authenticated users can create orgs"
  ON public.organizations FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
```

---

### 3. `user_organizations`
Many-to-many join table. Supports multiple users per org and multiple orgs per user.

```sql
CREATE TABLE public.user_organizations (
  user_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  org_id     UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  role       TEXT DEFAULT 'OWNER',   -- 'OWNER' | 'MEMBER' | 'VIEWER'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, org_id)
);

-- Indexes
CREATE INDEX idx_user_orgs_user ON public.user_organizations(user_id);
CREATE INDEX idx_user_orgs_org ON public.user_organizations(org_id);

-- RLS
ALTER TABLE public.user_organizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read their own memberships"
  ON public.user_organizations FOR SELECT
  USING (user_id = auth.uid());
CREATE POLICY "Org owners can manage memberships"
  ON public.user_organizations FOR ALL
  USING (
    org_id IN (
      SELECT id FROM public.organizations WHERE owner_user_id = auth.uid()
    )
  );
```

---

### 4. `jobs`
One row per analysis run. Stores the full pipeline state and deliverables.

```sql
CREATE TABLE public.jobs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id           TEXT UNIQUE NOT NULL,     -- human-readable ID (nanoid)
  status           TEXT NOT NULL,            -- pending|parsing|ingesting|synthesizing|formatting|completed|failed
  phase            TEXT DEFAULT 'PLAN',      -- INGEST|PLAN|EXECUTE
  organization_id  UUID REFERENCES public.organizations(id),
  questionnaire_json JSONB,                  -- Questionnaire object (includes new fields)
  file_paths_json  JSONB,                    -- string[] of uploaded file paths
  parsed_context   TEXT,                     -- BusinessPacket JSON (Stage 1 output)
  results_json     JSONB,                    -- MVPDeliverables JSON (includes all new deliverables)
  error            TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_jobs_run_id ON public.jobs(run_id);
CREATE INDEX idx_jobs_org_id ON public.jobs(organization_id);
CREATE INDEX idx_jobs_status ON public.jobs(status);

-- RLS
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members can read jobs for their orgs"
  ON public.jobs FOR SELECT
  USING (
    organization_id IN (
      SELECT org_id FROM public.user_organizations WHERE user_id = auth.uid()
    )
  );
CREATE POLICY "Org members can create jobs"
  ON public.jobs FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT org_id FROM public.user_organizations WHERE user_id = auth.uid()
    )
  );
```

---

### 5. `tasks`
Execution phase tasks (Phase 3).

```sql
CREATE TABLE public.tasks (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id         UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  title          TEXT NOT NULL,
  status         TEXT NOT NULL,     -- pending|in_progress|completed|failed
  assigned_agent TEXT,
  due_date       TIMESTAMPTZ,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_tasks_job_id ON public.tasks(job_id);

-- RLS
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members can read tasks for their jobs"
  ON public.tasks FOR SELECT
  USING (
    job_id IN (
      SELECT id FROM public.jobs WHERE organization_id IN (
        SELECT org_id FROM public.user_organizations WHERE user_id = auth.uid()
      )
    )
  );
```

---

### 6. `agent_conversations`
Stores ARIA chat conversation history per org (last 20 messages).

```sql
CREATE TABLE public.agent_conversations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id       UUID REFERENCES public.users(id),
  messages_json JSONB NOT NULL,   -- ChatMessage[] array (last 20)
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_agent_conversations_org ON public.agent_conversations(org_id);
CREATE INDEX idx_agent_conversations_user ON public.agent_conversations(user_id);

-- RLS
ALTER TABLE public.agent_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read their own conversations"
  ON public.agent_conversations FOR SELECT
  USING (user_id = auth.uid());
CREATE POLICY "Users can insert conversations for their orgs"
  ON public.agent_conversations FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM public.user_organizations WHERE user_id = auth.uid()
    )
  );
CREATE POLICY "Users can update their own conversations"
  ON public.agent_conversations FOR UPDATE
  USING (user_id = auth.uid());
```

---

## Questionnaire JSON Schema (for `jobs.questionnaire_json`)

The `Questionnaire` object stored in `jobs.questionnaire_json` now includes all fields:

```json
{
  "organizationName": "Acme Corp",
  "industry": "B2B SaaS",
  "revenueRange": "$0 - $10M",
  "businessModel": "Monthly subscriptions for workflow automation",
  "keyConcerns": "Late-paying clients, rising AWS costs",
  "oneDecisionKeepingOwnerUpAtNight": "Should we expand to enterprise or stay SMB?",
  "primaryObjective": "Increase MRR by 30% in 6 months",
  "keyCustomers": "TechCorp, BuildFast, Limegreen Ltd",
  "keyCompetitors": "Zapier, Make.com",
  "location": "Lagos, Nigeria",
  "website": "https://acmecorp.com",
  "websiteVisitorsPerDay": 250,
  "competitorUrls": ["https://zapier.com", "https://make.com"],
  "techStack": "Vercel, Supabase, Stripe",
  "orgId": "org-uuid-here"
}
```

---

## MVPDeliverables JSON Schema (for `jobs.results_json`)

The deliverables object now supports additional optional sections:

```json
{
  "healthScore": { ... },
  "cashIntelligence": { ... },
  "revenueLeakAnalysis": { ... },
  "issuesRegister": { ... },
  "atRiskCustomers": { ... },
  "decisionBrief": { ... },
  "actionPlan": { ... },
  "marketIntelligence": { ... },
  "websiteAnalysis": { "grade": "C", "score": 62, ... },
  "competitorAnalysis": { "repositioningRecommendations": [...], ... },
  "techOptimization": { "potentialSavings": 450, "recommendations": [...] },
  "pricingIntelligence": { "suggestedPricing": [...] }
}
```

---

## Migration Order

Run SQL in this order to respect foreign key constraints:

1. `users` (no FK dependencies)
2. `organizations` (FK to `users`)
3. `user_organizations` (FK to `users` + `organizations`)
4. `jobs` (FK to `organizations`)
5. `tasks` (FK to `jobs`)
6. `agent_conversations` (FK to `organizations` + `users`)

---

## Supabase-Specific Setup

### Enable Row Level Security
Always enable RLS. Every table above has RLS policies defined.

### Supabase Auth Trigger
Create a trigger to auto-create a `users` profile row when a user signs up:

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

### Storage Bucket
Create a `uploads` storage bucket for analysis documents:
```
Bucket name: pivot-uploads
Public: false
File size limit: 52428800 (50MB)
Allowed MIME types: application/pdf, application/vnd.openxmlformats-officedocument.*, text/csv, application/vnd.ms-excel
```

### Environment Variables
Replace SQLite connection in `lib/db/index.ts` with Supabase client:
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key  # server-side only
GEMINI_API_KEY=your-gemini-key
```
