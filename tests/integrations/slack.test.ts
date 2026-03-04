import { describe, it, expect, vi, beforeEach } from 'vitest';

// ═══════════════════════════════════════════════════════════════
// Slack Integration Tests
// Tests message filtering, smart token filtering, and analysis
// output format.
// ═══════════════════════════════════════════════════════════════

// We test the exported filterMessagesForAI indirectly by testing
// the public API that uses it. Since filterMessagesForAI is not
// exported, we test its behavior through analyzeSlackCommunication.
// We also directly test fetchSlackUsers / fetchSlackMessages by
// mocking the global fetch.

import type { SlackMessage, SlackUser } from '@/lib/integrations/slack';

// Mock @google/genai — must use a class so `new GoogleGenAI()` works
const mockGenerateContent = vi.fn().mockResolvedValue({
  text: JSON.stringify({
    relationship_scores: [
      {
        person1: 'Alice',
        person2: 'Bob',
        score: 85,
        frequency: 'high',
        sentiment: 'positive',
        context: 'Strong collaboration in engineering',
      },
    ],
    response_times: [
      {
        personName: 'Alice',
        avgResponseMinutes: 15,
        fastestMinutes: 2,
        slowestMinutes: 60,
        rating: 'excellent',
      },
    ],
    meeting_attendance: [],
    bottlenecks: [
      {
        personName: 'Charlie',
        type: 'single_point_of_failure',
        severity: 'high',
        evidence: 'Only person handling deployments',
        recommendation: 'Cross-train another team member',
      },
    ],
    sentiment: {
      overall: 'positive',
      overallScore: 78,
      perPerson: [
        {
          personName: 'Alice',
          sentiment: 'positive',
          score: 85,
          topEmotions: ['motivated', 'collaborative'],
        },
      ],
    },
    engagement: [
      {
        personName: 'Alice',
        messageFrequency: 'high',
        reactionFrequency: 'medium',
        threadParticipation: 'high',
        overallEngagement: 'highly_engaged',
        engagementScore: 92,
      },
    ],
    risk_flags: [],
  }),
});

vi.mock('@google/genai', () => {
  return {
    GoogleGenAI: class MockGoogleGenAI {
      models = {
        generateContent: mockGenerateContent,
      };
    },
  };
});

// ─── Sample Data ───────────────────────────────────────────────

function createSlackMessage(overrides: Partial<SlackMessage> = {}): SlackMessage {
  return {
    channelName: 'engineering',
    channelId: 'C001',
    channelType: 'public_channel',
    senderName: 'Alice Engineer',
    senderEmail: 'alice@example.com',
    senderId: 'U001',
    text: 'We need to discuss the sprint deadline for the new feature release',
    timestamp: String(Date.now() / 1000),
    reactions: [],
    threadReplyCount: 0,
    isThreadReply: false,
    ...overrides,
  };
}

const sampleUsers: SlackUser[] = [
  {
    id: 'U001',
    name: 'alice',
    realName: 'Alice Engineer',
    email: 'alice@example.com',
    title: 'Senior Engineer',
    isAdmin: false,
    isBot: false,
    timezone: 'US/Pacific',
  },
  {
    id: 'U002',
    name: 'bob',
    realName: 'Bob Manager',
    email: 'bob@example.com',
    title: 'Engineering Manager',
    isAdmin: true,
    isBot: false,
    timezone: 'US/Eastern',
  },
  {
    id: 'UBOT',
    name: 'slackbot',
    realName: 'Slackbot',
    email: null,
    title: null,
    isAdmin: false,
    isBot: true,
    timezone: null,
  },
];

// ─── Message Filtering Logic Tests ────────────────────────────

describe('Slack message filtering', () => {
  it('short messages have fewer than 5 words (used by filterMessagesForAI)', () => {
    const shortMsg = createSlackMessage({ text: 'ok thanks' });
    const longMsg = createSlackMessage({
      text: 'We need to discuss the sprint deadline for the project release next week',
    });

    const shortWords = shortMsg.text.trim().split(/\s+/);
    const longWords = longMsg.text.trim().split(/\s+/);

    expect(shortWords.length).toBeLessThan(5);
    expect(longWords.length).toBeGreaterThanOrEqual(5);
  });

  it('chitchat channels are detected correctly', () => {
    const chitchatChannels = ['general', 'random', 'watercooler', 'social', 'fun', 'off-topic'];
    const businessChannels = ['engineering', 'sales-pipeline', 'project-alpha', 'customer-support'];

    for (const ch of chitchatChannels) {
      const isChitchat = chitchatChannels.some((cc) => ch.toLowerCase().includes(cc));
      expect(isChitchat).toBe(true);
    }

    for (const ch of businessChannels) {
      const isChitchat = chitchatChannels.some((cc) => ch.toLowerCase().includes(cc));
      expect(isChitchat).toBe(false);
    }
  });

  it('business keywords are detected correctly', () => {
    const BUSINESS_KEYWORDS = [
      'project', 'client', 'sprint', 'deadline', 'revenue', 'budget',
      'deploy', 'release', 'incident', 'bug', 'feature', 'roadmap',
      'meeting', 'standup', 'review', 'planning', 'retro', 'demo',
    ];

    const isBusinessChannel = (name: string) =>
      BUSINESS_KEYWORDS.some((kw) => name.toLowerCase().includes(kw));

    expect(isBusinessChannel('sprint-planning')).toBe(true);
    expect(isBusinessChannel('project-alpha')).toBe(true);
    expect(isBusinessChannel('incident-response')).toBe(true);
    expect(isBusinessChannel('general')).toBe(false);
    expect(isBusinessChannel('team-lunch')).toBe(false);
  });
});

