"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, Download, AlertCircle, TrendingUp, DollarSign, Users, Target,
  ShieldAlert, Sparkles, ChevronRight, Loader2, ShieldCheck, Globe, Zap,
  BarChart3, GitBranch, Trophy, FileText, Clock, ArrowRight, Server, Megaphone,
  Presentation, Gauge, Calendar, ClipboardCheck, UserSearch, CheckCircle2,
  XCircle, MinusCircle, HelpCircle, Crosshair, Calculator, PieChart,
  Swords, Briefcase, UserPlus, LineChart, ShieldOff, BookOpen, Flag,
  Brain, Heart, Lightbulb, Layers, Building, Shield,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, Cell,
} from "recharts";
import type { Job, MVPDeliverables } from "@/lib/types";
import { ExecutionView } from "./ExecutionView";
import { AgentChatButton } from "./AgentChat";
import { CoachChatButton } from "./CoachChat";
import { RevenueLeakChart } from "./charts/RevenueLeakChart";
import { CashFlowChart } from "./charts/CashFlowChart";
import { CustomerRiskScatter } from "./charts/CustomerRiskScatter";
import { MarketingChannelChart } from "./charts/MarketingChannelChart";
import { IssuesSeverityChart } from "./charts/IssuesSeverityChart";
import { TechSavingsChart } from "./charts/TechSavingsChart";
import { PricingComparisonChart } from "./charts/PricingComparisonChart";
import { CompetitorRadarChart } from "./charts/CompetitorRadarChart";
import { ChartInteraction } from "./charts/ChartInteraction";
import SmartSectionRenderer from "./SmartSectionRenderer";

interface ResultsViewProps {
  runId: string;
  onBack: () => void;
  onNewRun: () => void;
}

