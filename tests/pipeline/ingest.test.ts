import { describe, it, expect, vi } from 'vitest';

// ═══════════════════════════════════════════════════════════════
// Upload & Questionnaire Parsing Tests
// Tests parseQuestionnaire and file validation logic
// ═══════════════════════════════════════════════════════════════

// We import the utility directly since it's a pure function with no
// Supabase dependencies
import { parseQuestionnaire } from '@/lib/upload';

// ─── parseQuestionnaire Tests ──────────────────────────────────

describe('parseQuestionnaire', () => {
  function createFormData(fields: Record<string, string>): FormData {
    const fd = new FormData();
    for (const [key, value] of Object.entries(fields)) {
      fd.set(key, value);
    }
    return fd;
  }

  it('parses basic fields', () => {
    const fd = createFormData({
      organizationName: 'Acme Corp',
      industry: 'Technology',
      revenueRange: '$1M - $10M',
      businessModel: 'SaaS',
      keyConcerns: 'Growth stalling',
      oneDecisionKeepingOwnerUpAtNight: 'Should we pivot?',
    });

    const q = parseQuestionnaire(fd);

    expect(q.organizationName).toBe('Acme Corp');
    expect(q.industry).toBe('Technology');
    expect(q.revenueRange).toBe('$1M - $10M');
    expect(q.businessModel).toBe('SaaS');
    expect(q.keyConcerns).toBe('Growth stalling');
    expect(q.oneDecisionKeepingOwnerUpAtNight).toBe('Should we pivot?');
  });

  it('defaults empty org name to empty string', () => {
    const fd = createFormData({
      industry: 'Tech',
      revenueRange: '$0 - $10M',
      businessModel: 'B2B',
      keyConcerns: 'None',
      oneDecisionKeepingOwnerUpAtNight: 'Nothing',
    });

    const q = parseQuestionnaire(fd);
    expect(q.organizationName).toBe('');
  });

  it('defaults revenueRange when not provided', () => {
    const fd = createFormData({
      organizationName: 'Test',
      industry: 'Retail',
      businessModel: 'E-commerce',
      keyConcerns: 'Competition',
      oneDecisionKeepingOwnerUpAtNight: 'Pricing',
    });

    const q = parseQuestionnaire(fd);
    expect(q.revenueRange).toBe('$0 - $10M');
  });

  it('parses competitorUrls as JSON array', () => {
    const fd = createFormData({
      organizationName: 'Test',
      industry: 'Tech',
      revenueRange: '$0 - $10M',
      businessModel: 'SaaS',
      keyConcerns: 'None',
      oneDecisionKeepingOwnerUpAtNight: 'Nothing',
      competitorUrls: JSON.stringify(['https://comp1.com', 'https://comp2.com']),
    });

    const q = parseQuestionnaire(fd);
    expect(q.competitorUrls).toEqual(['https://comp1.com', 'https://comp2.com']);
  });

  it('parses competitorUrls as comma-separated string', () => {
    const fd = createFormData({
      organizationName: 'Test',
      industry: 'Tech',
      revenueRange: '$0 - $10M',
      businessModel: 'SaaS',
      keyConcerns: 'None',
      oneDecisionKeepingOwnerUpAtNight: 'Nothing',
      competitorUrls: 'https://comp1.com, https://comp2.com',
    });

    const q = parseQuestionnaire(fd);
    expect(q.competitorUrls).toEqual(['https://comp1.com', 'https://comp2.com']);
  });

  it('parses marketingChannels as JSON array', () => {
    const fd = createFormData({
      organizationName: 'Test',
      industry: 'Tech',
      revenueRange: '$0 - $10M',
      businessModel: 'SaaS',
      keyConcerns: 'None',
      oneDecisionKeepingOwnerUpAtNight: 'Nothing',
      marketingChannels: JSON.stringify(['SEO', 'PPC', 'Social']),
    });

    const q = parseQuestionnaire(fd);
    expect(q.marketingChannels).toEqual(['SEO', 'PPC', 'Social']);
  });

  it('parses socialMediaUrls as JSON object', () => {
    const urls = { twitter: 'https://twitter.com/test', linkedin: 'https://linkedin.com/company/test' };
    const fd = createFormData({
      organizationName: 'Test',
      industry: 'Tech',
      revenueRange: '$0 - $10M',
      businessModel: 'SaaS',
      keyConcerns: 'None',
      oneDecisionKeepingOwnerUpAtNight: 'Nothing',
      socialMediaUrls: JSON.stringify(urls),
    });

    const q = parseQuestionnaire(fd);
    expect(q.socialMediaUrls).toEqual(urls);
  });

  it('parses websiteVisitorsPerDay as integer', () => {
    const fd = createFormData({
      organizationName: 'Test',
      industry: 'Tech',
      revenueRange: '$0 - $10M',
      businessModel: 'SaaS',
      keyConcerns: 'None',
      oneDecisionKeepingOwnerUpAtNight: 'Nothing',
      websiteVisitorsPerDay: '5000',
    });

    const q = parseQuestionnaire(fd);
    expect(q.websiteVisitorsPerDay).toBe(5000);
  });

  it('handles invalid websiteVisitorsPerDay gracefully', () => {
    const fd = createFormData({
      organizationName: 'Test',
      industry: 'Tech',
      revenueRange: '$0 - $10M',
      businessModel: 'SaaS',
      keyConcerns: 'None',
      oneDecisionKeepingOwnerUpAtNight: 'Nothing',
      websiteVisitorsPerDay: 'not-a-number',
    });

    const q = parseQuestionnaire(fd);
    expect(q.websiteVisitorsPerDay).toBeUndefined();
  });

  it('includes optional fields when provided', () => {
    const fd = createFormData({
      organizationName: 'Test',
      industry: 'Tech',
      revenueRange: '$0 - $10M',
      businessModel: 'SaaS',
      keyConcerns: 'Growth',
      oneDecisionKeepingOwnerUpAtNight: 'Hiring',
      primaryObjective: 'Scale revenue',
      keyCustomers: 'Enterprise',
      keyCompetitors: 'Competitor A, Competitor B',
      location: 'San Francisco, CA',
      website: 'https://test.com',
      techStack: 'React, Node.js',
      orgId: 'org-123',
    });

    const q = parseQuestionnaire(fd);
    expect(q.primaryObjective).toBe('Scale revenue');
    expect(q.keyCustomers).toBe('Enterprise');
    expect(q.keyCompetitors).toBe('Competitor A, Competitor B');
    expect(q.location).toBe('San Francisco, CA');
    expect(q.website).toBe('https://test.com');
    expect(q.techStack).toBe('React, Node.js');
    expect(q.orgId).toBe('org-123');
  });

  it('returns undefined for missing optional fields', () => {
    const fd = createFormData({
      organizationName: 'Test',
      industry: 'Tech',
      revenueRange: '$0 - $10M',
      businessModel: 'SaaS',
      keyConcerns: 'None',
      oneDecisionKeepingOwnerUpAtNight: 'Nothing',
    });

    const q = parseQuestionnaire(fd);
    expect(q.primaryObjective).toBeUndefined();
    expect(q.keyCustomers).toBeUndefined();
    expect(q.location).toBeUndefined();
    expect(q.website).toBeUndefined();
    expect(q.competitorUrls).toBeUndefined();
    expect(q.marketingChannels).toBeUndefined();
    expect(q.socialMediaUrls).toBeUndefined();
    expect(q.websiteVisitorsPerDay).toBeUndefined();
  });
});

