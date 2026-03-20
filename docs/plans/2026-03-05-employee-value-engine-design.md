# Employee Value Engine + BetterBot Agents + Mission Control

**Date:** 2026-03-05
**Status:** Approved design, ready for implementation

---

## 1. Overview

A system that scores every employee's net value to the company using a hybrid of hard dollar math and AI-scored intangibles. Each user gets a personal BetterBot agent scoped to their permissions. Owners get a lean optimization dashboard. Multiple agents can run simultaneously in a spectator/mission control view. GitHub integration enables code audits and automated PRs.

**Build order:** Employee Value Engine → BetterBot Per User → Mission Control → GitHub Code Audit

---

## 2. Net Value Formula

```
Net Value = Hard Value + (Intangible Score x Intangible Multiplier) - Total Cost
```

- **Hard Value** = directly measurable revenue/output in dollars (projects delivered, deals closed, billable hours)
- **Intangible Score** = 0-100 AI-scored composite from integration signals + optional manager input
- **Intangible Multiplier** = company-specific dollar conversion. If avg revenue per employee is $8K/mo, a score of 80/100 = $6,400 intangible contribution
- **Total Cost** = salary + benefits + tools + overhead allocation

### 30-Day Rolling Weighted Average

- Events from last 7 days: weight 3x
- Events from 8-14 days: weight 2x
- Events from 15-30 days: weight 1x
- Events older than 30 days: dropped

### AI-Determined Role Classification

The AI classifies each employee from job title + actual integration activity patterns:

| Role Type | Examples | Hard Value Weight | Intangible Weight |
|-----------|----------|-------------------|-------------------|
| **Direct Revenue** | Sales reps, client-facing devs, consultants | 70% | 30% |
| **Revenue Enabler** | PMs, team leads, architects | 40% | 60% |
| **Support/Ops** | HR, admin, finance | 10% | 90% |

A "Senior Developer" who mostly does code reviews and unblocks others gets classified as Revenue Enabler, not Direct Revenue, based on their actual activity.

---

## 3. Intangible Scoring (6 Dimensions)

| Dimension | What It Measures | Data Source |
|-----------|-----------------|-------------|
| **Responsiveness** | Reply speed, unblocking others, closing loops | Slack response times, email reply speed, Jira comment turnaround |
| **Output Volume** | Raw quantity of work produced | GitHub commits/PRs, Jira tickets closed, emails sent, projects delivered |
| **Quality Signal** | How good is their work | PR approval rate, bug reopen rate, client satisfaction signals, revision requests |
| **Collaboration** | Do they make others better | Slack threads initiated, PR reviews given, cross-team messages, meeting participation |
| **Reliability** | Hit deadlines and follow through | Jira on-time completion %, missed meetings, dropped threads |
| **Manager Assessment** | Human judgment on intangibles AI can't see | Optional 0-100 slider + tags + notes per employee |

### Dimension Weights by Role Type

| Dimension | Direct Revenue | Revenue Enabler | Support/Ops |
|-----------|---------------|-----------------|-------------|
| Responsiveness | 10% | 20% | 25% |
| Output Volume | 30% | 15% | 15% |
| Quality Signal | 25% | 20% | 15% |
| Collaboration | 5% | 25% | 20% |
| Reliability | 15% | 10% | 15% |
| Manager Assessment | 15% | 10% | 10% |

### Missing Data Handling

If a dimension has no data source (e.g., no GitHub connected), that dimension is excluded and weights redistribute proportionally. The score labels which dimensions are measured vs. unmeasured.

---

## 4. Graceful Degradation (4 Data Tiers)

| Tier | Data Available | Approach | Confidence |
|------|---------------|----------|------------|
| **Tier 1: Full** | 3+ integrations + manager input | All 6 dimensions scored | Green: "Measured" |
| **Tier 2: Partial** | 1-2 integrations OR manager only | Score available dimensions, redistribute weights | Yellow: "Partial" |
| **Tier 3: Minimal** | Salary + job title only | Hard cost known, intangible uses industry benchmark | Gray: "Estimated" |
| **Tier 4: New hire** | Just added, no history | 30-day grace period, "Evaluating..." with progress bar | Gray: "Evaluating" |

Industry benchmarks are generated from company's industry, size, and revenue (from questionnaire + website scrape). All benchmarks labeled `_source: "industry_estimate"` and shown in different color in UI.

