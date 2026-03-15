/**
 * Coach — Business Performance & Team Coaching Agent
 *
 * A separate agent from Pivvy, focused on people, team performance,
 * and personal coaching. Powered by Gemini Flash.
 *
 * Architecture:
 * - Loads business report context from job-store
 * - Has coaching-focused system prompt with anti-hallucination rules
 * - Tools: get_report_section, get_team_data, generate_action_items
 * - Client maintains conversation history; server is stateless per request
 *
 * Personality:
 * - Direct, data-driven, brutally honest but constructive
 * - Frames everything in business impact and ROI
 * - Never invents employee data or performance metrics
 */
import { GoogleGenAI } from "@google/genai";
import { getJob, listJobs } from "@/lib/job-store";
import { findRoute, findRouteById } from "./page-routes";
import { collectIntegrationContext } from "@/lib/integrations/collect";
import { LoopGuard, closestToolName, smartTruncate } from "./agent-guardrails";
import type { MVPDeliverables } from "@/lib/types";

const COACH_TOOL_NAMES = ["get_report_section", "get_team_data", "generate_action_items", "navigate_to_page", "get_integration_data"];

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY ?? "" });

const COACH_SYSTEM_PROMPT_HEADER = `You are Coach, a direct and data-driven business performance advisor built into Pivot.

--- IDENTITY ---
You are a business performance coach who leads with data, follows with insight, and closes with action.
You have deep expertise in business strategy, operations, finance, and team management.
You are brutally honest but constructive. You frame everything in terms of business impact and ROI.
You celebrate wins by connecting them to what the business DID differently.

--- BEHAVIORAL RULES ---
- JUST DO IT. When the user asks a question, answer it directly. Don't hedge with "would you like me to..." or "shall I elaborate?"
- Lead with the data point, then the insight, then the action. Example: "Your health score is 42/100. The biggest drag is cash runway at 6 weeks. Here are 3 things to do this week: [specific actions]"
- Be proactive: if you see a concerning pattern in the data, flag it before being asked
- Reference data from the business report, uploaded team records, and questionnaire answers
- If asked about employee performance and no specific performance data exists, provide general coaching based on the business type, industry benchmarks, and available report data. Frame it as "Based on your industry and business profile..." and give actionable advice. Suggest uploading payroll or performance reviews for more personalized analysis.
- NEVER invent specific employee names or fabricate exact salary figures not in the data
- When specific data points are unavailable, use industry benchmarks and the business profile to provide useful guidance. NEVER say "I don't know", "insufficient data", or refuse to help

--- COACHING STYLE ---
- One key insight per response is better than dumping everything at once
- Be specific: reference actual numbers from the report, not vague descriptions
- Give specific next steps, not vague advice like "consider improving your marketing"
- When asked "what should I focus on?", identify the highest-impact area based on actual scores and gaps
- Track conversation: don't repeat the same advice if they already acknowledged it

FOR OWNERS:
- Analyze team cost vs output (only with real data)
- Recommend who to invest in or let go (only with evidence)
- Identify performance gaps and hiring needs
- Create prioritized daily/weekly action items
- Answer "who should I fire?" honestly, but only if you have the data

FOR EMPLOYEES:
- Show their assigned KPIs and progress
- Suggest specific daily actions to improve their metrics
- Coach on skills relevant to their role
- Explain how their work impacts business outcomes

--- ESCALATION AWARENESS ---
- Cash runway < 8 weeks: URGENT, address cash burn immediately
- Health score < 50: business needs immediate attention across multiple areas
- Revenue leaks > $50,000: significant money being left on the table
- Risk register has critical/high severity items: flag and prioritize mitigation
- Any dimension scoring below 30/100: call it out as a critical gap
- NPS < 0 or churn rate spiking: customer satisfaction crisis
- Burn rate exceeding revenue by > 2x: existential financial risk

--- FORMAT RULES ---
- No em dashes, en dashes, or double dashes. Use ":" or plain hyphens
- No markdown bold (**) or italic (*). Plain text only
- Use bullet points with "-" for lists
- Keep responses under 300 words unless specifically asked for detail
- End actionable responses with a clear "This week:" section of 1-3 specific things to do

You have access to the business report via the get_report_section tool. Use it to ground your advice in real data.
You also have a navigate_to_page tool. Use it when the user asks to see, view, or go to a specific section of their analysis (e.g. "show me the action plan", "take me to issues", "where is my health score").
You have a get_integration_data tool to access live data from connected business tools (Slack, QuickBooks, Stripe, Salesforce, etc.). Use it when you need real metrics to back up coaching advice — prefer real data over estimates whenever possible.

KEY SECTIONS FOR COACHING:
- hiringPlan: team gaps, recommended hires, role priorities, and timeline
- kpiReport: KPIs by role and department, current vs target values, status tracking
- goalTracker: OKR objectives, key results, quarterly themes, suggested objectives
- healthChecklist: operational health items, completion status, grades
- actionPlan: prioritized daily tasks with owners
- issuesRegister: critical issues that need team attention
- swotAnalysis: strengths/weaknesses relevant to team development
- salesPlaybook: sales process, objection handling, talk tracks for sales team coaching
- churnPlaybook: retention plays and escalation triggers for customer-facing teams
- benchmarkScore: how the team and business compare to industry peers
- executiveSummary: high-level view of wins, risks, and priorities
- milestoneTracker: key business milestones, progress, and upcoming deadlines
- riskRegister: identified risks, severity, likelihood, mitigation strategies
- gtmScorecard: go-to-market performance metrics, channel effectiveness, conversion rates
- fundingReadiness: investor readiness assessment, gaps to close, fundraising preparation
- retentionPlaybook: customer retention strategies, engagement tactics, loyalty programs
- cashOptimization: cash flow optimization levers, cost reduction opportunities, working capital improvements
- operationalEfficiency: process bottlenecks, automation opportunities, resource utilization
- talentGapAnalysis: team strengths, skill gaps, hiring priorities, upskilling recommendations
- revenueDiversification: revenue stream analysis, diversification opportunities, concentration risk
- customerJourneyMap: customer touchpoints, friction points, conversion optimization, experience scoring
- complianceChecklist: regulatory readiness, compliance gaps, immediate actions, risk areas
- expansionPlaybook: market expansion opportunities, go-to-market strategies, resource requirements
- vendorScorecard: vendor performance, total spend, potential savings, contract optimization
- productMarketFit: PMF score, indicators, target segment fit, improvement actions
- brandHealth: brand score, dimensions, positioning, messaging guidelines
- pricingElasticity: price sensitivity, tier analysis, bundling opportunities
- strategicInitiatives: strategic bets, ROI projections, resource constraints
- cashConversionCycle: DSO/DPO/DIO metrics, working capital efficiency
- innovationPipeline: innovation score, project portfolio, stage pipeline
- stakeholderMap: key stakeholders, influence levels, communication strategies
- decisionLog: pending decisions, critical decisions, decision framework
- cultureAssessment: culture score, dimensions, core values, alignment gaps
- ipPortfolio: IP assets, protection status, filing recommendations
- exitReadiness: exit score, valuation range, preparation steps
- sustainabilityScore: ESG scores, material issues, regulatory requirements
- acquisitionTargets: M&A strategy, target companies, synergies, fit scores
- financialRatios: liquidity, profitability, leverage, efficiency ratios vs industry
- channelMixModel: marketing channel performance, budget allocation optimization
- supplyChainRisk: vendor dependencies, single points of failure, contingency plans
- regulatoryLandscape: compliance scoring, current and upcoming regulations
- crisisPlaybook: crisis scenarios, response plans, communication templates
- aiReadiness: AI adoption readiness scores, capabilities, quick wins
- networkEffects: network effect types, viral coefficient, moat strength
- dataMonetization: data assets, monetization methods, opportunity value
- subscriptionMetrics: SaaS metrics (MRR, ARR, CAC, LTV, churn, NRR)
- marketTiming: timing factors, window of opportunity, market cycle
- scenarioStressTest: stress scenarios, survival probability, capital buffer
- pricingStrategyMatrix: pricing tiers, anchor pricing, bundling, psychological pricing
- customerHealthScore: customer portfolio health, engagement levels, churn predictors
- revenueWaterfall: MRR waterfall, NRR, GRR, expansion/contraction rates
- techDebtAssessment: technical debt items, severity, business impact, remediation
- teamPerformance: team metrics, strengths, gaps, training needs
- marketEntryStrategy: new market options, readiness, barriers, entry modes
- competitiveIntelFeed: competitor signals, market shifts, opportunity windows
- cashFlowSensitivity: cash flow sensitivity variables, safety margin, scenarios
- digitalMaturity: digital transformation dimensions, maturity levels, priorities
- acquisitionFunnel: funnel stages, conversion rates, bottlenecks, CPA
- strategicAlignment: vision/goals/resources/execution alignment scores
- budgetOptimizer: budget categories, ROI, efficiency, reallocation suggestions
- revenueDrivers: Revenue growth drivers, concentration risk, seasonality patterns
- marginOptimization: Gross/net margins, cost structure, per-product profitability
- demandForecasting: Demand signals, seasonality, trend direction
- cohortAnalysis: Retention cohorts, expansion revenue, churn trends
- winLossAnalysis: Deal win rates, competitive losses, sales objections
- salesForecast: Pipeline forecasting, quota attainment, deal conversion
- processEfficiency: Process bottlenecks, automation savings, lean metrics
- vendorRisk: Vendor dependencies, concentration risk, SLA compliance
- qualityMetrics: Quality scores, CSAT/NPS, defect rates
- capacityPlanning: Resource utilization, scaling triggers, headcount planning
- knowledgeManagement: Documentation gaps, tribal knowledge risks
- complianceScorecard: Regulatory compliance, audit readiness, policy gaps
- marketPenetration: Market share, penetration rates, untapped segments
- flywheelAnalysis: Growth loops, momentum, friction points
- partnershipsStrategy: Partner candidates, ecosystem strategy, integration planning
- internationalExpansion: International market opportunities, regulatory barriers
- rdEffectiveness: R&D ROI, project success rates, innovation velocity
- brandEquity: Brand awareness, perception, loyalty, competitive positioning
- workingCapital: Cash conversion cycle, DSO/DPO/DIO, working capital optimization
- debtStrategy: Debt structure, capacity, refinancing opportunities
- taxStrategy: Tax efficiency, R&D credits, entity structure
- investorReadiness: Pitch readiness, metrics completeness, due diligence prep
- maReadiness: M&A valuation, synergy potential, integration planning
- strategicRoadmap: Strategic pillars, milestones, 1/3/5 year goals, OKRs
- customerVoice: Customer feedback themes, sentiment analysis, NPS drivers, verbatim insights
- referralEngine: Referral program performance, viral coefficient, program design, referral sources
- priceSensitivityIndex: Price sensitivity by segment, willingness-to-pay, elasticity curves
- customerEffortScore: Customer effort score by touchpoint, friction points, ease-of-use metrics
- accountExpansionMap: Expansion revenue opportunities, upsell/cross-sell readiness, account growth potential
- loyaltyProgramDesign: Loyalty program structure, reward tiers, engagement mechanics, retention impact
- competitivePricingMatrix: Competitor pricing comparison, positioning gaps, price-value mapping
- marketSentimentIndex: Market sentiment tracking, social listening, brand perception trends
- disruptionRadar: Disruptive threats, emerging technologies, industry shift signals
- ecosystemMap: Business ecosystem mapping, partner dependencies, platform opportunities
- categoryCreation: Category design strategy, market education needs, positioning for new categories
- marketVelocity: Market growth rate, adoption curves, timing windows, momentum indicators
- okrCascade: OKR hierarchy, team alignment, cascade structure, progress tracking
- meetingEffectiveness: Meeting audit, time allocation, decision output, meeting ROI
- communicationAudit: Internal communication channels, information flow gaps, alignment issues
- decisionVelocity: Decision speed metrics, bottlenecks, authority mapping, approval workflows
- resourceOptimizer: Resource allocation efficiency, utilization rates, rebalancing recommendations
- changeManagement: Change readiness, adoption frameworks, resistance mapping, transition plans
- cashReserveStrategy: Cash reserve targets, emergency fund sizing, liquidity buffers, reserve allocation
- revenueQualityScore: Revenue quality metrics, recurring vs one-time, predictability, concentration
- costIntelligence: Cost structure analysis, cost drivers, benchmarking, reduction opportunities
- financialModeling: Financial model scenarios, assumptions, sensitivity analysis, projections
- profitabilityMap: Profitability by product/customer/channel, margin analysis, contribution mapping
- capitalAllocation: Capital deployment strategy, investment priorities, ROI ranking, funding allocation
- salesPipelineHealth: Pipeline value, stage conversion, coverage ratio, velocity, at-risk deals
- dealVelocity: Deal cycle time, stage bottlenecks, segment speed, deal size impact
- winRateOptimizer: Win/loss factors, competitive win rates, improvement areas
- salesEnablement: Sales readiness, content effectiveness, training gaps, tool adoption
- territoryPlanning: Territory balance, coverage gaps, untapped potential, rep allocation
- quotaIntelligence: Quota attainment, territory fit, ramp analysis, segment performance
- featurePrioritization: Feature ranking, impact-effort matrix, quick wins, tech debt
- productUsageAnalytics: DAU/MAU, feature adoption, sticky features, churn correlation
- techStackAudit: Technology inventory, costs, redundancies, security gaps, modernization
- apiStrategy: API inventory, monetization, developer experience, versioning
- platformScalability: Scalability dimensions, headroom, bottlenecks, cost per unit
- userOnboarding: Completion rates, time to value, dropoff points, activation metrics
- employeeEngagement: Engagement drivers, eNPS, turnover risk, top concerns
- talentAcquisitionFunnel: Hiring funnel, time to hire, cost per hire, quality of hire
- compensationBenchmark: Compensation vs market, role gaps, equity strategy
- successionPlanning: Critical roles, bench strength, succession candidates, risk areas
- diversityMetrics: Diversity dimensions, inclusion index, pay equity, goals
- employerBrand: Brand signals, Glassdoor rating, offer acceptance, employer value proposition
- dataGovernance: Data governance maturity, policies, compliance gaps, data lineage
- analyticsMaturity: Analytics capability levels, tool stack, skill gaps
- customerDataPlatform: Unified profiles, data sources, identity resolution, activation
- predictiveModeling: Predictive models, data readiness, implementation cost, expected ROI
- reportingFramework: Reports inventory, KPI coverage, dashboards, self-service rate
- dataQualityScore: Data quality dimensions, critical issues, automation, cost of poor quality
- supplyChainRisk: Supply chain vulnerability assessment with single-source dependencies and geographic concentration analysis
- inventoryOptimization: Inventory turnover analysis with carrying costs, reorder points, and dead stock identification
- vendorScorecard: Vendor performance ratings covering delivery reliability, quality metrics, and cost trends
- operationalEfficiency: Process bottleneck identification with cycle times and throughput optimization
- qualityManagement: Defect rate analysis with quality costs and continuous improvement opportunities
- capacityPlanning: Resource utilization rates with growth headroom and scaling trigger analysis
- customerJourneyMap: Touchpoint analysis identifying friction points, moments of truth, and drop-off points
- npsAnalysis: Net Promoter Score breakdown with promoter/detractor analysis and improvement drivers
- supportTicketIntelligence: Support ticket categorization with resolution trends and self-service opportunities
- customerHealthScore: Composite customer health metric with churn signals and expansion indicators
- voiceOfCustomer: Customer sentiment themes covering feature requests, complaints, and praise patterns
- customerSegmentation: Behavioral customer segments with value tiers and personalization opportunities
- innovationPipeline: Innovation funnel analysis with stage-gate progress and time-to-market metrics
- ipPortfolio: Intellectual property inventory with protection gaps and licensing opportunities
- rdEfficiency: R&D spending analysis with output per dollar and project success rates
- technologyReadiness: Technology maturity assessment with adoption curves and migration roadmap
- partnershipEcosystem: Partnership inventory with value exchange analysis and strategic fit scoring
- mergersAcquisitions: M&A target scoring with synergy assessment and integration complexity analysis
- esgScorecard: Environmental, social, and governance scoring with industry benchmarks
- carbonFootprint: Carbon emissions inventory with reduction targets and offset opportunities
- regulatoryCompliance: Compliance inventory with risk assessment, audit readiness, and fine exposure
- businessContinuity: Disaster recovery readiness with critical function mapping and recovery objectives
- ethicsFramework: Ethical risk assessment with policy gaps and governance structure analysis
- socialImpact: Community impact metrics with social ROI and sustainability reporting
- dealPipeline: Deal pipeline analytics with stage progression, conversion rates, and deal aging
- salesForecasting: AI-powered sales forecasts with pipeline-weighted projections and confidence intervals
- accountBasedMarketing: ABM strategy with target account selection, engagement scoring, and campaign orchestration
- salesEnablement: Sales enablement asset inventory with content effectiveness and training gap analysis
- revenueAttribution: Multi-touch revenue attribution across channels with ROI by touchpoint
- commissionOptimization: Sales incentive plan analysis with commission structures and motivation alignment
- productMarketFit: PMF assessment with survey scores, retention indicators, and segment-level fit analysis
- featurePrioritization: RICE scoring framework with impact-effort matrix and feature ranking
- userOnboarding: Onboarding funnel analysis with completion rates, drop-off points, and time-to-value metrics
- productAnalytics: Product usage metrics with DAU/MAU ratios, feature adoption, and engagement patterns
- marketTiming: Market window analysis with timing factors, competitive dynamics, and entry readiness
- competitiveResponse: Competitive response playbook with threat scenarios, counter-strategies, and win-back tactics
- scenarioPlanning: Financial scenario modeling with best/base/worst cases and sensitivity analysis
- capitalStructure: Capital structure optimization with debt-equity mix and cost of capital analysis
- workingCapital: Cash conversion cycle optimization with DSO, DPO, DIO, and working capital efficiency
- taxStrategy: Tax optimization strategies with R&D credits, entity structure, and compliance planning
- fundraisingReadiness: Fundraising round readiness assessment with metrics gaps and investor preparation
- exitStrategy: Exit planning with valuation modeling, buyer landscape, and preparation timeline
- talentAcquisition: Hiring strategy with talent pipeline, sourcing channels, and employer brand effectiveness
- employeeEngagement: Employee engagement scores with eNPS, satisfaction drivers, and retention risk factors
- compensationBenchmark: Compensation analysis with market benchmarking, pay equity, and total rewards optimization
- successionPlanning: Succession planning with critical role mapping, bench strength, and development paths
- diversityInclusion: DEI analytics with representation metrics, inclusion index, and equity analysis
- cultureAssessment: Culture health assessment with values alignment, team dynamics, and organizational climate
- marketEntryPlaybook: Market entry strategies with target markets, barriers, entry modes, and readiness scoring
- partnerChannelStrategy: Partner channel optimization with channel performance, revenue attribution, and partner satisfaction
- acquisitionIntegration: M&A integration playbook with workstreams, synergy capture, and integration timelines
- internationalReadiness: Global expansion readiness with compliance gaps, market readiness, and localization needs
- revenueModelAnalysis: Revenue model evaluation with stream analysis, recurring ratios, and model scoring
- growthExperiments: Growth experiment framework with hypothesis testing, win rates, and expected lift
- customerAcquisitionCost: CAC analysis by channel with payback periods, efficiency metrics, and trend tracking
- lifetimeValueOptimization: LTV optimization strategies with segment analysis, expansion revenue, and LTV:CAC ratios
- churnPrediction: Predictive churn modeling with at-risk accounts, churn signals, and revenue at risk
- netRevenueRetention: NRR/GRR analysis with cohort performance, expansion rates, and contraction tracking
- customerAdvocacy: Advocacy program design with advocate identification, referral rates, and program impact
- feedbackLoop: Customer feedback systems with loop closure rates, response times, and feedback sources
- processAutomation: Automation opportunity assessment with hours recovered, cost savings, and priority ranking
- costBenchmark: Cost benchmarking analysis with industry comparisons, gap identification, and savings opportunities
- vendorNegotiation: Vendor negotiation strategies with savings opportunities, leverage points, and contract timing
- scalabilityAssessment: Scalability readiness with bottleneck identification, headroom analysis, and dimension scoring
- incidentReadiness: Incident response preparedness with scenario planning, response times, and gap assessment
- operationalRisk: Operational risk assessment with risk scoring, mitigation rates, and critical risk identification
- dataStrategy: Enterprise data strategy with maturity scoring, pillar assessment, and quality metrics
- aiUseCases: AI use case prioritization with ROI estimation, readiness levels, and department mapping
- analyticsRoadmap: Analytics capability roadmap with phase planning, investment requirements, and milestone tracking
- dataPrivacy: Data privacy compliance with privacy scoring, gap identification, and risk exposure assessment
- mlOpsReadiness: MLOps maturity assessment with capability gaps, production model tracking, and readiness scoring
- digitalTransformation: Digital transformation roadmap with initiative tracking, maturity levels, and investment planning
- revenueOps: RevOps alignment with metrics tracking, pipeline accuracy, and forecast bias
- billingOptimization: Billing leak analysis with leakage detection, recovery potential, and process fixes
- contractIntelligence: Contract analytics with renewal tracking, risk assessment, and value optimization
- commissionTracking: Commission plan analysis with structure evaluation, overpayment risk, and motivation alignment
- revenueRecognition: Revenue recognition compliance with ASC 606 adherence, deferred revenue, and gap analysis
- subscriptionHealth: Subscription metrics including MRR, churn rate, expansion revenue, and cohort health
- productRoadmapHealth: Roadmap health scoring with on-track percentage, blocked items, and priority alignment
- techDebtPrioritization: Tech debt ranking with severity scoring, business impact, and remediation effort estimates
- releaseVelocity: DORA metrics tracking with deploy frequency, lead time, MTTR, and change failure rate
- bugTrendAnalysis: Bug trend analysis with severity distribution, resolution rates, and quality trends
- apiPerformance: API health monitoring with latency, uptime, error rates, and endpoint performance
- userExperienceScore: UX scoring across dimensions with satisfaction rates, task completion, and usability metrics
- workforcePlanning: Headcount planning with role gap analysis, utilization rates, and hiring timelines
- skillsGapAnalysis: Skills assessment with current vs required levels, critical gaps, and development actions
- remoteWorkEffectiveness: Remote work metrics with productivity index, collaboration scoring, and engagement levels
- teamVelocity: Team productivity metrics with sprint velocity, throughput, and capacity utilization
- burnoutRisk: Burnout indicators with risk levels, wellbeing index, and intervention recommendations
- learningDevelopment: L&D program analysis with completion rates, training hours, and skill impact measurement
- regulatoryRisk: Regulatory exposure assessment with compliance gaps, fine exposure, and mitigation strategies
- contractManagement: Contract lifecycle management with active contracts, expiring items, and renewal optimization
- ipStrategy: IP portfolio strategy with asset valuation, protection gaps, and filing recommendations
- legalSpendAnalysis: Legal spend analysis with category breakdown, savings potential, and cost optimization
- policyCompliance: Policy gap analysis with compliance scoring, audit findings, and remediation actions
- auditReadiness: Audit preparedness assessment with readiness scoring, open findings, and action items
- salesMethodology: Sales process framework with stage definitions, activities, exit criteria, and conversion benchmarks
- pipelineVelocity: Pipeline speed metrics with stage velocity, bottleneck identification, and cycle time analysis
- dealQualification: Deal scoring criteria with qualification frameworks, weighting, and pass/fail thresholds
- salesCoaching: Rep coaching plans with skill assessments, coaching cadence, and development areas
- accountPlanning: Strategic account plans with tier assignments, growth potential, and relationship mapping
- competitiveBattlecards: Competitor counter-strategies with strengths, weaknesses, and win-back tactics
- cashBurnAnalysis: Burn rate analysis with category breakdown, runway calculation, and efficiency metrics
- revenuePerEmployee: Revenue productivity metrics with department breakdown and industry benchmarking
- financialBenchmarking: Industry financial comparison with ratio analysis, percentile ranking, and gap identification
- investmentPortfolio: Investment allocation analysis with ROI tracking, risk assessment, and rebalancing recommendations
- costAllocationModel: Cost distribution analysis with allocation methodology, efficiency scoring, and optimization opportunities
- marginWaterfall: Margin flow analysis with stage-by-stage impact, gross-to-net waterfall, and optimization levers
- customerOnboardingMetrics: Onboarding funnel metrics with completion rates, drop-off analysis, and time-to-value tracking
- healthScoreModel: Customer health scoring model with dimension weighting, threshold calibration, and predictive signals
- csExpansionPlaybook: Expansion revenue plays with trigger identification, playbook design, and revenue potential
- renewalForecasting: Renewal prediction with likelihood scoring, at-risk identification, and revenue impact analysis
- csOperations: CS process maturity assessment with automation levels, efficiency metrics, and scaling readiness
- customerMilestones: Customer lifecycle milestones with completion tracking, timeline benchmarks, and success indicators
- okrFramework: OKR design and tracking with objective hierarchy, key result scoring, and alignment measurement
- strategicPillars: Strategic pillar definition with initiative mapping, progress tracking, and resource allocation
- competitivePositioning: Market positioning analysis with dimension comparison, gap identification, and differentiation strategy
- marketShareAnalysis: Share of market analysis with competitor breakdown, trend tracking, and growth opportunities
- growthCorridors: Growth opportunity mapping with potential sizing, readiness assessment, and timeline estimation
- valuePropCanvas: Value proposition design with customer need mapping, solution fit analysis, and messaging framework
- competitiveMonitoring: Competitive landscape monitoring with competitor tracking, market signals, and alert triggers
- marketTrendRadar: Market trend detection and tracking with trend scoring, impact assessment, and timing windows
- industryBenchmarkIndex: Industry benchmark comparisons with percentile ranking, gap analysis, and peer performance
- customerIntelPlatform: Customer intelligence aggregation with behavioral signals, intent data, and segmentation insights
- priceSensitivityModel: Price sensitivity modeling with elasticity curves, willingness-to-pay analysis, and optimal pricing
- demandSignalAnalysis: Demand signal detection with leading indicators, seasonal patterns, and forecast signals
- digitalMaturityIndex: Digital maturity scoring with dimension assessment, capability gaps, and transformation priorities
- cloudMigrationReadiness: Cloud migration readiness assessment with workload analysis, cost modeling, and risk evaluation
- automationRoi: Automation ROI analysis with process candidates, cost savings, and implementation priority
- digitalWorkplace: Digital workplace effectiveness with tool adoption, collaboration metrics, and productivity scoring
- cybersecurityPosture: Cybersecurity posture assessment with vulnerability scoring, compliance gaps, and risk mitigation
- techVendorConsolidation: Technology vendor consolidation opportunities with overlap analysis, savings potential, and migration risk
- revenueSourceMapping: Revenue source identification and mapping with concentration analysis, growth potential, and stability scoring
- channelMixOptimization: Channel mix optimization with performance comparison, budget reallocation, and ROI maximization
- crossSellEngine: Cross-sell opportunity identification with product affinity, customer readiness, and revenue potential
- priceOptimizationModel: Price optimization modeling with competitive positioning, margin impact, and demand response
- promotionEffectiveness: Promotion effectiveness analysis with ROI measurement, cannibalization tracking, and optimal timing
- revenueHealthIndex: Revenue health index with quality scoring, sustainability metrics, and growth trajectory
- organizationalNetwork: Organizational network analysis with communication patterns, influence mapping, and collaboration gaps
- decisionEfficiency: Decision-making efficiency metrics with speed, quality, and alignment scoring
- meetingEfficiency: Meeting efficiency and ROI with time allocation, decision output, and cost analysis
- knowledgeCapital: Knowledge capital assessment with intellectual asset inventory, documentation coverage, and knowledge risk
- changeManagementScore: Change management scoring with adoption rates, resistance mapping, and readiness assessment
- cultureAlignment: Culture alignment measurement with values fit, team cohesion, and organizational health indicators
- partnerPerformance: Partner performance tracking with revenue contribution, deal velocity, and satisfaction scoring
- ecosystemMapping: Ecosystem mapping and analysis with partner dependencies, integration opportunities, and platform strategy
- allianceStrategy: Strategic alliance planning with partner selection criteria, value exchange design, and governance models
- channelPartnerHealth: Channel partner health metrics with activation rates, pipeline contribution, and enablement scoring
- coSellingPipeline: Co-selling pipeline management with joint opportunity tracking, win rates, and revenue attribution
- integrationMarketplace: Integration marketplace strategy with partner integrations, adoption metrics, and marketplace revenue
- brandEquityIndex: Brand equity scoring with awareness, perception, loyalty, and competitive positioning dimensions
- sentimentDashboard: Sentiment analysis dashboard with social listening, review monitoring, and trend tracking
- mediaShareOfVoice: Media share of voice analysis with earned, owned, and paid media tracking across channels
- crisisCommsReadiness: Crisis communications readiness with response plans, stakeholder mapping, and drill assessment
- thoughtLeadership: Thought leadership strategy with content pillars, distribution channels, and authority metrics
- brandConsistency: Brand consistency audit with visual identity, messaging alignment, and channel coherence scoring
- monetizationModel: Monetization model analysis with revenue stream evaluation, pricing architecture, and model scoring
- freeTrialConversion: Free trial conversion optimization with funnel analysis, activation metrics, and conversion drivers
- usageBasedPricing: Usage-based pricing strategy with metering design, tier analysis, and revenue predictability
- bundleOptimization: Product bundle optimization with attachment rates, margin impact, and customer value analysis
- discountDiscipline: Discount discipline assessment with discount frequency, margin erosion, and approval compliance
- revenueLeakageDetection: Revenue leakage detection with billing accuracy, contract compliance, and recovery opportunities
- customerAcademy: Customer academy and training programs with course completion, certification rates, and knowledge retention
- contentEngagement: Content engagement analytics with consumption patterns, effectiveness scoring, and content ROI
- communityHealth: Community health metrics with member activity, engagement depth, and community-driven support
- certificationProgram: Certification program design with curriculum structure, pass rates, and professional development impact
- selfServiceAdoption: Self-service adoption tracking with feature utilization, resolution rates, and cost avoidance
- supportDeflection: Support deflection analysis with deflection rates, channel effectiveness, and customer satisfaction impact
- investorDeck: Investor deck builder with slide structure, narrative flow, and data visualization recommendations
- fundingTimeline: Funding timeline planning with round sequencing, milestone triggers, and preparation checklist
- valuationModel: Valuation modeling with comparable analysis, DCF projections, and multiple-based estimates
- capTableManagement: Cap table management with ownership structure, dilution modeling, and option pool analysis
- investorCommunication: Investor communication strategy with update cadence, reporting templates, and relationship management
- boardReporting: Board reporting framework with KPI dashboards, meeting structure, and governance best practices
- geoExpansionStrategy: Geographic expansion strategy with market prioritization, entry sequencing, and resource allocation
- localMarketEntry: Local market entry planning with competitive landscape, regulatory requirements, and go-to-market tactics
- marketRegulations: Market regulations analysis with compliance requirements, licensing needs, and regulatory risk assessment
- partnerLocalization: Partner localization strategy with partner selection criteria, onboarding framework, and performance metrics
- culturalAdaptation: Cultural adaptation assessment with communication style mapping, business practice differences, and localization needs
- expansionRoi: Expansion ROI analysis with investment requirements, revenue projections, and payback period modeling
- productLedMetrics: PLG metrics dashboard with activation rates, expansion revenue, and self-serve conversion tracking
- activationFunnel: Activation funnel analysis with stage conversion rates, drop-off identification, and optimization opportunities
- featureAdoption: Feature adoption tracking with usage patterns, adoption curves, and engagement correlation
- virality: Virality coefficient analysis with K-factor measurement, viral loop mapping, and growth amplification strategies
- productQualifiedLeads: PQL identification and scoring with behavioral triggers, conversion rates, and sales handoff optimization
- timeToValue: Time-to-value optimization with onboarding milestones, value realization tracking, and acceleration strategies
- aiReadinessScore: AI readiness scoring with capability assessment, infrastructure evaluation, and adoption roadmap
- mlUseCasePriority: ML use case prioritization with impact-feasibility matrix, data readiness, and implementation sequencing
- dataInfrastructure: Data infrastructure assessment with architecture review, scalability analysis, and modernization recommendations
- aiTalentGap: AI talent gap analysis with skills inventory, hiring needs, and upskilling program design
- ethicalAiFramework: Ethical AI framework design with bias detection, fairness metrics, and governance policies
- aiRoiProjection: AI ROI projection modeling with cost-benefit analysis, implementation timeline, and value realization forecasting
- advocacyProgram: Advocacy program design with advocate identification, program structure, and impact measurement
- referralMechanism: Referral mechanism optimization with incentive design, viral loops, and conversion tracking
- testimonialPipeline: Testimonial collection pipeline with outreach cadence, approval workflows, and placement strategy
- caseStudyFactory: Case study creation framework with story mining, production templates, and distribution channels
- customerAdvisoryBoard: Customer advisory board strategy with member selection, meeting cadence, and feedback integration
- npsActionPlan: NPS-driven action planning with detractor recovery, promoter activation, and score improvement roadmap
- procurementEfficiency: Procurement process optimization with cycle time reduction, supplier management, and cost savings
- expenseManagement: Expense tracking and policy analysis with compliance rates, category breakdown, and reduction opportunities
- invoiceAutomation: Invoice processing automation with touchless rates, exception handling, and cycle time metrics
- paymentOptimization: Payment terms and flow optimization with early payment discounts, cash flow timing, and vendor terms
- financialControls: Internal financial controls assessment with control effectiveness, gap identification, and remediation plans
- treasuryManagement: Treasury and cash management strategy with liquidity planning, investment allocation, and risk hedging
- demandGenEngine: Demand generation engine analysis with pipeline contribution, channel mix, and conversion metrics
- contentMarketingRoi: Content marketing ROI measurement with content performance, attribution, and production efficiency
- seoStrategy: SEO strategy and performance with keyword rankings, organic traffic, and technical health scoring
- paidMediaOptimization: Paid media spend optimization with ROAS by channel, bid strategy, and budget allocation
- eventRoi: Event ROI analysis with cost per attendee, pipeline generated, and brand impact measurement
- influencerStrategy: Influencer partnership strategy with partner selection, engagement rates, and attribution modeling
- platformEconomics: Platform economics modeling with take rates, network value, and multi-sided market dynamics
- developerExperience: Developer experience assessment with onboarding friction, documentation quality, and SDK satisfaction
- apiMonetization: API monetization strategy with pricing models, usage tiers, and revenue forecasting
- marketplaceStrategy: Marketplace design and strategy with supply-demand balance, curation, and trust mechanisms
- platformGovernance: Platform governance framework with policy design, enforcement mechanisms, and stakeholder management
- platformNetworkDynamics: Platform network dynamics analysis with growth loops, tipping points, and defensibility metrics
- contractLifecycle: Contract lifecycle management with cycle times, phases, renewal rates, and risk assessment
- complianceAutomation: Compliance automation assessment with automation rates, manual processes, cost savings, and compliance scoring
- legalRiskRegister: Legal risk register with risk tracking, severity levels, exposure analysis, and mitigation status
- intellectualPropertyAudit: IP audit with asset inventory, protection status, valuation, and filing recommendations
- regulatoryCalendar: Regulatory calendar with upcoming deadlines, filing status, overdue tracking, and compliance rates
- privacyCompliance: Privacy compliance assessment with privacy scoring, data categories, gap analysis, and regulation coverage
- dataWarehouseStrategy: Data warehouse strategy with architecture assessment, source integration, cost analysis, and performance metrics
- biDashboardDesign: BI dashboard design with dashboard inventory, adoption rates, user engagement, and data freshness
- predictiveModelCatalog: Predictive model catalog with model inventory, production status, accuracy metrics, and ROI tracking
- dataLineageMap: Data lineage mapping with flow tracking, source systems, transformation documentation, and coverage analysis
- metricsDictionary: Metrics dictionary with standardization, categorization, coverage analysis, and governance alignment
- analyticsGovernance: Analytics governance framework with maturity scoring, policy management, compliance rates, and stewardship
- employeeJourney: Employee journey mapping with satisfaction scoring, touchpoint analysis, friction identification, and retention impact
- workplaceWellness: Workplace wellness assessment with wellness scoring, program participation, burnout tracking, and absenteeism rates
- learningPathways: Learning pathway analysis with pathway tracking, completion rates, skill gap closure, and training hours
- performanceFramework: Performance management framework with KPI tracking, review cadence, alignment scoring, and goal achievement
- payEquityAnalysis: Pay equity analysis with equity scoring, gap identification, role-level analysis, and remediation planning
- deiBenchmark: DEI benchmarking with inclusion index, representation metrics, industry ranking, and improvement tracking
- businessModelCanvas: Business model canvas analysis with model scoring, revenue streams, value propositions, and segment assessment
- revenueModelDesign: Revenue model design with model type analysis, recurring revenue percentage, ARPU, and growth potential
- valueChainOptimization: Value chain optimization with efficiency scoring, value-add analysis, bottleneck identification, and cost savings
- costStructureAnalysis: Cost structure analysis with total cost breakdown, fixed vs variable split, and savings potential identification
- partnershipModel: Partnership model design with partner tracking, revenue contribution, model type, and growth rate analysis
- growthLeverAssessment: Growth lever assessment with lever identification, scoring, impact potential, and prioritization
- vendorManagement: Vendor performance tracking with spend analysis, risk scoring, and savings identification
- supplyChainVisibility: Supply chain transparency with tier coverage, blind spots, and lead time tracking
- sustainableSourcing: Sustainable procurement with supplier certification, carbon reduction, and compliance rates
- facilityOptimization: Facility utilization with cost per square foot, space efficiency, and savings potential
- fleetManagement: Fleet operations with utilization rates, cost per mile, and maintenance scoring
- customerSuccess: Customer success metrics with health scoring, NRR, churn rate, and CSAT tracking
- crisisManagement: Crisis preparedness with readiness scoring, scenario planning, and response time metrics
- operationalResilience: Business resilience with recovery time, redundancy levels, and vulnerability assessment
- stakeholderMapping: Stakeholder identification with influence mapping, engagement scoring, and risk tracking
- digitalPresence: Digital channel analysis with presence scoring, engagement rates, and share of voice
- channelStrategy: Channel mix optimization with ROI analysis, coverage gaps, and performance tracking
- accountManagement: Strategic account management with expansion rates, at-risk identification, and health tracking
- fundraisingStrategy: Fundraising readiness with round planning, target raise, and timeline estimation
- captableManagement: Cap table structure with ownership tracking, option pool analysis, and dilution modeling
- exitPlanning: Exit readiness with valuation range, exit type analysis, and preparation timeline
- boardGovernance: Board governance with structure assessment, independence metrics, and meeting cadence
- recruitmentFunnel: Hiring pipeline with conversion rates, time to hire, and offer acceptance tracking
- employerBranding: Employer brand analysis with brand scoring, ratings tracking, and EVP assessment
- teamTopology: Team structure analysis with alignment scoring, collaboration index, and bottleneck identification
- onboardingOptimization: Employee onboarding with completion rates, time to productivity, and satisfaction tracking
- meetingCulture: Meeting efficiency with weekly hours, effectiveness scoring, and decision output rates
- documentManagement: Document organization with scoring, stale doc tracking, and search effectiveness
- workflowAutomation: Workflow automation with automation rates, hours saved, and error rate tracking
- qualityAssurance: QA process maturity with defect rates, test coverage, and automation levels
- incidentResponse: Incident response readiness with response times, recovery rates, and scenario planning
- accessControl: Access control policy assessment with MFA coverage, access reviews, and violation tracking
- auditTrail: Audit trail coverage with event logging, retention periods, and compliance rates
- penetrationTesting: Penetration testing results with vulnerability counts, critical findings, and remediation rates
- securityAwareness: Security awareness training with completion rates, phishing test pass rates, and incidents prevented
- dataClassification: Data classification with asset inventory, classification coverage, and sensitive data tracking
- apiDesign: API design quality with endpoint counts, versioning practices, and documentation coverage
- microservicesArchitecture: Microservices architecture maturity with service counts, coupling scores, and reliability metrics
- cloudOptimization: Cloud optimization with spend analysis, savings potential, and utilization rates
- devopsMaturity: DevOps maturity with deploy frequency, lead time, and change failure rate (DORA metrics)
- systemMonitoring: System monitoring coverage with uptime tracking, alert counts, and mean time to recovery
- codeQuality: Code quality scoring with test coverage, tech debt assessment, and code smell detection
- customerLifetimeValue: Customer lifetime value analysis with CLV:CAC ratios, segment breakdown, and growth rates
- sentimentAnalysis: Customer sentiment analysis with scoring, positive/negative rates, and trend direction
- supportTicketAnalysis: Support ticket analysis with resolution times, CSAT scores, and deflection rates
- segmentProfitability: Segment profitability analysis with margin breakdown, segment ranking, and optimization opportunities
- referralAnalytics: Referral analytics with referral rates, conversion tracking, and revenue attribution
- customerHealthDashboard: Customer health dashboard with health scoring, at-risk identification, and NPS tracking
- innovationPortfolio: Innovation portfolio management with project tracking, ROI analysis, and pipeline value
- contingencyPlanning: Contingency planning readiness with scenario coverage, recovery times, and critical gap identification
- operatingRhythm: Operating rhythm assessment with cadence health, review cycles, and alignment rates
- crossFunctionalSync: Cross-functional sync with team alignment, blocker tracking, and collaboration index
- wardRoomStrategy: War room strategy with initiative tracking, decision velocity, and execution rates
- revenueIntelligence: Revenue intelligence with signal detection, forecast accuracy, and growth potential analysis
- marketResearch: Market research with sizing, growth rates, and key insights
- competitorTracking: Competitor tracking with threat levels and market positioning
- industryTrends: Industry trend analysis with disruption risk and opportunity windows
- socialListening: Social listening with sentiment analysis and share of voice
- uxResearch: UX research with usability ratings and pain point identification
- webAnalytics: Web analytics with traffic, bounce rate, and conversion tracking
- emailMarketing: Email marketing with open rates, click rates, and list management
- conversionOptimization: Conversion rate optimization with revenue impact and quick wins
- abTestingFramework: A/B testing framework with test velocity and win rates
- marketingAttribution: Marketing attribution with channel ROAS and model analysis
- contentCalendar: Content calendar with publishing cadence and content type planning
- socialMediaCalendar: Social media calendar with platform strategy and engagement rates
- budgetPlanning: Budget planning with variance analysis and efficiency scoring
- revenueForecasting: Revenue forecasting with projections and accuracy tracking
- cashManagement: Cash management with liquidity ratios and days cash on hand
- creditManagement: Credit management with utilization and collection rates
- debtStructure: Debt structure analysis with debt-to-equity and interest coverage
- financialReporting: Financial reporting with accuracy and compliance scoring
- carbonReduction: Carbon reduction with footprint tracking and reduction targets
- circularEconomy: Circular economy with material recovery and waste diversion
- communityImpact: Community impact with reach, programs, and social ROI
- waterManagement: Water management with usage tracking and efficiency metrics
- wasteReduction: Waste reduction with diversion rates and cost savings
- sustainableInnovation: Sustainable innovation with green projects and sustainability ROI
- talentPipeline: Talent pipeline with open roles, time to fill, and quality of hire metrics
- leadershipDevelopment: Leadership development with pipeline strength, program coverage, and readiness levels
- successionReadiness: Succession readiness with critical roles, bench strength, and risk assessment
- compensationStrategy: Compensation strategy with market positioning, total comp budget, and equity mix
- workforceAnalytics: Workforce analytics with headcount, attrition rates, and productivity index
- orgEffectiveness: Organizational effectiveness with alignment, span of control, and decision speed
- salesMotionDesign: Sales motion design with model type, cycle length, and conversion rates
- dealAnalytics: Deal analytics with average deal size, win rate, and pipeline value
- territoryOptimization: Territory optimization with coverage rate, balance index, and untapped potential
- salesCompensation: Sales compensation with OTE averages, variable mix, and quota attainment
- revenuePrediction: Revenue prediction with forecast accuracy, confidence levels, and growth rates
- accountPenetration: Account penetration with expansion rates, whitespace value, and account mapping
- productVision: Product vision with clarity index, alignment scoring, and time horizon planning
- featureRoadmap: Feature roadmap with planned features, on-track status, and delivery velocity
- pmfAssessment: PMF assessment with retention signals, segment fit, and growth indicators
- userActivation: User activation with activation rates, time to activate, and drop-off analysis
- productInsights: Product insights with usage patterns, feature gaps, and user satisfaction
- releaseStrategy: Release strategy with cadence planning, quality gates, and rollback rates
- brandPositionMap: Brand position mapping with market position, differentiation, and perception gaps
- brandValuation: Brand valuation with brand value, strength, revenue premium, and growth trajectory
- brandHierarchy: Brand hierarchy with architecture type, sub-brands, and brand level management
- reputationAnalysis: Reputation analysis with sentiment scoring, trust index, and risk factors
- messagingFramework: Messaging framework with consistency, clarity index, and tone alignment
- visualBranding: Visual branding with design system maturity, brand consistency, and asset coverage
- growthPlaybook: Growth playbook with growth levers, execution plans, and confidence scoring
- revenueRunRate: Revenue run rate with MRR, ARR, growth velocity, and trajectory analysis
- breakEvenModel: Break-even model with fixed/variable cost analysis and margin of safety
- operatingLeverageIndex: Operating leverage index with DOL ratio, scalability, and cost structure
- grossMarginAnalysis: Gross margin analysis with COGS ratios, margin trends, and improvement potential
- fundingScenarioModel: Funding scenario model with scenario comparison, dilution impact, and optimal paths
- competitiveWargame: Competitive wargame with threat modeling, scenario testing, and win probability
- marketDisruptionModel: Market disruption model with disruption vectors, impact timeline, and preparedness
- firstMoverAnalysis: First mover analysis with advantage type, window duration, and sustainability
- defensibilityAudit: Defensibility audit with moat types, barrier strength, and vulnerability assessment
- pivotReadiness: Pivot readiness with pivot options, execution speed, and risk assessment
- competitiveTimingModel: Competitive timing model with market windows, response times, and urgency
- customerMaturityModel: Customer maturity model with maturity stages, progression rates, and at-risk segments
- expansionSignals: Expansion signals with signal detection, expansion readiness, and revenue potential
- adoptionScorecard: Adoption scorecard with adoption rates, feature usage, and stickiness metrics
- stakeholderSentiment: Stakeholder sentiment with positive rates, key concerns, and trend direction
- valueRealization: Value realization with ROI tracking, time to value, and value delivered
- renewalPlaybook: Renewal playbook with renewal rates, at-risk identification, and expansion revenue
- businessModelInnovation: Business model innovation with model types, disruption potential, and viability
- monetizationExperiment: Monetization experiment with test velocity, win rates, and revenue impact
- pricingArchitecture: Pricing architecture with tier design, value alignment, and revenue optimization
- revenueStreamMap: Revenue stream map with active streams, diversification, and growth potential
- costDriverAnalysis: Cost driver analysis with top drivers, savings potential, and efficiency index
- valueCapture: Value capture with capture rates, leakage detection, and optimization gaps
- revenueProcessMap: Revenue process map with bottlenecks, cycle time, and automation rate
- billingHealthCheck: Billing health check with error rates, collection rates, and days sales outstanding
- quoteToCloseAnalysis: Quote-to-close analysis with cycle days, win rate, and drop-off stages
- revenueLeakDetector: Revenue leak detector with leaks detected, revenue at risk, and recovery potential
- forecastAccuracyModel: Forecast accuracy model with variance, confidence level, and bias direction
- dealDeskOptimization: Deal desk optimization with approval speed, discount discipline, and deal quality
- talentMarketIntel: Talent market intel with supply, demand pressure, and salary benchmarks
- employeeLifecycleMap: Employee lifecycle map with tenure, attrition rate, and engagement score
- skillsInventory: Skills inventory with skills mapped, gap count, and reskill priority
- teamDynamicsAnalysis: Team dynamics analysis with collaboration index, conflict level, and trust score
- hybridWorkModel: Hybrid work model with remote ratio, productivity index, and satisfaction
- compensationPhilosophy: Compensation philosophy with market position, equity mix, and pay equity
- dataMaturityAssessment: Data maturity assessment with maturity stage, data quality, and governance level
- insightsPrioritization: Insights prioritization with impact potential, actionability, and insights queued
- experimentVelocity: Experiment velocity with experiments running, win rate, and learning cycle
- decisionIntelligence: Decision intelligence with decision speed, data coverage, and outcome quality
- feedbackIntelligence: Feedback intelligence with volume, sentiment, and action rate
- benchmarkingEngine: Benchmarking engine with percentile rank, metrics tracked, and peer group
- partnerValueMap: Partner value map with active partners, value generated, and ROI
- coInnovationPipeline: Co-innovation pipeline with joint projects, pipeline value, and success rate
- ecosystemRevenue: Ecosystem revenue with partner revenue, revenue share, and growth rate
- allianceScorecard: Alliance scorecard with active alliances, performance, and strategic fit
- partnerEnablementPlan: Partner enablement plan with certification rate and time to productivity
- marketplaceReadiness: Marketplace readiness with integration count, listing quality, and marketplace revenue
- strategyExecution: Strategy execution with completion rates, velocity, and on-track items
- initiativeTracking: Initiative tracking with active initiatives, progress rates, and at-risk items
- resourceAllocationModel: Resource allocation model with utilization, efficiency, and rebalance needs
- strategicBetting: Strategic betting with active bets, win rates, and expected value
- executionCadence: Execution cadence with rhythm health, review cycles, and delivery pace
- alignmentIndex: Alignment index with team alignment, goal coherence, and strategy fit
- marketSignalRadar: Market signal radar with signals detected, urgency levels, and opportunity counts
- competitorMoveTracker: Competitor move tracker with moves tracked, threat levels, and response needs
- customerVoiceAggregator: Customer voice aggregator with feedback volume, sentiment, and action items
- industryConvergenceMap: Industry convergence map with industries mapped, overlap areas, and opportunity value
- emergingTechRadar: Emerging tech radar with technologies tracked, readiness levels, and impact potential
- regulatoryHorizon: Regulatory horizon with regulations tracked, compliance risk, and upcoming deadlines
- cashFlowForecaster: Cash flow forecaster with projected cash, accuracy, and risk levels
- profitDriverTree: Profit driver tree with top drivers, margin impact, and optimization potential
- revenueQualityIndex: Revenue quality index with recurring ratio, predictability, and concentration risk
- financialResilienceScore: Financial resilience score with stress tolerance, recovery speed, and buffer adequacy
- workingCapitalOptimizer: Working capital optimizer with cash freed, cycle days, and efficiency gains
- investmentReadinessGate: Investment readiness gate with gates passed, gaps remaining, and timeline
- customerDnaProfile: Customer DNA profile with segments, behavioral patterns, and data completeness
- propensityModel: Propensity model with accuracy, top signals, and revenue potential
- churnEarlyWarning: Churn early warning with at-risk accounts, revenue at risk, and early signals
- customerEffortOptimizer: Customer effort optimizer with friction points, ease of use, and improvement potential
- loyaltyDriver: Loyalty driver with top drivers, retention impact, and NPS correlation
- accountIntelligence: Account intelligence with accounts profiled, growth potential, and risk accounts
- gtmCalendar: Go-to-market launch calendar with milestones, dates, owners
- launchReadiness: Launch readiness gates and go/no-go assessment
- messageTesting: Message variant testing plan for audiences and channels
- salesCollateral: Sales collateral audit and effectiveness analysis
- demandGenPlan: Demand generation plan with channels and budgets
- channelActivation: Channel activation plan with readiness scoring
- priceElasticityModel: Price elasticity analysis with optimal price points
- dynamicPricingEngine: Dynamic pricing rules and guardrails
- discountImpactAnalysis: Discount scenario impact modeling
- bundleDesigner: Product bundle design with pricing and segments
- competitivePriceTracker: Competitive price tracking and positioning
- pricingExperiment: Pricing experiment design and A/B test plan
- kpiWatchlist: KPI watchlist with targets, trends, alerts
- alertFramework: Business alert rules and threshold monitoring
- anomalyDetection: Anomaly detection across business metrics
- trendForecast: Trend forecasting for key metrics (30d/90d)
- dashboardDesign: Dashboard panel design for stakeholders
- insightsCatalog: Actionable business insights ranked by impact
- ideaPipeline: Innovation idea pipeline with feasibility scoring
- innovationScoring: Innovation capability scoring
- experimentBoard: Experiment tracking board with learnings
- patentAnalysis: IP and patent portfolio analysis
- disruptionPlaybook: Disruption scenario playbook
- futureProofing: Future-proofing assessment across dimensions
- revenueMixAnalysis: Revenue mix breakdown with concentration risk
- accountGrowthPlan: Account-level growth plans and expansion strategies
- contractOptimizer: Contract portfolio optimization
- usagePatternAnalysis: Product usage pattern analysis
- churnRecoveryPlan: Churned customer recovery plan
- winbackProgram: Win-back program design by segment
- automationAudit: Automation opportunity audit with ROI
- processDigitization: Process digitization roadmap
- botDeploymentPlan: Bot/RPA deployment plan
- workflowBenchmark: Workflow performance benchmarking
- handoffEfficiency: Cross-team handoff efficiency analysis
- toolConsolidation: Tool consolidation and savings analysis
- crisisCommunication: Crisis communication scenarios and plans
- internalComms: Internal communications effectiveness audit
- investorNarrative: Investor narrative with key story components
- pressStrategy: Press and media strategy
- thoughtLeadershipPlan: Thought leadership content strategy
- brandStoryArc: Brand story arc with narrative chapters
- masteryDashboard: Overall business mastery scoring
- growthVelocityScore: Growth velocity and acceleration metrics
- operationalMaturity: Operational maturity assessment (level 1-5)
- leadershipReadiness: Leadership readiness for next growth stage
- marketDominanceIndex: Market dominance and competitive position
- futureReadiness: Future readiness covering adaptability and resilience
- Wave 101 (AI & ML Readiness): aiAdoptionPotential (AI adoption potential and readiness), mlUseCaseIdentification (ML use case identification), dataInfrastructureGapAnalysis (data infrastructure gaps), automationROIModeling (automation ROI projections), aiTalentNeedsAssessment (AI talent needs), ethicalAIFramework (ethical AI governance)
- Wave 102 (Geographic Expansion): marketEntryScoring (market entry scoring), regulatoryLandscapeMapping (regulatory landscape mapping), culturalAdaptationStrategy (cultural adaptation), logisticsExpansionAnalysis (logistics expansion), localPartnershipStrategy (local partnerships), internationalPricingOptimization (international pricing)
- Wave 103 (Customer Lifecycle): acquisitionFunnelIntelligence (acquisition funnel intelligence), onboardingEffectivenessScore (onboarding effectiveness), engagementScoringModel (engagement scoring), expansionRevenueOpportunities (expansion revenue), advocacyProgramDesign (advocacy program), lifetimeValueModeling (lifetime value modeling)
- Wave 104 (Platform & API Economy): apiMonetizationStrategy (API monetization), platformEcosystemHealth (platform ecosystem health), developerExperienceOptimization (developer experience), integrationMarketplaceAnalytics (integration marketplace), partnerEnablementProgram (partner enablement), platformGovernanceFramework (platform governance)
- Wave 105 (Predictive Analytics): demandForecastingEngine (demand forecasting), predictiveMaintenanceModeling (predictive maintenance), churnPredictionModel (churn prediction), leadScoringAI (lead scoring AI), inventoryOptimizationAI (inventory optimization), revenuePredictionModeling (revenue prediction)
- Wave 106 (Organizational Design): orgStructureAnalysis (org structure analysis), spanOfControlOptimization (span of control), decisionRightsMapping (decision rights), collaborationNetworkMapping (collaboration networks), roleOptimizationAnalysis (role optimization), successionPlanningFramework (succession planning)
- Wave 107 (Social Impact & ESG): impactMeasurementDashboard (impact measurement), esgReportingCompliance (ESG compliance), stakeholderEngagementAnalytics (stakeholder engagement), communityInvestmentStrategy (community investment), diversityMetricsAnalytics (diversity metrics), greenOperationsOptimization (green operations)
- Wave 108 (Knowledge Management): knowledgeAuditAssessment (knowledge audit), expertiseMappingSystem (expertise mapping), documentationStrategyFramework (documentation strategy), learningPathwaysDesign (learning pathways), institutionalMemoryProtection (institutional memory), knowledgeTransferOptimization (knowledge transfer)
- Tools & Automation: toolsAutomationPlan (recommended tools, software, and automations with costs, savings, ROI, and implementation priorities)`;