const TABS = [
  { id: 0,  label: "Health Score",    icon: TrendingUp,  dataKey: null           },
  { id: 1,  label: "Cash",            icon: DollarSign,  dataKey: null           },
  { id: 2,  label: "Revenue Leaks",   icon: AlertCircle, dataKey: null           },
  { id: 3,  label: "Issues",          icon: ShieldAlert, dataKey: null           },
  { id: 4,  label: "At-Risk Clients", icon: Users,       dataKey: null           },
  { id: 5,  label: "Decision Brief",  icon: Target,      dataKey: null           },
  { id: 6,  label: "Action Plan",     icon: Sparkles,    dataKey: null           },
  { id: 7,  label: "Growth Intel",    icon: Globe,       dataKey: "marketIntelligence"    },
  { id: 8,  label: "Website",         icon: BarChart3,   dataKey: "websiteAnalysis"       },
  { id: 9,  label: "Competitors",     icon: Trophy,      dataKey: "competitorAnalysis"    },
  { id: 10, label: "Tech Savings",    icon: Server,      dataKey: "techOptimization"      },
  { id: 11, label: "Pricing",         icon: DollarSign,  dataKey: "pricingIntelligence"   },
  { id: 12, label: "Marketing",       icon: Megaphone,   dataKey: "marketingStrategy"     },
  { id: 13, label: "Pitch Deck",      icon: Presentation, dataKey: "pitchDeckAnalysis"    },
  { id: 14, label: "KPIs",            icon: Gauge,        dataKey: "kpiReport"             },
  { id: 15, label: "30-Day Roadmap",  icon: Calendar,     dataKey: "roadmap"               },
  { id: 16, label: "Health Check",    icon: ClipboardCheck, dataKey: "healthChecklist"      },
  { id: 17, label: "Lead Gen",        icon: UserSearch,   dataKey: "leadReport"            },
  { id: 18, label: "SWOT",            icon: Crosshair,    dataKey: "swotAnalysis"          },
  { id: 19, label: "Unit Economics",  icon: Calculator,   dataKey: "unitEconomics"         },
  { id: 20, label: "Segments",        icon: PieChart,     dataKey: "customerSegmentation"  },
  { id: 21, label: "Win/Loss",        icon: Swords,       dataKey: "competitiveWinLoss"    },
  { id: 22, label: "Investor Brief",  icon: Briefcase,    dataKey: "investorOnePager"      },
  { id: 23, label: "Hiring Plan",     icon: UserPlus,     dataKey: "hiringPlan"            },
  { id: 24, label: "Forecast",        icon: LineChart,    dataKey: "revenueForecast"       },
  { id: 25, label: "Churn Playbook",  icon: ShieldOff,    dataKey: "churnPlaybook"         },
  { id: 26, label: "Sales Playbook",  icon: BookOpen,     dataKey: "salesPlaybook"         },
  { id: 27, label: "Goals & OKRs",    icon: Flag,         dataKey: "goalTracker"           },
  { id: 28, label: "Exec Summary",    icon: FileText,     dataKey: "executiveSummary"      },
  { id: 30, label: "Milestones",      icon: Flag,         dataKey: "milestoneTracker"      },
  { id: 31, label: "Risk Register",   icon: ShieldAlert,  dataKey: "riskRegister"          },
  { id: 32, label: "Partnerships",    icon: GitBranch,    dataKey: "partnershipOpportunities" },
  { id: 33, label: "Funding Ready",   icon: DollarSign,   dataKey: "fundingReadiness"      },
  { id: 34, label: "Market Sizing",   icon: PieChart,     dataKey: "marketSizing"          },
  { id: 35, label: "Scenarios",       icon: Sparkles,     dataKey: "scenarioPlanner"       },
  { id: 36, label: "Ops Efficiency",  icon: Zap,          dataKey: "operationalEfficiency" },
  { id: 37, label: "CLV Analysis",    icon: Users,        dataKey: "clvAnalysis"           },
  { id: 38, label: "Retention",       icon: ShieldCheck,  dataKey: "retentionPlaybook"     },
  { id: 39, label: "Attribution",     icon: BarChart3,    dataKey: "revenueAttribution"    },
  { id: 40, label: "Board Deck",      icon: Presentation, dataKey: "boardDeck"             },
  { id: 41, label: "Moat Analysis",   icon: Trophy,       dataKey: "competitiveMoat"       },
  { id: 42, label: "GTM Score",       icon: Target,       dataKey: "gtmScorecard"          },
  { id: 43, label: "Cash Optimize",   icon: DollarSign,   dataKey: "cashOptimization"      },
  { id: 44, label: "Talent Gaps",     icon: Users,        dataKey: "talentGapAnalysis"     },
  { id: 45, label: "Diversification", icon: PieChart,     dataKey: "revenueDiversification"},
  { id: 46, label: "Customer Journey",icon: GitBranch,    dataKey: "customerJourneyMap"    },
  { id: 47, label: "Compliance",      icon: ShieldCheck,  dataKey: "complianceChecklist"   },
  { id: 48, label: "Expansion",       icon: Target,       dataKey: "expansionPlaybook"     },
  { id: 49, label: "Vendors",         icon: DollarSign,   dataKey: "vendorScorecard"       },
  { id: 50, label: "PMF Score",       icon: Target,       dataKey: "productMarketFit"      },
  { id: 51, label: "Brand Health",    icon: Trophy,       dataKey: "brandHealth"           },
  { id: 52, label: "Price Elasticity",icon: DollarSign,   dataKey: "pricingElasticity"     },
  { id: 53, label: "Initiatives",     icon: Flag,         dataKey: "strategicInitiatives"  },
  { id: 54, label: "Cash Cycle",      icon: Calculator,   dataKey: "cashConversionCycle"   },
  { id: 55, label: "Innovation",      icon: Sparkles,     dataKey: "innovationPipeline"    },
  { id: 56, label: "Stakeholders",   icon: Users,        dataKey: "stakeholderMap"        },
  { id: 57, label: "Decision Log",   icon: ClipboardCheck, dataKey: "decisionLog"         },
  { id: 58, label: "Culture",        icon: Users,        dataKey: "cultureAssessment"     },
  { id: 59, label: "IP Portfolio",   icon: ShieldCheck,  dataKey: "ipPortfolio"           },
  { id: 60, label: "Exit Ready",     icon: Target,       dataKey: "exitReadiness"         },
  { id: 61, label: "Sustainability", icon: Globe,        dataKey: "sustainabilityScore"   },
  { id: 62, label: "Acquisitions",   icon: Target,       dataKey: "acquisitionTargets"    },
  { id: 63, label: "Fin. Ratios",    icon: Calculator,   dataKey: "financialRatios"       },
  { id: 64, label: "Channel Mix",    icon: BarChart3,    dataKey: "channelMixModel"       },
  { id: 65, label: "Supply Chain",   icon: GitBranch,    dataKey: "supplyChainRisk"       },
  { id: 66, label: "Regulatory",     icon: ShieldCheck,  dataKey: "regulatoryLandscape"   },
  { id: 67, label: "Crisis Plan",    icon: ShieldAlert,  dataKey: "crisisPlaybook"        },
  { id: 68, label: "AI Ready",       icon: Sparkles,     dataKey: "aiReadiness"           },
  { id: 69, label: "Network FX",     icon: Globe,        dataKey: "networkEffects"         },
  { id: 70, label: "Data Value",     icon: Server,       dataKey: "dataMonetization"       },
  { id: 71, label: "SaaS Metrics",   icon: LineChart,    dataKey: "subscriptionMetrics"    },
  { id: 72, label: "Mkt Timing",     icon: Calendar,     dataKey: "marketTiming"           },
  { id: 73, label: "Stress Test",    icon: Zap,          dataKey: "scenarioStressTest"     },
  { id: 74, label: "Price Matrix",   icon: DollarSign,   dataKey: "pricingStrategyMatrix" },
  { id: 75, label: "Cust Health",    icon: Users,        dataKey: "customerHealthScore"   },
  { id: 76, label: "Rev Waterfall",  icon: BarChart3,    dataKey: "revenueWaterfall"      },
  { id: 77, label: "Tech Debt",      icon: Server,       dataKey: "techDebtAssessment"    },
  { id: 78, label: "Team Perf",      icon: Users,        dataKey: "teamPerformance"       },
  { id: 79, label: "Market Entry",   icon: Globe,        dataKey: "marketEntryStrategy"   },
  { id: 80, label: "Comp Intel",     icon: Trophy,       dataKey: "competitiveIntelFeed"  },
  { id: 81, label: "Cash Sense",     icon: DollarSign,   dataKey: "cashFlowSensitivity"   },
  { id: 82, label: "Digital Score",  icon: Sparkles,     dataKey: "digitalMaturity"       },
  { id: 83, label: "Acq Funnel",     icon: Target,       dataKey: "acquisitionFunnel"     },
  { id: 84, label: "Alignment",      icon: Flag,         dataKey: "strategicAlignment"    },
  { id: 85, label: "Budget Opt",     icon: Calculator,   dataKey: "budgetOptimizer"       },
  { id: 86, label: "Rev Drivers",   icon: TrendingUp,   dataKey: "revenueDrivers"        },
  { id: 87, label: "Margins",       icon: DollarSign,   dataKey: "marginOptimization"    },
  { id: 88, label: "Demand",        icon: BarChart3,    dataKey: "demandForecasting"     },
  { id: 89, label: "Cohorts",       icon: Users,        dataKey: "cohortAnalysis"        },
  { id: 90, label: "Win/Loss",      icon: Swords,       dataKey: "winLossAnalysis"       },
  { id: 91, label: "Sales Fcst",    icon: LineChart,    dataKey: "salesForecast"         },
  { id: 92, label: "Process Eff",   icon: Zap,          dataKey: "processEfficiency"     },
  { id: 93, label: "Vendor Risk",   icon: ShieldAlert,  dataKey: "vendorRisk"            },
  { id: 94, label: "Quality",       icon: ShieldCheck,  dataKey: "qualityMetrics"        },
  { id: 95, label: "Capacity",      icon: Server,       dataKey: "capacityPlanning"      },
  { id: 96, label: "Knowledge",     icon: BookOpen,     dataKey: "knowledgeManagement"   },
  { id: 97, label: "Compliance",    icon: ClipboardCheck, dataKey: "complianceScorecard"  },
  { id: 98,  label: "Penetration",   icon: Target,        dataKey: "marketPenetration"     },
  { id: 99,  label: "Flywheel",      icon: Zap,           dataKey: "flywheelAnalysis"      },
  { id: 100, label: "Partners",      icon: GitBranch,     dataKey: "partnershipsStrategy"  },
  { id: 101, label: "Intl Expand",   icon: Globe,         dataKey: "internationalExpansion"},
  { id: 102, label: "R&D Effect",    icon: Sparkles,      dataKey: "rdEffectiveness"       },
  { id: 103, label: "Brand Equity",  icon: Trophy,        dataKey: "brandEquity"           },
  { id: 104, label: "Work Capital",  icon: DollarSign,    dataKey: "workingCapital"        },
  { id: 105, label: "Debt Plan",     icon: Calculator,    dataKey: "debtStrategy"          },
  { id: 106, label: "Tax Strategy",  icon: FileText,      dataKey: "taxStrategy"           },
  { id: 107, label: "Investor Ready",icon: Briefcase,     dataKey: "investorReadiness"     },
  { id: 108, label: "M&A Ready",     icon: Target,        dataKey: "maReadiness"           },
  { id: 109, label: "Roadmap",       icon: Flag,          dataKey: "strategicRoadmap"      },
  // Wave 17
  { id: 110, label: "Cust Voice",    icon: Users,         dataKey: "customerVoice"         },
  { id: 111, label: "Referrals",     icon: UserPlus,      dataKey: "referralEngine"        },
  { id: 112, label: "Price Sense",   icon: DollarSign,    dataKey: "priceSensitivityIndex"  },
  { id: 113, label: "Effort Score",  icon: Gauge,         dataKey: "customerEffortScore"   },
  { id: 114, label: "Expansion",     icon: TrendingUp,    dataKey: "accountExpansionMap"    },
  { id: 115, label: "Loyalty",       icon: Trophy,        dataKey: "loyaltyProgramDesign"  },
  // Wave 18
  { id: 116, label: "Price Matrix",  icon: Calculator,    dataKey: "competitivePricingMatrix" },
  { id: 117, label: "Sentiment",     icon: BarChart3,     dataKey: "marketSentimentIndex"  },
  { id: 118, label: "Disruption",    icon: Zap,           dataKey: "disruptionRadar"       },
  { id: 119, label: "Ecosystem",     icon: GitBranch,     dataKey: "ecosystemMap"          },
  { id: 120, label: "Category",      icon: Sparkles,      dataKey: "categoryCreation"      },
  { id: 121, label: "Mkt Velocity",  icon: LineChart,     dataKey: "marketVelocity"        },
  // Wave 19
  { id: 122, label: "OKR Cascade",   icon: Target,        dataKey: "okrCascade"            },
  { id: 123, label: "Meetings",      icon: Clock,         dataKey: "meetingEffectiveness"  },
  { id: 124, label: "Comms Audit",   icon: Megaphone,     dataKey: "communicationAudit"    },
  { id: 125, label: "Decisions",     icon: Crosshair,     dataKey: "decisionVelocity"      },
  { id: 126, label: "Resources",     icon: Server,        dataKey: "resourceOptimizer"     },
  { id: 127, label: "Change Mgmt",   icon: ArrowRight,    dataKey: "changeManagement"      },
  // Wave 20
  { id: 128, label: "Cash Reserve",  icon: DollarSign,    dataKey: "cashReserveStrategy"   },
  { id: 129, label: "Rev Quality",   icon: PieChart,      dataKey: "revenueQualityScore"   },
  { id: 130, label: "Cost Intel",    icon: Calculator,    dataKey: "costIntelligence"      },
  { id: 131, label: "Fin Model",     icon: LineChart,     dataKey: "financialModeling"     },
  { id: 132, label: "Profit Map",    icon: TrendingUp,    dataKey: "profitabilityMap"      },
  { id: 133, label: "Cap Alloc",     icon: Briefcase,     dataKey: "capitalAllocation"     },
  // Wave 21 — Sales Operations
  { id: 134, label: "Pipeline",       icon: Gauge,         dataKey: "salesPipelineHealth"   },
  { id: 135, label: "Deal Speed",     icon: Zap,           dataKey: "dealVelocity"          },
  { id: 136, label: "Win Rate",       icon: Trophy,        dataKey: "winRateOptimizer"      },
  { id: 137, label: "Enablement",     icon: Briefcase,     dataKey: "salesEnablement"       },
  { id: 138, label: "Territories",    icon: Target,        dataKey: "territoryPlanning"     },
  { id: 139, label: "Quotas",         icon: DollarSign,    dataKey: "quotaIntelligence"     },
  // Wave 22 — Product & Technology
  { id: 140, label: "Features",       icon: Sparkles,      dataKey: "featurePrioritization" },
  { id: 141, label: "Usage",          icon: BarChart3,     dataKey: "productUsageAnalytics" },
  { id: 142, label: "Tech Audit",     icon: Server,        dataKey: "techStackAudit"        },
  { id: 143, label: "API Strategy",   icon: GitBranch,     dataKey: "apiStrategy"           },
  { id: 144, label: "Scalability",    icon: TrendingUp,    dataKey: "platformScalability"   },
  { id: 145, label: "Onboarding",     icon: ArrowRight,    dataKey: "userOnboarding"        },
  // Wave 23 — People & Culture
  { id: 146, label: "Engagement",     icon: Users,         dataKey: "employeeEngagement"    },
  { id: 147, label: "Talent",         icon: UserPlus,      dataKey: "talentAcquisitionFunnel" },
  { id: 148, label: "Comp Bench",     icon: Calculator,    dataKey: "compensationBenchmark" },
  { id: 149, label: "Succession",     icon: Clock,         dataKey: "successionPlanning"    },
  { id: 150, label: "Diversity",      icon: PieChart,      dataKey: "diversityMetrics"      },
  { id: 151, label: "Employer Brand", icon: Megaphone,     dataKey: "employerBrand"         },
  // Wave 24 — Data & Analytics
  { id: 152, label: "Data Gov",       icon: ShieldCheck,   dataKey: "dataGovernance"        },
  { id: 153, label: "Analytics",      icon: LineChart,     dataKey: "analyticsMaturity"     },
  { id: 154, label: "CDP",            icon: Crosshair,     dataKey: "customerDataPlatform"  },
  { id: 155, label: "Predictive",     icon: TrendingUp,    dataKey: "predictiveModeling"    },
  { id: 156, label: "Reporting",      icon: BarChart3,     dataKey: "reportingFramework"    },
  { id: 157, label: "Data Quality",   icon: Gauge,         dataKey: "dataQualityScore"      },
  // Wave 25 — Operations & Supply Chain
  { id: 158, label: "Supply Chain",   icon: GitBranch,     dataKey: "supplyChainRisk"       },
  { id: 159, label: "Inventory",      icon: Server,        dataKey: "inventoryOptimization" },
  { id: 160, label: "Vendors",        icon: ClipboardCheck, dataKey: "vendorScorecard"      },
  { id: 161, label: "Ops Efficiency", icon: Zap,           dataKey: "operationalEfficiency" },
  { id: 162, label: "Quality",        icon: ShieldCheck,   dataKey: "qualityManagement"     },
  { id: 163, label: "Capacity",       icon: BarChart3,     dataKey: "capacityPlanning"      },
  // Wave 26 — Customer Intelligence
  { id: 164, label: "Journey Map",    icon: Target,        dataKey: "customerJourneyMap"    },
  { id: 165, label: "NPS",            icon: Gauge,         dataKey: "npsAnalysis"           },
  { id: 166, label: "Support",        icon: HelpCircle,    dataKey: "supportTicketIntelligence" },
  { id: 167, label: "Health Score",   icon: ShieldCheck,   dataKey: "customerHealthScore"   },
  { id: 168, label: "VoC",            icon: Users,         dataKey: "voiceOfCustomer"       },
  { id: 169, label: "Segments",       icon: PieChart,      dataKey: "customerSegmentation"  },
  // Wave 27 — Innovation & Strategy
  { id: 170, label: "Innovation",     icon: Sparkles,      dataKey: "innovationPipeline"    },
  { id: 171, label: "IP Portfolio",   icon: ShieldAlert,   dataKey: "ipPortfolio"           },
  { id: 172, label: "R&D",            icon: Calculator,    dataKey: "rdEfficiency"          },
  { id: 173, label: "Tech Ready",     icon: Server,        dataKey: "technologyReadiness"   },
  { id: 174, label: "Partners",       icon: Briefcase,     dataKey: "partnershipEcosystem"  },
  { id: 175, label: "M&A",            icon: Swords,        dataKey: "mergersAcquisitions"   },
  // Wave 28 — ESG & Governance
  { id: 176, label: "ESG",            icon: Globe,         dataKey: "esgScorecard"          },
  { id: 177, label: "Carbon",         icon: TrendingUp,    dataKey: "carbonFootprint"       },
  { id: 178, label: "Compliance",     icon: ShieldCheck,   dataKey: "regulatoryCompliance"  },
  { id: 179, label: "Continuity",     icon: ShieldAlert,   dataKey: "businessContinuity"    },
  { id: 180, label: "Ethics",         icon: BookOpen,      dataKey: "ethicsFramework"       },
  { id: 181, label: "Social Impact",  icon: Users,         dataKey: "socialImpact"          },
  // Wave 29 — Revenue Intelligence & Sales Analytics
  { id: 182, label: "Deal Pipeline",  icon: Gauge,         dataKey: "dealPipeline"          },
  { id: 183, label: "Sales Forecast", icon: LineChart,      dataKey: "salesForecasting"      },
  { id: 184, label: "ABM",            icon: Target,         dataKey: "accountBasedMarketing"  },
  { id: 187, label: "Commissions",    icon: DollarSign,     dataKey: "commissionOptimization"},
  // Wave 30 — Product & Market Intelligence
  { id: 191, label: "Prod Analytics", icon: BarChart3,      dataKey: "productAnalytics"      },
  { id: 193, label: "Comp Response",  icon: Swords,         dataKey: "competitiveResponse"   },
  // Wave 31 — Financial Planning & Analysis
  { id: 194, label: "Scenarios",      icon: Sparkles,       dataKey: "scenarioPlanning"      },
  { id: 195, label: "Cap Structure",  icon: DollarSign,     dataKey: "capitalStructure"      },
  { id: 198, label: "Fundraising",    icon: TrendingUp,     dataKey: "fundraisingReadiness"  },
  { id: 199, label: "Exit Strategy",  icon: Flag,           dataKey: "exitStrategy"          },
  // Wave 32 — People & Culture Analytics
  { id: 200, label: "Talent",         icon: UserPlus,       dataKey: "talentAcquisition"     },
  { id: 204, label: "DEI",            icon: PieChart,       dataKey: "diversityInclusion"    },
  // Wave 33 — Market Expansion & Growth
  { id: 206, label: "Mkt Entry",      icon: Globe,          dataKey: "marketEntryPlaybook"   },
  { id: 207, label: "Partner Ch",     icon: GitBranch,      dataKey: "partnerChannelStrategy"},
  { id: 208, label: "Acq Integ",      icon: Target,         dataKey: "acquisitionIntegration"},
  { id: 209, label: "Intl Ready",     icon: Globe,          dataKey: "internationalReadiness"},
  { id: 210, label: "Rev Model",      icon: DollarSign,     dataKey: "revenueModelAnalysis"  },
  { id: 211, label: "Growth Exp",     icon: Sparkles,       dataKey: "growthExperiments"     },
  // Wave 34 — Customer Economics
  { id: 212, label: "CAC",            icon: Calculator,     dataKey: "customerAcquisitionCost"},
  { id: 213, label: "LTV Opt",        icon: TrendingUp,     dataKey: "lifetimeValueOptimization"},
  { id: 214, label: "Churn Pred",     icon: ShieldAlert,    dataKey: "churnPrediction"       },
  { id: 215, label: "NRR",            icon: LineChart,      dataKey: "netRevenueRetention"   },
  { id: 216, label: "Advocacy",       icon: Users,          dataKey: "customerAdvocacy"      },
  { id: 217, label: "Feedback",       icon: Megaphone,      dataKey: "feedbackLoop"          },
  // Wave 35 — Operational Excellence
  { id: 218, label: "Automation",     icon: Zap,            dataKey: "processAutomation"     },
  { id: 219, label: "Cost Bench",     icon: Calculator,     dataKey: "costBenchmark"         },
  { id: 220, label: "Vendor Neg",     icon: Briefcase,      dataKey: "vendorNegotiation"     },
  { id: 221, label: "Scalability",    icon: TrendingUp,     dataKey: "scalabilityAssessment" },
  { id: 222, label: "Incidents",      icon: ShieldAlert,    dataKey: "incidentReadiness"     },
  { id: 223, label: "Ops Risk",       icon: ShieldOff,      dataKey: "operationalRisk"       },
  // Wave 36 — Data & AI
  { id: 224, label: "Data Strategy",  icon: Server,         dataKey: "dataStrategy"          },
  { id: 225, label: "AI Cases",       icon: Sparkles,       dataKey: "aiUseCases"            },
  { id: 226, label: "Analytics Rd",   icon: BarChart3,      dataKey: "analyticsRoadmap"      },
  { id: 227, label: "Data Privacy",   icon: ShieldCheck,    dataKey: "dataPrivacy"           },
  { id: 228, label: "MLOps",          icon: Server,         dataKey: "mlOpsReadiness"        },
  { id: 229, label: "Digital Xform",  icon: Zap,            dataKey: "digitalTransformation" },
  // Wave 37 — Revenue Operations
  { id: 230, label: "Rev Ops",        icon: DollarSign,     dataKey: "revenueOps"            },
  { id: 231, label: "Billing Opt",    icon: Calculator,     dataKey: "billingOptimization"   },
  { id: 232, label: "Contract Intel", icon: FileText,       dataKey: "contractIntelligence"  },
  { id: 233, label: "Commissions",    icon: DollarSign,     dataKey: "commissionTracking"    },
  { id: 234, label: "Rev Rec",        icon: ClipboardCheck, dataKey: "revenueRecognition"    },
  { id: 235, label: "Sub Health",     icon: LineChart,      dataKey: "subscriptionHealth"    },
  // Wave 38 — Product Intelligence
  { id: 236, label: "Roadmap HP",     icon: Flag,           dataKey: "productRoadmapHealth"  },
  { id: 237, label: "Debt Priority",  icon: Server,         dataKey: "techDebtPrioritization"},
  { id: 238, label: "Release Vel",    icon: Zap,            dataKey: "releaseVelocity"       },
  { id: 239, label: "Bug Trends",     icon: ShieldAlert,    dataKey: "bugTrendAnalysis"      },
  { id: 240, label: "API Perf",       icon: GitBranch,      dataKey: "apiPerformance"        },
  { id: 241, label: "UX Score",       icon: Users,          dataKey: "userExperienceScore"   },
  // Wave 39 — Workforce Planning
  { id: 242, label: "Workforce",      icon: Users,          dataKey: "workforcePlanning"     },
  { id: 243, label: "Skills Gap",     icon: Target,         dataKey: "skillsGapAnalysis"     },
  { id: 244, label: "Remote Work",    icon: Globe,          dataKey: "remoteWorkEffectiveness"},
  { id: 245, label: "Team Vel",       icon: TrendingUp,     dataKey: "teamVelocity"          },
  { id: 246, label: "Burnout Risk",   icon: ShieldOff,      dataKey: "burnoutRisk"           },
  { id: 247, label: "L&D",            icon: BookOpen,       dataKey: "learningDevelopment"   },
  // Wave 40 — Compliance & Legal
  { id: 248, label: "Reg Risk",       icon: ShieldAlert,    dataKey: "regulatoryRisk"        },
  { id: 249, label: "Contracts",      icon: FileText,       dataKey: "contractManagement"    },
  { id: 250, label: "IP Strategy",    icon: ShieldCheck,    dataKey: "ipStrategy"            },
  { id: 251, label: "Legal Spend",    icon: DollarSign,     dataKey: "legalSpendAnalysis"    },
  { id: 252, label: "Policy Comp",    icon: ClipboardCheck, dataKey: "policyCompliance"      },
  { id: 253, label: "Audit Ready",    icon: Gauge,          dataKey: "auditReadiness"        },
  // Wave 41 — Sales Excellence
  { id: 254, label: "Sales Method",   icon: BookOpen,       dataKey: "salesMethodology"      },
  { id: 255, label: "Pipe Velocity",  icon: Zap,            dataKey: "pipelineVelocity"      },
  { id: 256, label: "Deal Qual",      icon: Target,         dataKey: "dealQualification"     },
  { id: 257, label: "Sales Coach",    icon: Users,          dataKey: "salesCoaching"         },
  { id: 258, label: "Acct Planning",  icon: Briefcase,      dataKey: "accountPlanning"       },
  { id: 259, label: "Battlecards",    icon: Swords,         dataKey: "competitiveBattlecards"},
  // Wave 42 — Financial Intelligence
  { id: 260, label: "Cash Burn",      icon: DollarSign,     dataKey: "cashBurnAnalysis"      },
  { id: 261, label: "Rev/Employee",   icon: Calculator,     dataKey: "revenuePerEmployee"    },
  { id: 262, label: "Fin Benchmark",  icon: BarChart3,      dataKey: "financialBenchmarking" },
  { id: 263, label: "Invest Port",    icon: Briefcase,      dataKey: "investmentPortfolio"   },
  { id: 264, label: "Cost Alloc",     icon: PieChart,       dataKey: "costAllocationModel"   },
  { id: 265, label: "Margin Fall",    icon: TrendingUp,     dataKey: "marginWaterfall"       },
  // Wave 43 — Customer Success
  { id: 266, label: "Onboard Metrics",icon: ArrowRight,     dataKey: "customerOnboardingMetrics"},
  { id: 267, label: "Health Model",   icon: ShieldCheck,    dataKey: "healthScoreModel"      },
  { id: 268, label: "CS Expansion",   icon: TrendingUp,     dataKey: "csExpansionPlaybook"   },
  { id: 269, label: "Renewal Fcst",   icon: LineChart,      dataKey: "renewalForecasting"    },
  { id: 270, label: "CS Ops",         icon: Gauge,          dataKey: "csOperations"          },
  { id: 271, label: "Milestones",     icon: Flag,           dataKey: "customerMilestones"    },
  // Wave 44 — Strategic Planning
  { id: 272, label: "OKR Framework",  icon: Target,         dataKey: "okrFramework"          },
  { id: 273, label: "Strat Pillars",  icon: Flag,           dataKey: "strategicPillars"      },
  { id: 274, label: "Comp Position",  icon: Trophy,         dataKey: "competitivePositioning"},
  { id: 275, label: "Market Share",   icon: PieChart,       dataKey: "marketShareAnalysis"   },
  { id: 276, label: "Growth Corr",    icon: Sparkles,       dataKey: "growthCorridors"       },
  { id: 277, label: "Value Prop",     icon: Crosshair,      dataKey: "valuePropCanvas"       },
  // Wave 45 — Market Intelligence
  { id: 278, label: "Comp Monitor",   icon: Trophy,         dataKey: "competitiveMonitoring" },
  { id: 279, label: "Trend Radar",    icon: Target,         dataKey: "marketTrendRadar"      },
  { id: 280, label: "Industry Bench", icon: BarChart3,      dataKey: "industryBenchmarkIndex"},
  { id: 281, label: "Customer Intel", icon: Users,          dataKey: "customerIntelPlatform" },
  { id: 282, label: "Price Sensitivity", icon: DollarSign,  dataKey: "priceSensitivityModel" },
  { id: 283, label: "Demand Signals", icon: TrendingUp,     dataKey: "demandSignalAnalysis"  },
  // Wave 46 — Digital Transformation
  { id: 284, label: "Digital Maturity", icon: Sparkles,     dataKey: "digitalMaturityIndex"  },
  { id: 285, label: "Cloud Migration", icon: Server,        dataKey: "cloudMigrationReadiness"},
  { id: 286, label: "Automation ROI", icon: Calculator,     dataKey: "automationRoi"         },
  { id: 287, label: "Digital Workplace", icon: Globe,       dataKey: "digitalWorkplace"      },
  { id: 288, label: "Cybersecurity",  icon: ShieldCheck,    dataKey: "cybersecurityPosture"  },
  { id: 289, label: "Vendor Consol",  icon: Briefcase,      dataKey: "techVendorConsolidation"},
  // Wave 47 — Revenue Acceleration
  { id: 290, label: "Revenue Sources", icon: DollarSign,    dataKey: "revenueSourceMapping"  },
  { id: 291, label: "Channel Mix",    icon: PieChart,       dataKey: "channelMixOptimization"},
  { id: 292, label: "Cross-Sell",     icon: TrendingUp,     dataKey: "crossSellEngine"       },
  { id: 293, label: "Price Optimize", icon: Calculator,     dataKey: "priceOptimizationModel"},
  { id: 294, label: "Promotions",     icon: Megaphone,      dataKey: "promotionEffectiveness" },
  { id: 295, label: "Revenue Health", icon: LineChart,       dataKey: "revenueHealthIndex"    },
  // Wave 48 — Organizational Health
  { id: 296, label: "Org Network",    icon: GitBranch,      dataKey: "organizationalNetwork" },
  { id: 297, label: "Decision Eff",   icon: Crosshair,      dataKey: "decisionEfficiency"    },
  { id: 298, label: "Meeting Eff",    icon: Clock,          dataKey: "meetingEfficiency"     },
  { id: 299, label: "Knowledge Cap",  icon: BookOpen,       dataKey: "knowledgeCapital"      },
  { id: 300, label: "Change Mgmt",    icon: ArrowRight,     dataKey: "changeManagementScore" },
  { id: 301, label: "Culture Align",  icon: Users,          dataKey: "cultureAlignment"      },
  // Wave 49 — Partnership & Ecosystem
  { id: 302, label: "Partner Perf",   icon: GitBranch,      dataKey: "partnerPerformance"    },
  { id: 303, label: "Ecosystem Map",  icon: Globe,          dataKey: "ecosystemMapping"      },
  { id: 304, label: "Alliance Strat", icon: Briefcase,      dataKey: "allianceStrategy"      },
  { id: 305, label: "Channel Partners", icon: Users,        dataKey: "channelPartnerHealth"  },
  { id: 306, label: "Co-Selling",     icon: TrendingUp,     dataKey: "coSellingPipeline"     },
  { id: 307, label: "Integrations",   icon: GitBranch,      dataKey: "integrationMarketplace"},
  // Wave 50 — Brand & Reputation
  { id: 308, label: "Brand Equity",   icon: Trophy,         dataKey: "brandEquityIndex"      },
  { id: 309, label: "Sentiment",      icon: BarChart3,      dataKey: "sentimentDashboard"    },
  { id: 310, label: "Media Share",    icon: Megaphone,      dataKey: "mediaShareOfVoice"     },
  { id: 311, label: "Crisis Comms",   icon: ShieldAlert,    dataKey: "crisisCommsReadiness"  },
  { id: 312, label: "Thought Leadership", icon: BookOpen,   dataKey: "thoughtLeadership"     },
  { id: 313, label: "Brand Consistency", icon: Flag,        dataKey: "brandConsistency"      },
  // Wave 51 — Pricing & Monetization
  { id: 314, label: "Monetization",   icon: DollarSign,     dataKey: "monetizationModel"     },
  { id: 315, label: "Trial Conversion", icon: TrendingUp,   dataKey: "freeTrialConversion"   },
  { id: 316, label: "Usage Pricing",  icon: Calculator,     dataKey: "usageBasedPricing"     },
  { id: 317, label: "Bundle Optimization", icon: PieChart,  dataKey: "bundleOptimization"    },
  { id: 318, label: "Discount Discipline", icon: ShieldCheck, dataKey: "discountDiscipline"  },
  { id: 319, label: "Revenue Leakage", icon: AlertCircle,   dataKey: "revenueLeakageDetection"},
  // Wave 52 — Customer Education
  { id: 320, label: "Academy",        icon: BookOpen,       dataKey: "customerAcademy"       },
  { id: 321, label: "Content Engagement", icon: BarChart3,  dataKey: "contentEngagement"     },
  { id: 322, label: "Community",      icon: Users,          dataKey: "communityHealth"       },
  { id: 323, label: "Certification",  icon: ClipboardCheck, dataKey: "certificationProgram"  },
  { id: 324, label: "Self-Service",   icon: Zap,            dataKey: "selfServiceAdoption"   },
  { id: 325, label: "Support Deflection", icon: HelpCircle, dataKey: "supportDeflection"     },
  // Wave 53 — Investor Relations
  { id: 326, label: "Investor Deck",     icon: Presentation,   dataKey: "investorDeck"          },
  { id: 327, label: "Funding Timeline",  icon: Calendar,       dataKey: "fundingTimeline"       },
  { id: 328, label: "Valuation",         icon: Calculator,     dataKey: "valuationModel"        },
  { id: 329, label: "Cap Table",         icon: PieChart,       dataKey: "capTableManagement"    },
  { id: 330, label: "Investor Comms",    icon: Megaphone,      dataKey: "investorCommunication" },
  { id: 331, label: "Board Reports",     icon: FileText,       dataKey: "boardReporting"        },
  // Wave 54 — Market Expansion
  { id: 332, label: "Geo Expansion",     icon: Globe,          dataKey: "geoExpansionStrategy"  },
  { id: 333, label: "Market Entry",      icon: ArrowRight,     dataKey: "localMarketEntry"      },
  { id: 334, label: "Regulations",       icon: ShieldCheck,    dataKey: "marketRegulations"     },
  { id: 335, label: "Localization",      icon: Globe,          dataKey: "partnerLocalization"   },
  { id: 336, label: "Cultural Adapt",    icon: Users,          dataKey: "culturalAdaptation"    },
  { id: 337, label: "Expansion ROI",     icon: TrendingUp,     dataKey: "expansionRoi"          },
  // Wave 55 — Product-Led Growth
  { id: 338, label: "PLG Metrics",       icon: BarChart3,      dataKey: "productLedMetrics"     },
  { id: 339, label: "Activation",        icon: Zap,            dataKey: "activationFunnel"      },
  { id: 340, label: "Feature Adoption",  icon: Target,         dataKey: "featureAdoption"       },
  { id: 341, label: "Virality",          icon: TrendingUp,     dataKey: "virality"              },
  { id: 342, label: "PQLs",             icon: UserSearch,      dataKey: "productQualifiedLeads" },
  { id: 343, label: "Time-to-Value",    icon: Clock,           dataKey: "timeToValue"           },
  // Wave 56 — AI & Automation Readiness
  { id: 344, label: "AI Readiness",      icon: Sparkles,       dataKey: "aiReadinessScore"      },
  { id: 345, label: "ML Use Cases",      icon: GitBranch,      dataKey: "mlUseCasePriority"     },
  { id: 346, label: "Data Infra",        icon: Server,         dataKey: "dataInfrastructure"    },
  { id: 347, label: "AI Talent",         icon: UserPlus,       dataKey: "aiTalentGap"           },
  { id: 348, label: "Ethical AI",        icon: ShieldCheck,    dataKey: "ethicalAiFramework"    },
  { id: 349, label: "AI ROI",           icon: LineChart,       dataKey: "aiRoiProjection"       },
  // Wave 57 — Customer Advocacy
  { id: 350, label: "Advocacy",          icon: Trophy,          dataKey: "advocacyProgram"        },
  { id: 351, label: "Referrals",         icon: Users,           dataKey: "referralMechanism"      },
  { id: 352, label: "Testimonials",      icon: FileText,        dataKey: "testimonialPipeline"    },
  { id: 353, label: "Case Studies",      icon: BookOpen,        dataKey: "caseStudyFactory"       },
  { id: 354, label: "Advisory Board",    icon: Briefcase,       dataKey: "customerAdvisoryBoard"  },
  { id: 355, label: "NPS Actions",       icon: Target,          dataKey: "npsActionPlan"          },
  // Wave 58 — Operational Finance
  { id: 356, label: "Procurement",       icon: ClipboardCheck,  dataKey: "procurementEfficiency"  },
  { id: 357, label: "Expenses",          icon: DollarSign,      dataKey: "expenseManagement"      },
  { id: 358, label: "Invoicing",         icon: FileText,        dataKey: "invoiceAutomation"      },
  { id: 359, label: "Payments",          icon: DollarSign,      dataKey: "paymentOptimization"    },
  { id: 360, label: "Controls",          icon: ShieldCheck,     dataKey: "financialControls"      },
  { id: 361, label: "Treasury",          icon: Calculator,      dataKey: "treasuryManagement"     },
  // Wave 59 — Growth Marketing
  { id: 362, label: "Demand Gen",        icon: Megaphone,       dataKey: "demandGenEngine"        },
  { id: 363, label: "Content ROI",       icon: BarChart3,       dataKey: "contentMarketingRoi"    },
  { id: 364, label: "SEO",              icon: Globe,            dataKey: "seoStrategy"            },
  { id: 365, label: "Paid Media",        icon: TrendingUp,      dataKey: "paidMediaOptimization"  },
  { id: 366, label: "Events",            icon: Calendar,        dataKey: "eventRoi"               },
  { id: 367, label: "Influencers",       icon: Users,           dataKey: "influencerStrategy"     },
  // Wave 60 — Platform Strategy
  { id: 368, label: "Platform Economics", icon: PieChart,       dataKey: "platformEconomics"      },
  { id: 369, label: "Dev Experience",    icon: Zap,             dataKey: "developerExperience"    },
  { id: 370, label: "API Revenue",       icon: Server,          dataKey: "apiMonetization"        },
  { id: 371, label: "Marketplace",       icon: Globe,           dataKey: "marketplaceStrategy"    },
  { id: 372, label: "Governance",        icon: ShieldAlert,     dataKey: "platformGovernance"     },
  { id: 373, label: "Network Effects",   icon: GitBranch,       dataKey: "platformNetworkDynamics"},
  // Wave 61 — Legal & Compliance Operations
  { id: 374, label: "Contract Lifecycle", icon: FileText,       dataKey: "contractLifecycle"       },
  { id: 375, label: "Compliance Auto",   icon: ShieldCheck,     dataKey: "complianceAutomation"    },
  { id: 376, label: "Legal Risk",        icon: ShieldAlert,     dataKey: "legalRiskRegister"       },
  { id: 377, label: "IP Audit",          icon: BookOpen,        dataKey: "intellectualPropertyAudit"},
  { id: 378, label: "Regulatory Calendar", icon: Calendar,      dataKey: "regulatoryCalendar"      },
  { id: 379, label: "Privacy Compliance", icon: ShieldCheck,    dataKey: "privacyCompliance"       },
  // Wave 62 — Data Analytics
  { id: 380, label: "Data Warehouse",    icon: Server,          dataKey: "dataWarehouseStrategy"   },
  { id: 381, label: "BI Dashboards",     icon: BarChart3,       dataKey: "biDashboardDesign"       },
  { id: 382, label: "Predictive Models", icon: TrendingUp,      dataKey: "predictiveModelCatalog"  },
  { id: 383, label: "Data Lineage",      icon: GitBranch,       dataKey: "dataLineageMap"          },
  { id: 384, label: "Metrics Dictionary", icon: BookOpen,       dataKey: "metricsDictionary"       },
  { id: 385, label: "Analytics Gov",     icon: ShieldAlert,     dataKey: "analyticsGovernance"     },
  // Wave 63 — Employee Experience
  { id: 386, label: "Employee Journey",  icon: Users,           dataKey: "employeeJourney"         },
  { id: 387, label: "Workplace Wellness", icon: Sparkles,       dataKey: "workplaceWellness"       },
  { id: 388, label: "Learning Paths",    icon: BookOpen,        dataKey: "learningPathways"        },
  { id: 389, label: "Performance KPIs",  icon: Target,          dataKey: "performanceFramework"    },
  { id: 390, label: "Pay Equity",        icon: DollarSign,      dataKey: "payEquityAnalysis"       },
  { id: 391, label: "DEI Benchmark",     icon: Users,           dataKey: "deiBenchmark"            },
  // Wave 64 — Business Model Innovation
  { id: 392, label: "Business Model",    icon: Briefcase,       dataKey: "businessModelCanvas"     },
  { id: 393, label: "Revenue Model",     icon: DollarSign,      dataKey: "revenueModelDesign"      },
  { id: 394, label: "Value Chain",       icon: GitBranch,       dataKey: "valueChainOptimization"  },
  { id: 395, label: "Cost Structure",    icon: PieChart,        dataKey: "costStructureAnalysis"   },
  { id: 396, label: "Partnerships",      icon: Users,           dataKey: "partnershipModel"        },
  { id: 397, label: "Growth Levers",     icon: TrendingUp,      dataKey: "growthLeverAssessment"   },
  // Wave 65 — Vendor & Procurement
  { id: 398, label: "Vendor Mgmt",       icon: Users,           dataKey: "vendorManagement"        },
  { id: 399, label: "Supply Chain",       icon: GitBranch,       dataKey: "supplyChainVisibility"   },
  { id: 400, label: "Sustainable Source", icon: Globe,           dataKey: "sustainableSourcing"     },
  { id: 401, label: "Facility Opt",       icon: Server,          dataKey: "facilityOptimization"    },
  { id: 402, label: "Fleet Mgmt",         icon: Briefcase,       dataKey: "fleetManagement"         },
  { id: 403, label: "Customer Success",   icon: Trophy,          dataKey: "customerSuccess"         },
  // Wave 66 — Crisis & Resilience
  { id: 404, label: "Crisis Mgmt",        icon: ShieldAlert,     dataKey: "crisisManagement"        },
  { id: 405, label: "Op Resilience",      icon: ShieldCheck,     dataKey: "operationalResilience"   },
  { id: 406, label: "Stakeholders",       icon: Users,           dataKey: "stakeholderMapping"      },
  { id: 407, label: "Digital Presence",    icon: Globe,           dataKey: "digitalPresence"         },
  { id: 408, label: "Channel Strategy",   icon: Megaphone,       dataKey: "channelStrategy"         },
  { id: 409, label: "Account Mgmt",       icon: Briefcase,       dataKey: "accountManagement"       },
  // Wave 67 — Fundraising & Governance
  { id: 410, label: "Fundraising",        icon: DollarSign,      dataKey: "fundraisingStrategy"     },
  { id: 411, label: "Cap Table",          icon: PieChart,        dataKey: "captableManagement"      },
  { id: 412, label: "Exit Planning",      icon: Flag,            dataKey: "exitPlanning"            },
  { id: 413, label: "Board Gov",          icon: ClipboardCheck,  dataKey: "boardGovernance"         },
  { id: 414, label: "Recruitment",        icon: UserPlus,        dataKey: "recruitmentFunnel"       },
  { id: 415, label: "Employer Brand",     icon: Sparkles,        dataKey: "employerBranding"        },
  // Wave 68 — Team & Operations
  { id: 416, label: "Team Topology",      icon: Users,           dataKey: "teamTopology"            },
  { id: 417, label: "Onboarding Opt",     icon: UserPlus,        dataKey: "onboardingOptimization"  },
  { id: 418, label: "Meeting Culture",    icon: Calendar,        dataKey: "meetingCulture"          },
  { id: 419, label: "Doc Mgmt",           icon: FileText,        dataKey: "documentManagement"      },
  { id: 420, label: "Workflow Auto",      icon: Zap,             dataKey: "workflowAutomation"      },
  { id: 421, label: "Quality Assurance",  icon: CheckCircle2,    dataKey: "qualityAssurance"        },
  // Wave 69 — Cybersecurity & Compliance
  { id: 422, label: "Incident Response",  icon: ShieldAlert,     dataKey: "incidentResponse"        },
  { id: 423, label: "Access Control",     icon: ShieldCheck,     dataKey: "accessControl"           },
  { id: 424, label: "Audit Trail",        icon: ClipboardCheck,  dataKey: "auditTrail"              },
  { id: 425, label: "Pen Testing",        icon: Crosshair,       dataKey: "penetrationTesting"      },
  { id: 426, label: "Security Training",  icon: BookOpen,        dataKey: "securityAwareness"       },
  { id: 427, label: "Data Classification",icon: FileText,        dataKey: "dataClassification"      },
  // Wave 70 — Technical Infrastructure
  { id: 428, label: "API Design",         icon: Server,          dataKey: "apiDesign"               },
  { id: 429, label: "Microservices",      icon: GitBranch,       dataKey: "microservicesArchitecture"},
  { id: 430, label: "Cloud Optimize",     icon: Globe,           dataKey: "cloudOptimization"       },
  { id: 431, label: "DevOps",             icon: Zap,             dataKey: "devopsMaturity"          },
  { id: 432, label: "Monitoring",         icon: Gauge,           dataKey: "systemMonitoring"        },
  { id: 433, label: "Code Quality",       icon: CheckCircle2,    dataKey: "codeQuality"             },
  // Wave 71 — Customer Intelligence
  { id: 434, label: "Customer CLV",       icon: DollarSign,      dataKey: "customerLifetimeValue"   },
  { id: 435, label: "Sentiment",          icon: TrendingUp,      dataKey: "sentimentAnalysis"       },
  { id: 436, label: "Support Tickets",    icon: AlertCircle,     dataKey: "supportTicketAnalysis"   },
  { id: 437, label: "Segment Profit",     icon: PieChart,        dataKey: "segmentProfitability"    },
  { id: 438, label: "Referral Analytics", icon: Users,           dataKey: "referralAnalytics"       },
  { id: 439, label: "Customer Health",    icon: Sparkles,        dataKey: "customerHealthDashboard" },
  // Wave 72 — Strategic Planning
  { id: 440, label: "Innovation Portfolio",icon: Sparkles,       dataKey: "innovationPortfolio"     },
  { id: 441, label: "Contingency",        icon: ShieldOff,       dataKey: "contingencyPlanning"     },
  { id: 442, label: "Operating Rhythm",   icon: Clock,           dataKey: "operatingRhythm"         },
  { id: 443, label: "Cross-Func Sync",    icon: GitBranch,       dataKey: "crossFunctionalSync"     },
  { id: 444, label: "War Room",           icon: Swords,          dataKey: "wardRoomStrategy"        },
  { id: 445, label: "Revenue Intel",      icon: LineChart,       dataKey: "revenueIntelligence"     },
  // Wave 73 — Market Research & Insights
  { id: 446, label: "Market Research",    icon: Globe,           dataKey: "marketResearch"          },
  { id: 447, label: "Competitor Track",   icon: Trophy,          dataKey: "competitorTracking"      },
  { id: 448, label: "Industry Trends",    icon: TrendingUp,      dataKey: "industryTrends"          },
  { id: 449, label: "Social Listening",   icon: Megaphone,       dataKey: "socialListening"         },
  { id: 450, label: "UX Research",        icon: Users,           dataKey: "uxResearch"              },
  { id: 451, label: "Web Analytics",      icon: BarChart3,       dataKey: "webAnalytics"            },
  // Wave 74 — Digital Marketing
  { id: 452, label: "Email Marketing",    icon: Target,          dataKey: "emailMarketing"          },
  { id: 453, label: "CRO",               icon: TrendingUp,      dataKey: "conversionOptimization"  },
  { id: 454, label: "A/B Testing",        icon: GitBranch,       dataKey: "abTestingFramework"      },
  { id: 455, label: "Attribution",        icon: PieChart,        dataKey: "marketingAttribution"    },
  { id: 456, label: "Content Calendar",   icon: Calendar,        dataKey: "contentCalendar"         },
  { id: 457, label: "Social Calendar",    icon: Calendar,        dataKey: "socialMediaCalendar"     },
  // Wave 75 — Financial Planning
  { id: 458, label: "Budget Planning",    icon: DollarSign,      dataKey: "budgetPlanning"          },
  { id: 459, label: "Rev Forecasting",    icon: LineChart,       dataKey: "revenueForecasting"      },
  { id: 460, label: "Cash Mgmt",          icon: DollarSign,      dataKey: "cashManagement"          },
  { id: 461, label: "Credit Mgmt",        icon: ShieldCheck,     dataKey: "creditManagement"        },
  { id: 462, label: "Debt Structure",     icon: BarChart3,       dataKey: "debtStructure"           },
  { id: 463, label: "Financial Report",   icon: FileText,        dataKey: "financialReporting"      },
  // Wave 76 — Sustainability & ESG
  { id: 464, label: "Carbon Reduction",   icon: Zap,             dataKey: "carbonReduction"         },
  { id: 465, label: "Circular Economy",   icon: Globe,           dataKey: "circularEconomy"         },
  { id: 466, label: "Community Impact",   icon: Users,           dataKey: "communityImpact"         },
  { id: 467, label: "Water Mgmt",         icon: Sparkles,        dataKey: "waterManagement"         },
  { id: 468, label: "Waste Reduction",    icon: ShieldOff,       dataKey: "wasteReduction"          },
  { id: 469, label: "Sustainable Innov",  icon: Sparkles,        dataKey: "sustainableInnovation"   },
  // Wave 77 — Talent & People Analytics
  { id: 470, label: "Talent Pipeline",    icon: Users,           dataKey: "talentPipeline"          },
  { id: 471, label: "Leadership Dev",     icon: Trophy,          dataKey: "leadershipDevelopment"   },
  { id: 472, label: "Succession Ready",   icon: ShieldCheck,     dataKey: "successionReadiness"     },
  { id: 473, label: "Comp Strategy",      icon: DollarSign,      dataKey: "compensationStrategy"    },
  { id: 474, label: "Workforce Analytics",icon: BarChart3,       dataKey: "workforceAnalytics"      },
  { id: 475, label: "Org Effectiveness",  icon: Target,          dataKey: "orgEffectiveness"        },
  // Wave 78 — Sales Operations
  { id: 476, label: "Sales Motion",       icon: TrendingUp,      dataKey: "salesMotionDesign"       },
  { id: 477, label: "Deal Analytics",     icon: LineChart,        dataKey: "dealAnalytics"           },
  { id: 478, label: "Territory Optim",    icon: Globe,           dataKey: "territoryOptimization"   },
  { id: 479, label: "Sales Comp",         icon: DollarSign,      dataKey: "salesCompensation"       },
  { id: 480, label: "Revenue Predict",    icon: TrendingUp,      dataKey: "revenuePrediction"       },
  { id: 481, label: "Account Penetr",     icon: Target,          dataKey: "accountPenetration"      },
  // Wave 79 — Product Excellence
  { id: 482, label: "Product Vision",     icon: Sparkles,        dataKey: "productVision"           },
  { id: 483, label: "Feature Roadmap",    icon: GitBranch,       dataKey: "featureRoadmap"          },
  { id: 484, label: "PMF Assessment",     icon: ShieldCheck,     dataKey: "pmfAssessment"           },
  { id: 485, label: "User Activation",    icon: Users,           dataKey: "userActivation"          },
  { id: 486, label: "Product Insights",   icon: PieChart,        dataKey: "productInsights"         },
  { id: 487, label: "Release Strategy",   icon: Zap,             dataKey: "releaseStrategy"         },
  // Wave 80 — Brand & Identity
  { id: 488, label: "Brand Position",     icon: Target,          dataKey: "brandPositionMap"        },
  { id: 489, label: "Brand Valuation",    icon: DollarSign,      dataKey: "brandValuation"          },
  { id: 490, label: "Brand Hierarchy",    icon: GitBranch,       dataKey: "brandHierarchy"          },
  { id: 491, label: "Reputation",         icon: ShieldCheck,     dataKey: "reputationAnalysis"      },
  { id: 492, label: "Messaging",          icon: Megaphone,       dataKey: "messagingFramework"      },
  { id: 493, label: "Visual Branding",    icon: Sparkles,        dataKey: "visualBranding"          },
  // Wave 81 — Strategic Growth Planning
  { id: 494, label: "Growth Playbook",    icon: TrendingUp,      dataKey: "growthPlaybook"          },
  { id: 495, label: "Revenue Run Rate",   icon: DollarSign,      dataKey: "revenueRunRate"          },
  { id: 496, label: "Break-Even Model",   icon: Calculator,      dataKey: "breakEvenModel"          },
  { id: 497, label: "Operating Leverage", icon: BarChart3,       dataKey: "operatingLeverageIndex"  },
  { id: 498, label: "Gross Margin",       icon: PieChart,        dataKey: "grossMarginAnalysis"     },
  { id: 499, label: "Funding Scenarios",  icon: Briefcase,       dataKey: "fundingScenarioModel"    },
  // Wave 82 — Competitive Wargaming
  { id: 500, label: "Competitive Wargame",icon: Swords,          dataKey: "competitiveWargame"      },
  { id: 501, label: "Market Disruption",  icon: Zap,             dataKey: "marketDisruptionModel"   },
  { id: 502, label: "First Mover",        icon: Flag,            dataKey: "firstMoverAnalysis"      },
  { id: 503, label: "Defensibility",      icon: ShieldCheck,     dataKey: "defensibilityAudit"      },
  { id: 504, label: "Pivot Readiness",    icon: Target,          dataKey: "pivotReadiness"          },
  { id: 505, label: "Competitive Timing", icon: Clock,           dataKey: "competitiveTimingModel"  },
  // Wave 83 — Customer Success Advanced
  { id: 506, label: "Customer Maturity",  icon: Users,           dataKey: "customerMaturityModel"   },
  { id: 507, label: "Expansion Signals",  icon: TrendingUp,      dataKey: "expansionSignals"        },
  { id: 508, label: "Adoption Scorecard", icon: ClipboardCheck,  dataKey: "adoptionScorecard"       },
  { id: 509, label: "Stakeholder Sent.",  icon: UserSearch,      dataKey: "stakeholderSentiment"    },
  { id: 510, label: "Value Realization",  icon: Sparkles,        dataKey: "valueRealization"        },
  { id: 511, label: "Renewal Playbook",   icon: BookOpen,        dataKey: "renewalPlaybook"         },
  // Wave 84 — Business Model Design
  { id: 512, label: "Model Innovation",   icon: Sparkles,        dataKey: "businessModelInnovation" },
  { id: 513, label: "Monetization Exp.",  icon: DollarSign,      dataKey: "monetizationExperiment"  },
  { id: 514, label: "Pricing Architect",  icon: Calculator,      dataKey: "pricingArchitecture"     },
  { id: 515, label: "Revenue Streams",    icon: LineChart,       dataKey: "revenueStreamMap"        },
  { id: 516, label: "Cost Drivers",       icon: BarChart3,       dataKey: "costDriverAnalysis"      },
  { id: 517, label: "Value Capture",      icon: Trophy,          dataKey: "valueCapture"            },
  // Wave 85 — Revenue Operations
  { id: 518, label: "Revenue Process",    icon: GitBranch,       dataKey: "revenueProcessMap"       },
  { id: 519, label: "Billing Health",     icon: ShieldCheck,     dataKey: "billingHealthCheck"      },
  { id: 520, label: "Quote-to-Close",     icon: Clock,           dataKey: "quoteToCloseAnalysis"    },
  { id: 521, label: "Revenue Leak Det.",  icon: AlertCircle,     dataKey: "revenueLeakDetector"     },
  { id: 522, label: "Forecast Accuracy",  icon: Target,          dataKey: "forecastAccuracyModel"   },
  { id: 523, label: "Deal Desk Opt.",     icon: Briefcase,       dataKey: "dealDeskOptimization"    },
  // Wave 86 — Workforce Strategy
  { id: 524, label: "Talent Market",      icon: Globe,           dataKey: "talentMarketIntel"       },
  { id: 525, label: "Employee Lifecycle", icon: Users,           dataKey: "employeeLifecycleMap"    },
  { id: 526, label: "Skills Inventory",   icon: ClipboardCheck,  dataKey: "skillsInventory"         },
  { id: 527, label: "Team Dynamics",      icon: UserSearch,      dataKey: "teamDynamicsAnalysis"    },
  { id: 528, label: "Hybrid Work",        icon: Server,          dataKey: "hybridWorkModel"         },
  { id: 529, label: "Compensation Phil.", icon: DollarSign,      dataKey: "compensationPhilosophy"  },
  // Wave 87 — Data & Intelligence
  { id: 530, label: "Data Maturity",      icon: BarChart3,       dataKey: "dataMaturityAssessment"  },
  { id: 531, label: "Insights Priority",  icon: Sparkles,        dataKey: "insightsPrioritization"  },
  { id: 532, label: "Experiment Velocity", icon: Zap,            dataKey: "experimentVelocity"      },
  { id: 533, label: "Decision Intel",     icon: Crosshair,       dataKey: "decisionIntelligence"    },
  { id: 534, label: "Feedback Intel",     icon: Megaphone,       dataKey: "feedbackIntelligence"    },
  { id: 535, label: "Benchmarking",       icon: Gauge,           dataKey: "benchmarkingEngine"      },
  // Wave 88 — Ecosystem & Partnerships
  { id: 536, label: "Partner Value",      icon: Trophy,          dataKey: "partnerValueMap"         },
  { id: 537, label: "Co-Innovation",      icon: Sparkles,        dataKey: "coInnovationPipeline"    },
  { id: 538, label: "Ecosystem Revenue",  icon: DollarSign,      dataKey: "ecosystemRevenue"        },
  { id: 539, label: "Alliance Scorecard", icon: ShieldCheck,     dataKey: "allianceScorecard"       },
  { id: 540, label: "Partner Enablement", icon: BookOpen,        dataKey: "partnerEnablementPlan"   },
  { id: 541, label: "Marketplace Ready",  icon: Globe,           dataKey: "marketplaceReadiness"    },
  // Wave 89 — Strategy Execution
  { id: 542, label: "Strategy Execution", icon: Target,          dataKey: "strategyExecution"       },
  { id: 543, label: "Initiative Track",   icon: Flag,            dataKey: "initiativeTracking"      },
  { id: 544, label: "Resource Alloc",     icon: PieChart,        dataKey: "resourceAllocationModel" },
  { id: 545, label: "Strategic Betting",  icon: Swords,          dataKey: "strategicBetting"        },
  { id: 546, label: "Execution Cadence",  icon: Clock,           dataKey: "executionCadence"        },
  { id: 547, label: "Alignment Index",    icon: Crosshair,       dataKey: "alignmentIndex"          },
  // Wave 90 — Market Intelligence
  { id: 548, label: "Market Signals",     icon: Zap,             dataKey: "marketSignalRadar"       },
  { id: 549, label: "Competitor Moves",   icon: Swords,          dataKey: "competitorMoveTracker"   },
  { id: 550, label: "Customer Voice Agg", icon: Megaphone,       dataKey: "customerVoiceAggregator" },
  { id: 551, label: "Industry Converge",  icon: GitBranch,       dataKey: "industryConvergenceMap"  },
  { id: 552, label: "Emerging Tech",      icon: Sparkles,        dataKey: "emergingTechRadar"       },
  { id: 553, label: "Regulatory Horizon", icon: ShieldCheck,     dataKey: "regulatoryHorizon"       },
  // Wave 91 — Financial Intelligence
  { id: 554, label: "Cash Flow Forecast", icon: DollarSign,      dataKey: "cashFlowForecaster"      },
  { id: 555, label: "Profit Drivers",     icon: TrendingUp,      dataKey: "profitDriverTree"        },
  { id: 556, label: "Revenue Quality",    icon: Gauge,           dataKey: "revenueQualityIndex"     },
  { id: 557, label: "Financial Resil",    icon: ShieldAlert,     dataKey: "financialResilienceScore"},
  { id: 558, label: "Working Cap Opt",    icon: Calculator,      dataKey: "workingCapitalOptimizer" },
  { id: 559, label: "Investment Gate",    icon: Briefcase,       dataKey: "investmentReadinessGate" },
  // Wave 92 — Customer Intelligence
  { id: 560, label: "Customer DNA",       icon: Users,           dataKey: "customerDnaProfile"      },
  { id: 561, label: "Propensity Model",   icon: LineChart,       dataKey: "propensityModel"         },
  { id: 562, label: "Churn Warning",      icon: AlertCircle,     dataKey: "churnEarlyWarning"       },
  { id: 563, label: "Effort Optimizer",   icon: Zap,             dataKey: "customerEffortOptimizer" },
  { id: 564, label: "Loyalty Drivers",    icon: Trophy,          dataKey: "loyaltyDriver"           },
  { id: 565, label: "Account Intel",      icon: UserSearch,      dataKey: "accountIntelligence"     },
  { id: 566, label: "GTM Calendar",       icon: Calendar,        dataKey: "gtmCalendar"             },
  { id: 567, label: "Launch Readiness",   icon: CheckCircle2,    dataKey: "launchReadiness"         },
  { id: 568, label: "Message Testing",    icon: Megaphone,       dataKey: "messageTesting"          },
  { id: 569, label: "Sales Collateral",   icon: FileText,        dataKey: "salesCollateral"         },
  { id: 570, label: "Demand Gen Plan",    icon: TrendingUp,      dataKey: "demandGenPlan"           },
  { id: 571, label: "Channel Activation", icon: Zap,             dataKey: "channelActivation"       },
  { id: 572, label: "Price Elasticity",   icon: LineChart,       dataKey: "priceElasticityModel"    },
  { id: 573, label: "Dynamic Pricing",    icon: DollarSign,      dataKey: "dynamicPricingEngine"    },
  { id: 574, label: "Discount Impact",    icon: Calculator,      dataKey: "discountImpactAnalysis"  },
  { id: 575, label: "Bundle Designer",    icon: Briefcase,       dataKey: "bundleDesigner"          },
  { id: 576, label: "Competitive Pricing",icon: Swords,          dataKey: "competitivePriceTracker" },
  { id: 577, label: "Pricing Experiments",icon: Target,          dataKey: "pricingExperiment"       },
  { id: 578, label: "KPI Watchlist",      icon: Gauge,           dataKey: "kpiWatchlist"            },
  { id: 579, label: "Alert Framework",    icon: AlertCircle,     dataKey: "alertFramework"          },
  { id: 580, label: "Anomaly Detection",  icon: ShieldAlert,     dataKey: "anomalyDetection"        },
  { id: 581, label: "Trend Forecast",     icon: TrendingUp,      dataKey: "trendForecast"           },
  { id: 582, label: "Dashboard Design",   icon: BarChart3,       dataKey: "dashboardDesign"         },
  { id: 583, label: "Insights Catalog",   icon: Sparkles,        dataKey: "insightsCatalog"         },
  { id: 584, label: "Idea Pipeline",      icon: GitBranch,       dataKey: "ideaPipeline"            },
  { id: 585, label: "Innovation Scoring", icon: Trophy,          dataKey: "innovationScoring"       },
  { id: 586, label: "Experiment Board",   icon: ClipboardCheck,  dataKey: "experimentBoard"         },
  { id: 587, label: "Patent Analysis",    icon: ShieldCheck,     dataKey: "patentAnalysis"          },
  { id: 588, label: "Disruption Playbook",icon: Crosshair,       dataKey: "disruptionPlaybook"      },
  { id: 589, label: "Future Proofing",    icon: Flag,            dataKey: "futureProofing"          },
  { id: 590, label: "Revenue Mix",        icon: PieChart,        dataKey: "revenueMixAnalysis"      },
  { id: 591, label: "Account Growth",     icon: UserPlus,        dataKey: "accountGrowthPlan"       },
  { id: 592, label: "Contract Optimizer", icon: FileText,        dataKey: "contractOptimizer"       },
  { id: 593, label: "Usage Patterns",     icon: BarChart3,       dataKey: "usagePatternAnalysis"    },
  { id: 594, label: "Churn Recovery",     icon: ArrowRight,      dataKey: "churnRecoveryPlan"       },
  { id: 595, label: "Winback Program",    icon: Users,           dataKey: "winbackProgram"          },
  { id: 596, label: "Automation Audit",   icon: Zap,             dataKey: "automationAudit"         },
  { id: 597, label: "Process Digitization",icon: Server,         dataKey: "processDigitization"     },
  { id: 598, label: "Bot Deployment",     icon: Globe,           dataKey: "botDeploymentPlan"       },
  { id: 599, label: "Workflow Benchmark", icon: Clock,           dataKey: "workflowBenchmark"       },
  { id: 600, label: "Handoff Efficiency", icon: ArrowRight,      dataKey: "handoffEfficiency"       },
  { id: 601, label: "Tool Consolidation", icon: Briefcase,       dataKey: "toolConsolidation"       },
  { id: 602, label: "Crisis Comms",       icon: ShieldAlert,     dataKey: "crisisCommunication"     },
  { id: 603, label: "Internal Comms",     icon: Megaphone,       dataKey: "internalComms"           },
  { id: 604, label: "Investor Narrative", icon: Presentation,    dataKey: "investorNarrative"       },
  { id: 605, label: "Press Strategy",     icon: BookOpen,        dataKey: "pressStrategy"           },
  { id: 606, label: "Thought Leadership", icon: Sparkles,        dataKey: "thoughtLeadershipPlan"   },
  { id: 607, label: "Brand Story Arc",    icon: Flag,            dataKey: "brandStoryArc"           },
  { id: 608, label: "Mastery Dashboard",  icon: Gauge,           dataKey: "masteryDashboard"        },
  { id: 609, label: "Growth Velocity",    icon: TrendingUp,      dataKey: "growthVelocityScore"     },
  { id: 610, label: "Operational Maturity",icon: CheckCircle2,   dataKey: "operationalMaturity"     },
  { id: 611, label: "Leadership Readiness",icon: Users,          dataKey: "leadershipReadiness"     },
  { id: 612, label: "Market Dominance",   icon: Trophy,          dataKey: "marketDominanceIndex"    },
  { id: 613, label: "Future Readiness",   icon: Crosshair,       dataKey: "futureReadiness"         },
  // ── Wave 101: AI & ML Readiness ──
  { id: 614, label: "AI Adoption Potential", icon: Brain, dataKey: "aiAdoptionPotential" },
  { id: 615, label: "ML Use Cases", icon: Lightbulb, dataKey: "mlUseCaseIdentification" },
  { id: 616, label: "Data Infrastructure Gaps", icon: Layers, dataKey: "dataInfrastructureGapAnalysis" },
  { id: 617, label: "Automation ROI", icon: TrendingUp, dataKey: "automationROIModeling" },
  { id: 618, label: "AI Talent Needs", icon: Users, dataKey: "aiTalentNeedsAssessment" },
  { id: 619, label: "Ethical AI Framework", icon: Shield, dataKey: "ethicalAIFramework" },
  // ── Wave 102: Geographic Expansion ──
  { id: 620, label: "Market Entry Scoring", icon: Globe, dataKey: "marketEntryScoring" },
  { id: 621, label: "Regulatory Landscape", icon: FileText, dataKey: "regulatoryLandscapeMapping" },
  { id: 622, label: "Cultural Adaptation", icon: Heart, dataKey: "culturalAdaptationStrategy" },
  { id: 623, label: "Logistics Expansion", icon: Building, dataKey: "logisticsExpansionAnalysis" },
  { id: 624, label: "Local Partnerships", icon: Users, dataKey: "localPartnershipStrategy" },
  { id: 625, label: "Intl Pricing", icon: BarChart3, dataKey: "internationalPricingOptimization" },
  // ── Wave 103: Customer Lifecycle ──
  { id: 626, label: "Acquisition Funnel", icon: Target, dataKey: "acquisitionFunnelIntelligence" },
  { id: 627, label: "Onboarding Score", icon: CheckCircle2, dataKey: "onboardingEffectivenessScore" },
  { id: 628, label: "Engagement Scoring", icon: Heart, dataKey: "engagementScoringModel" },
  { id: 629, label: "Expansion Revenue", icon: TrendingUp, dataKey: "expansionRevenueOpportunities" },
  { id: 630, label: "Advocacy Program", icon: Users, dataKey: "advocacyProgramDesign" },
  { id: 631, label: "Lifetime Value", icon: BarChart3, dataKey: "lifetimeValueModeling" },
  // ── Wave 104: Platform & API Economy ──
  { id: 632, label: "API Monetization", icon: Zap, dataKey: "apiMonetizationStrategy" },
  { id: 633, label: "Platform Ecosystem", icon: Layers, dataKey: "platformEcosystemHealth" },
  { id: 634, label: "Developer Experience", icon: Lightbulb, dataKey: "developerExperienceOptimization" },
  { id: 635, label: "Integration Marketplace", icon: Building, dataKey: "integrationMarketplaceAnalytics" },
  { id: 636, label: "Partner Enablement", icon: Users, dataKey: "partnerEnablementProgram" },
  { id: 637, label: "Platform Governance", icon: Shield, dataKey: "platformGovernanceFramework" },
  // ── Wave 105: Predictive Analytics ──
  { id: 638, label: "Demand Forecasting", icon: TrendingUp, dataKey: "demandForecastingEngine" },
  { id: 639, label: "Predictive Maintenance", icon: Zap, dataKey: "predictiveMaintenanceModeling" },
  { id: 640, label: "Churn Prediction", icon: Target, dataKey: "churnPredictionModel" },
  { id: 641, label: "Lead Scoring AI", icon: Brain, dataKey: "leadScoringAI" },
  { id: 642, label: "Inventory Optimization", icon: BarChart3, dataKey: "inventoryOptimizationAI" },
  { id: 643, label: "Revenue Prediction", icon: TrendingUp, dataKey: "revenuePredictionModeling" },
  // ── Wave 106: Organizational Design ──
  { id: 644, label: "Org Structure", icon: Building, dataKey: "orgStructureAnalysis" },
  { id: 645, label: "Span of Control", icon: Users, dataKey: "spanOfControlOptimization" },
  { id: 646, label: "Decision Rights", icon: Shield, dataKey: "decisionRightsMapping" },
  { id: 647, label: "Collaboration Network", icon: Layers, dataKey: "collaborationNetworkMapping" },
  { id: 648, label: "Role Optimization", icon: Target, dataKey: "roleOptimizationAnalysis" },
  { id: 649, label: "Succession Planning", icon: Users, dataKey: "successionPlanningFramework" },
  // ── Wave 107: Social Impact & ESG ──
  { id: 650, label: "Impact Measurement", icon: Heart, dataKey: "impactMeasurementDashboard" },
  { id: 651, label: "ESG Compliance", icon: Shield, dataKey: "esgReportingCompliance" },
  { id: 652, label: "Stakeholder Engagement", icon: Users, dataKey: "stakeholderEngagementAnalytics" },
  { id: 653, label: "Community Investment", icon: Globe, dataKey: "communityInvestmentStrategy" },
  { id: 654, label: "Diversity Metrics", icon: Heart, dataKey: "diversityMetricsAnalytics" },
  { id: 655, label: "Green Operations", icon: Zap, dataKey: "greenOperationsOptimization" },
  // ── Wave 108: Knowledge Management ──
  { id: 656, label: "Knowledge Audit", icon: FileText, dataKey: "knowledgeAuditAssessment" },
  { id: 657, label: "Expertise Mapping", icon: Brain, dataKey: "expertiseMappingSystem" },
  { id: 658, label: "Documentation Strategy", icon: FileText, dataKey: "documentationStrategyFramework" },
  { id: 659, label: "Learning Pathways", icon: Lightbulb, dataKey: "learningPathwaysDesign" },
  { id: 660, label: "Institutional Memory", icon: Shield, dataKey: "institutionalMemoryProtection" },
  { id: 661, label: "Knowledge Transfer", icon: Users, dataKey: "knowledgeTransferOptimization" },
];