Day one, before ANY integrations are connected, the employer still sees a useful dashboard showing salary costs and estimated value based on role benchmarks.

---

## 5. Manager Input (Optional)

Manager assessment is a simple panel on each employee card. Nothing is required.

- **Score slider**: 0-100, drag to set. If empty, dimension excluded from calculation.
- **Quick tags**: Predefined tags — "reliable", "self-starter", "needs oversight", "culture carrier", "flight risk", "high potential". Tags inform AI coach goal-setting, don't affect numeric score.
- **Optional note**: Free-text. Private to owner/c-suite only — employees never see raw notes. AI coach can reference notes when advising employer.

No cadence enforced. Managers update whenever they want. System works fine without it.

---

## 6. Score Update Cycle (Event-Driven with Smoothing)

Scores update when meaningful events happen:
- Integration syncs (Slack, GitHub, Jira data arrives)
- Project delivered / deal closed
- Manager submits input
- Goal completed or missed

Uses 30-day rolling weighted average so no single event causes wild swings. Recent events weighted heavier. A developer who had one bad week doesn't see their score crater, but consistent underperformance shows up within a month.

---

## 7. AI Coach Per Employee

Each employee gets a dedicated AI coach. Not a separate process — the existing coach-agent.ts powered by Gemini Flash, scoped per employee with their specific context.

### Coach Context (built per request)

1. Employee's scoring data (all 6 dimensions, trends over time)
2. Role classification (direct revenue / enabler / support)
3. Manager tags and notes (if any)
4. Integration activity (recent Slack patterns, Jira velocity, etc.)
5. Company context (industry, size, goals from business analysis)

### For Employees

- **Score summary**: Plain English. "Your output is top 3 but your response time is slower than average — that's dragging your collaboration score down."
- **2-3 actionable goals**: Generated from weakest dimensions. Specific and measurable with projected score impact.
- **Progress tracking**: Auto-updates from integration events.
- **Celebrates wins**: Acknowledges dimension improvements.

### For Owners/C-Suite

- **Team ranking**: All employees by net value, sortable by any dimension.
- **"Who to invest in"**: High intangible + low salary = underpaid high performer, flight risk.
- **"Where to cut"**: Net-negative for 60+ days with reasoning tied to actual scores.
- **FTE optimization**: "You have 3 in marketing generating $X. Benchmark is 2 generating $X. Here's what consolidation looks like."

### Anti-Hallucination

Coach NEVER invents metrics. Every claim links to a measured dimension or clearly-labeled benchmark. If no data: "I don't have visibility into that yet — connect [integration] or ask their manager to add input."

---

## 8. Goal System

### Goal Structure

```typescript
interface EmployeeGoal {
  id: string;
  employeeId: string;
  dimension: string;        // which scoring dimension this targets
  title: string;            // "Review 2 teammate PRs by Friday"
  metric: string;           // "pr_reviews_given"
  target: number;           // 2
  current: number;          // auto-updated from integrations
  projectedImpact: number;  // +8 points to collaboration
  deadline: string;
  status: "active" | "completed" | "missed" | "stretch";
}
```

### Rules

- Max 3 active goals at a time. Focus over volume.
- Auto-track from integration data. Employee doesn't manually update.
- On completion, coach generates new goal targeting next weakest area.
- **Stretch goals**: Employee scoring 80+ across all dimensions gets aspirational targets.
- Goals visible only to the employee and their manager.

---

## 9. BetterBot Per User

Every user who accepts an invite gets a personal BetterBot agent. Permissions are **server-side enforced**, not UI-hidden.

### Permission Tiers

| Tier | Who | Can See | Can Do |
|------|-----|---------|--------|
| **Owner** | CEO, founder | Everything | Run any agent, view all dashboards |
| **C-Suite** | VP, directors | Their department + company metrics. No other dept individual scores | Run dept-scoped agents, set goals, add manager input |
| **Employee** | ICs | Only their own score, goals, coach, tasks | Chat with coach, use role-appropriate agents, mark tasks complete |

### Bot Personality by Tier

- **Owner**: Strategic advisor. "Your engineering FTE ratio is 1.3x industry average."
- **C-Suite**: Department leader. "Your team's velocity dropped 15% this sprint."
- **Employee**: Supportive coach. "Great week — you closed 4 tickets above your goal."

---

## 10. Task Agents Per Role