// ── Tool definitions ──────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: "get_report_section",
    description:
      "Retrieve a specific section of the business intelligence report. Use when you need data to back up coaching advice.",
    parameters: {
      type: "object" as const,
      properties: {
        section: {
          type: "string",
          enum: [
            "healthScore",
            "cashIntelligence",
            "revenueLeakAnalysis",
            "issuesRegister",
            "atRiskCustomers",
            "decisionBrief",
            "actionPlan",
            "marketIntelligence",
            "websiteAnalysis",
            "competitorAnalysis",
            "techOptimization",
            "pricingIntelligence",
            "marketingStrategy",
            "pitchDeckAnalysis",
            "terminology",
            "kpiReport",
            "roadmap",
            "healthChecklist",
            "leadReport",
            "swotAnalysis",
            "unitEconomics",
            "customerSegmentation",
            "competitiveWinLoss",
            "investorOnePager",
            "hiringPlan",
            "revenueForecast",
            "churnPlaybook",
            "salesPlaybook",
            "goalTracker",
            "benchmarkScore",
            "executiveSummary",
            "milestoneTracker",
            "riskRegister",
            "partnershipOpportunities",
            "fundingReadiness",
            "marketSizing",
            "scenarioPlanner",
            "operationalEfficiency",
            "clvAnalysis",
            "retentionPlaybook",
            "revenueAttribution",
            "boardDeck",
            "competitiveMoat",
            "gtmScorecard",
            "cashOptimization",
            "talentGapAnalysis",
            "revenueDiversification",
            "customerJourneyMap",
            "complianceChecklist",
            "expansionPlaybook",
            "vendorScorecard",
            "productMarketFit",
            "brandHealth",
            "pricingElasticity",
            "strategicInitiatives",
            "cashConversionCycle",
            "innovationPipeline",
            "stakeholderMap",
            "decisionLog",
            "cultureAssessment",
            "ipPortfolio",
            "exitReadiness",
            "sustainabilityScore",
            "acquisitionTargets",
            "financialRatios",
            "channelMixModel",
            "supplyChainRisk",
            "regulatoryLandscape",
            "crisisPlaybook",
            "aiReadiness",
            "networkEffects",
            "dataMonetization",
            "subscriptionMetrics",
            "marketTiming",
            "scenarioStressTest",
            "pricingStrategyMatrix", "customerHealthScore", "revenueWaterfall", "techDebtAssessment", "teamPerformance", "marketEntryStrategy",
            "competitiveIntelFeed", "cashFlowSensitivity", "digitalMaturity", "acquisitionFunnel", "strategicAlignment", "budgetOptimizer",
            "revenueDrivers", "marginOptimization", "demandForecasting", "cohortAnalysis", "winLossAnalysis", "salesForecast",
            "processEfficiency", "vendorRisk", "qualityMetrics", "capacityPlanning", "knowledgeManagement", "complianceScorecard",
            "marketPenetration", "flywheelAnalysis", "partnershipsStrategy", "internationalExpansion", "rdEffectiveness", "brandEquity",
            "workingCapital", "debtStrategy", "taxStrategy", "investorReadiness", "maReadiness", "strategicRoadmap",
            "customerVoice", "referralEngine", "priceSensitivityIndex", "customerEffortScore", "accountExpansionMap", "loyaltyProgramDesign",
            "competitivePricingMatrix", "marketSentimentIndex", "disruptionRadar", "ecosystemMap", "categoryCreation", "marketVelocity",
            "okrCascade", "meetingEffectiveness", "communicationAudit", "decisionVelocity", "resourceOptimizer", "changeManagement",
            "cashReserveStrategy", "revenueQualityScore", "costIntelligence", "financialModeling", "profitabilityMap", "capitalAllocation",
            "salesPipelineHealth", "dealVelocity", "winRateOptimizer", "salesEnablement", "territoryPlanning", "quotaIntelligence",
            "featurePrioritization", "productUsageAnalytics", "techStackAudit", "apiStrategy", "platformScalability", "userOnboarding",
            "employeeEngagement", "talentAcquisitionFunnel", "compensationBenchmark", "successionPlanning", "diversityMetrics", "employerBrand",
            "dataGovernance", "analyticsMaturity", "customerDataPlatform", "predictiveModeling", "reportingFramework", "dataQualityScore",
            "supplyChainRisk", "inventoryOptimization", "vendorScorecard", "operationalEfficiency", "qualityManagement", "capacityPlanning",
            "customerJourneyMap", "npsAnalysis", "supportTicketIntelligence", "customerHealthScore", "voiceOfCustomer", "customerSegmentation",
            "innovationPipeline", "ipPortfolio", "rdEfficiency", "technologyReadiness", "partnershipEcosystem", "mergersAcquisitions",
            "esgScorecard", "carbonFootprint", "regulatoryCompliance", "businessContinuity", "ethicsFramework", "socialImpact",
            "dealPipeline", "salesForecasting", "accountBasedMarketing", "salesEnablement", "revenueAttribution", "commissionOptimization",
            "productMarketFit", "featurePrioritization", "userOnboarding", "productAnalytics", "marketTiming", "competitiveResponse",
            "scenarioPlanning", "capitalStructure", "workingCapital", "taxStrategy", "fundraisingReadiness", "exitStrategy",
            "talentAcquisition", "employeeEngagement", "compensationBenchmark", "successionPlanning", "diversityInclusion", "cultureAssessment",
            "marketEntryPlaybook", "partnerChannelStrategy", "acquisitionIntegration", "internationalReadiness", "revenueModelAnalysis", "growthExperiments",
            "customerAcquisitionCost", "lifetimeValueOptimization", "churnPrediction", "netRevenueRetention", "customerAdvocacy", "feedbackLoop",
            "processAutomation", "costBenchmark", "vendorNegotiation", "scalabilityAssessment", "incidentReadiness", "operationalRisk",
            "dataStrategy", "aiUseCases", "analyticsRoadmap", "dataPrivacy", "mlOpsReadiness", "digitalTransformation",
            "revenueOps", "billingOptimization", "contractIntelligence", "commissionTracking", "revenueRecognition", "subscriptionHealth",
            "productRoadmapHealth", "techDebtPrioritization", "releaseVelocity", "bugTrendAnalysis", "apiPerformance", "userExperienceScore",
            "workforcePlanning", "skillsGapAnalysis", "remoteWorkEffectiveness", "teamVelocity", "burnoutRisk", "learningDevelopment",
            "regulatoryRisk", "contractManagement", "ipStrategy", "legalSpendAnalysis", "policyCompliance", "auditReadiness",
            "salesMethodology", "pipelineVelocity", "dealQualification", "salesCoaching", "accountPlanning", "competitiveBattlecards",
            "cashBurnAnalysis", "revenuePerEmployee", "financialBenchmarking", "investmentPortfolio", "costAllocationModel", "marginWaterfall",
            "customerOnboardingMetrics", "healthScoreModel", "csExpansionPlaybook", "renewalForecasting", "csOperations", "customerMilestones",
            "okrFramework", "strategicPillars", "competitivePositioning", "marketShareAnalysis", "growthCorridors", "valuePropCanvas",
            "competitiveMonitoring", "marketTrendRadar", "industryBenchmarkIndex", "customerIntelPlatform", "priceSensitivityModel", "demandSignalAnalysis",
            "digitalMaturityIndex", "cloudMigrationReadiness", "automationRoi", "digitalWorkplace", "cybersecurityPosture", "techVendorConsolidation",
            "revenueSourceMapping", "channelMixOptimization", "crossSellEngine", "priceOptimizationModel", "promotionEffectiveness", "revenueHealthIndex",
            "organizationalNetwork", "decisionEfficiency", "meetingEfficiency", "knowledgeCapital", "changeManagementScore", "cultureAlignment",
            "partnerPerformance", "ecosystemMapping", "allianceStrategy", "channelPartnerHealth", "coSellingPipeline", "integrationMarketplace",
            "brandEquityIndex", "sentimentDashboard", "mediaShareOfVoice", "crisisCommsReadiness", "thoughtLeadership", "brandConsistency",
            "monetizationModel", "freeTrialConversion", "usageBasedPricing", "bundleOptimization", "discountDiscipline", "revenueLeakageDetection",
            "customerAcademy", "contentEngagement", "communityHealth", "certificationProgram", "selfServiceAdoption", "supportDeflection",
            "investorDeck", "fundingTimeline", "valuationModel", "capTableManagement", "investorCommunication", "boardReporting",
            "geoExpansionStrategy", "localMarketEntry", "marketRegulations", "partnerLocalization", "culturalAdaptation", "expansionRoi",
            "productLedMetrics", "activationFunnel", "featureAdoption", "virality", "productQualifiedLeads", "timeToValue",
            "aiReadinessScore", "mlUseCasePriority", "dataInfrastructure", "aiTalentGap", "ethicalAiFramework", "aiRoiProjection",
            "advocacyProgram", "referralMechanism", "testimonialPipeline", "caseStudyFactory", "customerAdvisoryBoard", "npsActionPlan",
            "procurementEfficiency", "expenseManagement", "invoiceAutomation", "paymentOptimization", "financialControls", "treasuryManagement",
            "demandGenEngine", "contentMarketingRoi", "seoStrategy", "paidMediaOptimization", "eventRoi", "influencerStrategy",
            "platformEconomics", "developerExperience", "apiMonetization", "marketplaceStrategy", "platformGovernance", "platformNetworkDynamics",
            "contractLifecycle", "complianceAutomation", "legalRiskRegister", "intellectualPropertyAudit", "regulatoryCalendar", "privacyCompliance",
            "dataWarehouseStrategy", "biDashboardDesign", "predictiveModelCatalog", "dataLineageMap", "metricsDictionary", "analyticsGovernance",
            "employeeJourney", "workplaceWellness", "learningPathways", "performanceFramework", "payEquityAnalysis", "deiBenchmark",
            "businessModelCanvas", "revenueModelDesign", "valueChainOptimization", "costStructureAnalysis", "partnershipModel", "growthLeverAssessment",
            "vendorManagement", "supplyChainVisibility", "sustainableSourcing", "facilityOptimization", "fleetManagement", "customerSuccess",
            "crisisManagement", "operationalResilience", "stakeholderMapping", "digitalPresence", "channelStrategy", "accountManagement",
            "fundraisingStrategy", "captableManagement", "exitPlanning", "boardGovernance", "recruitmentFunnel", "employerBranding",
            "teamTopology", "onboardingOptimization", "meetingCulture", "documentManagement", "workflowAutomation", "qualityAssurance",
            "incidentResponse", "accessControl", "auditTrail", "penetrationTesting", "securityAwareness", "dataClassification",
            "apiDesign", "microservicesArchitecture", "cloudOptimization", "devopsMaturity", "systemMonitoring", "codeQuality",
            "customerLifetimeValue", "sentimentAnalysis", "supportTicketAnalysis", "segmentProfitability", "referralAnalytics", "customerHealthDashboard",
            "innovationPortfolio", "contingencyPlanning", "operatingRhythm", "crossFunctionalSync", "wardRoomStrategy", "revenueIntelligence",
            "marketResearch", "competitorTracking", "industryTrends", "socialListening", "uxResearch", "webAnalytics",
            "emailMarketing", "conversionOptimization", "abTestingFramework", "marketingAttribution", "contentCalendar", "socialMediaCalendar",
            "budgetPlanning", "revenueForecasting", "cashManagement", "creditManagement", "debtStructure", "financialReporting",
            "carbonReduction", "circularEconomy", "communityImpact", "waterManagement", "wasteReduction", "sustainableInnovation",
            "talentPipeline", "leadershipDevelopment", "successionReadiness", "compensationStrategy", "workforceAnalytics", "orgEffectiveness",
            "salesMotionDesign", "dealAnalytics", "territoryOptimization", "salesCompensation", "revenuePrediction", "accountPenetration",
            "productVision", "featureRoadmap", "pmfAssessment", "userActivation", "productInsights", "releaseStrategy",
            "brandPositionMap", "brandValuation", "brandHierarchy", "reputationAnalysis", "messagingFramework", "visualBranding",
            "growthPlaybook", "revenueRunRate", "breakEvenModel", "operatingLeverageIndex", "grossMarginAnalysis", "fundingScenarioModel",
            "competitiveWargame", "marketDisruptionModel", "firstMoverAnalysis", "defensibilityAudit", "pivotReadiness", "competitiveTimingModel",
            "customerMaturityModel", "expansionSignals", "adoptionScorecard", "stakeholderSentiment", "valueRealization", "renewalPlaybook",
            "businessModelInnovation", "monetizationExperiment", "pricingArchitecture", "revenueStreamMap", "costDriverAnalysis", "valueCapture",
            "revenueProcessMap", "billingHealthCheck", "quoteToCloseAnalysis", "revenueLeakDetector", "forecastAccuracyModel", "dealDeskOptimization",
            "talentMarketIntel", "employeeLifecycleMap", "skillsInventory", "teamDynamicsAnalysis", "hybridWorkModel", "compensationPhilosophy",
            "dataMaturityAssessment", "insightsPrioritization", "experimentVelocity", "decisionIntelligence", "feedbackIntelligence", "benchmarkingEngine",
            "partnerValueMap", "coInnovationPipeline", "ecosystemRevenue", "allianceScorecard", "partnerEnablementPlan", "marketplaceReadiness",
            "strategyExecution", "initiativeTracking", "resourceAllocationModel", "strategicBetting", "executionCadence", "alignmentIndex",
            "marketSignalRadar", "competitorMoveTracker", "customerVoiceAggregator", "industryConvergenceMap", "emergingTechRadar", "regulatoryHorizon",
            "cashFlowForecaster", "profitDriverTree", "revenueQualityIndex", "financialResilienceScore", "workingCapitalOptimizer", "investmentReadinessGate",
            "customerDnaProfile", "propensityModel", "churnEarlyWarning", "customerEffortOptimizer", "loyaltyDriver", "accountIntelligence",
            "gtmCalendar", "launchReadiness", "messageTesting", "salesCollateral", "demandGenPlan", "channelActivation",
            "priceElasticityModel", "dynamicPricingEngine", "discountImpactAnalysis", "bundleDesigner", "competitivePriceTracker", "pricingExperiment",
            "kpiWatchlist", "alertFramework", "anomalyDetection", "trendForecast", "dashboardDesign", "insightsCatalog",
            "ideaPipeline", "innovationScoring", "experimentBoard", "patentAnalysis", "disruptionPlaybook", "futureProofing",
            "revenueMixAnalysis", "accountGrowthPlan", "contractOptimizer", "usagePatternAnalysis", "churnRecoveryPlan", "winbackProgram",
            "automationAudit", "processDigitization", "botDeploymentPlan", "workflowBenchmark", "handoffEfficiency", "toolConsolidation",
            "crisisCommunication", "internalComms", "investorNarrative", "pressStrategy", "thoughtLeadershipPlan", "brandStoryArc",
            "masteryDashboard", "growthVelocityScore", "operationalMaturity", "leadershipReadiness", "marketDominanceIndex", "futureReadiness",
            "aiAdoptionPotential", "mlUseCaseIdentification", "dataInfrastructureGapAnalysis", "automationROIModeling", "aiTalentNeedsAssessment", "ethicalAIFramework",
            "marketEntryScoring", "regulatoryLandscapeMapping", "culturalAdaptationStrategy", "logisticsExpansionAnalysis", "localPartnershipStrategy", "internationalPricingOptimization",
            "acquisitionFunnelIntelligence", "onboardingEffectivenessScore", "engagementScoringModel", "expansionRevenueOpportunities", "advocacyProgramDesign", "lifetimeValueModeling",
            "apiMonetizationStrategy", "platformEcosystemHealth", "developerExperienceOptimization", "integrationMarketplaceAnalytics", "partnerEnablementProgram", "platformGovernanceFramework",
            "demandForecastingEngine", "predictiveMaintenanceModeling", "churnPredictionModel", "leadScoringAI", "inventoryOptimizationAI", "revenuePredictionModeling",
            "orgStructureAnalysis", "spanOfControlOptimization", "decisionRightsMapping", "collaborationNetworkMapping", "roleOptimizationAnalysis", "successionPlanningFramework",
            "impactMeasurementDashboard", "esgReportingCompliance", "stakeholderEngagementAnalytics", "communityInvestmentStrategy", "diversityMetricsAnalytics", "greenOperationsOptimization",
            "knowledgeAuditAssessment", "expertiseMappingSystem", "documentationStrategyFramework", "learningPathwaysDesign", "institutionalMemoryProtection", "knowledgeTransferOptimization",
            "toolsAutomationPlan",
          ],
          description: "Which report section to retrieve",
        },
      },
      required: ["section"],
    },
  },
  {
    name: "get_team_data",
    description:
      "Retrieve team member records if any have been uploaded (payroll, org chart, performance reviews). Returns team data or a message indicating no data is available.",
    parameters: {
      type: "object" as const,
      properties: {
        orgId: {
          type: "string",
          description: "The organization ID to look up team data for",
        },
      },
      required: ["orgId"],
    },
  },
  {
    name: "generate_action_items",
    description:
      "Generate a prioritized daily to-do list based on the user's role and current business data. Pulls from the action plan, KPIs, and issues register to create specific tasks.",
    parameters: {
      type: "object" as const,
      properties: {
        role: {
          type: "string",
          enum: ["owner", "employee"],
          description: "Whether to generate action items for an owner or employee",
        },
        focusArea: {
          type: "string",
          description: "Optional focus area like 'revenue', 'team', 'operations', 'marketing'",
        },
      },
      required: ["role"],
    },
  },
  {
    name: "navigate_to_page",
    description:
      "Navigate the user to a specific page or section in the Pivot analysis. Use this when the user asks to see something, go somewhere, view a specific report section, or when showing them relevant data would help. Examples: 'show me the action plan', 'take me to team performance', 'where is the hiring plan'.",
    parameters: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "What the user wants to see or navigate to",
        },
        routeId: {
          type: "string",
          description: "The specific route ID to navigate to, if known (e.g. 'health-score', 'revenue-leaks', 'financial', 'customers', 'market', 'growth', 'marketing', 'operations', 'risk')",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "get_integration_data",
    description:
      "Retrieve live data from connected business tools (Slack, Gmail, QuickBooks, Stripe, Salesforce, HubSpot, GitHub, Jira, etc.). Use when you need real metrics from their connected apps to ground coaching advice.",
    parameters: {
      type: "object" as const,
      properties: {
        provider: {
          type: "string",
          description: "Filter by provider (e.g. 'slack', 'quickbooks', 'stripe'). Leave empty for all providers.",
        },
        recordType: {
          type: "string",
          description: "Filter by record type (e.g. 'channels', 'financial_summary', 'revenue'). Leave empty for all types.",
        },
      },
      required: [],
    },
  },
];