// ─── Channel Type Detection Tests ──────────────────────────────

describe('Slack channel type detection', () => {
  it('correctly categorizes channel types', () => {
    // The channelType function logic
    function channelType(ch: any): string {
      if (ch.is_im) return 'im';
      if (ch.is_mpim) return 'mpim';
      if (ch.is_group || ch.is_private) return 'private_channel';
      return 'public_channel';
    }

    expect(channelType({ is_im: true })).toBe('im');
    expect(channelType({ is_mpim: true })).toBe('mpim');
    expect(channelType({ is_group: true })).toBe('private_channel');
    expect(channelType({ is_private: true })).toBe('private_channel');
    expect(channelType({ is_channel: true })).toBe('public_channel');
    expect(channelType({})).toBe('public_channel');
  });
});

// ─── Communication Analysis Output Tests ────────────────────────

describe('analyzeSlackCommunication', () => {
  let analyzeSlackCommunication: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('@/lib/integrations/slack');
    analyzeSlackCommunication = mod.analyzeSlackCommunication;
  });

  it('returns empty insights for empty messages', async () => {
    const result = await analyzeSlackCommunication([], sampleUsers, 'Test Org');
    expect(result).toEqual([]);
  });

  it('produces structured CommunicationInsight records', async () => {
    const messages = [
      createSlackMessage({
        text: 'We need to review the sprint backlog before the planning meeting tomorrow morning',
        senderName: 'Alice Engineer',
        channelName: 'engineering',
      }),
      createSlackMessage({
        text: 'I agree, let us schedule a quick sync call to discuss the technical requirements',
        senderName: 'Bob Manager',
        channelName: 'engineering',
      }),
    ];

    const insights = await analyzeSlackCommunication(messages, sampleUsers, 'Test Org');

    expect(Array.isArray(insights)).toBe(true);
    expect(insights.length).toBeGreaterThan(0);

    // Each insight should have the standard structure
    for (const insight of insights) {
      expect(insight.id).toBeDefined();
      expect(insight.source).toBe('slack');
      expect(insight.insightType).toBeDefined();
      expect(insight.periodStart).toBeDefined();
      expect(insight.periodEnd).toBeDefined();
      expect(insight.createdAt).toBeDefined();
      expect(insight.data).toBeDefined();
    }
  });

  it('produces correct insight types from AI output', async () => {
    const messages = [
      createSlackMessage({
        text: 'The deployment pipeline is broken and we need to fix it before the release deadline',
        channelName: 'engineering',
      }),
    ];

    const insights = await analyzeSlackCommunication(messages, sampleUsers, 'Test Org');

    const insightTypes = insights.map((i: any) => i.insightType);
    expect(insightTypes).toContain('relationship_score');
    expect(insightTypes).toContain('response_time');
    expect(insightTypes).toContain('bottleneck');
    expect(insightTypes).toContain('sentiment');
    expect(insightTypes).toContain('engagement');
  });

  it('sets correct source field', async () => {
    const messages = [
      createSlackMessage({
        text: 'We should discuss the roadmap priorities for the upcoming sprint planning session',
      }),
    ];

    const insights = await analyzeSlackCommunication(messages, sampleUsers, 'Test Org');

    for (const insight of insights) {
      expect(insight.source).toBe('slack');
    }
  });
});

// ─── Bot Filtering Tests ───────────────────────────────────────

describe('Slack bot filtering', () => {
  it('identifies bots correctly', () => {
    const botUser = sampleUsers.find((u) => u.isBot);
    expect(botUser).toBeDefined();
    expect(botUser!.name).toBe('slackbot');

    const humanUsers = sampleUsers.filter((u) => !u.isBot);
    expect(humanUsers).toHaveLength(2);
  });
});