Every user gets their coach PLUS role-appropriate task agents that execute real work.

| Agent | What It Does | Owner | C-Suite | Dev | Marketing | Sales | Ops |
|-------|-------------|-------|---------|-----|-----------|-------|-----|
| **Coach** | Score review, goals, advice | Y | Y | Y | Y | Y | Y |
| **Atlas** (Strategist) | Strategy, competitive analysis | Y | Y | | | | |
| **Maven** (Marketer) | Campaigns, social, ads, pitch decks | Y | Y | | Y | | |
| **Quant** (Analyst) | Revenue analysis, forecasting | Y | Y | | | Y | |
| **Forge** (Operator) | SOPs, processes, risk assessment | Y | Y | | | | Y |
| **Scout** (Recruiter) | Job postings, hiring plans | Y | Y | | | | |
| **Lens** (Researcher) | Deep research, market intel | Y | Y | Y | Y | Y | Y |
| **CodeBot** (Developer) | Code review, PRs, refactoring | Y | | Y | | | |

Agents use BetterBot execution engine (session.ts, orchestrator.ts). Each agent wears an outfit that scopes its tools. Permission tier further restricts what data the agent can access.

---

## 11. Mission Control (Multi-Agent Spectator)

Grid view of all active agent sessions. Up to 3 concurrent agents via `Promise.allSettled`.

### Each Agent Card Shows

- Agent name + avatar
- Current task (truncated)
- Live tool call stream
- Status: working / reviewing / waiting for approval / done
- Cost so far

### Features

- **Expand** any card for full conversation view
- **Intervene**: pause, redirect, or cancel
- **Approval gates**: High-impact actions (emails, PRs, spending) pause for approval
- **Queue**: Pending tasks shown below active grid
- Real-time updates via Supabase subscriptions

---

## 12. GitHub Code Audit

### Connection

OAuth with scopes: `repo` (read code, create PRs), `read:org` (team structure).

### What It Does

1. **Initial audit on connect**: Scans default branch, samples ~20 files. Produces Code Health Report (tech debt, architecture, security, quality score). Feeds into developer intangible scoring.

2. **PR reviews**: GitHub webhook on push/PR to main. Agent reviews diff, posts comments. Only PRs with 100+ lines changed to keep noise low.

3. **Weekly improvement PRs**: Picks highest-impact improvement from audit, creates real PR (fix vulnerability, add error handling, improve complex function, update website copy).

### Feeds Into Employee Scoring

- **Output Volume** → commits, PRs merged
- **Quality Signal** → approval rate, bugs introduced vs fixed
- **Collaboration** → PR reviews given to teammates
- **Reliability** → CI pass rate, reverted commits

### Cost

Initial audit ~$0.05, weekly PR ~$0.02, PR reviews ~$0.01 each. Under $1/month per repo.

---

## 13. Employee Dashboard (What Employees See)

```
┌─────────────────────────────────────────────────┐
│  Hey Sarah              Net Value: +$2,340/mo   │
│  Rank: #4 of 12        up 2 spots this month    │
├─────────────────────────────────────────────────┤
│  YOUR SCORE                          78/100      │
│  Confidence: Measured (3 sources)                │
│                                                  │
│  Responsiveness  82  ████████████████░░          │
│  Output Volume   71  ██████████████░░░           │
│  Quality Signal  85  █████████████████░          │
│  Collaboration   64  ████████████░░░░░  ← focus  │
│  Reliability     80  ████████████████░░          │
├─────────────────────────────────────────────────┤
│  ACTIVE GOALS                    2 of 3 on track │
│  [x] Close 5 tickets this week        5/5 done   │
│  [ ] Review 2 teammate PRs by Fri     1/2        │
│  [!] Respond to DMs within 2hrs       68%        │
├─────────────────────────────────────────────────┤
│  AGENTS                                          │
│  [Coach]  [Lens]  [CodeBot]                      │
└─────────────────────────────────────────────────┘
```

Employees see rank number + direction but NOT other employees' scores.

---

## 14. Employer Lean Dashboard (What Owners See)