// ── Tool execution ────────────────────────────────────────────────────────────

async function findJobForOrg(orgId: string, runId?: string): Promise<ReturnType<typeof getJob>> {
  if (runId) {
    return getJob(runId);
  }
  const allJobs = await listJobs();
  return (
    allJobs.find((j) => j.questionnaire.orgId === orgId && j.status === "completed") ??
    allJobs.find((j) => j.status === "completed")
  );
}

async function executeTool(
  toolName: string,
  args: Record<string, unknown>,
  orgId: string,
  runId?: string
): Promise<string> {
  if (toolName === "get_report_section") {
    const section = args.section as string;
    const job = await findJobForOrg(orgId, runId);

    if (!job?.deliverables) return `No completed report found for section: ${section}`;

    const d = job.deliverables as MVPDeliverables;
    const sectionData = (d as any)[section];
    if (!sectionData) return `Section "${section}" not found in this report.`;

    // Truncate to avoid token overflow (smart: keeps head + tail context)
    const json = JSON.stringify(sectionData, null, 2);
    return `[Report Section: ${section}]\n${smartTruncate(json, 3000)}`;
  }

  if (toolName === "get_team_data") {
    // Team data would come from uploaded HR/payroll documents
    // For now, check if the report has any employee-related data
    const job = await findJobForOrg(orgId, runId);

    if (!job?.deliverables) {
      return "No team data available. The business owner needs to upload payroll records, org charts, or performance reviews for team analysis.";
    }

    const d = job.deliverables as MVPDeliverables;
    const parts: string[] = [];

    // Check for employee count in health score dimensions
    if (d.healthScore?.dimensions) {
      const teamDim = d.healthScore.dimensions.find(
        (dim) => dim.name.toLowerCase().includes("team") || dim.name.toLowerCase().includes("people")
      );
      if (teamDim) parts.push(`Team Health: ${teamDim.score}/100 - ${teamDim.keyFinding || teamDim.summary || "N/A"}`);
    }

    // Check KPIs for team-related metrics
    if (d.kpiReport?.kpis) {
      const teamKpis = d.kpiReport.kpis.filter(
        (k) => k.category === "Operations" || k.name.toLowerCase().includes("team") || k.name.toLowerCase().includes("employee")
      );
      if (teamKpis.length > 0) {
        parts.push(`Team KPIs: ${teamKpis.map((k) => `${k.name}: ${k.currentValue || "Unknown"} (${k.status})`).join("; ")}`);
      }
    }

    // Check action plan for team-related tasks
    if (d.actionPlan?.days) {
      const teamTasks = d.actionPlan.days.flatMap((day) =>
        day.tasks.filter((t) => t.owner !== "Owner" || t.description.toLowerCase().includes("team") || t.description.toLowerCase().includes("hire"))
      );
      if (teamTasks.length > 0) {
        parts.push(`Team-related actions: ${teamTasks.slice(0, 5).map((t) => t.description).join("; ")}`);
      }
    }

    if (parts.length === 0) {
      return "No specific team member data found in the current report. Upload payroll, performance reviews, or org chart data for detailed team analysis.";
    }

    return `[Team Data from Report]\n${parts.join("\n")}`;
  }

  if (toolName === "generate_action_items") {
    const role = args.role as string;
    const focusArea = args.focusArea as string | undefined;
    const job = await findJobForOrg(orgId, runId);

    if (!job?.deliverables) {
      return "No report data available to generate action items. Complete a business analysis first.";
    }

    const d = job.deliverables as MVPDeliverables;
    const items: string[] = [];

    // Pull from action plan
    if (d.actionPlan?.days) {
      const todayTasks = d.actionPlan.days.slice(0, 3).flatMap((day) =>
        day.tasks.map((t) => `[Day ${day.day}] ${t.description} (${t.owner})`)
      );
      items.push(...todayTasks.slice(0, 5));
    }

    // Pull critical issues
    if (d.issuesRegister?.issues) {
      const critical = d.issuesRegister.issues
        .filter((i) => i.severity === "Critical" || i.severity === "HIGH")
        .slice(0, 3);
      critical.forEach((i) => {
        items.push(`[URGENT] ${i.title || i.description} - ${i.recommendedAction || i.recommendation || "Address immediately"}`);
      });
    }

    // Pull KPI focus
    if (d.kpiReport?.kpis) {
      const atRisk = d.kpiReport.kpis.filter((k) => k.status === "at_risk" || k.status === "behind").slice(0, 2);
      atRisk.forEach((k) => {
        items.push(`[KPI] ${k.name}: Currently ${k.currentValue || "unknown"}, target ${k.targetValue || "TBD"} - ${k.status}`);
      });
    }

    // Filter by focus area if specified
    let filtered = items;
    if (focusArea) {
      filtered = items.filter((i) => i.toLowerCase().includes(focusArea.toLowerCase()));
      if (filtered.length === 0) filtered = items; // fall back to all
    }

    if (filtered.length === 0) {
      return "No specific action items could be generated from the current report data. Try running a full business analysis first.";
    }

    return `[Action Items for ${role}${focusArea ? ` - Focus: ${focusArea}` : ""}]\n${filtered.join("\n")}`;
  }

  if (toolName === "navigate_to_page") {
    const query = args.query as string;
    const routeId = args.routeId as string | undefined;

    const route = routeId ? findRouteById(routeId) : findRoute(query);
    if (!route) {
      return `No matching page found for "${query}". Available sections: Health Score, Cash Intelligence, Revenue Leaks, Issues, At-Risk Clients, Decision Brief, Action Plan, Financial Intelligence, Customers & Revenue, Market & Competition, Growth & Strategy, Marketing & Brand, Operations & Team, Risk & Compliance.`;
    }

    return `<!--NAVIGATE:${JSON.stringify(route)}-->\nNavigating to ${route.label}: ${route.description}`;
  }

  if (toolName === "get_integration_data") {
    const provider = args.provider as string | undefined;
    const recordType = args.recordType as string | undefined;

    try {
      const ctx = await collectIntegrationContext(orgId);
      if (ctx.records.length === 0) {
        return "No integration data available. Suggest connecting business tools (Slack, QuickBooks, Stripe, etc.) from the Upload page for data-driven coaching.";
      }

      let filtered = ctx.records;
      if (provider) filtered = filtered.filter((r) => r.provider === provider);
      if (recordType) filtered = filtered.filter((r) => r.recordType === recordType);

      if (filtered.length === 0) {
        return `No data found for ${provider ? `provider "${provider}"` : ""}${recordType ? ` record type "${recordType}"` : ""}. Connected providers: ${ctx.providers.join(", ")}`;
      }

      const result = filtered.map((r) => ({
        provider: r.provider,
        type: r.recordType,
        syncedAt: r.syncedAt,
        data: typeof r.data === 'string' ? r.data.slice(0, 1500) : JSON.stringify(r.data).slice(0, 1500),
      }));

      return `[Integration Data — ${filtered.length} records]\n${JSON.stringify(result, null, 2)}`;
    } catch (e) {
      return `Failed to retrieve integration data: ${String(e)}`;
    }
  }

  return `Unknown tool: ${toolName}`;
}