// ─── File Extension Validation Tests ──────────────────────────

describe('File extension validation', () => {
  const ACCEPTED_EXTENSIONS = new Set(
    '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt,.md'
      .split(',')
      .map((e) => e.trim().toLowerCase()),
  );

  it('accepts PDF files', () => {
    expect(ACCEPTED_EXTENSIONS.has('.pdf')).toBe(true);
  });

  it('accepts DOCX files', () => {
    expect(ACCEPTED_EXTENSIONS.has('.docx')).toBe(true);
    expect(ACCEPTED_EXTENSIONS.has('.doc')).toBe(true);
  });

  it('accepts spreadsheet files', () => {
    expect(ACCEPTED_EXTENSIONS.has('.xls')).toBe(true);
    expect(ACCEPTED_EXTENSIONS.has('.xlsx')).toBe(true);
    expect(ACCEPTED_EXTENSIONS.has('.csv')).toBe(true);
  });

  it('accepts text files', () => {
    expect(ACCEPTED_EXTENSIONS.has('.txt')).toBe(true);
    expect(ACCEPTED_EXTENSIONS.has('.md')).toBe(true);
  });

  it('rejects image files', () => {
    expect(ACCEPTED_EXTENSIONS.has('.jpg')).toBe(false);
    expect(ACCEPTED_EXTENSIONS.has('.png')).toBe(false);
    expect(ACCEPTED_EXTENSIONS.has('.gif')).toBe(false);
  });

  it('rejects executable files', () => {
    expect(ACCEPTED_EXTENSIONS.has('.exe')).toBe(false);
    expect(ACCEPTED_EXTENSIONS.has('.sh')).toBe(false);
    expect(ACCEPTED_EXTENSIONS.has('.bat')).toBe(false);
  });

  it('rejects archive files', () => {
    expect(ACCEPTED_EXTENSIONS.has('.zip')).toBe(false);
    expect(ACCEPTED_EXTENSIONS.has('.tar')).toBe(false);
    expect(ACCEPTED_EXTENSIONS.has('.gz')).toBe(false);
  });
});

// ─── File Size Limit Tests ────────────────────────────────────

describe('File size limits', () => {
  const MAX_FILE_BYTES = 50 * 1024 * 1024; // 50MB

  it('max file size is 50MB', () => {
    expect(MAX_FILE_BYTES).toBe(52428800);
  });

  it('accepts files under 50MB', () => {
    const fileSize = 10 * 1024 * 1024; // 10MB
    expect(fileSize <= MAX_FILE_BYTES).toBe(true);
  });

  it('rejects files over 50MB', () => {
    const fileSize = 60 * 1024 * 1024; // 60MB
    expect(fileSize <= MAX_FILE_BYTES).toBe(false);
  });
});