```
┌─────────────────────────────────────────────────────┐
│  Team Intelligence              12 employees        │
├──────────────┬──────────────┬───────────────────────┤
│ Total Payroll│ Total Value  │ Net ROI               │
│ $38,400/mo   │ $67,200/mo   │ +74.7%                │
├──────────────┴──────────────┴───────────────────────┤
│  FTE EFFICIENCY                                      │
│  Your FTE: 12    Industry avg: 9                     │
│  You may be 3 heads over-staffed.                    │
│  Potential savings: $9,600/mo                        │
├──────────────────────────────────────────────────────┤
│  TEAM RANKING                                        │
│  #1  Jake M.    Dev Lead   +$4,200/mo   Score: 91   │
│  #2  Sarah K.   Sr Dev     +$2,340/mo   Score: 78   │
│  ...                                                 │
│  #12 Pat L.     Admin      -$1,100/mo   Score: 31   │
├──────────────────────────────────────────────────────┤
│  INSIGHTS                                            │
│  [red] Pat net-negative 47 days. 0/3 goals done.    │
│  [yellow] Sarah scores #2, paid #6. Flight risk.    │
│  [green] Jake produces 4.2x his salary.             │
├──────────────────────────────────────────────────────┤
│  AGENTS                                              │
│  [Coach] [Atlas] [Quant] [Lens]                      │
│  [Maven] [Forge] [Scout] [CodeBot]                   │
└──────────────────────────────────────────────────────┘
```

---

## 15. Database Schema

### New Tables

```sql
-- Employee scores (rolling history)
CREATE TABLE employee_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    hard_value REAL DEFAULT 0,
    total_cost REAL DEFAULT 0,
    net_value REAL DEFAULT 0,
    responsiveness REAL,
    output_volume REAL,
    quality_signal REAL,
    collaboration REAL,
    reliability REAL,
    manager_assessment REAL,
    intangible_score REAL,
    role_type TEXT DEFAULT 'support',
    confidence TEXT DEFAULT 'estimated',
    data_sources JSONB DEFAULT '[]',
    rank INTEGER,
    rank_change INTEGER DEFAULT 0,
    scored_at TIMESTAMPTZ DEFAULT NOW(),
    period_start TIMESTAMPTZ,
    period_end TIMESTAMPTZ
);
CREATE INDEX idx_emp_scores_employee ON employee_scores(employee_id);
CREATE INDEX idx_emp_scores_org ON employee_scores(org_id);
CREATE INDEX idx_emp_scores_date ON employee_scores(scored_at DESC);

-- Employee goals
CREATE TABLE employee_goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    dimension TEXT NOT NULL,
    title TEXT NOT NULL,
    metric TEXT NOT NULL,
    target REAL NOT NULL,
    current REAL DEFAULT 0,
    projected_impact REAL,
    deadline TIMESTAMPTZ,
    status TEXT DEFAULT 'active' CHECK (status IN ('active','completed','missed','stretch')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);
CREATE INDEX idx_emp_goals_employee ON employee_goals(employee_id);
CREATE INDEX idx_emp_goals_status ON employee_goals(status);

-- Manager input (optional)
CREATE TABLE manager_inputs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    manager_id TEXT NOT NULL,
    score REAL CHECK (score >= 0 AND score <= 100),
    tags JSONB DEFAULT '[]',
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_mgr_inputs_employee ON manager_inputs(employee_id);
CREATE INDEX idx_mgr_inputs_date ON manager_inputs(created_at DESC);
```

### Modify Existing `employees` Table

```sql
ALTER TABLE employees ADD COLUMN github_username TEXT;
ALTER TABLE employees ADD COLUMN slack_user_id TEXT;
ALTER TABLE employees ADD COLUMN email TEXT;
ALTER TABLE employees ADD COLUMN role_type TEXT DEFAULT 'support';
ALTER TABLE employees ADD COLUMN current_score REAL;
ALTER TABLE employees ADD COLUMN current_rank INTEGER;
ALTER TABLE employees ADD COLUMN user_id UUID REFERENCES auth.users(id);
ALTER TABLE employees ADD COLUMN permission_tier TEXT DEFAULT 'employee'
    CHECK (permission_tier IN ('owner','csuite','employee'));
```

---

## 16. New Files