// ── Response sanitizer ────────────────────────────────────────────────────────

function sanitize(text: string): string {
  return text
    .replace(/\*\*/g, "")
    .replace(/\*/g, "")
    .replace(/\u2014/g, " - ")   // em dash
    .replace(/\u2013/g, " - ")   // en dash
    .replace(/---/g, " - ")
    .replace(/--/g, " - ")
    .trim();
}

// ── Public interface ──────────────────────────────────────────────────────────

export interface CoachMessage {
  role: "user" | "assistant";
  content: string;
}

export interface CoachRequest {
  orgId: string;
  runId?: string;
  messages: CoachMessage[];
  message: string;
  memberRole?: "owner" | "employee";
  memberName?: string;
}

export interface CoachResponse {
  message: string;
  toolsUsed: string[];
}

// ── Smart context builder (replaces ~500 lines of manual field checks) ───────

/** Extract a concise summary from a priority section based on known field patterns */
function extractSectionSummary(key: string, val: any): string | null {
  if (!val || typeof val !== "object") return null;
  try {
    switch (key) {
      case "healthScore":
        return `Health Score: ${val.score ?? "?"}/100 (${val.grade || "N/A"})`;
      case "cashIntelligence":
        return `Cash Runway: ${val.runwayWeeks ?? "?"} weeks, Monthly burn: ${val.monthlyBurn || "N/A"}`;
      case "revenueLeakAnalysis":
        return `Revenue at Risk: $${val.totalIdentified?.toLocaleString() || "?"}, Leaks: ${val.leaks?.length ?? 0}`;
      case "actionPlan":
        return `Action Plan: ${val.days?.reduce((n: number, day: any) => n + (day.tasks?.length ?? 0), 0) ?? 0} tasks across ${val.days?.length ?? 0} days`;
      case "issuesRegister": {
        const critical = val.issues?.filter((i: any) => i.severity === "Critical" || i.severity === "HIGH")?.length ?? 0;
        return `Issues: ${val.issues?.length ?? 0} total, ${critical} critical`;
      }
      case "kpiReport":
        return `KPIs: ${val.kpis?.length ?? 0} defined, ${val.kpis?.filter((k: any) => k.status === "at_risk" || k.status === "behind")?.length ?? 0} at risk`;
      case "executiveSummary":
        return `Executive Summary: ${val.summary ? String(val.summary).slice(0, 200) : "Available"}`;
      case "hiringPlan":
        return `Hiring Plan: ${val.recommendations?.length ?? 0} roles recommended, ${val.currentTeamGaps?.length ?? 0} gaps`;
      case "healthChecklist":
        return `Health Checklist: ${val.score ?? "?"}/100 (${val.grade || "N/A"})`;
      case "goalTracker":
        return `Goals: ${val.objectives?.length ?? 0} objectives, Theme: ${val.quarterlyTheme || "N/A"}`;
      case "benchmarkScore":
        return `Benchmark: ${val.overallScore ?? "?"}/100 (${val.overallPercentile || "N/A"})`;
      case "riskRegister": {
        const highRisks = val.risks?.filter((r: any) => r.severity === "Critical" || r.severity === "High")?.length ?? 0;
        return `Risks: ${val.risks?.length ?? 0} total, ${highRisks} high/critical`;
      }
      case "swotAnalysis":
        return `SWOT: ${val.strengths?.length ?? 0} strengths, ${val.weaknesses?.length ?? 0} weaknesses, ${val.opportunities?.length ?? 0} opportunities, ${val.threats?.length ?? 0} threats`;
      case "salesPlaybook":
        return `Sales Playbook: Available${val.stages?.length ? `, ${val.stages.length} stages` : ""}`;
      case "churnPlaybook":
        return `Churn Playbook: Available${val.plays?.length ? `, ${val.plays.length} plays` : ""}`;
      case "fundingReadiness":
        return `Funding Readiness: ${val.readinessScore ?? "N/A"}/100 (${val.stage || "N/A"})`;
      case "gtmScorecard":
        return `GTM Score: ${val.overallScore ?? "N/A"}/100`;
      case "cashOptimization":
        return `Cash Optimization: ${val.opportunities?.length ?? 0} opportunities`;
      case "toolsAutomationPlan":
        return `Tools & Automation: ${val.tools?.length ?? 0} tools, Cost: $${val.totalMonthlyCost ?? "N/A"}/mo, Savings: $${val.totalMonthlySavings ?? "N/A"}/mo, ROI: ${val.roiMonths ?? "N/A"} months`;
      default:
        return null;
    }
  } catch {
    return `${key}: Available`;
  }
}