const GRADE_COLORS: Record<string, { text: string; bg: string }> = {
  A: { text: "text-emerald-700", bg: "bg-emerald-50" },
  B: { text: "text-green-700",   bg: "bg-green-50"   },
  C: { text: "text-yellow-700",  bg: "bg-yellow-50"  },
  D: { text: "text-orange-700",  bg: "bg-orange-50"  },
  F: { text: "text-red-700",     bg: "bg-red-50"     },
};

const SEVERITY_COLORS: Record<string, string> = {
  HIGH:     "text-red-700 bg-red-50 border-red-200",
  MED:      "text-amber-700 bg-amber-50 border-amber-200",
  LOW:      "text-blue-700 bg-blue-50 border-blue-200",
  Critical: "text-red-700 bg-red-50 border-red-200",
  High:     "text-orange-700 bg-orange-50 border-orange-200",
  Medium:   "text-yellow-700 bg-yellow-50 border-yellow-200",
  Low:      "text-zinc-600 bg-zinc-50 border-zinc-200",
};

function fmt(n: number) {
  if (!n) return "$0";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[10px] font-mono text-zinc-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
      {children}
    </h3>
  );
}

function ConfidenceBanner({ provenance }: { provenance: NonNullable<MVPDeliverables["dataProvenance"]> }) {
  const hasWarnings = provenance.warnings.length > 0;
  const hasGaps = provenance.coverageGaps.length > 0;
  if (!hasWarnings && !hasGaps) return null;

  const severity = provenance.warnings.length > 2 ? "high" : hasWarnings ? "medium" : "low";
  const colors = severity === "high"
    ? "bg-red-50 border-red-200 text-red-800"
    : severity === "medium"
    ? "bg-amber-50 border-amber-200 text-amber-800"
    : "bg-zinc-50 border-zinc-200 text-zinc-600";

  return (
    <div className={`border rounded-xl p-4 mb-6 ${colors}`}>
      <div className="flex items-center gap-2 mb-2">
        <AlertCircle className="w-4 h-4 shrink-0" />
        <span className="text-[10px] font-mono uppercase tracking-widest font-bold">
          {severity === "high" ? "Treat numbers as rough estimates only"
            : severity === "medium" ? "Some figures are AI estimates"
            : "Data coverage notes"}
        </span>
        <span className="text-[9px] font-mono opacity-60 ml-auto">
          {provenance.financialFactCount} verified facts from {provenance.documentSources.length} documents
        </span>
      </div>
      {hasWarnings && (
        <ul className="text-xs space-y-1 ml-6">
          {provenance.warnings.slice(0, 3).map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ul>
      )}
      {hasGaps && (
        <div className="text-[10px] opacity-70 mt-2 ml-6">
          Coverage gaps: {provenance.coverageGaps.join(", ")}
        </div>
      )}
    </div>
  );
}

export function ResultsView({ runId, onBack, onNewRun }: ResultsViewProps) {
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);
  const [phase, setPhase] = useState<string>("PLAN");
  const [activeTab, setActiveTab] = useState(0);
  const [viewMode, setViewMode] = useState<"report" | "execute">("report");
  const [chartOverlays, setChartOverlays] = useState<Record<string, any>>({});

  const handleProjection = (section: string) => (data: { projection: any; insight: string | null }) => {
    setChartOverlays(prev => ({ ...prev, [section]: data.projection }));
  };

  const clearOverlay = (section: string) => () => {
    setChartOverlays(prev => {
      const next = { ...prev };
      delete next[section];
      return next;
    });
  };

  useEffect(() => {
    if (job?.phase) setPhase(job.phase);
  }, [job?.phase]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/job?runId=${encodeURIComponent(runId)}`)
      .then((res) => {
        if (!res.ok) throw new Error("Job not found");
        return res.json();
      })
      .then((data) => { if (!cancelled) setJob(data); })
      .catch((e) => { if (!cancelled) setError(e.message || "Failed to load results"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [runId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FDFDFD] flex flex-col items-center justify-center p-8">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          className="w-12 h-12 border-2 border-zinc-200 border-t-zinc-900 rounded-full mb-4" />
        <div className="text-zinc-500 font-mono text-xs uppercase tracking-widest">Retrieving intelligence...</div>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="min-h-screen bg-[#FDFDFD] flex flex-col items-center justify-center p-8 text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <h2 className="text-xl font-medium text-zinc-900 mb-2">Analysis Unavailable</h2>
        <div className="text-red-600 font-mono text-sm mb-6">{error || "The requested analysis could not be located."}</div>
        <button onClick={onBack} className="px-6 py-2 bg-zinc-900 text-white text-xs font-mono uppercase tracking-wider hover:bg-zinc-800 transition-all rounded-lg">Return to Dashboard</button>
      </div>
    );
  }

  if (job.status === "failed") {
    return (
      <div className="min-h-screen bg-[#FDFDFD] flex flex-col items-center justify-center p-8 text-center max-w-xl mx-auto">
        <ShieldAlert className="w-12 h-12 text-red-500 mb-4" />
        <h2 className="text-2xl font-light text-zinc-900 mb-2">Analysis Interrupted</h2>
        <p className="text-sm text-zinc-500 mb-8">{job.error || "An unexpected error occurred during the synthesis phase."}</p>
        <div className="flex gap-4">
          <button onClick={onBack} className="px-6 py-2 border border-zinc-200 text-zinc-700 text-xs font-mono uppercase tracking-wider hover:bg-zinc-50 transition-all rounded-lg">Dashboard</button>
          <button onClick={onNewRun} className="px-6 py-2 bg-zinc-900 text-white text-xs font-mono uppercase tracking-wider hover:bg-zinc-800 transition-all shadow-lg rounded-lg">New Analysis</button>
        </div>
      </div>
    );
  }

  const isReady = (job.status === "completed" || job.status === "formatting") && job.deliverables;
  if (!isReady) {
    return (
      <div className="min-h-screen bg-[#FDFDFD] flex flex-col items-center justify-center p-8">
        <div className="text-zinc-500 font-mono text-xs uppercase tracking-widest mb-4">Report Generation In Progress</div>
        <div className="w-64 h-1 bg-zinc-100 rounded-full overflow-hidden">
          <motion.div initial={{ x: "-100%" }} animate={{ x: "100%" }} transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            className="w-1/2 h-full bg-zinc-900" />
        </div>
        <p className="mt-4 text-[10px] text-zinc-400 font-mono uppercase tracking-wider">Status: {job.status}</p>
        <button onClick={onBack} className="mt-8 text-xs text-zinc-500 hover:text-zinc-900 underline underline-offset-4 transition-colors">Return to Dashboard</button>
      </div>
    );
  }

  const d = job.deliverables as MVPDeliverables;

  const sortedTabs = useMemo(() => {
    const coreTabs = TABS.filter(t => t.id <= 13);
    const restTabs = TABS.filter(t => t.id > 13 && (d as unknown as Record<string, unknown>)[t.dataKey!]);
    restTabs.sort((a, b) => {
      const aLen = JSON.stringify((d as unknown as Record<string, unknown>)[a.dataKey!] || {}).length;
      const bLen = JSON.stringify((d as unknown as Record<string, unknown>)[b.dataKey!] || {}).length;
      return bLen - aLen;
    });
    return [...coreTabs, ...restTabs];
  }, [d]);
  const base = `${typeof window !== "undefined" ? window.location.origin : ""}/api/download`;

  const handleApprove = async () => {
    setApproving(true);
    try {
      const res = await fetch(`/api/job/phase`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId, phase: "EXECUTE" }),
      });
      if (!res.ok) throw new Error("Phase transition failed");
      setPhase("EXECUTE");
    } catch (err) {
      console.error(err);
    } finally {
      setApproving(false);
    }
  };

  const isExecutePhase = phase === "EXECUTE";

  if (isExecutePhase && viewMode === "execute") {
    return (
      <div className="relative">
        {/* Floating toggle to switch back to report */}
        <button
          onClick={() => setViewMode("report")}
          className="fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-2 bg-white text-zinc-900 text-xs font-mono uppercase tracking-wider rounded-xl shadow-2xl border border-zinc-200 hover:bg-zinc-50 transition-all"
        >
          <FileText className="w-3.5 h-3.5" />
          View Report
        </button>
        <ExecutionView job={job} onBack={onBack} />
      </div>
    );
  }

  // ── Data helpers ────────────────────────────────────────────────────────────
  const hs = d.healthScore;
  const ci = d.cashIntelligence;
  const rl = d.revenueLeakAnalysis;
  const ir = d.issuesRegister;
  const arc = d.atRiskCustomers;
  const db2 = d.decisionBrief;
  const ap = d.actionPlan;
  const mi = d.marketIntelligence;
  const chartOrgId = job.questionnaire.orgId ?? "default-org";

  const radarData = (hs.dimensions || []).map((dim) => ({
    dimension: dim.name.split(" ")[0],
    score: dim.score,
  }));

  const weeklyModel = (ci as any).weeklyProjections || (ci as any).weekly_model || [];

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-zinc-900 flex flex-col font-sans">

      {/* ── Top Header ────────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-zinc-200 sticky top-0 z-30 px-6 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-zinc-50 rounded-full transition-colors text-zinc-400 hover:text-zinc-900">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 border-l border-zinc-200 pl-4">
            <div className="w-7 h-7 bg-zinc-900 flex items-center justify-center rounded-md shadow-sm">
              <div className="w-2.5 h-2.5 bg-white rounded-sm rotate-45" />
            </div>
            <div>
              <div className="text-sm font-bold tracking-tight text-zinc-900 leading-none">{job.questionnaire.organizationName}</div>
              <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest mt-0.5">Intelligence Report</div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <a href={`${base}?runId=${encodeURIComponent(runId)}&format=pdf`}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-zinc-200 text-zinc-600 text-xs font-mono uppercase tracking-wider hover:bg-zinc-50 transition-all rounded-lg">
            <Download className="w-3.5 h-3.5" /> PDF
          </a>
          {isExecutePhase ? (
            <button onClick={() => setViewMode("execute")}
              className="px-4 py-2 bg-zinc-900 text-white text-xs font-mono uppercase tracking-wider hover:bg-zinc-800 transition-all rounded-lg shadow-md active:scale-95 flex items-center gap-2">
              <ShieldCheck className="w-3.5 h-3.5" />
              Execution Center
            </button>
          ) : (
            <button onClick={handleApprove} disabled={approving}
              className="px-4 py-2 bg-zinc-900 text-white text-xs font-mono uppercase tracking-wider hover:bg-zinc-800 transition-all rounded-lg shadow-md active:scale-95 flex items-center gap-2">
              {approving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
              Approve & Execute
            </button>
          )}
        </div>
      </header>

      {/* ── Score Hero ────────────────────────────────────────────────────── */}
      <div className="bg-zinc-900 text-white px-6 py-8">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row gap-8 items-center">
          <div className="text-center md:text-left flex-1">
            <p className="text-zinc-500 text-[10px] font-mono uppercase tracking-widest mb-2">Business Health Score</p>
            <div className="flex items-end gap-3 justify-center md:justify-start">
              <span className="text-7xl font-light tabular-nums">{hs.score ?? "—"}</span>
              <span className="text-xl text-zinc-500 mb-2">/100</span>
              {hs.grade && (
                <span className={`text-2xl font-bold mb-2 px-3 py-1 rounded-lg ${GRADE_COLORS[hs.grade]?.text ?? "text-zinc-300"} ${GRADE_COLORS[hs.grade]?.bg ?? "bg-zinc-800"}`}>
                  {hs.grade}
                </span>
              )}
            </div>
            {hs.headline && <p className="text-lg font-medium mt-2 text-zinc-100">{hs.headline}</p>}
            {hs.summary && <p className="text-zinc-400 text-sm mt-1 max-w-lg leading-relaxed">{hs.summary}</p>}
          </div>
          {radarData.length > 0 && (
            <div className="w-56 h-56 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData}>
                  <PolarGrid stroke="#3f3f46" />
                  <PolarAngleAxis dataKey="dimension" tick={{ fill: "#71717a", fontSize: 10 }} />
                  <Radar name="Score" dataKey="score" stroke="#e4e4e7" fill="#e4e4e7" fillOpacity={0.25} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* ── Tab Navigation ────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-zinc-200 sticky top-[61px] z-20">
        <div className="max-w-5xl mx-auto px-4 flex gap-0 overflow-x-auto scrollbar-none">
          {sortedTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            // Hide conditional tabs when data not available
            if (tab.dataKey && !(d as unknown as Record<string, unknown>)[tab.dataKey]) return null;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-3.5 text-xs font-mono whitespace-nowrap border-b-2 transition-all uppercase tracking-widest ${
                  isActive
                    ? "border-zinc-900 text-zinc-900"
                    : "border-transparent text-zinc-400 hover:text-zinc-700 hover:border-zinc-300"
                }`}
              >
                <Icon className="w-3 h-3" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Tab Content ───────────────────────────────────────────────────── */}
      <main className="max-w-5xl mx-auto w-full px-4 py-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
          >

            {/* Data confidence indicator */}
            {d.dataProvenance && (
              <ConfidenceBanner provenance={d.dataProvenance} />
            )}

            {/* ── Tab 0: Health Score ─────────────────────────────────────── */}
            {activeTab === 0 && (
              <div className="space-y-4">
                {(hs.dimensions || []).map((dim, i) => (
                  <div key={i} className="bg-white border border-zinc-200 rounded-2xl p-6 flex flex-col md:flex-row gap-5 items-start md:items-center shadow-sm">
                    <div className="flex items-center gap-4 shrink-0">
                      <div className="text-center w-16">
                        <div className="text-3xl font-light text-zinc-900 tabular-nums">{dim.score}</div>
                        {dim.grade && (
                          <div className={`text-xs font-bold mt-1 px-2 py-0.5 rounded ${GRADE_COLORS[dim.grade]?.text ?? ""} ${GRADE_COLORS[dim.grade]?.bg ?? ""}`}>
                            {dim.grade}
                          </div>
                        )}
                      </div>
                      <div className="w-24 h-2 bg-zinc-100 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${dim.score}%` }}
                          transition={{ duration: 1, delay: i * 0.1 }}
                          className="h-full bg-zinc-900/70 rounded-full"
                        />
                      </div>
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-zinc-900">{dim.name}</p>
                      {dim.summary && <p className="text-sm text-zinc-500 mt-1">{dim.summary}</p>}
                      {dim.driver && <p className="text-sm text-zinc-700 mt-1 font-medium">Key driver: {dim.driver}</p>}
                      {(dim as any).key_finding && <p className="text-sm text-zinc-600 mt-1 italic">{(dim as any).key_finding}</p>}
                    </div>
                  </div>
                ))}
                {hs.summary && (
                  <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm">
                    <SectionHeader><Sparkles className="w-3 h-3" /> Summary</SectionHeader>
                    <p className="text-sm text-zinc-600 leading-relaxed">{hs.summary}</p>
                  </div>
                )}
              </div>
            )}

            {/* ── Tab 1: Cash Intelligence ────────────────────────────────── */}
            {activeTab === 1 && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    { label: "Current Cash Position", value: fmt(Number((ci as any).currentCashPosition ?? (ci as any).current_cash_position ?? 0)) },
                    { label: "Cash Runway", value: `${(ci as any).runwayWeeks ?? (ci as any).runway_weeks ?? "?"} weeks` },
                    { label: "Critical Weeks",
                      value: (() => {
                        const cw = (ci as any).criticalWeeks ?? (ci as any).critical_weeks;
                        return Array.isArray(cw) && cw.length ? `Week ${cw.join(", ")}` : "None flagged";
                      })()
                    },
                  ].map((m) => (
                    <div key={m.label} className="bg-white border border-zinc-200 rounded-2xl p-6 text-center shadow-sm">
                      <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest mb-2">{m.label}</p>
                      <p className="text-2xl font-light text-zinc-900">{m.value}</p>
                    </div>
                  ))}
                </div>

                {ci.summary && (
                  <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm">
                    <p className="text-sm text-zinc-600 leading-relaxed">{ci.summary}</p>
                  </div>
                )}

                {/* Cash flow charts */}
                <CashFlowChart projections={(ci as any).weeklyProjections ?? []} overlay={chartOverlays.cash} />
                <ChartInteraction
                  section="cash"
                  orgId={chartOrgId}
                  prompts={[
                    "What weeks are most dangerous for cash?",
                    "How can I extend my runway by 4 weeks?",
                    "What expenses should I cut first?",
                  ]}
                  projectionConfig={{
                    type: "cash_forecast",
                    scenario: "Continue current burn rate with no changes to revenue or expenses",
                    months: 3,
                  }}
                  onProjection={handleProjection("cash")}
                  onDismiss={clearOverlay("cash")}
                />

                {weeklyModel.length > 0 && (
                  <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm">
                    <SectionHeader><BarChart3 className="w-3 h-3" /> 13-Week Cash Forecast</SectionHeader>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={weeklyModel}>
                        <XAxis dataKey="week" tick={{ fontSize: 11, fill: "#71717a" }} tickFormatter={(v) => `W${v}`} />
                        <YAxis tick={{ fontSize: 11, fill: "#71717a" }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`} />
                        <Tooltip formatter={(v) => fmt(v as number)} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                        <Bar dataKey="closing_balance" radius={[4, 4, 0, 0]}>
                          {weeklyModel.map((entry: any, i: number) => (
                            <Cell key={i} fill={entry.risk_flag ? "#ef4444" : "#18181b"} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm">
                    <SectionHeader><AlertCircle className="w-3 h-3" /> Cash Risks</SectionHeader>
                    <ul className="space-y-3">
                      {(ci.risks || []).map((r, i) => (
                        <li key={i} className="flex gap-3 text-sm text-zinc-700 bg-red-50 p-3 rounded-xl border border-red-100">
                          <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                          <span>{typeof r === "string" ? r : (r as any).description || JSON.stringify(r)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm">
                    <SectionHeader><ChevronRight className="w-3 h-3" /> Recommendations</SectionHeader>
                    <ul className="space-y-3">
                      {(ci.recommendations || []).map((a, i) => (
                        <li key={i} className="flex gap-3 text-sm text-zinc-700 bg-zinc-50 p-3 rounded-xl border border-zinc-100">
                          <ChevronRight className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" />
                          <span>{typeof a === "string" ? a : JSON.stringify(a)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* ── Tab 2: Revenue Leaks ────────────────────────────────────── */}
            {activeTab === 2 && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white border-2 border-zinc-900 rounded-2xl p-6 text-center shadow-sm">
                    <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest mb-2">Total Recoverable</p>
                    <p className="text-3xl font-light text-zinc-900">{fmt(rl.totalIdentified || 0)}</p>
                  </div>
                  <div className="bg-white border border-zinc-200 rounded-2xl p-6 text-center shadow-sm">
                    <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest mb-2">90-Day Projection</p>
                    <p className="text-2xl font-light text-zinc-900">{fmt(Number((rl as any).day90RecoveryProjection ?? (rl as any).day90_recovery_projection ?? 0))}</p>
                  </div>
                  <div className="bg-white border border-zinc-200 rounded-2xl p-6 text-center shadow-sm">
                    <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest mb-2">Priority Action</p>
                    <p className="text-xs text-zinc-700 font-medium leading-snug">{(rl as any).priorityAction ?? (rl as any).priority_action ?? "—"}</p>
                  </div>
                </div>

                {rl.summary && (
                  <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm">
                    <p className="text-sm text-zinc-600 italic border-l-2 border-zinc-200 pl-4">{rl.summary}</p>
                  </div>
                )}

                {/* Revenue leak charts */}
                <RevenueLeakChart items={rl.items || []} overlay={chartOverlays.revenue} onDismissOverlay={clearOverlay("revenue")} />
                <ChartInteraction
                  section="revenue"
                  orgId={chartOrgId}
                  prompts={[
                    "Which leak should I fix first for fastest ROI?",
                    "What if I recovered the top 3 leaks?",
                    "Break down the root causes of my biggest leak",
                  ]}
                  projectionConfig={{
                    type: "revenue_recovery",
                    scenario: "Fix the top 3 revenue leaks over the next 10 weeks",
                    months: 3,
                  }}
                  onProjection={handleProjection("revenue")}
                  onDismiss={clearOverlay("revenue")}
                />

                {(rl.items || []).map((item, i) => (
                  <div key={i} className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="flex items-center gap-3">
                        <span className="w-7 h-7 rounded-lg bg-zinc-100 text-zinc-600 text-xs font-bold flex items-center justify-center shrink-0">
                          #{i + 1}
                        </span>
                        <div>
                          <p className="font-semibold text-zinc-900">{item.description}</p>
                          {(item as any).clientOrArea && <p className="text-sm text-zinc-500">{(item as any).clientOrArea}</p>}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-light text-red-600">{fmt(item.amount || 0)}</p>
                        {(item as any).confidence && <p className="text-xs text-zinc-400">{(item as any).confidence} confidence</p>}
                      </div>
                    </div>
                    {(item as any).rootCause && <p className="text-sm text-zinc-500 mt-3">{(item as any).rootCause}</p>}
                    {(item as any).recoveryAction && (
                      <p className="text-sm text-zinc-700 font-medium mt-2">
                        <ChevronRight className="w-3 h-3 inline-block mr-1 text-zinc-400" />
                        {(item as any).recoveryAction}
                        {(item as any).timeline && ` (${(item as any).timeline})`}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* ── Tab 3: Issues Register ──────────────────────────────────── */}
            {activeTab === 3 && (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4 mb-2">
                  {[
                    { label: "Total Issues",        value: String(ir.issues?.length ?? 0) },
                    { label: "Critical",            value: String(ir.issues?.filter(i => i.severity === "HIGH" || i.severity === "Critical").length ?? 0), cls: "text-red-600" },
                    { label: "Financial Exposure",  value: fmt(ir.issues?.reduce((s, i) => s + (i.financialImpact ?? 0), 0) ?? 0) },
                  ].map((m) => (
                    <div key={m.label} className="bg-white border border-zinc-200 rounded-2xl p-6 text-center shadow-sm">
                      <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest mb-2">{m.label}</p>
                      <p className={`text-2xl font-light ${m.cls ?? "text-zinc-900"}`}>{m.value}</p>
                    </div>
                  ))}
                </div>

                {/* Issues charts */}
                <IssuesSeverityChart issues={ir.issues || []} overlay={chartOverlays.issues} onDismissOverlay={clearOverlay("issues")} />
                <ChartInteraction
                  section="issues"
                  orgId={chartOrgId}
                  prompts={[
                    "What's the total financial exposure from critical issues?",
                    "Which issue should I tackle this week?",
                    "How do these issues affect my cash runway?",
                  ]}
                  onProjection={handleProjection("issues")}
                  onDismiss={clearOverlay("issues")}
                  projectionConfig={{
                    type: "growth_scenario",
                    scenario: "Resolve all critical and high-severity issues over the next 10 weeks",
                    months: 3,
                  }}
                />

                {(ir.issues || []).map((issue, i) => (
                  <div key={i} className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm">
                    <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] font-mono text-zinc-400">{issue.id}</span>
                        <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border uppercase ${SEVERITY_COLORS[issue.severity ?? "Low"]}`}>
                          {issue.severity}
                        </span>
                        {issue.category && (
                          <span className="text-[10px] text-zinc-500 bg-zinc-100 rounded px-2 py-0.5 font-mono">{issue.category}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        {issue.financialImpact != null && (
                          <span className="text-lg font-light text-red-600">{fmt(issue.financialImpact)}</span>
                        )}
                      </div>
                    </div>
                    <p className="font-semibold text-zinc-900 mb-1">{issue.description}</p>
                    {(issue as any).recommendation && (
                      <p className="text-sm text-zinc-600 mt-2">
                        <ChevronRight className="w-3 h-3 inline-block mr-1 text-zinc-400" />
                        {(issue as any).recommendation}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* ── Tab 4: At-Risk Customers ────────────────────────────────── */}
            {activeTab === 4 && (
              <div className="space-y-4">
                {arc.summary && (
                  <div className="bg-red-50 border border-red-100 rounded-2xl p-5">
                    <p className="text-sm font-medium text-zinc-900">
                      Revenue at Risk: <span className="text-red-600 text-xl font-light ml-2">
                        {fmt(arc.customers?.reduce((s, c) => s + (c.revenueAtRisk ?? 0), 0) ?? 0)}
                      </span>
                    </p>
                    <p className="text-sm text-zinc-600 mt-1">{arc.summary}</p>
                  </div>
                )}

                {/* Customer risk scatter chart */}
                <CustomerRiskScatter customers={arc.customers || []} overlay={chartOverlays.customers} onDismissOverlay={clearOverlay("customers")} />
                <ChartInteraction
                  section="customers"
                  orgId={chartOrgId}
                  prompts={[
                    "What happens if I lose my highest-risk customer?",
                    "Which customer should I call first and what do I say?",
                    "What's my total revenue exposure from at-risk clients?",
                  ]}
                  projectionConfig={{
                    type: "customer_churn",
                    scenario: "Lose the highest-risk customer within 4 weeks with no replacement revenue",
                    months: 3,
                  }}
                  onProjection={handleProjection("customers")}
                  onDismiss={clearOverlay("customers")}
                />

                {(arc.customers || []).map((c, i) => (
                  <div key={i} className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm">
                    <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
                      <div>
                        <p className="text-xl font-medium text-zinc-900 uppercase tracking-tight">{c.name}</p>
                        {c.revenueAtRisk != null && (
                          <p className="text-sm text-zinc-500">Revenue at risk: {fmt(c.revenueAtRisk)}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <span className={`text-[10px] font-mono font-bold px-2 py-1 rounded-lg border uppercase ${SEVERITY_COLORS["High"]}`}>
                          {c.risk}
                        </span>
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4 mt-2">
                      {(c as any).warningSignals?.length > 0 && (
                        <div>
                          <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest mb-2">Warning Signals</p>
                          <ul className="space-y-1">
                            {(c as any).warningSignals.map((s: string, si: number) => (
                              <li key={si} className="text-sm text-zinc-700 flex gap-2">
                                <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" /> {s}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      <div>
                        <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest mb-2">Recommended Action</p>
                        <p className="text-sm text-zinc-700 border-l-2 border-zinc-900 pl-3">{c.recommendation}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── Tab 5: Decision Brief ───────────────────────────────────── */}
            {activeTab === 5 && (
              <div className="space-y-4">
                <div className="bg-zinc-900 text-white rounded-2xl p-8">
                  <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-3">Decision Required</p>
                  <p className="text-2xl font-light mb-3">{db2.decision}</p>
                  {db2.context && <p className="text-zinc-400 text-sm leading-relaxed">{db2.context}</p>}
                </div>

                {(db2.options || []).length > 0 && (
                  <div className="grid md:grid-cols-2 gap-4">
                    {(db2.options || []).map((opt, i) => (
                      <div key={i} className={`bg-white border rounded-2xl p-6 shadow-sm transition-all ${opt.recommendation ? "border-zinc-900 ring-2 ring-zinc-900/10" : "border-zinc-200"}`}>
                        {opt.recommendation && (
                          <span className="inline-flex items-center gap-1 text-[9px] font-mono bg-zinc-900 text-white px-2 py-0.5 rounded uppercase tracking-widest mb-3">
                            Recommended
                          </span>
                        )}
                        <p className="font-semibold text-zinc-900 mb-2">{opt.label}</p>
                        <p className="text-xs text-zinc-500 mb-3">{opt.expectedOutcome ?? opt.outcome}</p>
                        <div className="grid grid-cols-2 gap-3">
                          {opt.pros && opt.pros.length > 0 && (
                            <div>
                              <p className="text-[9px] font-mono text-green-600 uppercase tracking-widest mb-1">Pros</p>
                              {opt.pros.map((p, pi) => (
                                <p key={pi} className="text-xs text-zinc-700">+ {p}</p>
                              ))}
                            </div>
                          )}
                          {opt.cons && opt.cons.length > 0 && (
                            <div>
                              <p className="text-[9px] font-mono text-red-600 uppercase tracking-widest mb-1">Cons</p>
                              {opt.cons.map((c, ci2) => (
                                <p key={ci2} className="text-xs text-zinc-700">- {c}</p>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {db2.recommendation && (
                  <div className="bg-white border-2 border-zinc-900 rounded-2xl p-6 shadow-sm">
                    <SectionHeader>Pivot Recommendation</SectionHeader>
                    <p className="font-semibold text-zinc-900 mb-2">{db2.recommendation}</p>
                    {db2.rationale && <p className="text-sm text-zinc-500 leading-relaxed">{db2.rationale}</p>}
                    {db2.nextStep && (
                      <div className="mt-4 pt-4 border-t border-zinc-100">
                        <p className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest mb-1">Next Step (48 Hours)</p>
                        <p className="text-sm text-zinc-700 font-medium">{db2.nextStep}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── Tab 6: Action Plan ──────────────────────────────────────── */}
            {activeTab === 6 && (
              <div>
                <div className="space-y-10 relative before:absolute before:inset-0 before:left-[11px] before:w-[1px] before:bg-zinc-100 before:z-0">
                  {(ap.days || []).map((day, i) => (
                    <div key={i} className="relative z-10 pl-10">
                      <div className="absolute left-0 top-0 w-6 h-6 bg-white border-2 border-zinc-900 rounded-full flex items-center justify-center text-[10px] font-bold">
                        {day.day}
                      </div>
                      <div className="mb-4">
                        <h4 className="text-lg font-medium text-zinc-900">{day.title}</h4>
                        <div className="h-[1px] w-10 bg-zinc-200 mt-1" />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {day.tasks.map((task, j) => (
                          <div key={j} className="bg-white border border-zinc-100 p-4 rounded-xl flex items-start gap-3 shadow-sm">
                            <div className="w-5 h-5 bg-zinc-50 border border-zinc-200 rounded-md flex items-center justify-center shrink-0 mt-0.5">
                              <div className="w-2 h-2 border-b border-r border-zinc-300 rotate-45" />
                            </div>
                            <div>
                              <div className="text-sm text-zinc-800 leading-snug">{task.description}</div>
                              <div className="flex items-center gap-2 mt-2">
                                <span className="text-[9px] font-mono text-zinc-400 uppercase">{task.owner}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                {ap.summary && (
                  <div className="mt-10 pt-8 border-t border-zinc-100">
                    <SectionHeader>Strategy Summary</SectionHeader>
                    <p className="text-sm text-zinc-600 leading-relaxed italic">{ap.summary}</p>
                  </div>
                )}
              </div>
            )}

            {/* ── Tab 7: Growth Intelligence ──────────────────────────────── */}
            {activeTab === 7 && mi && (
              <div className="space-y-8">
                {/* Header banner */}
                <div className="bg-zinc-900 text-white rounded-2xl p-8">
                  <div className="flex items-start justify-between flex-wrap gap-3">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Globe className="w-4 h-4 text-zinc-400" />
                        <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">Growth Intelligence Report</p>
                        {mi.searchPowered && (
                          <span className="text-[9px] bg-green-600 text-white px-2 py-0.5 rounded-full font-mono uppercase">Live Research</span>
                        )}
                      </div>
                      <p className="text-xl font-medium">{mi.industry ?? "Your Industry"}</p>
                      {mi.industryContext && <p className="text-zinc-400 text-sm mt-1 max-w-2xl leading-relaxed">{mi.industryContext}</p>}
                    </div>
                  </div>
                  {mi.urgentOpportunity && (
                    <div className="mt-5 bg-white/10 rounded-xl p-4 border border-white/20">
                      <p className="text-[9px] font-mono text-yellow-300 uppercase tracking-widest mb-1 flex items-center gap-1">
                        <Zap className="w-3 h-3" /> Priority This Week
                      </p>
                      <p className="text-white font-medium text-sm">{mi.urgentOpportunity}</p>
                    </div>
                  )}
                </div>

                {/* Benchmarks */}
                {(mi.benchmarks || []).length > 0 && (
                  <div>
                    <SectionHeader><BarChart3 className="w-3 h-3" /> Industry Benchmarks</SectionHeader>
                    <div className="space-y-3">
                      {(mi.benchmarks || []).map((b, i) => {
                        const gap = (b.gapAnalysis ?? "").toLowerCase();
                        const gapColor = gap.includes("above") ? "text-green-600 bg-green-50 border-green-200"
                          : gap.includes("below") ? "text-red-600 bg-red-50 border-red-200"
                          : "text-zinc-500 bg-zinc-50 border-zinc-200";
                        return (
                          <div key={i} className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm flex flex-col md:flex-row gap-4">
                            <div className="flex-1">
                              <p className="font-semibold text-zinc-900">{b.metric}</p>
                              {b.implication && <p className="text-sm text-zinc-500 mt-1">{b.implication}</p>}
                            </div>
                            <div className="flex items-center gap-6 shrink-0 text-right">
                              <div>
                                <p className="text-[9px] font-mono text-zinc-400 uppercase">Industry Range</p>
                                <p className="font-semibold text-zinc-900">{b.industryRange ?? "—"}</p>
                              </div>
                              <div>
                                <p className="text-[9px] font-mono text-zinc-400 uppercase">Your Business</p>
                                <p className="font-semibold text-zinc-900">{b.thisBusinessEstimate ?? "—"}</p>
                              </div>
                              <div>
                                <p className="text-[9px] font-mono text-zinc-400 uppercase">Gap</p>
                                <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded border capitalize ${gapColor}`}>
                                  {b.gapAnalysis ?? "—"}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Quick Wins */}
                {(mi.quickWins || []).length > 0 && (
                  <div>
                    <SectionHeader><Zap className="w-3 h-3" /> Quick Wins — Immediate Cash Actions</SectionHeader>
                    <div className="space-y-3">
                      {(mi.quickWins || []).map((w, i) => (
                        <div key={i} className="bg-white border border-l-4 border-zinc-200 border-l-zinc-900 rounded-2xl p-5 shadow-sm">
                          <div className="flex items-start justify-between gap-3 flex-wrap">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="w-6 h-6 bg-zinc-100 text-zinc-700 rounded-full flex items-center justify-center text-xs font-bold shrink-0">{i + 1}</span>
                                <p className="font-semibold text-zinc-900">{w.action}</p>
                              </div>
                              {w.instructions && <p className="text-sm text-zinc-600 ml-8">{w.instructions}</p>}
                            </div>
                            <div className="text-right shrink-0">
                              <span className="text-[9px] font-mono bg-zinc-100 text-zinc-600 px-2 py-1 rounded-lg block mb-1">{w.timeline}</span>
                              <p className="text-sm font-bold text-green-600">{w.expectedCashImpact}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Low-Hanging Fruit */}
                {(mi.lowHangingFruit || []).length > 0 && (
                  <div>
                    <SectionHeader><Zap className="w-3 h-3" /> Low-Hanging Fruit Opportunities</SectionHeader>
                    <div className="grid md:grid-cols-2 gap-4">
                      {(mi.lowHangingFruit || []).map((lhf, i) => {
                        const effortColor = lhf.effort === "Low" ? "bg-green-50 text-green-700 border-green-200"
                          : lhf.effort === "Medium" ? "bg-amber-50 text-amber-700 border-amber-200"
                          : "bg-red-50 text-red-700 border-red-200";
                        return (
                          <div key={i} className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm flex flex-col gap-3">
                            <div className="flex items-start justify-between gap-2">
                              <p className="font-semibold text-zinc-900">{lhf.opportunity}</p>
                              <span className={`text-[9px] font-mono px-2 py-1 rounded-lg border shrink-0 ${effortColor}`}>{lhf.effort} effort</span>
                            </div>
                            {lhf.whyThisBusiness && <p className="text-sm text-zinc-500">{lhf.whyThisBusiness}</p>}
                            <div className="flex gap-4 text-sm">
                              <div>
                                <p className="text-[9px] font-mono text-zinc-400 uppercase">Revenue potential</p>
                                <p className="font-bold text-green-600">{lhf.monthlyRevenuePotential}/mo</p>
                              </div>
                              <div>
                                <p className="text-[9px] font-mono text-zinc-400 uppercase">Time to revenue</p>
                                <p className="font-bold text-zinc-900">{lhf.timeToFirstRevenue}</p>
                              </div>
                            </div>
                            {(lhf as any).implementationSteps?.length > 0 && (
                              <div className="bg-zinc-50 rounded-xl p-3">
                                <p className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest mb-2">How To Do It</p>
                                <ol className="space-y-1">
                                  {(lhf as any).implementationSteps.map((step: string, si: number) => (
                                    <li key={si} className="text-xs text-zinc-700 flex gap-2">
                                      <span className="text-zinc-400 shrink-0">{si + 1}.</span>{step}
                                    </li>
                                  ))}
                                </ol>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Pivot Opportunities */}
                {(mi.pivotOpportunities || []).length > 0 && (
                  <div>
                    <SectionHeader><GitBranch className="w-3 h-3" /> Pivot & Expansion Opportunities</SectionHeader>
                    <div className="space-y-4">
                      {(mi.pivotOpportunities || []).map((p, i) => (
                        <div key={i} className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm">
                          <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
                            <div>
                              <p className="text-xl font-medium text-zinc-900">{p.direction}</p>
                              {p.whySuited && <p className="text-sm text-zinc-500 mt-1">{p.whySuited}</p>}
                            </div>
                            <div className="text-right">
                              <p className="text-[9px] font-mono text-zinc-400 uppercase">Startup cost</p>
                              <p className="font-semibold text-zinc-900">{p.startupCost}</p>
                              <p className="text-[9px] font-mono text-zinc-400 uppercase mt-1">Time to revenue</p>
                              <p className="font-semibold text-zinc-700">{p.timeToFirstRevenue}</p>
                            </div>
                          </div>
                          {p.risk && (
                            <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mt-2">
                              <AlertCircle className="w-3 h-3 inline-block mr-1" />Risk: {p.risk}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* What top performers do */}
                {(mi.whatTopPerformersDo || []).length > 0 && (
                  <div className="bg-zinc-900 text-white rounded-2xl p-8">
                    <SectionHeader><Trophy className="w-3 h-3 text-yellow-400" /> <span className="text-zinc-400">What Top 10% Do Differently</span></SectionHeader>
                    <ul className="space-y-3">
                      {(mi.whatTopPerformersDo || []).map((item, i) => (
                        <li key={i} className="flex gap-3 text-sm">
                          <span className="text-yellow-400 font-bold shrink-0">{i + 1}.</span>
                          <span className="text-zinc-300 leading-relaxed">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Competitive intel */}
                {mi.competitiveIntelligence && (
                  <div className="bg-white border border-l-4 border-zinc-200 border-l-zinc-500 rounded-2xl p-6 shadow-sm">
                    <SectionHeader><Trophy className="w-3 h-3" /> Competitive Intelligence</SectionHeader>
                    <p className="text-sm text-zinc-600 leading-relaxed">{mi.competitiveIntelligence}</p>
                  </div>
                )}
              </div>
            )}

            {/* ── Tab 8: Website Analysis ──────────────────────────────── */}
            {activeTab === 8 && d.websiteAnalysis && (() => {
              const wa = d.websiteAnalysis!;
              const gc = GRADE_COLORS[wa.grade] ?? { text: "text-zinc-700", bg: "bg-zinc-100" };
              return (
                <div className="space-y-6">
                  {/* Grade hero */}
                  <div className="bg-zinc-900 text-white rounded-2xl p-8 flex flex-col md:flex-row gap-6 items-start">
                    <div className="text-center shrink-0">
                      <div className={`text-6xl font-bold px-6 py-4 rounded-2xl ${gc.text} ${gc.bg}`}>{wa.grade}</div>
                      <div className="text-zinc-400 text-sm mt-2">{wa.score}/100</div>
                    </div>
                    <div className="flex-1">
                      <p className="text-zinc-400 text-[10px] font-mono uppercase tracking-widest mb-2">{wa.url}</p>
                      <p className="text-lg text-white leading-relaxed">{wa.synopsis}</p>
                      {wa.ctaAssessment && <p className="text-zinc-400 text-sm mt-3">{wa.ctaAssessment}</p>}
                    </div>
                  </div>

                  {/* Offer gap */}
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm">
                      <p className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest mb-2">What You Actually Offer</p>
                      <p className="text-sm text-zinc-700">{wa.actualOffer}</p>
                    </div>
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 shadow-sm">
                      <p className="text-[9px] font-mono text-amber-600 uppercase tracking-widest mb-2">Offer Gap</p>
                      <p className="text-sm text-amber-900">{wa.offerGap}</p>
                    </div>
                  </div>

                  {/* Suggested headline */}
                  <div className="bg-white border-2 border-zinc-900 rounded-2xl p-6">
                    <p className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest mb-2">Suggested Homepage Headline</p>
                    <p className="text-2xl font-medium text-zinc-900">&quot;{wa.suggestedHeadline}&quot;</p>
                  </div>

                  {/* Issues */}
                  {wa.topIssues?.length > 0 && (
                    <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm">
                      <SectionHeader><AlertCircle className="w-3 h-3" /> Top Issues</SectionHeader>
                      <ul className="space-y-2">
                        {wa.topIssues.map((issue, i) => (
                          <li key={i} className="flex gap-2 text-sm text-zinc-700">
                            <span className="text-red-500 font-bold shrink-0">{i + 1}.</span>{issue}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Marketing direction */}
                  <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm">
                    <SectionHeader><Globe className="w-3 h-3" /> Marketing Direction</SectionHeader>
                    <p className="text-sm text-zinc-600 leading-relaxed">{wa.marketingDirection}</p>
                  </div>

                  {/* Recommendations */}
                  {wa.recommendations?.length > 0 && (
                    <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm">
                      <SectionHeader><Sparkles className="w-3 h-3" /> Recommendations</SectionHeader>
                      <ol className="space-y-2">
                        {wa.recommendations.map((rec, i) => (
                          <li key={i} className="flex gap-3 text-sm text-zinc-700">
                            <span className="text-zinc-400 font-bold shrink-0">{i + 1}.</span>{rec}
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ── Tab 9: Competitor Analysis ───────────────────────────── */}
            {activeTab === 9 && d.competitorAnalysis && (() => {
              const ca = d.competitorAnalysis!;
              return (
                <div className="space-y-6">
                  {/* Positioning statement */}
                  <div className="bg-zinc-900 text-white rounded-2xl p-8">
                    <p className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest mb-2">Suggested Positioning</p>
                    <p className="text-xl font-medium leading-relaxed">{ca.suggestedPositioning}</p>
                    {ca.differentiationOpportunity && (
                      <p className="text-zinc-400 text-sm mt-3">{ca.differentiationOpportunity}</p>
                    )}
                  </div>

                  {/* Headline comparison */}
                  {ca.headlineComparison && (
                    <div className="grid md:grid-cols-3 gap-4">
                      {ca.headlineComparison.current && (
                        <div className="bg-red-50 border border-red-200 rounded-2xl p-5">
                          <p className="text-[9px] font-mono text-red-500 uppercase tracking-widest mb-2">Current Headline</p>
                          <p className="text-sm font-medium text-red-900">&quot;{ca.headlineComparison.current}&quot;</p>
                        </div>
                      )}
                      <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-5">
                        <p className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest mb-2">How Leaders Do It</p>
                        <p className="text-sm text-zinc-700">{ca.headlineComparison.theirs}</p>
                      </div>
                      <div className="bg-green-50 border border-green-200 rounded-2xl p-5">
                        <p className="text-[9px] font-mono text-green-600 uppercase tracking-widest mb-2">Suggested Headline</p>
                        <p className="text-sm font-bold text-green-900">&quot;{ca.headlineComparison.suggested}&quot;</p>
                      </div>
                    </div>
                  )}

                  {/* Repositioning recommendations */}
                  {ca.repositioningRecommendations?.length > 0 && (
                    <div>
                      <SectionHeader><ArrowRight className="w-3 h-3" /> Repositioning Moves</SectionHeader>
                      <div className="space-y-4">
                        {ca.repositioningRecommendations.map((rec) => (
                          <div key={rec.rank} className="bg-white border border-l-4 border-zinc-200 border-l-zinc-900 rounded-2xl p-6 shadow-sm">
                            <div className="flex items-start gap-3">
                              <span className="w-7 h-7 bg-zinc-900 text-white rounded-full flex items-center justify-center text-xs font-bold shrink-0">{rec.rank}</span>
                              <div className="flex-1">
                                <p className="font-semibold text-zinc-900">{rec.recommendation}</p>
                                <p className="text-sm text-zinc-500 mt-1">{rec.rationale}</p>
                                {rec.implementation && (
                                  <div className="mt-3 bg-zinc-50 rounded-xl p-3">
                                    <p className="text-[9px] font-mono text-zinc-400 uppercase mb-1">Implementation</p>
                                    <p className="text-xs text-zinc-700">{rec.implementation}</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Competitor radar chart */}
                  <CompetitorRadarChart
                    competitors={[...ca.competitors, ...ca.industryLeaders]}
                    yourGrade={d.websiteAnalysis?.grade}
                    overlay={chartOverlays.competitors}
                    onDismissOverlay={clearOverlay("competitors")}
                  />
                  <ChartInteraction
                    section="competitors"
                    orgId={chartOrgId}
                    prompts={[
                      "How do I differentiate from my top competitor?",
                      "What are competitors doing that I should copy?",
                      "Where am I strongest vs weakest against competition?",
                    ]}
                    onProjection={handleProjection("competitors")}
                    onDismiss={clearOverlay("competitors")}
                  />

                  {/* Competitor cards */}
                  {[...ca.competitors, ...ca.industryLeaders].length > 0 && (
                    <div>
                      <SectionHeader><Trophy className="w-3 h-3" /> Competitive Landscape Analysis</SectionHeader>
                      <div className="grid md:grid-cols-2 gap-4">
                        {[...ca.competitors, ...ca.industryLeaders].map((c, i) => {
                          const gc = c.websiteGrade ? (GRADE_COLORS[c.websiteGrade] ?? { text: "text-zinc-700", bg: "bg-zinc-100" }) : { text: "text-zinc-400", bg: "bg-zinc-100" };
                          return (
                            <div key={i} className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm">
                              <div className="flex items-start justify-between gap-2 mb-3">
                                <div>
                                  <p className="font-semibold text-zinc-900">{c.name}</p>
                                  <p className="text-[10px] font-mono text-zinc-400 truncate">{c.url}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                  {c.isIndustryLeader && (
                                    <span className="text-[9px] font-mono bg-amber-100 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full uppercase">Leader</span>
                                  )}
                                  {c.websiteGrade && (
                                    <span className={`text-sm font-bold px-2 py-0.5 rounded-lg ${gc.text} ${gc.bg}`}>{c.websiteGrade}</span>
                                  )}
                                </div>
                              </div>
                              <p className="text-sm text-zinc-600 mb-3">{c.offer}</p>
                              <p className="text-[10px] text-zinc-500 italic">{c.marketingDirection}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ── Tab 10: Tech Savings ─────────────────────────────────── */}
            {activeTab === 10 && d.techOptimization && (() => {
              const to = d.techOptimization!;
              const effortColor = (e: string) =>
                e === "Low" ? "bg-green-50 text-green-700 border-green-200"
                : e === "Medium" ? "bg-amber-50 text-amber-700 border-amber-200"
                : "bg-red-50 text-red-700 border-red-200";
              return (
                <div className="space-y-6">
                  {/* Savings hero */}
                  {to.potentialSavings && (
                    <div className="bg-zinc-900 text-white rounded-2xl p-8 flex items-center gap-6">
                      <div>
                        <p className="text-zinc-400 text-[10px] font-mono uppercase tracking-widest mb-1">Potential Monthly Savings</p>
                        <p className="text-5xl font-light">{fmt(to.potentialSavings)}</p>
                      </div>
                      {to.currentEstimatedMonthlyCost && (
                        <div className="border-l border-zinc-700 pl-6">
                          <p className="text-zinc-400 text-[10px] font-mono uppercase tracking-widest mb-1">Current Tech Cost</p>
                          <p className="text-2xl text-zinc-300">{fmt(to.currentEstimatedMonthlyCost)}/mo</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Summary */}
                  {to.summary && (
                    <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm">
                      <p className="text-sm text-zinc-600 leading-relaxed">{to.summary}</p>
                    </div>
                  )}

                  {/* Tech savings chart */}
                  {to.recommendations?.length > 0 && (
                    <>
                      <TechSavingsChart recommendations={to.recommendations} overlay={chartOverlays.tech} onDismissOverlay={clearOverlay("tech")} />
                      <ChartInteraction
                        section="tech"
                        orgId={chartOrgId}
                        prompts={[
                          "Which migration gives the best ROI?",
                          "What's my total possible savings if I do all?",
                          "Which tools are critical vs nice-to-have?",
                        ]}
                        projectionConfig={{
                          type: "growth_scenario",
                          scenario: "Implement all tech cost optimizations over 10 weeks, saving estimated monthly amounts",
                          months: 3,
                        }}
                        onProjection={handleProjection("tech")}
                        onDismiss={clearOverlay("tech")}
                      />
                    </>
                  )}

                  {/* Recommendations */}
                  {to.recommendations?.length > 0 && (
                    <div className="space-y-4">
                      <SectionHeader><Server className="w-3 h-3" /> Cost Optimization Moves</SectionHeader>
                      {to.recommendations.map((rec) => (
                        <div key={rec.rank} className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm">
                          <div className="flex items-start gap-4">
                            <span className="w-7 h-7 bg-zinc-100 text-zinc-700 rounded-full flex items-center justify-center text-xs font-bold shrink-0">{rec.rank}</span>
                            <div className="flex-1">
                              <div className="flex items-center gap-3 flex-wrap mb-2">
                                <span className="font-mono text-sm bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 rounded">{rec.currentTool}</span>
                                <ArrowRight className="w-4 h-4 text-zinc-400" />
                                <span className="font-mono text-sm bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded">{rec.suggestedAlternative}</span>
                                <span className={`text-[9px] font-mono px-2 py-0.5 rounded-lg border uppercase ${effortColor(rec.migrationEffort)}`}>
                                  {rec.migrationEffort} effort
                                </span>
                              </div>
                              <p className="text-sm text-zinc-600">{rec.rationale}</p>
                              <p className="text-sm font-bold text-green-600 mt-2">Save {rec.estimatedSaving}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ── Tab 11: Pricing Intelligence ─────────────────────────── */}
            {activeTab === 11 && d.pricingIntelligence && (() => {
              const pi = d.pricingIntelligence!;
              return (
                <div className="space-y-6">
                  {/* Assessment */}
                  <div className="bg-zinc-900 text-white rounded-2xl p-8">
                    <p className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest mb-3">Current Pricing Assessment</p>
                    <p className="text-lg leading-relaxed">{pi.currentPricingAssessment}</p>
                  </div>

                  {/* Pricing chart */}
                  {pi.suggestedPricing?.length > 0 && (
                    <>
                      <PricingComparisonChart tiers={pi.suggestedPricing} overlay={chartOverlays.pricing} onDismissOverlay={clearOverlay("pricing")} />
                      <ChartInteraction
                        section="pricing"
                        orgId={chartOrgId}
                        prompts={[
                          "What if I raise prices by 15%?",
                          "Which tier has the highest margin potential?",
                          "How does my pricing compare to competitors?",
                        ]}
                        projectionConfig={{
                          type: "revenue_recovery",
                          scenario: "Implement recommended pricing tiers over the next 10 weeks with gradual customer migration",
                          months: 3,
                        }}
                        onProjection={handleProjection("pricing")}
                        onDismiss={clearOverlay("pricing")}
                      />
                    </>
                  )}

                  {/* Pricing tiers */}
                  {pi.suggestedPricing?.length > 0 && (
                    <div>
                      <SectionHeader><DollarSign className="w-3 h-3" /> Recommended Pricing Tiers</SectionHeader>
                      <div className="grid md:grid-cols-3 gap-4">
                        {pi.suggestedPricing.map((tier, i) => (
                          <div key={i} className={`rounded-2xl p-6 border shadow-sm ${i === 1 ? "bg-zinc-900 text-white border-zinc-700" : "bg-white border-zinc-200"}`}>
                            <p className={`text-[9px] font-mono uppercase tracking-widest mb-1 ${i === 1 ? "text-zinc-400" : "text-zinc-400"}`}>{tier.tier}</p>
                            <p className={`text-2xl font-bold mb-2 ${i === 1 ? "text-white" : "text-zinc-900"}`}>{tier.range}</p>
                            <p className={`text-xs mb-3 ${i === 1 ? "text-zinc-400" : "text-zinc-500"}`}>{tier.targetSegment}</p>
                            <p className={`text-sm ${i === 1 ? "text-zinc-300" : "text-zinc-600"}`}>{tier.rationale}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Competitive position + margin optimization */}
                  <div className="grid md:grid-cols-2 gap-4">
                    {pi.competitivePosition && (
                      <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm">
                        <SectionHeader><Trophy className="w-3 h-3" /> Competitive Position</SectionHeader>
                        <p className="text-sm text-zinc-600 leading-relaxed">{pi.competitivePosition}</p>
                      </div>
                    )}
                    {pi.marginOptimization && (
                      <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm">
                        <SectionHeader><TrendingUp className="w-3 h-3" /> Margin Optimization</SectionHeader>
                        <p className="text-sm text-zinc-600 leading-relaxed">{pi.marginOptimization}</p>
                      </div>
                    )}
                  </div>

                  {pi.summary && (
                    <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm">
                      <SectionHeader><Sparkles className="w-3 h-3" /> Summary</SectionHeader>
                      <p className="text-sm text-zinc-600 leading-relaxed">{pi.summary}</p>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ── Tab 12: Marketing Intelligence ─────────────────────────── */}
            {activeTab === 12 && d.marketingStrategy && (() => {
              const ms = d.marketingStrategy!;
              const effortColor = (e: string) =>
                e === "Low" ? "bg-green-50 text-green-700 border-green-200"
                : e === "Medium" ? "bg-amber-50 text-amber-700 border-amber-200"
                : "bg-red-50 text-red-700 border-red-200";
              return (
                <div className="space-y-8">
                  {/* Executive summary */}
                  <div className="bg-zinc-900 text-white rounded-2xl p-8">
                    <div className="flex items-center gap-2 mb-3">
                      <Megaphone className="w-4 h-4 text-zinc-400" />
                      <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">Marketing Intelligence Report</p>
                    </div>
                    {ms.summary && <p className="text-lg leading-relaxed">{ms.summary}</p>}
                    {ms.currentChannels.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-4">
                        {ms.currentChannels.map((ch) => (
                          <span key={ch} className="text-[9px] font-mono bg-white/10 text-zinc-300 px-2 py-1 rounded-lg border border-white/10 uppercase">{ch}</span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Marketing charts */}
                  <MarketingChannelChart
                    channels={ms.channelRecommendations ?? []}
                    socialStrategy={ms.socialMediaStrategy ?? []}
                    overlay={chartOverlays.marketing}
                    onDismissOverlay={clearOverlay("marketing")}
                  />
                  <ChartInteraction
                    section="marketing"
                    orgId={chartOrgId}
                    prompts={[
                      "What's my best marketing channel right now?",
                      "How should I split my ad budget?",
                      "What content should I post this week?",
                    ]}
                    projectionConfig={{
                      type: "growth_scenario",
                      scenario: "Execute top 3 recommended marketing channels for 10 weeks with consistent effort",
                      months: 3,
                    }}
                    onProjection={handleProjection("marketing")}
                    onDismiss={clearOverlay("marketing")}
                  />

                  {/* Channel recommendations */}
                  {ms.channelRecommendations?.length > 0 && (
                    <div>
                      <SectionHeader><Megaphone className="w-3 h-3" /> Top Channel Recommendations</SectionHeader>
                      <div className="space-y-4">
                        {ms.channelRecommendations.map((rec) => (
                          <div key={rec.rank} className="bg-white border border-l-4 border-zinc-200 border-l-zinc-900 rounded-2xl p-6 shadow-sm">
                            <div className="flex items-start gap-4">
                              <span className="w-7 h-7 bg-zinc-900 text-white rounded-full flex items-center justify-center text-xs font-bold shrink-0">{rec.rank}</span>
                              <div className="flex-1">
                                <div className="flex items-center gap-3 flex-wrap mb-2">
                                  <p className="font-semibold text-zinc-900 text-lg">{rec.channel}</p>
                                  <span className={`text-[9px] font-mono px-2 py-0.5 rounded-lg border uppercase ${effortColor(rec.effort)}`}>
                                    {rec.effort} effort
                                  </span>
                                </div>
                                <p className="text-sm text-zinc-600 mb-3">{rec.why}</p>
                                <div className="grid md:grid-cols-2 gap-3">
                                  <div className="bg-green-50 rounded-xl p-3 border border-green-100">
                                    <p className="text-[9px] font-mono text-green-600 uppercase tracking-widest mb-1">Expected Impact (3 Mo)</p>
                                    <p className="text-xs text-green-800 font-medium">{rec.expectedImpact}</p>
                                  </div>
                                  <div className="bg-zinc-50 rounded-xl p-3 border border-zinc-100">
                                    <p className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest mb-1">How to Start</p>
                                    <p className="text-xs text-zinc-700">{rec.howToStart}</p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Social media audit — user profiles vs competitor profiles */}
                  {ms.socialMediaStrategy?.length > 0 && (
                    <div>
                      <SectionHeader><Users className="w-3 h-3" /> Social Media Audit</SectionHeader>
                      <div className="grid md:grid-cols-2 gap-4">
                        {ms.socialMediaStrategy.map((s, i) => {
                          const gc = s.currentGrade ? (GRADE_COLORS[s.currentGrade] ?? { text: "text-zinc-700", bg: "bg-zinc-100" }) : null;
                          const cgc = s.vsCompetitorGrade ? (GRADE_COLORS[s.vsCompetitorGrade] ?? { text: "text-zinc-700", bg: "bg-zinc-100" }) : null;
                          return (
                            <div key={i} className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm">
                              <div className="flex items-start justify-between gap-2 mb-3">
                                <p className="font-semibold text-zinc-900 uppercase tracking-tight">{s.platform}</p>
                                <div className="flex items-center gap-2">
                                  {gc && (
                                    <div className="text-center">
                                      <span className={`text-sm font-bold px-2 py-0.5 rounded-lg ${gc.text} ${gc.bg}`}>{s.currentGrade}</span>
                                      <p className="text-[8px] font-mono text-zinc-400 mt-0.5">You</p>
                                    </div>
                                  )}
                                  {cgc && (
                                    <div className="text-center">
                                      <span className={`text-sm font-bold px-2 py-0.5 rounded-lg ${cgc.text} ${cgc.bg}`}>{s.vsCompetitorGrade}</span>
                                      <p className="text-[8px] font-mono text-zinc-400 mt-0.5">Best Comp</p>
                                    </div>
                                  )}
                                </div>
                              </div>
                              <p className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest mb-1">Post {s.postingFrequency}</p>
                              {s.improvements?.length > 0 && (
                                <div className="mt-3">
                                  <p className="text-[9px] font-mono text-red-500 uppercase tracking-widest mb-1">Improvements Needed</p>
                                  <ul className="space-y-1">
                                    {s.improvements.map((imp, ii) => (
                                      <li key={ii} className="text-xs text-zinc-700 flex gap-1.5">
                                        <AlertCircle className="w-3 h-3 text-amber-500 shrink-0 mt-0.5" />{imp}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              {s.contentSuggestions?.length > 0 && (
                                <div className="mt-3">
                                  <p className="text-[9px] font-mono text-green-600 uppercase tracking-widest mb-1">Content Ideas</p>
                                  <ul className="space-y-1">
                                    {s.contentSuggestions.map((cs2, ci3) => (
                                      <li key={ci3} className="text-xs text-zinc-700 flex gap-1.5">
                                        <Sparkles className="w-3 h-3 text-green-500 shrink-0 mt-0.5" />{cs2}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Scraped social profiles detail cards */}
                  {(ms.socialProfiles?.length > 0 || ms.competitorSocialProfiles?.length > 0) && (
                    <div>
                      <SectionHeader><Globe className="w-3 h-3" /> Profile Analysis — You vs Competitors</SectionHeader>
                      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {[...(ms.socialProfiles ?? []), ...(ms.competitorSocialProfiles ?? [])].map((p, i) => {
                          const gc = p.profileGrade && p.profileGrade !== "N/A" ? (GRADE_COLORS[p.profileGrade] ?? { text: "text-zinc-700", bg: "bg-zinc-100" }) : null;
                          return (
                            <div key={i} className={`border rounded-2xl p-5 shadow-sm ${p.isCompetitor ? "bg-zinc-50 border-zinc-200" : "bg-white border-zinc-900/20"}`}>
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <div>
                                  <p className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest">{p.platform}</p>
                                  <p className="font-semibold text-zinc-900">@{p.handle}</p>
                                  {p.companyName && <p className="text-[10px] text-zinc-500">{p.companyName}</p>}
                                </div>
                                <div className="flex items-center gap-2">
                                  {p.isCompetitor && (
                                    <span className="text-[9px] font-mono bg-zinc-200 text-zinc-600 px-2 py-0.5 rounded-full uppercase">Competitor</span>
                                  )}
                                  {gc && (
                                    <span className={`text-sm font-bold px-2 py-0.5 rounded-lg ${gc.text} ${gc.bg}`}>{p.profileGrade}</span>
                                  )}
                                </div>
                              </div>
                              {p.followerCount && p.followerCount !== "Unknown" && (
                                <p className="text-xs text-zinc-500 mb-1">{p.followerCount} followers · {p.engagementLevel} engagement</p>
                              )}
                              {p.bioSummary && <p className="text-xs text-zinc-600 italic mb-2">{p.bioSummary}</p>}
                              {p.contentThemes?.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-2">
                                  {p.contentThemes.map((t, ti) => (
                                    <span key={ti} className="text-[9px] bg-zinc-100 text-zinc-600 px-1.5 py-0.5 rounded">{t}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Website copy recommendations */}
                  {ms.websiteCopyRecommendations?.length > 0 && (
                    <div>
                      <SectionHeader><FileText className="w-3 h-3" /> Website Copy Changes</SectionHeader>
                      <div className="space-y-4">
                        {ms.websiteCopyRecommendations.map((rec, i) => (
                          <div key={i} className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm">
                            <p className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest mb-3">{rec.section}</p>
                            <div className="grid md:grid-cols-2 gap-4">
                              <div className="bg-red-50 border border-red-100 rounded-xl p-4">
                                <p className="text-[9px] font-mono text-red-500 uppercase tracking-widest mb-1">Current</p>
                                <p className="text-sm text-red-900">{rec.current}</p>
                              </div>
                              <div className="bg-green-50 border border-green-100 rounded-xl p-4">
                                <p className="text-[9px] font-mono text-green-600 uppercase tracking-widest mb-1">Suggested</p>
                                <p className="text-sm text-green-900 font-medium">{rec.suggested}</p>
                              </div>
                            </div>
                            <p className="text-xs text-zinc-500 mt-3 italic">{rec.rationale}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Offer positioning */}
                  {ms.offerPositioning && (
                    <div className="bg-zinc-900 text-white rounded-2xl p-8">
                      <SectionHeader><Target className="w-3 h-3 text-zinc-400" /> <span className="text-zinc-400">Offer Positioning</span></SectionHeader>
                      <div className="space-y-4">
                        <div>
                          <p className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest mb-1">How You Currently Position</p>
                          <p className="text-zinc-300">{ms.offerPositioning.currentPositioning}</p>
                        </div>
                        {ms.offerPositioning.competitorPositioning?.length > 0 && (
                          <div>
                            <p className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest mb-1">How Competitors Position</p>
                            {ms.offerPositioning.competitorPositioning.map((cp, i) => (
                              <p key={i} className="text-zinc-400 text-sm">- {cp}</p>
                            ))}
                          </div>
                        )}
                        <div className="bg-white/10 border border-white/20 rounded-xl p-4 mt-2">
                          <p className="text-[9px] font-mono text-green-400 uppercase tracking-widest mb-1">Recommended Repositioning</p>
                          <p className="text-white font-medium">{ms.offerPositioning.suggestedRepositioning}</p>
                        </div>
                        {ms.offerPositioning.keyMessages?.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {ms.offerPositioning.keyMessages.map((msg, i) => (
                              <span key={i} className="text-xs bg-white/10 text-zinc-300 px-3 py-1.5 rounded-lg border border-white/10">{msg}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Content strategy */}
                  {ms.contentStrategy && (
                    <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm">
                      <SectionHeader><FileText className="w-3 h-3" /> Content Strategy</SectionHeader>
                      <p className="text-sm text-zinc-600 leading-relaxed whitespace-pre-line">{ms.contentStrategy}</p>
                    </div>
                  )}

                  {/* Ad spend recommendation */}
                  {ms.adSpendRecommendation && (
                    <div className="bg-white border border-l-4 border-zinc-200 border-l-zinc-900 rounded-2xl p-6 shadow-sm">
                      <SectionHeader><DollarSign className="w-3 h-3" /> Ad Spend Recommendation</SectionHeader>
                      <p className="text-sm text-zinc-600 leading-relaxed">{ms.adSpendRecommendation}</p>
                    </div>
                  )}
                </div>
              );
            })()}

            {activeTab === 13 && d.pitchDeckAnalysis && (() => {
              const pd = d.pitchDeckAnalysis!;
              const gc = GRADE_COLORS[pd.overallGrade] ?? { text: "text-zinc-700", bg: "bg-zinc-100" };
              return (
                <div className="space-y-6">
                  {/* Score hero */}
                  <div className="bg-zinc-900 text-white rounded-2xl p-8 flex flex-col md:flex-row gap-6 items-start">
                    <div className="text-center shrink-0">
                      <div className={`text-6xl font-bold px-6 py-4 rounded-2xl ${gc.text} ${gc.bg}`}>{pd.overallGrade}</div>
                      <div className="text-zinc-400 text-sm mt-2">{pd.overallScore}/100</div>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Presentation className="w-4 h-4 text-zinc-400" />
                        <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">Pitch Deck Review</p>
                      </div>
                      <p className="text-lg text-white leading-relaxed">{pd.headline}</p>
                      <div className="flex gap-3 mt-3 text-[10px] font-mono text-zinc-500">
                        <span>{pd.fileName}</span>
                        {pd.slideCount && <span>{pd.slideCount} slides</span>}
                      </div>
                    </div>
                  </div>

                  {/* Extracted content */}
                  {pd.extractedContent && (
                    <div className="grid md:grid-cols-2 gap-4">
                      {Object.entries(pd.extractedContent)
                        .filter(([, v]) => v)
                        .map(([key, value]) => (
                          <div key={key} className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm">
                            <p className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest mb-2">
                              {key.replace(/([A-Z])/g, " $1").trim()}
                            </p>
                            <p className="text-sm text-zinc-700">{value}</p>
                          </div>
                        ))}
                    </div>
                  )}

                  {/* Strengths + Weaknesses */}
                  <div className="grid md:grid-cols-2 gap-4">
                    {pd.strengths?.length > 0 && (
                      <div className="bg-green-50 border border-green-200 rounded-2xl p-6">
                        <SectionHeader><Sparkles className="w-3 h-3 text-green-600" /> Strengths</SectionHeader>
                        <ul className="space-y-2">
                          {pd.strengths.map((s, i) => (
                            <li key={i} className="text-sm text-green-800 flex gap-2">
                              <span className="text-green-500 font-bold shrink-0">+</span>{s}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {pd.weaknesses?.length > 0 && (
                      <div className="bg-red-50 border border-red-200 rounded-2xl p-6">
                        <SectionHeader><AlertCircle className="w-3 h-3 text-red-500" /> Weaknesses</SectionHeader>
                        <ul className="space-y-2">
                          {pd.weaknesses.map((w, i) => (
                            <li key={i} className="text-sm text-red-800 flex gap-2">
                              <span className="text-red-500 font-bold shrink-0">-</span>{w}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* Missing slides */}
                  {pd.missingSlides?.length > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6">
                      <SectionHeader><AlertCircle className="w-3 h-3 text-amber-500" /> Missing Essential Slides</SectionHeader>
                      <div className="flex flex-wrap gap-2">
                        {pd.missingSlides.map((s, i) => (
                          <span key={i} className="text-xs font-mono bg-amber-100 text-amber-800 border border-amber-300 px-3 py-1.5 rounded-lg">
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recommendations */}
                  {pd.recommendations?.length > 0 && (
                    <div>
                      <SectionHeader><Sparkles className="w-3 h-3" /> Improvement Recommendations</SectionHeader>
                      <div className="space-y-4">
                        {pd.recommendations.map((rec) => (
                          <div key={rec.rank} className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm">
                            <div className="flex items-start gap-4">
                              <span className="w-7 h-7 bg-zinc-900 text-white rounded-full flex items-center justify-center text-xs font-bold shrink-0">{rec.rank}</span>
                              <div className="flex-1">
                                <p className="font-semibold text-zinc-900 mb-2">{rec.area}</p>
                                <div className="grid md:grid-cols-2 gap-3">
                                  <div className="bg-red-50 border border-red-100 rounded-xl p-3">
                                    <p className="text-[9px] font-mono text-red-500 uppercase tracking-widest mb-1">Current</p>
                                    <p className="text-xs text-red-900">{rec.current}</p>
                                  </div>
                                  <div className="bg-green-50 border border-green-100 rounded-xl p-3">
                                    <p className="text-[9px] font-mono text-green-600 uppercase tracking-widest mb-1">Suggested</p>
                                    <p className="text-xs text-green-900 font-medium">{rec.suggested}</p>
                                  </div>
                                </div>
                                <p className="text-xs text-zinc-500 mt-2 italic">{rec.rationale}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Suggested infographics */}
                  {pd.suggestedInfographics?.length > 0 && (
                    <div>
                      <SectionHeader><BarChart3 className="w-3 h-3" /> Suggested Visuals & Infographics</SectionHeader>
                      <div className="grid md:grid-cols-2 gap-4">
                        {pd.suggestedInfographics.map((info, i) => (
                          <div key={i} className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-[9px] font-mono bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded uppercase">
                                {info.type}
                              </span>
                              <span className="text-[10px] text-zinc-400">{info.slide}</span>
                            </div>
                            <p className="text-sm text-zinc-700">{info.description}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Positioning advice */}
                  {pd.positioningAdvice && (
                    <div className="bg-white border-2 border-zinc-900 rounded-2xl p-6">
                      <SectionHeader><Target className="w-3 h-3" /> Positioning Strategy</SectionHeader>
                      <p className="text-sm text-zinc-700 leading-relaxed">{pd.positioningAdvice}</p>
                    </div>
                  )}

                  {/* Generate new deck CTA */}
                  <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-6 text-center">
                    <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest mb-3">Need a New Pitch Deck?</p>
                    <p className="text-sm text-zinc-600 mb-4">Ask Pivvy to generate an investor-ready pitch deck based on your report data.</p>
                    <p className="text-xs text-zinc-500 italic">Try: &quot;Generate a pitch deck for me&quot; in the Pivvy chat</p>
                  </div>
                </div>
              );
            })()}

            {/* ── Smart Renderer for all sections with id > 13 ─────────── */}
            {activeTab > 13 && (() => {
              const tab = sortedTabs.find(t => t.id === activeTab);
              if (!tab?.dataKey) return null;
              const sectionData = (d as unknown as Record<string, unknown>)[tab.dataKey];
              if (!sectionData || typeof sectionData !== "object") return null;
              return <SmartSectionRenderer sectionKey={tab.dataKey} data={sectionData as Record<string, unknown>} title={tab.label} claimValidations={d.claimValidations?.filter(c => c.field.startsWith(tab.dataKey))} />;
            })()}

          </motion.div>
        </AnimatePresence>
      </main>

      {/* ── Floating Chat Buttons ──────────────────────────────────────────── */}
      <CoachChatButton
        orgId={job.questionnaire.orgId ?? "default-org"}
        runId={runId}
      />
      <AgentChatButton
        orgId={job.questionnaire.orgId ?? "default-org"}
        orgName={job.questionnaire.organizationName}
      />
    </div>
  );
}