| File | Purpose |
|------|---------|
| `lib/scoring/engine.ts` | Core scoring calculations, weighted averages, ranking |
| `lib/scoring/collectors/slack.ts` | Extract Slack metrics per employee |
| `lib/scoring/collectors/github.ts` | Extract GitHub metrics per employee |
| `lib/scoring/collectors/jira.ts` | Extract Jira metrics per employee |
| `lib/scoring/collectors/gmail.ts` | Extract Gmail metrics per employee |
| `lib/scoring/goals.ts` | AI goal generation from weak dimensions |
| `lib/scoring/benchmarks.ts` | Industry benchmark lookup by role/industry/size |
| `lib/integrations/github.ts` | GitHub OAuth + API client + webhook handler |
| `lib/execution/agents/codebot.ts` | CodeBot agent definition |
| `lib/execution/outfits/codebot-outfit.ts` | CodeBot tools (PR review, code analysis) |
| `components/EmployeeDashboard.tsx` | Employee personal view |
| `components/LeanDashboard.tsx` | Owner team intelligence view |
| `components/MissionControl.tsx` | Multi-agent spectator grid |
| `components/ManagerInput.tsx` | Score slider + tags + notes panel |
| `app/api/employees/scores/route.ts` | GET/POST employee scores |
| `app/api/employees/goals/route.ts` | GET/POST/PATCH employee goals |
| `app/api/employees/manager-input/route.ts` | POST manager input |
| `app/api/integrations/github/callback/route.ts` | GitHub OAuth callback |
| `app/api/integrations/github/webhook/route.ts` | GitHub push/PR webhook |
| `supabase/migrations/004_employee_scoring.sql` | New tables + employee alterations |

### Reused/Extended (no new files needed)

| File | Change |
|------|--------|
| `lib/agent/coach-agent.ts` | Add scoring context + goal tracking to system prompt |
| `lib/execution/outfits.ts` | Add CodeBot outfit |
| `lib/execution/agents/index.ts` | Add CodeBot agent definition |
| `lib/role-filter.ts` | Add permission_tier scoping |
| `lib/integrations/oauth.ts` | Add GitHub provider config |
| `components/TeamView.tsx` | Replace with LeanDashboard for owners |
| `app/page.tsx` | Route to EmployeeDashboard for employee-tier users |

---

## 17. Implementation Order

| # | Task | Effort | Dependencies |
|---|------|--------|-------------|
| 1 | Migration 004: new tables + employee alterations | Small | None |
| 2 | `lib/scoring/engine.ts` — core formula + weighted average | Medium | #1 |
| 3 | `lib/scoring/benchmarks.ts` — industry benchmark fallback | Small | #2 |
| 4 | Score collectors (Slack, Jira, Gmail, GitHub stubs) | Medium | #2 |
| 5 | Test scoring engine with synthetic employees, iterate | Medium | #2, #3, #4 |
| 6 | `lib/scoring/goals.ts` — AI goal generation | Medium | #2 |
| 7 | API routes (scores, goals, manager-input) | Small | #1 |
| 8 | EmployeeDashboard.tsx | Medium | #7 |
| 9 | ManagerInput.tsx | Small | #7 |
| 10 | LeanDashboard.tsx (replaces TeamView for owners) | Medium | #7 |
| 11 | Permission tier enforcement in role-filter + BetterBot | Medium | #1 |
| 12 | Agent access matrix (which agents per role) | Small | #11 |
| 13 | MissionControl.tsx (spectator view) | Medium | #12 |
| 14 | GitHub integration (OAuth + webhook + CodeBot) | Large | #4, #12 |
| 15 | Score update cron (event-driven recalculation) | Small | #2, #4 |
| 16 | End-to-end testing with real integrations | Medium | All |

---

## 18. Testing Strategy

Before any UI is built, the scoring engine must be validated:

1. Generate 20+ synthetic employees across all 3 role types
2. Inject varied integration data (high performers, low performers, missing data, new hires)
3. Run scoring engine and verify:
   - Rankings make intuitive sense
   - Missing data degrades gracefully (no crashes, no hallucinated scores)
   - Role classification matches expected behavior
   - 30-day smoothing prevents single-event volatility
   - Industry benchmarks produce reasonable Tier 3 estimates
4. Iterate formula weights until scoring is solid across all scenarios
5. Only then wire into UI

---

## 19. Cost Estimates

| Component | Monthly Cost |
|-----------|-------------|
| Scoring engine (Gemini Flash for role classification + goal generation) | ~$2-5 per company |
| GitHub code audit (initial + weekly PRs + PR reviews) | ~$1 per repo |
| BetterBot agents (per-user sessions) | ~$0.01-0.05 per interaction |
| Cloud Scheduler (score recalculation cron) | ~$0.10 |
| **Total per company** | **~$5-10/month** |