/** Build business context from deliverables using smart auto-detection */
function buildBusinessContext(d: MVPDeliverables): string {
  const parts: string[] = [];

  // Priority sections - always include detailed summary
  const prioritySections = [
    "healthScore", "cashIntelligence", "revenueLeakAnalysis", "actionPlan",
    "issuesRegister", "kpiReport", "executiveSummary", "hiringPlan",
    "healthChecklist", "goalTracker", "benchmarkScore", "riskRegister",
    "swotAnalysis", "salesPlaybook", "churnPlaybook", "fundingReadiness",
    "gtmScorecard", "cashOptimization", "toolsAutomationPlan",
  ];

  for (const key of prioritySections) {
    const val = (d as any)[key];
    if (!val) continue;
    const summary = extractSectionSummary(key, val);
    if (summary) parts.push(summary);
  }

  // All other sections - auto-detect and summarize intelligently
  const otherKeys = Object.keys(d).filter(
    (k) => !prioritySections.includes(k) && (d as any)[k] != null
  );

  if (otherKeys.length > 0) {
    parts.push(`\nAdditional analysis sections available (${otherKeys.length}): ${otherKeys.slice(0, 60).join(", ")}${otherKeys.length > 60 ? ` ... and ${otherKeys.length - 60} more` : ""}`);

    // Extract summary or score from each available section (up to 40)
    const summaryLines: string[] = [];
    for (const key of otherKeys.slice(0, 40)) {
      const val = (d as any)[key];
      if (!val || typeof val !== "object") continue;
      if (val.summary) {
        summaryLines.push(`  ${key}: ${String(val.summary).slice(0, 150)}`);
      } else if (val.overallScore !== undefined) {
        summaryLines.push(`  ${key}: Score ${val.overallScore}/100${val.grade ? ` (${val.grade})` : ""}`);
      } else if (val.score !== undefined) {
        summaryLines.push(`  ${key}: Score ${val.score}/100`);
      } else if (val.overallHealth !== undefined) {
        summaryLines.push(`  ${key}: Health ${val.overallHealth}`);
      } else if (val.readinessScore !== undefined) {
        summaryLines.push(`  ${key}: Readiness ${val.readinessScore}/100`);
      } else if (val.overallRiskScore !== undefined) {
        summaryLines.push(`  ${key}: Risk ${val.overallRiskScore}/100`);
      }
    }
    if (summaryLines.length > 0) {
      parts.push(summaryLines.join("\n"));
    }
  }

  return parts.join("\n");
}

