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
import type { MVPDeliverables } from "@/lib/types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

const COACH_SYSTEM_PROMPT = `You are Coach, a direct and data-driven business performance advisor for Pivot.

CRITICAL ANTI-HALLUCINATION RULES:
- ONLY reference data that exists in the business report or uploaded team records
- If asked about employee performance and no performance data exists, say: "I don't have performance data for your team yet. Upload payroll, performance reviews, or CRM activity data so I can give you real numbers instead of guesses."
- NEVER invent employee names, salaries, performance metrics, or team statistics
- If data is insufficient, say so clearly — do NOT fill gaps with plausible-sounding numbers
- Be brutally honest but constructive — frame everything in terms of business impact and ROI

FOR OWNERS:
- Analyze team cost vs output (only with real data)
- Recommend who to invest in or let go (only with evidence)
- Identify performance gaps and hiring needs
- Create prioritized daily/weekly action items
- Answer "who should I fire?" honestly — but only if you have the data

FOR EMPLOYEES:
- Show their assigned KPIs and progress
- Suggest specific daily actions to improve their metrics
- Coach on skills relevant to their role
- Explain how their work impacts business outcomes

STYLE RULES:
- Lead with numbers, not feelings
- Give specific next steps, not vague advice
- Reference actual business data from the report
- When you don't know something, say so — don't guess
- Keep responses focused and actionable (not long essays)
- Use bullet points and structure when listing actions
- Do NOT use em dashes, en dashes, double dashes, or asterisks. Use plain text only.

You have access to the business report via the get_report_section tool. Use it to ground your advice in real data.

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
- aiRoiProjection: AI ROI projection modeling with cost-benefit analysis, implementation timeline, and value realization forecasting`;

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
];

// ── Tool execution ────────────────────────────────────────────────────────────