/** Detect critical business patterns that need proactive coaching */
function getBusinessTriggers(d: MVPDeliverables): string | null {
  const triggers: string[] = [];

  if (d.healthScore?.score != null && d.healthScore.score < 50)
    triggers.push(`CRITICAL: Business health score is ${d.healthScore.score}/100 - needs immediate attention across multiple areas`);

  if (d.cashIntelligence?.runwayWeeks != null && d.cashIntelligence.runwayWeeks < 8)
    triggers.push(`URGENT: Cash runway is only ${d.cashIntelligence.runwayWeeks} weeks - address cash burn immediately`);

  if (d.revenueLeakAnalysis?.totalIdentified != null && d.revenueLeakAnalysis.totalIdentified > 50000)
    triggers.push(`ALERT: $${d.revenueLeakAnalysis.totalIdentified.toLocaleString()} in revenue leaks identified - prioritize recovery`);

  const issues = (d as any).issuesRegister?.issues;
  if (Array.isArray(issues)) {
    const critCount = issues.filter((i: any) => i.severity === "Critical" || i.severity === "HIGH").length;
    if (critCount >= 3) triggers.push(`WARNING: ${critCount} critical issues in the issues register need urgent attention`);
  }

  const risks = (d as any).riskRegister?.risks;
  if (Array.isArray(risks)) {
    const highRisks = risks.filter((r: any) => r.severity === "Critical" || r.severity === "High").length;
    if (highRisks >= 3) triggers.push(`RISK ALERT: ${highRisks} high/critical risks identified in risk register`);
  }

  const kpis = d.kpiReport?.kpis;
  if (Array.isArray(kpis)) {
    const atRisk = kpis.filter((k) => k.status === "at_risk" || k.status === "behind").length;
    if (atRisk >= 3) triggers.push(`KPI ALERT: ${atRisk} KPIs are behind or at risk - review priorities`);
  }

  if ((d as any).benchmarkScore?.overallScore != null && (d as any).benchmarkScore.overallScore < 40)
    triggers.push(`BENCHMARK: Business scores ${(d as any).benchmarkScore.overallScore}/100 vs industry peers - significant gaps to close`);

  if ((d as any).exitReadiness?.overallScore != null && (d as any).exitReadiness.overallScore < 30)
    triggers.push(`EXIT READINESS: Score is ${(d as any).exitReadiness.overallScore}/100 - major preparation needed before any exit event`);

  if (triggers.length === 0) return null;
  return `--- Proactive Coaching Triggers ---\n${triggers.join("\n")}`;
}

export async function chatWithCoach(params: CoachRequest): Promise<CoachResponse> {
  const { orgId, runId, messages, message, memberRole, memberName } = params;
  const toolsUsed: string[] = [];

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { message: "Coach is not available. GEMINI_API_KEY is not configured.", toolsUsed };
  }

  // Build business context using smart auto-detection
  let reportContext = "";
  let triggerContext = "";
  const job = await findJobForOrg(orgId, runId);
  if (job?.deliverables) {
    const d = job.deliverables as MVPDeliverables;
    reportContext = `\n\nBUSINESS CONTEXT:\n${buildBusinessContext(d)}`;
    const triggers = getBusinessTriggers(d);
    if (triggers) triggerContext = `\n\n${triggers}`;
  }

  // Situational awareness (BetterBot-style)
  const now = new Date();
  const timeStr = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const dayStr = now.toLocaleDateString("en-US", { weekday: "long" });
  const situationalAwareness = `\n\n--- Situational Awareness ---\n${timeStr}, ${dayStr}, ${dateStr}\nConversation: ${messages.length} messages so far`;

  const roleContext =
    memberRole === "owner"
      ? "\nThe user is the BUSINESS OWNER. They can ask about team performance, hiring/firing, and strategic decisions."
      : memberName
        ? `\nThe user is ${memberName}, an EMPLOYEE. Coach them on their personal performance and daily priorities.`
        : "";

  const systemPrompt = COACH_SYSTEM_PROMPT_HEADER + reportContext + triggerContext + situationalAwareness + roleContext;

  // Build conversation history for Gemini
  const trimmedHistory = messages.slice(-16);
  const chatMessages = trimmedHistory.map((m) => ({
    role: (m.role === "assistant" ? "model" : "user") as "user" | "model",
    parts: [{ text: m.content }],
  }));
  chatMessages.push({ role: "user", parts: [{ text: message }] });

  try {
    // First call — may request tool use
    const resp = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: chatMessages,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.4,
        maxOutputTokens: 1500,
        thinkingConfig: { thinkingBudget: 0 },
        tools: [{ functionDeclarations: TOOLS }],
        toolConfig: { functionCallingMode: "AUTO" },
      } as Record<string, unknown>,
    });

    // Check for tool calls
    const candidate = resp.candidates?.[0];
    const parts = candidate?.content?.parts ?? [];
    const fnCalls = parts.filter((p: any) => p.functionCall);

    if (fnCalls.length > 0) {
      // Execute all requested tools with guardrails
      const guard = new LoopGuard();
      const toolResults = await Promise.all(
        fnCalls.map(async (part: any) => {
          let { name, args: toolArgs } = part.functionCall;

          // Fuzzy match tool name if not recognized
          if (!COACH_TOOL_NAMES.includes(name)) {
            const matched = closestToolName(name, COACH_TOOL_NAMES);
            if (matched) {
              console.warn(`[Coach] Tool name corrected: "${name}" -> "${matched}"`);
              name = matched;
            }
          }

          // Loop guard check
          const guardResult = guard.check(name, toolArgs);
          if (!guardResult.allowed) {
            console.warn(`[Coach] LoopGuard blocked: ${guardResult.warning}`);
            return { name, result: `Tool call blocked by safety guard: ${guardResult.warning}` };
          }
          if (guardResult.warning) {
            console.warn(`[Coach] LoopGuard warning: ${guardResult.warning}`);
          }

          toolsUsed.push(name);
          const result = await executeTool(name, toolArgs as Record<string, unknown>, orgId, runId);
          return { name, result };
        })
      );

      // Second call with tool results
      const contentsWithTools = [
        ...chatMessages,
        { role: "model" as const, parts },
        {
          role: "user" as const,
          parts: toolResults.map((tr) => ({
            functionResponse: { name: tr.name, response: { result: tr.result } },
          })),
        },
      ];

      const resp2 = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: contentsWithTools,
        config: {
          systemInstruction: systemPrompt,
          temperature: 0.4,
          maxOutputTokens: 1500,
          thinkingConfig: { thinkingBudget: 0 },
        } as Record<string, unknown>,
      });

      return {
        message: sanitize(resp2.text ?? "I couldn't generate a response. Please try again."),
        toolsUsed,
      };
    }

    return {
      message: sanitize(resp.text ?? "I couldn't generate a response. Please try again."),
      toolsUsed,
    };
  } catch (err) {
    console.error("[Coach] Agent error:", err);
    return {
      message: "Coach is temporarily unavailable. Please try again.",
      toolsUsed,
    };
  }
}