function findJobForOrg(orgId: string, runId?: string): ReturnType<typeof getJob> {
  if (runId) {
    return getJob(runId);
  }
  const allJobs = listJobs();
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
    const job = findJobForOrg(orgId, runId);

    if (!job?.deliverables) return `No completed report found for section: ${section}`;

    const d = job.deliverables as MVPDeliverables;
    const sectionData = (d as any)[section];
    if (!sectionData) return `Section "${section}" not found in this report.`;

    // Truncate to avoid token overflow
    const json = JSON.stringify(sectionData, null, 2);
    return `[Report Section: ${section}]\n${json.slice(0, 3000)}`;
  }

  if (toolName === "get_team_data") {
    // Team data would come from uploaded HR/payroll documents
    // For now, check if the report has any employee-related data
    const job = findJobForOrg(orgId, runId);

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
    const job = findJobForOrg(orgId, runId);

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

export async function chatWithCoach(params: CoachRequest): Promise<CoachResponse> {
  const { orgId, runId, messages, message, memberRole, memberName } = params;
  const toolsUsed: string[] = [];

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { message: "Coach is not available. GEMINI_API_KEY is not configured.", toolsUsed };
  }

  // Build business context from report
  let reportContext = "";
  const job = findJobForOrg(orgId, runId);
  if (job?.deliverables) {
    const d = job.deliverables as MVPDeliverables;
    const parts: string[] = [];
    if (d.healthScore) parts.push(`Health Score: ${d.healthScore.score}/100 (${d.healthScore.grade || "N/A"})`);
    if (d.cashIntelligence) parts.push(`Cash Runway: ${d.cashIntelligence.runwayWeeks ?? "?"} weeks`);
    if (d.revenueLeakAnalysis) parts.push(`Revenue at Risk: $${d.revenueLeakAnalysis.totalIdentified?.toLocaleString() || "?"}`);
    if (d.kpiReport) parts.push(`KPIs defined: ${d.kpiReport.kpis?.length || 0}`);
    if (d.healthChecklist) parts.push(`Health Checklist: ${d.healthChecklist.score}/100 (${d.healthChecklist.grade})`);
    if (d.hiringPlan) parts.push(`Hiring Plan: ${d.hiringPlan.recommendations?.length || 0} hiring recommendations, ${d.hiringPlan.currentTeamGaps?.length || 0} team gaps identified`);
    if (d.goalTracker) parts.push(`Goal Tracker: ${d.goalTracker.objectives?.length || 0} objectives, theme: ${d.goalTracker.quarterlyTheme || "N/A"}`);
    if (d.benchmarkScore) parts.push(`Benchmark Score: ${d.benchmarkScore.overallScore}/100 (${d.benchmarkScore.overallPercentile || "N/A"})`);
    if ((d as any).milestoneTracker) parts.push(`Milestone Tracker: ${(d as any).milestoneTracker.milestones?.length || 0} milestones tracked`);
    if ((d as any).riskRegister) parts.push(`Risk Register: ${(d as any).riskRegister.risks?.length || 0} risks identified`);
    if ((d as any).gtmScorecard) parts.push(`GTM Scorecard: ${(d as any).gtmScorecard.overallScore ?? "N/A"}/100`);
    if ((d as any).fundingReadiness) parts.push(`Funding Readiness: ${(d as any).fundingReadiness.readinessScore ?? "N/A"}/100 (${(d as any).fundingReadiness.stage || "N/A"})`);
    if ((d as any).cashOptimization) parts.push(`Cash Optimization: ${(d as any).cashOptimization.opportunities?.length || 0} optimization opportunities identified`);
    if ((d as any).talentGapAnalysis) parts.push(`Talent Gap Analysis: Team strengths: ${(d as any).talentGapAnalysis.currentTeamStrengths?.length || 0} identified, Roles to hire: ${(d as any).talentGapAnalysis.roleRecommendations?.length || 0}`);
    if ((d as any).complianceChecklist) parts.push(`Compliance Checklist: Overall readiness: ${(d as any).complianceChecklist.overallReadiness ?? "N/A"}, Immediate actions: ${(d as any).complianceChecklist.immediateActions?.length || 0}`);
    if ((d as any).vendorScorecard) parts.push(`Vendor Scorecard: Total spend: ${(d as any).vendorScorecard.totalVendorSpend || "?"}, Potential savings: ${(d as any).vendorScorecard.totalPotentialSavings || "?"}`);
    if ((d as any).productMarketFit) parts.push(`Product-Market Fit: Overall score: ${(d as any).productMarketFit.overallScore ?? "N/A"}, Grade: ${(d as any).productMarketFit.grade || "N/A"}`);
    if ((d as any).brandHealth) parts.push(`Brand Health: Overall score: ${(d as any).brandHealth.overallScore ?? "N/A"}, Brand strength: ${(d as any).brandHealth.brandStrength || "N/A"}`);
    if ((d as any).innovationPipeline) parts.push(`Innovation Pipeline: Innovation score: ${(d as any).innovationPipeline.innovationScore ?? "N/A"}, Projects: ${(d as any).innovationPipeline.projects?.length || 0}`);
    if ((d as any).exitReadiness) parts.push(`Exit Readiness: Score: ${(d as any).exitReadiness.overallScore ?? "N/A"}/100, Valuation range: ${(d as any).exitReadiness.valuationRange || "N/A"}`);
    if ((d as any).cultureAssessment) parts.push(`Culture Assessment: Score: ${(d as any).cultureAssessment.overallScore ?? "N/A"}/100, Culture type: ${(d as any).cultureAssessment.cultureType || "N/A"}`);
    if ((d as any).sustainabilityScore) parts.push(`Sustainability Score: Score: ${(d as any).sustainabilityScore.overallScore ?? "N/A"}/100, Grade: ${(d as any).sustainabilityScore.grade || "N/A"}`);
    if ((d as any).acquisitionTargets) parts.push(`M&A Strategy: ${(d as any).acquisitionTargets.strategy || "N/A"}, Targets identified: ${(d as any).acquisitionTargets.targets?.length ?? 0}`);
    if ((d as any).financialRatios) parts.push(`Financial Health: ${(d as any).financialRatios.overallHealth || "N/A"}`);
    if ((d as any).channelMixModel) parts.push(`Top Channel: ${(d as any).channelMixModel.topPerformingChannel || "N/A"}`);
    if ((d as any).supplyChainRisk) parts.push(`Supply Chain Risk: ${(d as any).supplyChainRisk.overallRiskScore ?? "N/A"}/100`);
    if ((d as any).regulatoryLandscape) parts.push(`Compliance Score: ${(d as any).regulatoryLandscape.overallComplianceScore ?? "N/A"}/100`);
    if ((d as any).crisisPlaybook) parts.push(`Crisis Scenarios: ${(d as any).crisisPlaybook.scenarios?.length ?? 0} prepared`);
    if ((d as any).aiReadiness) parts.push(`AI Readiness: ${(d as any).aiReadiness.overallScore ?? "N/A"}/100`);
    if ((d as any).networkEffects) parts.push(`Network Effects: ${(d as any).networkEffects.moatStrength || "N/A"} moat, Score: ${(d as any).networkEffects.overallScore ?? "N/A"}/100`);
    if ((d as any).dataMonetization) parts.push(`Data Monetization: ${(d as any).dataMonetization.totalOpportunityValue || "N/A"} opportunity`);
    if ((d as any).subscriptionMetrics) parts.push(`SaaS Health: ${(d as any).subscriptionMetrics.overallHealth || "N/A"}`);
    if ((d as any).marketTiming) parts.push(`Market Timing: ${(d as any).marketTiming.overallTiming || "N/A"}`);
    if ((d as any).scenarioStressTest) parts.push(`Stress Resilience: ${(d as any).scenarioStressTest.resilience || "N/A"}, Baseline Runway: ${(d as any).scenarioStressTest.baselineCashRunway || "N/A"}`);
    if ((d as any).pricingStrategyMatrix) parts.push(`Pricing Strategy: ${(d as any).pricingStrategyMatrix.recommendedStrategy || "N/A"}`);
    if ((d as any).customerHealthScore) parts.push(`Customer Portfolio Health: ${(d as any).customerHealthScore.overallPortfolioHealth ?? "N/A"}/100, At-risk: ${(d as any).customerHealthScore.atRiskCount ?? 0}`);
    if ((d as any).revenueWaterfall) parts.push(`Net Revenue Retention: ${(d as any).revenueWaterfall.netRevenueRetention || "N/A"}`);
    if ((d as any).techDebtAssessment) parts.push(`Tech Debt Score: ${(d as any).techDebtAssessment.overallScore ?? "N/A"}/100, Cost: ${(d as any).techDebtAssessment.totalEstimatedCost || "N/A"}`);
    if ((d as any).teamPerformance) parts.push(`Team Performance: ${(d as any).teamPerformance.overallScore ?? "N/A"}/100`);
    if ((d as any).marketEntryStrategy) parts.push(`Market Entry Readiness: ${(d as any).marketEntryStrategy.readinessScore ?? "N/A"}/100, Priority: ${(d as any).marketEntryStrategy.priorityMarket || "N/A"}`);
    if ((d as any).competitiveIntelFeed) parts.push(`Competitive Threat Level: ${(d as any).competitiveIntelFeed.threatLevel || "N/A"}, Signals: ${(d as any).competitiveIntelFeed.signals?.length ?? 0}`);
    if ((d as any).cashFlowSensitivity) parts.push(`Cash Sensitivity: Most sensitive to ${(d as any).cashFlowSensitivity.mostSensitiveVariable || "N/A"}`);
    if ((d as any).digitalMaturity) parts.push(`Digital Maturity: ${(d as any).digitalMaturity.overallScore ?? "N/A"}/100`);
    if ((d as any).acquisitionFunnel) parts.push(`Acquisition Funnel: ${(d as any).acquisitionFunnel.overallConversionRate || "N/A"} conversion, CPA: ${(d as any).acquisitionFunnel.costPerAcquisition || "N/A"}`);
    if ((d as any).strategicAlignment) parts.push(`Strategic Alignment: ${(d as any).strategicAlignment.overallScore ?? "N/A"}/100`);
    if ((d as any).budgetOptimizer) parts.push(`Budget: ${(d as any).budgetOptimizer.totalBudget || "N/A"}, Savings: ${(d as any).budgetOptimizer.savingsOpportunity || "N/A"}`);
    if ((d as any).revenueDrivers) parts.push(`Revenue Drivers: Top driver: ${(d as any).revenueDrivers.topDriver || "N/A"}, Concentration risk: ${(d as any).revenueDrivers.concentrationRisk || "N/A"}`);
    if ((d as any).marginOptimization) parts.push(`Margin Optimization: Gross margin: ${(d as any).marginOptimization.grossMargin || "N/A"}, Net margin: ${(d as any).marginOptimization.netMargin || "N/A"}`);
    if ((d as any).demandForecasting) parts.push(`Demand Forecast: Trend: ${(d as any).demandForecasting.trendDirection || "N/A"}, Confidence: ${(d as any).demandForecasting.confidence || "N/A"}`);
    if ((d as any).cohortAnalysis) parts.push(`Cohort Analysis: Retention rate: ${(d as any).cohortAnalysis.overallRetention || "N/A"}, Best cohort: ${(d as any).cohortAnalysis.bestCohort || "N/A"}`);
    if ((d as any).winLossAnalysis) parts.push(`Win/Loss: Win rate: ${(d as any).winLossAnalysis.winRate || "N/A"}, Top loss reason: ${(d as any).winLossAnalysis.topLossReason || "N/A"}`);
    if ((d as any).salesForecast) parts.push(`Sales Forecast: Pipeline value: ${(d as any).salesForecast.pipelineValue || "N/A"}, Forecast accuracy: ${(d as any).salesForecast.forecastAccuracy || "N/A"}`);
    if ((d as any).processEfficiency) parts.push(`Process Efficiency: Score: ${(d as any).processEfficiency.overallScore ?? "N/A"}/100, Bottlenecks: ${(d as any).processEfficiency.bottlenecks?.length ?? 0}`);
    if ((d as any).vendorRisk) parts.push(`Vendor Risk: Overall risk: ${(d as any).vendorRisk.overallRisk || "N/A"}, Critical vendors: ${(d as any).vendorRisk.criticalVendors?.length ?? 0}`);
    if ((d as any).qualityMetrics) parts.push(`Quality Metrics: CSAT: ${(d as any).qualityMetrics.csat || "N/A"}, NPS: ${(d as any).qualityMetrics.nps ?? "N/A"}`);
    if ((d as any).capacityPlanning) parts.push(`Capacity Planning: Utilization: ${(d as any).capacityPlanning.currentUtilization || "N/A"}, Scaling trigger: ${(d as any).capacityPlanning.scalingTrigger || "N/A"}`);
    if ((d as any).knowledgeManagement) parts.push(`Knowledge Management: Documentation coverage: ${(d as any).knowledgeManagement.coverageScore ?? "N/A"}%, Tribal knowledge risks: ${(d as any).knowledgeManagement.tribalKnowledgeRisks?.length ?? 0}`);
    if ((d as any).complianceScorecard) parts.push(`Compliance Scorecard: Score: ${(d as any).complianceScorecard.overallScore ?? "N/A"}/100, Gaps: ${(d as any).complianceScorecard.gaps?.length ?? 0}`);
    if ((d as any).marketPenetration) parts.push(`Market Penetration: Current share: ${(d as any).marketPenetration.currentShare || "N/A"}, Penetration rate: ${(d as any).marketPenetration.penetrationRate || "N/A"}`);
    if ((d as any).flywheelAnalysis) parts.push(`Flywheel Analysis: Momentum: ${(d as any).flywheelAnalysis.momentum || "N/A"}, Friction points: ${(d as any).flywheelAnalysis.frictionPoints?.length ?? 0}`);
    if ((d as any).partnershipsStrategy) parts.push(`Partnerships Strategy: Partners identified: ${(d as any).partnershipsStrategy.partnerCandidates?.length ?? 0}, Ecosystem: ${(d as any).partnershipsStrategy.ecosystemStrategy || "N/A"}`);
    if ((d as any).internationalExpansion) parts.push(`International Expansion: Priority market: ${(d as any).internationalExpansion.priorityMarket || "N/A"}, Readiness: ${(d as any).internationalExpansion.readinessScore ?? "N/A"}/100`);
    if ((d as any).rdEffectiveness) parts.push(`R&D Effectiveness: ROI: ${(d as any).rdEffectiveness.rdRoi || "N/A"}, Success rate: ${(d as any).rdEffectiveness.projectSuccessRate || "N/A"}`);
    if ((d as any).brandEquity) parts.push(`Brand Equity: Score: ${(d as any).brandEquity.overallScore ?? "N/A"}/100, Awareness: ${(d as any).brandEquity.awareness || "N/A"}`);
    if ((d as any).workingCapital) parts.push(`Working Capital: Cash conversion cycle: ${(d as any).workingCapital.cashConversionCycle || "N/A"} days, DSO: ${(d as any).workingCapital.dso || "N/A"}`);
    if ((d as any).debtStrategy) parts.push(`Debt Strategy: Total debt: ${(d as any).debtStrategy.totalDebt || "N/A"}, Capacity: ${(d as any).debtStrategy.debtCapacity || "N/A"}`);
    if ((d as any).taxStrategy) parts.push(`Tax Strategy: Effective rate: ${(d as any).taxStrategy.effectiveRate || "N/A"}, Savings opportunities: ${(d as any).taxStrategy.savingsOpportunities?.length ?? 0}`);
    if ((d as any).investorReadiness) parts.push(`Investor Readiness: Score: ${(d as any).investorReadiness.overallScore ?? "N/A"}/100, Gaps: ${(d as any).investorReadiness.gaps?.length ?? 0}`);
    if ((d as any).maReadiness) parts.push(`M&A Readiness: Score: ${(d as any).maReadiness.overallScore ?? "N/A"}/100, Valuation: ${(d as any).maReadiness.estimatedValuation || "N/A"}`);
    if ((d as any).strategicRoadmap) parts.push(`Strategic Roadmap: Pillars: ${(d as any).strategicRoadmap.strategicPillars?.length ?? 0}, Next milestone: ${(d as any).strategicRoadmap.nextMilestone || "N/A"}`);
    if ((d as any).customerVoice) parts.push(`Customer Voice: Sentiment: ${(d as any).customerVoice.overallSentiment || "N/A"}, NPS: ${(d as any).customerVoice.nps ?? "N/A"}, Themes: ${(d as any).customerVoice.topThemes?.length ?? 0}`);
    if ((d as any).referralEngine) parts.push(`Referral Engine: Viral coefficient: ${(d as any).referralEngine.viralCoefficient ?? "N/A"}, Referral rate: ${(d as any).referralEngine.referralRate || "N/A"}`);
    if ((d as any).priceSensitivityIndex) parts.push(`Price Sensitivity: Index: ${(d as any).priceSensitivityIndex.overallIndex ?? "N/A"}, Most sensitive segment: ${(d as any).priceSensitivityIndex.mostSensitiveSegment || "N/A"}`);
    if ((d as any).customerEffortScore) parts.push(`Customer Effort Score: Overall: ${(d as any).customerEffortScore.overallScore ?? "N/A"}, Highest friction: ${(d as any).customerEffortScore.highestFrictionPoint || "N/A"}`);
    if ((d as any).accountExpansionMap) parts.push(`Account Expansion: Expansion potential: ${(d as any).accountExpansionMap.totalExpansionPotential || "N/A"}, Ready accounts: ${(d as any).accountExpansionMap.readyAccounts?.length ?? 0}`);
    if ((d as any).loyaltyProgramDesign) parts.push(`Loyalty Program: Recommended model: ${(d as any).loyaltyProgramDesign.recommendedModel || "N/A"}, Retention impact: ${(d as any).loyaltyProgramDesign.projectedRetentionImpact || "N/A"}`);
    if ((d as any).competitivePricingMatrix) parts.push(`Competitive Pricing: Position: ${(d as any).competitivePricingMatrix.pricePosition || "N/A"}, Gap: ${(d as any).competitivePricingMatrix.pricingGap || "N/A"}`);
    if ((d as any).marketSentimentIndex) parts.push(`Market Sentiment: Score: ${(d as any).marketSentimentIndex.overallSentiment ?? "N/A"}/100, Trend: ${(d as any).marketSentimentIndex.trend || "N/A"}`);
    if ((d as any).disruptionRadar) parts.push(`Disruption Radar: Threats: ${(d as any).disruptionRadar.threats?.length ?? 0}, Urgency: ${(d as any).disruptionRadar.highestUrgency || "N/A"}`);
    if ((d as any).ecosystemMap) parts.push(`Ecosystem Map: Partners: ${(d as any).ecosystemMap.partners?.length ?? 0}, Platform opportunities: ${(d as any).ecosystemMap.platformOpportunities?.length ?? 0}`);
    if ((d as any).categoryCreation) parts.push(`Category Creation: Feasibility: ${(d as any).categoryCreation.feasibilityScore ?? "N/A"}/100, Strategy: ${(d as any).categoryCreation.strategy || "N/A"}`);
    if ((d as any).marketVelocity) parts.push(`Market Velocity: Growth rate: ${(d as any).marketVelocity.growthRate || "N/A"}, Momentum: ${(d as any).marketVelocity.momentum || "N/A"}`);
    if ((d as any).okrCascade) parts.push(`OKR Cascade: Objectives: ${(d as any).okrCascade.objectives?.length ?? 0}, Alignment score: ${(d as any).okrCascade.alignmentScore ?? "N/A"}/100`);
    if ((d as any).meetingEffectiveness) parts.push(`Meeting Effectiveness: Score: ${(d as any).meetingEffectiveness.overallScore ?? "N/A"}/100, Hours/week: ${(d as any).meetingEffectiveness.totalHoursPerWeek ?? "N/A"}`);
    if ((d as any).communicationAudit) parts.push(`Communication Audit: Score: ${(d as any).communicationAudit.overallScore ?? "N/A"}/100, Gaps: ${(d as any).communicationAudit.gaps?.length ?? 0}`);
    if ((d as any).decisionVelocity) parts.push(`Decision Velocity: Speed: ${(d as any).decisionVelocity.averageDecisionTime || "N/A"}, Bottlenecks: ${(d as any).decisionVelocity.bottlenecks?.length ?? 0}`);
    if ((d as any).resourceOptimizer) parts.push(`Resource Optimizer: Utilization: ${(d as any).resourceOptimizer.overallUtilization || "N/A"}, Rebalancing opportunities: ${(d as any).resourceOptimizer.rebalancingOpportunities?.length ?? 0}`);
    if ((d as any).changeManagement) parts.push(`Change Management: Readiness: ${(d as any).changeManagement.readinessScore ?? "N/A"}/100, Active changes: ${(d as any).changeManagement.activeChanges?.length ?? 0}`);
    if ((d as any).cashReserveStrategy) parts.push(`Cash Reserve Strategy: Target reserve: ${(d as any).cashReserveStrategy.targetReserve || "N/A"}, Current reserve: ${(d as any).cashReserveStrategy.currentReserve || "N/A"}`);
    if ((d as any).revenueQualityScore) parts.push(`Revenue Quality: Score: ${(d as any).revenueQualityScore.overallScore ?? "N/A"}/100, Recurring: ${(d as any).revenueQualityScore.recurringPercentage || "N/A"}`);
    if ((d as any).costIntelligence) parts.push(`Cost Intelligence: Total costs: ${(d as any).costIntelligence.totalCosts || "N/A"}, Reduction opportunities: ${(d as any).costIntelligence.reductionOpportunities?.length ?? 0}`);
    if ((d as any).financialModeling) parts.push(`Financial Modeling: Scenarios: ${(d as any).financialModeling.scenarios?.length ?? 0}, Base case: ${(d as any).financialModeling.baseCase || "N/A"}`);
    if ((d as any).profitabilityMap) parts.push(`Profitability Map: Most profitable: ${(d as any).profitabilityMap.mostProfitable || "N/A"}, Least profitable: ${(d as any).profitabilityMap.leastProfitable || "N/A"}`);
    if ((d as any).capitalAllocation) parts.push(`Capital Allocation: Total capital: ${(d as any).capitalAllocation.totalCapital || "N/A"}, Top priority: ${(d as any).capitalAllocation.topPriority || "N/A"}`);
    if ((d as any).salesPipelineHealth) parts.push(`Sales Pipeline: Value: ${(d as any).salesPipelineHealth.totalPipelineValue || "N/A"}, Coverage: ${(d as any).salesPipelineHealth.coverage || "N/A"}`);
    if ((d as any).dealVelocity) parts.push(`Deal Velocity: Avg cycle: ${(d as any).dealVelocity.avgDealCycle || "N/A"}, Fastest: ${(d as any).dealVelocity.fastestSegment || "N/A"}`);
    if ((d as any).winRateOptimizer) parts.push(`Win Rate: Overall: ${(d as any).winRateOptimizer.overallWinRate || "N/A"}, Competitive: ${(d as any).winRateOptimizer.competitiveWinRate || "N/A"}`);
    if ((d as any).salesEnablement) parts.push(`Sales Enablement: Readiness: ${(d as any).salesEnablement.readinessScore ?? "N/A"}/100, Gaps: ${(d as any).salesEnablement.trainingGaps?.length ?? 0}`);
    if ((d as any).territoryPlanning) parts.push(`Territory Planning: Balance: ${(d as any).territoryPlanning.balanceScore ?? "N/A"}/100, Untapped: ${(d as any).territoryPlanning.untappedPotential || "N/A"}`);
    if ((d as any).quotaIntelligence) parts.push(`Quota Intelligence: Attainment: ${(d as any).quotaIntelligence.overallAttainment || "N/A"}, Fit: ${(d as any).quotaIntelligence.quotaToTerritoryFit || "N/A"}`);
    if ((d as any).featurePrioritization) parts.push(`Feature Priority: Top: ${(d as any).featurePrioritization.topPriority || "N/A"}, Quick wins: ${(d as any).featurePrioritization.quickWins?.length ?? 0}`);
    if ((d as any).productUsageAnalytics) parts.push(`Product Usage: DAU: ${(d as any).productUsageAnalytics.dau || "N/A"}, MAU: ${(d as any).productUsageAnalytics.mau || "N/A"}`);
    if ((d as any).techStackAudit) parts.push(`Tech Stack: Cost: ${(d as any).techStackAudit.totalCost || "N/A"}, Redundancies: ${(d as any).techStackAudit.redundancies?.length ?? 0}`);
    if ((d as any).apiStrategy) parts.push(`API Strategy: APIs: ${(d as any).apiStrategy.apiCount ?? "N/A"}, Model: ${(d as any).apiStrategy.monetizationModel || "N/A"}`);
    if ((d as any).platformScalability) parts.push(`Scalability: Score: ${(d as any).platformScalability.overallScore ?? "N/A"}/100, Headroom: ${(d as any).platformScalability.peakCapacity || "N/A"}`);
    if ((d as any).userOnboarding) parts.push(`Onboarding: Completion: ${(d as any).userOnboarding.completionRate || "N/A"}, Time to value: ${(d as any).userOnboarding.timeToValue || "N/A"}`);
    if ((d as any).employeeEngagement) parts.push(`Engagement: Score: ${(d as any).employeeEngagement.overallScore ?? "N/A"}/100, eNPS: ${(d as any).employeeEngagement.eNPS || "N/A"}`);
    if ((d as any).talentAcquisitionFunnel) parts.push(`Talent Acquisition: Time to hire: ${(d as any).talentAcquisitionFunnel.overallTimeToHire || "N/A"}, Cost: ${(d as any).talentAcquisitionFunnel.costPerHire || "N/A"}`);
    if ((d as any).compensationBenchmark) parts.push(`Compensation: Position: ${(d as any).compensationBenchmark.overallPosition || "N/A"}, Budget: ${(d as any).compensationBenchmark.totalCompBudget || "N/A"}`);
    if ((d as any).successionPlanning) parts.push(`Succession: Critical roles: ${(d as any).successionPlanning.criticalRoles ?? "N/A"}, Bench: ${(d as any).successionPlanning.benchStrength || "N/A"}`);
    if ((d as any).diversityMetrics) parts.push(`Diversity: Score: ${(d as any).diversityMetrics.overallScore ?? "N/A"}/100, Inclusion: ${(d as any).diversityMetrics.inclusionIndex || "N/A"}`);
    if ((d as any).employerBrand) parts.push(`Employer Brand: Score: ${(d as any).employerBrand.overallScore ?? "N/A"}/100, Glassdoor: ${(d as any).employerBrand.glassdoorRating || "N/A"}`);
    if ((d as any).dataGovernance) parts.push(`Data Governance: Maturity: ${(d as any).dataGovernance.maturityLevel || "N/A"}, Gaps: ${(d as any).dataGovernance.complianceGaps?.length ?? 0}`);
    if ((d as any).analyticsMaturity) parts.push(`Analytics Maturity: Level: ${(d as any).analyticsMaturity.overallLevel ?? "N/A"}/5, Gaps: ${(d as any).analyticsMaturity.skillGaps?.length ?? 0}`);
    if ((d as any).customerDataPlatform) parts.push(`CDP: Profiles: ${(d as any).customerDataPlatform.unifiedProfiles || "N/A"}, Completeness: ${(d as any).customerDataPlatform.dataCompleteness || "N/A"}`);
    if ((d as any).predictiveModeling) parts.push(`Predictive: Models: ${(d as any).predictiveModeling.models?.length ?? 0}, ROI: ${(d as any).predictiveModeling.expectedROI || "N/A"}`);
    if ((d as any).reportingFramework) parts.push(`Reporting: Reports: ${(d as any).reportingFramework.reports?.length ?? 0}, Self-service: ${(d as any).reportingFramework.selfServiceRate || "N/A"}`);
    if ((d as any).dataQualityScore) parts.push(`Data Quality: Score: ${(d as any).dataQualityScore.overallScore ?? "N/A"}/100, Issues: ${(d as any).dataQualityScore.criticalIssues?.length ?? 0}`);
    if ((d as any).supplyChainRisk) parts.push(`Supply Chain Risk Score: ${(d as any).supplyChainRisk.overallRiskScore}/100, Single-Source Dependencies: ${(d as any).supplyChainRisk.singleSourceDependencies}`);
    if ((d as any).inventoryOptimization) parts.push(`Inventory: Carrying Cost ${(d as any).inventoryOptimization.totalCarryingCost}, Turnover ${(d as any).inventoryOptimization.turnoverRatio}x`);
    if ((d as any).vendorScorecard) parts.push(`Vendors: ${(d as any).vendorScorecard.totalVendors} total, Top: ${(d as any).vendorScorecard.topPerformer}`);
    if ((d as any).operationalEfficiency) parts.push(`Ops Efficiency Score: ${(d as any).operationalEfficiency.overallScore}/100, Waste: ${(d as any).operationalEfficiency.totalWaste}`);
    if ((d as any).qualityManagement) parts.push(`Quality: Defect Rate ${(d as any).qualityManagement.overallDefectRate}, Six Sigma: ${(d as any).qualityManagement.sixSigmaLevel}`);
    if ((d as any).capacityPlanning) parts.push(`Capacity: ${(d as any).capacityPlanning.overallUtilization} utilized, Headroom: ${(d as any).capacityPlanning.growthHeadroom}`);
    if ((d as any).customerJourneyMap) parts.push(`Journey Satisfaction: ${(d as any).customerJourneyMap.overallSatisfaction}/100`);
    if ((d as any).npsAnalysis) parts.push(`NPS: ${(d as any).npsAnalysis.overallNps}, Promoters: ${(d as any).npsAnalysis.promoterPercentage}`);
    if ((d as any).supportTicketIntelligence) parts.push(`Support: ${(d as any).supportTicketIntelligence.totalTickets} tickets, Avg Resolution: ${(d as any).supportTicketIntelligence.avgResolutionTime}`);
    if ((d as any).customerHealthScore) parts.push(`Customer Health: ${(d as any).customerHealthScore.overallScore}/100, At Risk: ${(d as any).customerHealthScore.atRiskPercentage}`);
    if ((d as any).voiceOfCustomer) parts.push(`VoC Sentiment Trend: ${(d as any).voiceOfCustomer.sentimentTrend}`);
    if ((d as any).customerSegmentation) parts.push(`Segments: High Value ${(d as any).customerSegmentation.highValuePercentage}, Growth: ${(d as any).customerSegmentation.growthSegment}`);
    if ((d as any).innovationPipeline) parts.push(`Innovation: ${(d as any).innovationPipeline.totalIdeas} ideas, Kill Rate: ${(d as any).innovationPipeline.killRate}`);
    if ((d as any).ipPortfolio) parts.push(`IP Assets: ${(d as any).ipPortfolio.totalAssets}`);
    if ((d as any).rdEfficiency) parts.push(`R&D: ${(d as any).rdEfficiency.totalSpend}, Success Rate: ${(d as any).rdEfficiency.successRate}`);
    if ((d as any).technologyReadiness) parts.push(`Tech Readiness: ${(d as any).technologyReadiness.overallReadiness}/100, Debt: ${(d as any).technologyReadiness.techDebtTotal}`);
    if ((d as any).partnershipEcosystem) parts.push(`Partners: ${(d as any).partnershipEcosystem.totalPartners}, Revenue: ${(d as any).partnershipEcosystem.revenueFromPartners}`);
    if ((d as any).mergersAcquisitions) parts.push(`M&A: Top Target: ${(d as any).mergersAcquisitions.topTarget}, Synergy: ${(d as any).mergersAcquisitions.totalSynergyPotential}`);
    if ((d as any).esgScorecard) parts.push(`ESG Score: ${(d as any).esgScorecard.overallScore}/100, Rank: ${(d as any).esgScorecard.industryRank}`);
    if ((d as any).carbonFootprint) parts.push(`Carbon: ${(d as any).carbonFootprint.totalEmissions}, Target: ${(d as any).carbonFootprint.reductionTarget}`);
    if ((d as any).regulatoryCompliance) parts.push(`Compliance: ${(d as any).regulatoryCompliance.overallStatus}, Fine Exposure: ${(d as any).regulatoryCompliance.fineExposure}`);
    if ((d as any).businessContinuity) parts.push(`BC Readiness: ${(d as any).businessContinuity.overallReadiness}`);
    if ((d as any).ethicsFramework) parts.push(`Ethics Maturity: ${(d as any).ethicsFramework.overallMaturity}`);
    if ((d as any).socialImpact) parts.push(`Social Impact: ${(d as any).socialImpact.overallScore}/100, Investment: ${(d as any).socialImpact.communityInvestment}`);
    if ((d as any).dealPipeline) parts.push(`Deal Pipeline: ${JSON.stringify((d as any).dealPipeline).slice(0, 300)}`);
    if ((d as any).salesForecasting) parts.push(`Sales Forecasting: ${JSON.stringify((d as any).salesForecasting).slice(0, 300)}`);
    if ((d as any).accountBasedMarketing) parts.push(`Account Based Marketing: ${JSON.stringify((d as any).accountBasedMarketing).slice(0, 300)}`);
    if ((d as any).salesEnablement) parts.push(`Sales Enablement: ${JSON.stringify((d as any).salesEnablement).slice(0, 300)}`);
    if ((d as any).revenueAttribution) parts.push(`Revenue Attribution: ${JSON.stringify((d as any).revenueAttribution).slice(0, 300)}`);
    if ((d as any).commissionOptimization) parts.push(`Commission Optimization: ${JSON.stringify((d as any).commissionOptimization).slice(0, 300)}`);
    if ((d as any).productMarketFit) parts.push(`Product Market Fit: ${JSON.stringify((d as any).productMarketFit).slice(0, 300)}`);
    if ((d as any).featurePrioritization) parts.push(`Feature Prioritization: ${JSON.stringify((d as any).featurePrioritization).slice(0, 300)}`);
    if ((d as any).userOnboarding) parts.push(`User Onboarding: ${JSON.stringify((d as any).userOnboarding).slice(0, 300)}`);
    if ((d as any).productAnalytics) parts.push(`Product Analytics: ${JSON.stringify((d as any).productAnalytics).slice(0, 300)}`);
    if ((d as any).marketTiming) parts.push(`Market Timing: ${JSON.stringify((d as any).marketTiming).slice(0, 300)}`);
    if ((d as any).competitiveResponse) parts.push(`Competitive Response: ${JSON.stringify((d as any).competitiveResponse).slice(0, 300)}`);
    if ((d as any).scenarioPlanning) parts.push(`Scenario Planning: ${JSON.stringify((d as any).scenarioPlanning).slice(0, 300)}`);
    if ((d as any).capitalStructure) parts.push(`Capital Structure: ${JSON.stringify((d as any).capitalStructure).slice(0, 300)}`);
    if ((d as any).workingCapital) parts.push(`Working Capital: ${JSON.stringify((d as any).workingCapital).slice(0, 300)}`);
    if ((d as any).taxStrategy) parts.push(`Tax Strategy: ${JSON.stringify((d as any).taxStrategy).slice(0, 300)}`);
    if ((d as any).fundraisingReadiness) parts.push(`Fundraising Readiness: ${JSON.stringify((d as any).fundraisingReadiness).slice(0, 300)}`);
    if ((d as any).exitStrategy) parts.push(`Exit Strategy: ${JSON.stringify((d as any).exitStrategy).slice(0, 300)}`);
    if ((d as any).talentAcquisition) parts.push(`Talent Acquisition: ${JSON.stringify((d as any).talentAcquisition).slice(0, 300)}`);
    if ((d as any).employeeEngagement) parts.push(`Employee Engagement: ${JSON.stringify((d as any).employeeEngagement).slice(0, 300)}`);
    if ((d as any).compensationBenchmark) parts.push(`Compensation Benchmark: ${JSON.stringify((d as any).compensationBenchmark).slice(0, 300)}`);
    if ((d as any).successionPlanning) parts.push(`Succession Planning: ${JSON.stringify((d as any).successionPlanning).slice(0, 300)}`);
    if ((d as any).diversityInclusion) parts.push(`Diversity Inclusion: ${JSON.stringify((d as any).diversityInclusion).slice(0, 300)}`);
    if ((d as any).cultureAssessment) parts.push(`Culture Assessment: ${JSON.stringify((d as any).cultureAssessment).slice(0, 300)}`);
    if ((d as any).marketEntryPlaybook) parts.push(`Market Entry: ${JSON.stringify((d as any).marketEntryPlaybook).slice(0, 300)}`);
    if ((d as any).partnerChannelStrategy) parts.push(`Partner Channels: ${JSON.stringify((d as any).partnerChannelStrategy).slice(0, 300)}`);
    if ((d as any).acquisitionIntegration) parts.push(`Acquisition Integration: ${JSON.stringify((d as any).acquisitionIntegration).slice(0, 300)}`);
    if ((d as any).internationalReadiness) parts.push(`International Readiness: ${JSON.stringify((d as any).internationalReadiness).slice(0, 300)}`);
    if ((d as any).revenueModelAnalysis) parts.push(`Revenue Model: ${JSON.stringify((d as any).revenueModelAnalysis).slice(0, 300)}`);
    if ((d as any).growthExperiments) parts.push(`Growth Experiments: ${JSON.stringify((d as any).growthExperiments).slice(0, 300)}`);
    if ((d as any).customerAcquisitionCost) parts.push(`CAC Analysis: ${JSON.stringify((d as any).customerAcquisitionCost).slice(0, 300)}`);
    if ((d as any).lifetimeValueOptimization) parts.push(`LTV Optimization: ${JSON.stringify((d as any).lifetimeValueOptimization).slice(0, 300)}`);
    if ((d as any).churnPrediction) parts.push(`Churn Prediction: ${JSON.stringify((d as any).churnPrediction).slice(0, 300)}`);
    if ((d as any).netRevenueRetention) parts.push(`Net Revenue Retention: ${JSON.stringify((d as any).netRevenueRetention).slice(0, 300)}`);
    if ((d as any).customerAdvocacy) parts.push(`Customer Advocacy: ${JSON.stringify((d as any).customerAdvocacy).slice(0, 300)}`);
    if ((d as any).feedbackLoop) parts.push(`Feedback Loop: ${JSON.stringify((d as any).feedbackLoop).slice(0, 300)}`);
    if ((d as any).processAutomation) parts.push(`Process Automation: ${JSON.stringify((d as any).processAutomation).slice(0, 300)}`);
    if ((d as any).costBenchmark) parts.push(`Cost Benchmark: ${JSON.stringify((d as any).costBenchmark).slice(0, 300)}`);
    if ((d as any).vendorNegotiation) parts.push(`Vendor Negotiation: ${JSON.stringify((d as any).vendorNegotiation).slice(0, 300)}`);
    if ((d as any).scalabilityAssessment) parts.push(`Scalability: ${JSON.stringify((d as any).scalabilityAssessment).slice(0, 300)}`);
    if ((d as any).incidentReadiness) parts.push(`Incident Readiness: ${JSON.stringify((d as any).incidentReadiness).slice(0, 300)}`);
    if ((d as any).operationalRisk) parts.push(`Operational Risk: ${JSON.stringify((d as any).operationalRisk).slice(0, 300)}`);
    if ((d as any).dataStrategy) parts.push(`Data Strategy: ${JSON.stringify((d as any).dataStrategy).slice(0, 300)}`);
    if ((d as any).aiUseCases) parts.push(`AI Use Cases: ${JSON.stringify((d as any).aiUseCases).slice(0, 300)}`);
    if ((d as any).analyticsRoadmap) parts.push(`Analytics Roadmap: ${JSON.stringify((d as any).analyticsRoadmap).slice(0, 300)}`);
    if ((d as any).dataPrivacy) parts.push(`Data Privacy: ${JSON.stringify((d as any).dataPrivacy).slice(0, 300)}`);
    if ((d as any).mlOpsReadiness) parts.push(`MLOps Readiness: ${JSON.stringify((d as any).mlOpsReadiness).slice(0, 300)}`);
    if ((d as any).digitalTransformation) parts.push(`Digital Transformation: ${JSON.stringify((d as any).digitalTransformation).slice(0, 300)}`);
    if ((d as any).revenueOps) parts.push(`Revenue Ops: ${JSON.stringify((d as any).revenueOps).slice(0, 300)}`);
    if ((d as any).billingOptimization) parts.push(`Billing Optimization: ${JSON.stringify((d as any).billingOptimization).slice(0, 300)}`);
    if ((d as any).contractIntelligence) parts.push(`Contract Intelligence: ${JSON.stringify((d as any).contractIntelligence).slice(0, 300)}`);
    if ((d as any).commissionTracking) parts.push(`Commission Tracking: ${JSON.stringify((d as any).commissionTracking).slice(0, 300)}`);
    if ((d as any).revenueRecognition) parts.push(`Revenue Recognition: ${JSON.stringify((d as any).revenueRecognition).slice(0, 300)}`);
    if ((d as any).subscriptionHealth) parts.push(`Subscription Health: ${JSON.stringify((d as any).subscriptionHealth).slice(0, 300)}`);
    if ((d as any).productRoadmapHealth) parts.push(`Product Roadmap Health: ${JSON.stringify((d as any).productRoadmapHealth).slice(0, 300)}`);
    if ((d as any).techDebtPrioritization) parts.push(`Tech Debt Prioritization: ${JSON.stringify((d as any).techDebtPrioritization).slice(0, 300)}`);
    if ((d as any).releaseVelocity) parts.push(`Release Velocity: ${JSON.stringify((d as any).releaseVelocity).slice(0, 300)}`);
    if ((d as any).bugTrendAnalysis) parts.push(`Bug Trend Analysis: ${JSON.stringify((d as any).bugTrendAnalysis).slice(0, 300)}`);
    if ((d as any).apiPerformance) parts.push(`API Performance: ${JSON.stringify((d as any).apiPerformance).slice(0, 300)}`);
    if ((d as any).userExperienceScore) parts.push(`User Experience Score: ${JSON.stringify((d as any).userExperienceScore).slice(0, 300)}`);
    if ((d as any).workforcePlanning) parts.push(`Workforce Planning: ${JSON.stringify((d as any).workforcePlanning).slice(0, 300)}`);
    if ((d as any).skillsGapAnalysis) parts.push(`Skills Gap Analysis: ${JSON.stringify((d as any).skillsGapAnalysis).slice(0, 300)}`);
    if ((d as any).remoteWorkEffectiveness) parts.push(`Remote Work Effectiveness: ${JSON.stringify((d as any).remoteWorkEffectiveness).slice(0, 300)}`);
    if ((d as any).teamVelocity) parts.push(`Team Velocity: ${JSON.stringify((d as any).teamVelocity).slice(0, 300)}`);
    if ((d as any).burnoutRisk) parts.push(`Burnout Risk: ${JSON.stringify((d as any).burnoutRisk).slice(0, 300)}`);
    if ((d as any).learningDevelopment) parts.push(`Learning Development: ${JSON.stringify((d as any).learningDevelopment).slice(0, 300)}`);
    if ((d as any).regulatoryRisk) parts.push(`Regulatory Risk: ${JSON.stringify((d as any).regulatoryRisk).slice(0, 300)}`);
    if ((d as any).contractManagement) parts.push(`Contract Management: ${JSON.stringify((d as any).contractManagement).slice(0, 300)}`);
    if ((d as any).ipStrategy) parts.push(`IP Strategy: ${JSON.stringify((d as any).ipStrategy).slice(0, 300)}`);
    if ((d as any).legalSpendAnalysis) parts.push(`Legal Spend Analysis: ${JSON.stringify((d as any).legalSpendAnalysis).slice(0, 300)}`);
    if ((d as any).policyCompliance) parts.push(`Policy Compliance: ${JSON.stringify((d as any).policyCompliance).slice(0, 300)}`);
    if ((d as any).auditReadiness) parts.push(`Audit Readiness: ${JSON.stringify((d as any).auditReadiness).slice(0, 300)}`);
    if ((d as any).salesMethodology) parts.push(`Sales Methodology: ${JSON.stringify((d as any).salesMethodology).slice(0, 300)}`);
    if ((d as any).pipelineVelocity) parts.push(`Pipeline Velocity: ${JSON.stringify((d as any).pipelineVelocity).slice(0, 300)}`);
    if ((d as any).dealQualification) parts.push(`Deal Qualification: ${JSON.stringify((d as any).dealQualification).slice(0, 300)}`);
    if ((d as any).salesCoaching) parts.push(`Sales Coaching: ${JSON.stringify((d as any).salesCoaching).slice(0, 300)}`);
    if ((d as any).accountPlanning) parts.push(`Account Planning: ${JSON.stringify((d as any).accountPlanning).slice(0, 300)}`);
    if ((d as any).competitiveBattlecards) parts.push(`Competitive Battlecards: ${JSON.stringify((d as any).competitiveBattlecards).slice(0, 300)}`);
    if ((d as any).cashBurnAnalysis) parts.push(`Cash Burn Analysis: ${JSON.stringify((d as any).cashBurnAnalysis).slice(0, 300)}`);
    if ((d as any).revenuePerEmployee) parts.push(`Revenue Per Employee: ${JSON.stringify((d as any).revenuePerEmployee).slice(0, 300)}`);
    if ((d as any).financialBenchmarking) parts.push(`Financial Benchmarking: ${JSON.stringify((d as any).financialBenchmarking).slice(0, 300)}`);
    if ((d as any).investmentPortfolio) parts.push(`Investment Portfolio: ${JSON.stringify((d as any).investmentPortfolio).slice(0, 300)}`);
    if ((d as any).costAllocationModel) parts.push(`Cost Allocation Model: ${JSON.stringify((d as any).costAllocationModel).slice(0, 300)}`);
    if ((d as any).marginWaterfall) parts.push(`Margin Waterfall: ${JSON.stringify((d as any).marginWaterfall).slice(0, 300)}`);
    if ((d as any).customerOnboardingMetrics) parts.push(`Customer Onboarding Metrics: ${JSON.stringify((d as any).customerOnboardingMetrics).slice(0, 300)}`);
    if ((d as any).healthScoreModel) parts.push(`Health Score Model: ${JSON.stringify((d as any).healthScoreModel).slice(0, 300)}`);
    if ((d as any).csExpansionPlaybook) parts.push(`CS Expansion Playbook: ${JSON.stringify((d as any).csExpansionPlaybook).slice(0, 300)}`);
    if ((d as any).renewalForecasting) parts.push(`Renewal Forecasting: ${JSON.stringify((d as any).renewalForecasting).slice(0, 300)}`);
    if ((d as any).csOperations) parts.push(`CS Operations: ${JSON.stringify((d as any).csOperations).slice(0, 300)}`);
    if ((d as any).customerMilestones) parts.push(`Customer Milestones: ${JSON.stringify((d as any).customerMilestones).slice(0, 300)}`);
    if ((d as any).okrFramework) parts.push(`OKR Framework: ${JSON.stringify((d as any).okrFramework).slice(0, 300)}`);
    if ((d as any).strategicPillars) parts.push(`Strategic Pillars: ${JSON.stringify((d as any).strategicPillars).slice(0, 300)}`);
    if ((d as any).competitivePositioning) parts.push(`Competitive Positioning: ${JSON.stringify((d as any).competitivePositioning).slice(0, 300)}`);
    if ((d as any).marketShareAnalysis) parts.push(`Market Share Analysis: ${JSON.stringify((d as any).marketShareAnalysis).slice(0, 300)}`);
    if ((d as any).growthCorridors) parts.push(`Growth Corridors: ${JSON.stringify((d as any).growthCorridors).slice(0, 300)}`);
    if ((d as any).valuePropCanvas) parts.push(`Value Prop Canvas: ${JSON.stringify((d as any).valuePropCanvas).slice(0, 300)}`);
    if ((d as any).competitiveMonitoring) parts.push(`Competitive Monitoring: ${(d as any).competitiveMonitoring.summary}`);
    if ((d as any).marketTrendRadar) parts.push(`Market Trend Radar: ${(d as any).marketTrendRadar.summary}`);
    if ((d as any).industryBenchmarkIndex) parts.push(`Industry Benchmark Index: ${(d as any).industryBenchmarkIndex.summary}`);
    if ((d as any).customerIntelPlatform) parts.push(`Customer Intel Platform: ${(d as any).customerIntelPlatform.summary}`);
    if ((d as any).priceSensitivityModel) parts.push(`Price Sensitivity Model: ${(d as any).priceSensitivityModel.summary}`);
    if ((d as any).demandSignalAnalysis) parts.push(`Demand Signal Analysis: ${(d as any).demandSignalAnalysis.summary}`);
    if ((d as any).digitalMaturityIndex) parts.push(`Digital Maturity Index: ${(d as any).digitalMaturityIndex.summary}`);
    if ((d as any).cloudMigrationReadiness) parts.push(`Cloud Migration Readiness: ${(d as any).cloudMigrationReadiness.summary}`);
    if ((d as any).automationRoi) parts.push(`Automation ROI: ${(d as any).automationRoi.summary}`);
    if ((d as any).digitalWorkplace) parts.push(`Digital Workplace: ${(d as any).digitalWorkplace.summary}`);
    if ((d as any).cybersecurityPosture) parts.push(`Cybersecurity Posture: ${(d as any).cybersecurityPosture.summary}`);
    if ((d as any).techVendorConsolidation) parts.push(`Tech Vendor Consolidation: ${(d as any).techVendorConsolidation.summary}`);
    if ((d as any).revenueSourceMapping) parts.push(`Revenue Source Mapping: ${(d as any).revenueSourceMapping.summary}`);
    if ((d as any).channelMixOptimization) parts.push(`Channel Mix Optimization: ${(d as any).channelMixOptimization.summary}`);
    if ((d as any).crossSellEngine) parts.push(`Cross-Sell Engine: ${(d as any).crossSellEngine.summary}`);
    if ((d as any).priceOptimizationModel) parts.push(`Price Optimization Model: ${(d as any).priceOptimizationModel.summary}`);
    if ((d as any).promotionEffectiveness) parts.push(`Promotion Effectiveness: ${(d as any).promotionEffectiveness.summary}`);
    if ((d as any).revenueHealthIndex) parts.push(`Revenue Health Index: ${(d as any).revenueHealthIndex.summary}`);
    if ((d as any).organizationalNetwork) parts.push(`Organizational Network: ${(d as any).organizationalNetwork.summary}`);
    if ((d as any).decisionEfficiency) parts.push(`Decision Efficiency: ${(d as any).decisionEfficiency.summary}`);
    if ((d as any).meetingEfficiency) parts.push(`Meeting Efficiency: ${(d as any).meetingEfficiency.summary}`);
    if ((d as any).knowledgeCapital) parts.push(`Knowledge Capital: ${(d as any).knowledgeCapital.summary}`);
    if ((d as any).changeManagementScore) parts.push(`Change Management Score: ${(d as any).changeManagementScore.summary}`);
    if ((d as any).cultureAlignment) parts.push(`Culture Alignment: ${(d as any).cultureAlignment.summary}`);
    if ((d as any).partnerPerformance) parts.push(`Partner Performance: ${(d as any).partnerPerformance.summary}`);
    if ((d as any).ecosystemMapping) parts.push(`Ecosystem Mapping: ${(d as any).ecosystemMapping.summary}`);
    if ((d as any).allianceStrategy) parts.push(`Alliance Strategy: ${(d as any).allianceStrategy.summary}`);
    if ((d as any).channelPartnerHealth) parts.push(`Channel Partner Health: ${(d as any).channelPartnerHealth.summary}`);
    if ((d as any).coSellingPipeline) parts.push(`Co-Selling Pipeline: ${(d as any).coSellingPipeline.summary}`);
    if ((d as any).integrationMarketplace) parts.push(`Integration Marketplace: ${(d as any).integrationMarketplace.summary}`);
    if ((d as any).brandEquityIndex) parts.push(`Brand Equity Index: ${(d as any).brandEquityIndex.summary}`);
    if ((d as any).sentimentDashboard) parts.push(`Sentiment Dashboard: ${(d as any).sentimentDashboard.summary}`);
    if ((d as any).mediaShareOfVoice) parts.push(`Media Share of Voice: ${(d as any).mediaShareOfVoice.summary}`);
    if ((d as any).crisisCommsReadiness) parts.push(`Crisis Comms Readiness: ${(d as any).crisisCommsReadiness.summary}`);
    if ((d as any).thoughtLeadership) parts.push(`Thought Leadership: ${(d as any).thoughtLeadership.summary}`);
    if ((d as any).brandConsistency) parts.push(`Brand Consistency: ${(d as any).brandConsistency.summary}`);
    if ((d as any).monetizationModel) parts.push(`Monetization Model: ${(d as any).monetizationModel.summary}`);
    if ((d as any).freeTrialConversion) parts.push(`Free Trial Conversion: ${(d as any).freeTrialConversion.summary}`);
    if ((d as any).usageBasedPricing) parts.push(`Usage-Based Pricing: ${(d as any).usageBasedPricing.summary}`);
    if ((d as any).bundleOptimization) parts.push(`Bundle Optimization: ${(d as any).bundleOptimization.summary}`);
    if ((d as any).discountDiscipline) parts.push(`Discount Discipline: ${(d as any).discountDiscipline.summary}`);
    if ((d as any).revenueLeakageDetection) parts.push(`Revenue Leakage Detection: ${(d as any).revenueLeakageDetection.summary}`);
    if ((d as any).customerAcademy) parts.push(`Customer Academy: ${(d as any).customerAcademy.summary}`);
    if ((d as any).contentEngagement) parts.push(`Content Engagement: ${(d as any).contentEngagement.summary}`);
    if ((d as any).communityHealth) parts.push(`Community Health: ${(d as any).communityHealth.summary}`);
    if ((d as any).certificationProgram) parts.push(`Certification Program: ${(d as any).certificationProgram.summary}`);
    if ((d as any).selfServiceAdoption) parts.push(`Self-Service Adoption: ${(d as any).selfServiceAdoption.summary}`);
    if ((d as any).supportDeflection) parts.push(`Support Deflection: ${(d as any).supportDeflection.summary}`);
    if ((d as any).investorDeck) parts.push(`Investor Deck: ${(d as any).investorDeck.summary}`);
    if ((d as any).fundingTimeline) parts.push(`Funding Timeline: ${(d as any).fundingTimeline.summary}`);
    if ((d as any).valuationModel) parts.push(`Valuation Model: ${(d as any).valuationModel.summary}`);
    if ((d as any).capTableManagement) parts.push(`Cap Table Management: ${(d as any).capTableManagement.summary}`);
    if ((d as any).investorCommunication) parts.push(`Investor Communication: ${(d as any).investorCommunication.summary}`);
    if ((d as any).boardReporting) parts.push(`Board Reporting: ${(d as any).boardReporting.summary}`);
    if ((d as any).geoExpansionStrategy) parts.push(`Geo Expansion Strategy: ${(d as any).geoExpansionStrategy.summary}`);
    if ((d as any).localMarketEntry) parts.push(`Local Market Entry: ${(d as any).localMarketEntry.summary}`);
    if ((d as any).marketRegulations) parts.push(`Market Regulations: ${(d as any).marketRegulations.summary}`);
    if ((d as any).partnerLocalization) parts.push(`Partner Localization: ${(d as any).partnerLocalization.summary}`);
    if ((d as any).culturalAdaptation) parts.push(`Cultural Adaptation: ${(d as any).culturalAdaptation.summary}`);
    if ((d as any).expansionRoi) parts.push(`Expansion ROI: ${(d as any).expansionRoi.summary}`);
    if ((d as any).productLedMetrics) parts.push(`PLG Metrics: ${(d as any).productLedMetrics.summary}`);
    if ((d as any).activationFunnel) parts.push(`Activation Funnel: ${(d as any).activationFunnel.summary}`);
    if ((d as any).featureAdoption) parts.push(`Feature Adoption: ${(d as any).featureAdoption.summary}`);
    if ((d as any).virality) parts.push(`Virality: ${(d as any).virality.summary}`);
    if ((d as any).productQualifiedLeads) parts.push(`Product Qualified Leads: ${(d as any).productQualifiedLeads.summary}`);
    if ((d as any).timeToValue) parts.push(`Time-to-Value: ${(d as any).timeToValue.summary}`);
    if ((d as any).aiReadinessScore) parts.push(`AI Readiness Score: ${(d as any).aiReadinessScore.summary}`);
    if ((d as any).mlUseCasePriority) parts.push(`ML Use Case Priority: ${(d as any).mlUseCasePriority.summary}`);
    if ((d as any).dataInfrastructure) parts.push(`Data Infrastructure: ${(d as any).dataInfrastructure.summary}`);
    if ((d as any).aiTalentGap) parts.push(`AI Talent Gap: ${(d as any).aiTalentGap.summary}`);
    if ((d as any).ethicalAiFramework) parts.push(`Ethical AI Framework: ${(d as any).ethicalAiFramework.summary}`);
    if ((d as any).aiRoiProjection) parts.push(`AI ROI Projection: ${(d as any).aiRoiProjection.summary}`);
    reportContext = `\n\nBUSINESS CONTEXT:\n${parts.join("\n")}`;
  }

  const roleContext =
    memberRole === "owner"
      ? "\nThe user is the BUSINESS OWNER. They can ask about team performance, hiring/firing, and strategic decisions."
      : memberName
        ? `\nThe user is ${memberName}, an EMPLOYEE. Coach them on their personal performance and daily priorities.`
        : "";

  const systemPrompt = COACH_SYSTEM_PROMPT + reportContext + roleContext;

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
      model: "gemini-2.5-flash-preview-05-20",
      contents: chatMessages,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.4,
        maxOutputTokens: 1500,
        tools: [{ functionDeclarations: TOOLS }],
        toolConfig: { functionCallingMode: "AUTO" },
      } as Record<string, unknown>,
    });

    // Check for tool calls
    const candidate = resp.candidates?.[0];
    const parts = candidate?.content?.parts ?? [];
    const fnCalls = parts.filter((p: any) => p.functionCall);

    if (fnCalls.length > 0) {
      // Execute all requested tools
      const toolResults = await Promise.all(
        fnCalls.map(async (part: any) => {
          const { name, args: toolArgs } = part.functionCall;
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
        model: "gemini-2.5-flash-preview-05-20",
        contents: contentsWithTools,
        config: {
          systemInstruction: systemPrompt,
          temperature: 0.4,
          maxOutputTokens: 1500,
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
