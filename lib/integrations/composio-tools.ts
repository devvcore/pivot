// ═══════════════════════════════════════════════════════════════
// Pivot — Composio Tool Execution Layer
// High-level typed helper functions wrapping Composio's
// composio.tools.execute() API for each supported integration.
// Each function obtains the Composio singleton, executes the
// named tool with the correct arguments, and returns the result.
// Errors are caught, logged, and result in a null return value.
// ═══════════════════════════════════════════════════════════════

import { getComposio } from './composio';
import type { IntegrationProvider } from './types';

// ─── Toolkit Name Mapping ────────────────────────────────────────────────────

export const COMPOSIO_TOOLKIT_MAP: Record<IntegrationProvider, string> = {
  slack: 'SLACKBOT',
  gmail: 'GMAIL',
  github: 'GITHUB',
  jira: 'JIRA',
  hubspot: 'HUBSPOT',
  salesforce: 'SALESFORCE',
  stripe: 'STRIPE',
  quickbooks: 'QUICKBOOKS',
  workday: 'WORKDAY',
  google_analytics: 'GOOGLE_ANALYTICS',
  google_sheets: 'GOOGLESHEETS',
  notion: 'NOTION',
  linear: 'LINEAR',
  asana: 'ASANA',
  google_calendar: 'GOOGLECALENDAR',
  microsoft_teams: 'MICROSOFT_TEAMS',
  airtable: 'AIRTABLE',
  adp: 'ADP',
  linkedin: 'LINKEDIN',
  twitter: 'TWITTER',
  instagram: 'INSTAGRAM',
  facebook: 'FACEBOOK',
  youtube: 'YOUTUBE',
};

// ─── Internal Execute Wrapper ────────────────────────────────────────────────

async function exec(
  toolName: string,
  orgId: string,
  args: Record<string, unknown>,
): Promise<any> {
  try {
    const composio = getComposio();
    const result = await composio.tools.execute(toolName, {
      userId: orgId,
      arguments: args,
      dangerouslySkipVersionCheck: true,
    } as Record<string, unknown>);
    return result;
  } catch (error) {
    console.error(`[composio-tools] ${toolName} failed for org ${orgId}:`, error);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════
// Slack
// ═══════════════════════════════════════════════════════════════

/** Send a message to a Slack channel. */
export async function sendSlackMessage(
  orgId: string,
  channel: string,
  text: string,
): Promise<any> {
  return exec('SLACKBOT_SEND_MESSAGE', orgId, { channel, text });
}

/** List all Slack channels in the workspace. */
export async function getSlackChannels(orgId: string): Promise<any> {
  return exec('SLACKBOT_LIST_ALL_CHANNELS', orgId, {});
}

/** Fetch message history for a Slack channel. */
export async function getSlackChannelHistory(
  orgId: string,
  channel: string,
  limit?: number,
): Promise<any> {
  return exec('SLACKBOT_FETCH_CONVERSATION_HISTORY', orgId, {
    channel,
    ...(limit !== undefined && { limit }),
  });
}

/** List all users in the Slack workspace. */
export async function getSlackUsers(orgId: string): Promise<any> {
  return exec('SLACKBOT_LIST_ALL_USERS', orgId, {});
}

// ═══════════════════════════════════════════════════════════════
// Gmail
// ═══════════════════════════════════════════════════════════════

/** Send an email via Gmail. */
export async function sendEmail(
  orgId: string,
  to: string,
  subject: string,
  body: string,
): Promise<any> {
  return exec('GMAIL_SEND_EMAIL', orgId, { to, subject, body });
}

/** Fetch emails from Gmail matching an optional query. */
export async function getEmails(
  orgId: string,
  query?: string,
  maxResults?: number,
): Promise<any> {
  return exec('GMAIL_FETCH_EMAILS', orgId, {
    ...(query !== undefined && { query }),
    ...(maxResults !== undefined && { max_results: maxResults }),
  });
}

/** Get the authenticated Gmail user profile. */
export async function getGmailProfile(orgId: string): Promise<any> {
  return exec('GMAIL_GET_PROFILE', orgId, {});
}

// ═══════════════════════════════════════════════════════════════
// GitHub
// ═══════════════════════════════════════════════════════════════

/** List GitHub repositories. If org is provided, lists org repos; otherwise lists user repos. */
export async function getGitHubRepos(
  orgId: string,
  org?: string,
): Promise<any> {
  if (org) {
    return exec('GITHUB_LIST_ORGANIZATION_REPOSITORIES', orgId, { org });
  }
  return exec('GITHUB_LIST_REPOSITORIES_FOR_THE_AUTHENTICATED_USER', orgId, {});
}

/** List issues for a GitHub repository. */
export async function getGitHubIssues(
  orgId: string,
  owner: string,
  repo: string,
): Promise<any> {
  return exec('GITHUB_LIST_REPOSITORY_ISSUES', orgId, { owner, repo });
}

/** List pull requests for a GitHub repository. */
export async function getGitHubPRs(
  orgId: string,
  owner: string,
  repo: string,
): Promise<any> {
  return exec('GITHUB_LIST_PULL_REQUESTS', orgId, { owner, repo });
}

/** Create an issue in a GitHub repository. */
export async function createGitHubIssue(
  orgId: string,
  owner: string,
  repo: string,
  title: string,
  body: string,
): Promise<any> {
  return exec('GITHUB_CREATE_AN_ISSUE', orgId, { owner, repo, title, body });
}

// ═══════════════════════════════════════════════════════════════
// HubSpot
// ═══════════════════════════════════════════════════════════════

/** Fetch HubSpot contacts with optional property filters. */
export async function getHubSpotContacts(
  orgId: string,
  properties?: string[],
  limit?: number,
): Promise<any> {
  return exec('HUBSPOT_BATCH_READ_COMPANIES_BY_PROPERTIES', orgId, {
    ...(properties !== undefined && { properties }),
    ...(limit !== undefined && { limit }),
  });
}

/** Create a new HubSpot contact. */
export async function createHubSpotContact(
  orgId: string,
  email: string,
  firstname: string,
  lastname: string,
  company?: string,
): Promise<any> {
  return exec('HUBSPOT_CREATE_CONTACT', orgId, {
    email,
    firstname,
    lastname,
    ...(company !== undefined && { company }),
  });
}

/** List HubSpot deals. */
export async function getHubSpotDeals(orgId: string): Promise<any> {
  return exec('HUBSPOT_LIST_DEALS', orgId, {});
}

// ═══════════════════════════════════════════════════════════════
// Jira
// ═══════════════════════════════════════════════════════════════

/** Search Jira issues using JQL. */
export async function searchJiraIssues(
  orgId: string,
  jql: string,
): Promise<any> {
  return exec('JIRA_SEARCH_ISSUES_JQL', orgId, { jql });
}

/** List sprints for a Jira board. */
export async function getJiraSprints(
  orgId: string,
  boardId: string,
): Promise<any> {
  return exec('JIRA_LIST_SPRINTS', orgId, { board_id: boardId });
}

/** Create a Jira issue. */
export async function createJiraIssue(
  orgId: string,
  projectKey: string,
  summary: string,
  description: string,
  issueType?: string,
): Promise<any> {
  return exec('JIRA_CREATE_ISSUE', orgId, {
    project_key: projectKey,
    summary,
    description,
    issue_type: issueType ?? 'Task',
  });
}

// ═══════════════════════════════════════════════════════════════
// Salesforce
// ═══════════════════════════════════════════════════════════════

/** List Salesforce accounts. */
export async function getSalesforceAccounts(orgId: string): Promise<any> {
  return exec('SALESFORCE_LIST_ACCOUNTS', orgId, {});
}

/** List Salesforce opportunities. */
export async function getSalesforceOpportunities(orgId: string): Promise<any> {
  return exec('SALESFORCE_LIST_OPPORTUNITIES', orgId, {});
}

// ═══════════════════════════════════════════════════════════════
// Stripe
// ═══════════════════════════════════════════════════════════════

/** List Stripe customers. */
export async function getStripeCustomers(
  orgId: string,
  limit?: number,
): Promise<any> {
  return exec('STRIPE_LIST_CUSTOMERS', orgId, {
    ...(limit !== undefined && { limit }),
  });
}

/** List Stripe payment intents. */
export async function getStripePayments(
  orgId: string,
  limit?: number,
): Promise<any> {
  return exec('STRIPE_LIST_PAYMENT_INTENTS', orgId, {
    ...(limit !== undefined && { limit }),
  });
}

// ═══════════════════════════════════════════════════════════════
// QuickBooks
// ═══════════════════════════════════════════════════════════════

/** List QuickBooks invoices. */
export async function getQuickBooksInvoices(orgId: string): Promise<any> {
  return exec('QUICKBOOKS_LIST_INVOICES', orgId, {});
}

/** List QuickBooks accounts. */
export async function getQuickBooksAccounts(orgId: string): Promise<any> {
  return exec('QUICKBOOKS_LIST_ACCOUNTS', orgId, {});
}

// ═══════════════════════════════════════════════════════════════
// Google Analytics
// ═══════════════════════════════════════════════════════════════

/** Run a Google Analytics report with specified dimensions and metrics. */
export async function runAnalyticsReport(
  orgId: string,
  propertyId: string,
  dimensions: string[],
  metrics: string[],
  startDate: string,
  endDate: string,
): Promise<any> {
  return exec('GOOGLE_ANALYTICS_RUN_REPORT', orgId, {
    property_id: propertyId,
    dimensions,
    metrics,
    start_date: startDate,
    end_date: endDate,
  });
}

/** Run a Google Analytics realtime report. */
export async function getRealtimeReport(
  orgId: string,
  propertyId: string,
): Promise<any> {
  return exec('GOOGLE_ANALYTICS_RUN_REALTIME_REPORT', orgId, {
    property_id: propertyId,
  });
}

// ═══════════════════════════════════════════════════════════════
// Google Sheets
// ═══════════════════════════════════════════════════════════════

/** Read data from a Google Sheets spreadsheet. */
export async function readSpreadsheet(
  orgId: string,
  spreadsheetId: string,
  range: string,
): Promise<any> {
  return exec('GOOGLESHEETS_READ_SPREADSHEET', orgId, {
    spreadsheet_id: spreadsheetId,
    range,
  });
}

/** Write data to a Google Sheets spreadsheet. */
export async function writeSpreadsheet(
  orgId: string,
  spreadsheetId: string,
  range: string,
  values: unknown[][],
): Promise<any> {
  return exec('GOOGLESHEETS_WRITE_SPREADSHEET', orgId, {
    spreadsheet_id: spreadsheetId,
    range,
    values,
  });
}

// ═══════════════════════════════════════════════════════════════
// Notion
// ═══════════════════════════════════════════════════════════════

/** Search across a Notion workspace. */
export async function searchNotion(
  orgId: string,
  query: string,
): Promise<any> {
  return exec('NOTION_SEARCH', orgId, { query });
}

/** Query a Notion database by ID. */
export async function getNotionDatabase(
  orgId: string,
  databaseId: string,
): Promise<any> {
  return exec('NOTION_QUERY_DATABASE', orgId, { database_id: databaseId });
}

// ═══════════════════════════════════════════════════════════════
// Linear
// ═══════════════════════════════════════════════════════════════

/** List Linear issues, optionally filtered by team. */
export async function getLinearIssues(
  orgId: string,
  teamId?: string,
): Promise<any> {
  return exec('LINEAR_LIST_ISSUES', orgId, {
    ...(teamId !== undefined && { team_id: teamId }),
  });
}

/** List Linear cycles (sprints) for a team. */
export async function getLinearCycles(
  orgId: string,
  teamId: string,
): Promise<any> {
  return exec('LINEAR_LIST_CYCLES', orgId, { team_id: teamId });
}

// ═══════════════════════════════════════════════════════════════
// Asana
// ═══════════════════════════════════════════════════════════════

/** List Asana tasks for a project. */
export async function getAsanaTasks(
  orgId: string,
  projectId: string,
): Promise<any> {
  return exec('ASANA_LIST_TASKS', orgId, { project: projectId });
}

/** List Asana projects in a workspace. */
export async function getAsanaProjects(
  orgId: string,
  workspaceId: string,
): Promise<any> {
  return exec('ASANA_LIST_PROJECTS', orgId, { workspace: workspaceId });
}

// ═══════════════════════════════════════════════════════════════
// Google Calendar
// ═══════════════════════════════════════════════════════════════

/** List Google Calendar events with optional time range. */
export async function getCalendarEvents(
  orgId: string,
  calendarId?: string,
  timeMin?: string,
  timeMax?: string,
): Promise<any> {
  return exec('GOOGLECALENDAR_LIST_EVENTS', orgId, {
    calendar_id: calendarId ?? 'primary',
    ...(timeMin !== undefined && { time_min: timeMin }),
    ...(timeMax !== undefined && { time_max: timeMax }),
  });
}

/** List all Google Calendars for the user. */
export async function getCalendars(orgId: string): Promise<any> {
  return exec('GOOGLECALENDAR_LIST_CALENDARS', orgId, {});
}

/** Create a Google Calendar event. */
export async function createCalendarEvent(
  orgId: string,
  summary: string,
  startTime: string,
  endTime: string,
  description?: string,
  attendees?: string[],
): Promise<any> {
  return exec('GOOGLECALENDAR_CREATE_EVENT', orgId, {
    summary,
    start_time: startTime,
    end_time: endTime,
    ...(description !== undefined && { description }),
    ...(attendees !== undefined && { attendees: attendees.map(e => ({ email: e })) }),
  });
}

// ═══════════════════════════════════════════════════════════════
// Microsoft Teams
// ═══════════════════════════════════════════════════════════════

/** List channels in a Microsoft Teams team. */
export async function getTeamsChannels(
  orgId: string,
  teamId: string,
): Promise<any> {
  return exec('MICROSOFT_TEAMS_LIST_CHANNELS', orgId, { team_id: teamId });
}

/** Get messages from a Microsoft Teams channel. */
export async function getTeamsMessages(
  orgId: string,
  teamId: string,
  channelId: string,
): Promise<any> {
  return exec('MICROSOFT_TEAMS_LIST_CHANNEL_MESSAGES', orgId, {
    team_id: teamId,
    channel_id: channelId,
  });
}

// ═══════════════════════════════════════════════════════════════
// Airtable
// ═══════════════════════════════════════════════════════════════

/** List all Airtable bases accessible to the user. */
export async function getAirtableBases(orgId: string): Promise<any> {
  return exec('AIRTABLE_LIST_BASES', orgId, {});
}

/** List records from an Airtable table. */
export async function getAirtableRecords(
  orgId: string,
  baseId: string,
  tableId: string,
): Promise<any> {
  return exec('AIRTABLE_LIST_RECORDS', orgId, {
    base_id: baseId,
    table_id: tableId,
  });
}

// ═══════════════════════════════════════════════════════════════
// LinkedIn
// ═══════════════════════════════════════════════════════════════

/** Create a text post on LinkedIn. */
export async function createLinkedInPost(
  orgId: string,
  text: string,
  visibility?: 'PUBLIC' | 'CONNECTIONS',
): Promise<any> {
  return exec('LINKEDIN_CREATE_LINKED_IN_POST', orgId, {
    text,
    visibility: visibility ?? 'PUBLIC',
  });
}

/** Create a LinkedIn post with a link/article share. */
export async function createLinkedInSharePost(
  orgId: string,
  text: string,
  url: string,
  title?: string,
): Promise<any> {
  return exec('LINKEDIN_CREATE_POST_WITH_SHARE', orgId, {
    text,
    url,
    ...(title !== undefined && { title }),
  });
}

/** Get the authenticated LinkedIn user's profile. */
export async function getLinkedInProfile(orgId: string): Promise<any> {
  return exec('LINKEDIN_GET_USER_PROFILE', orgId, {});
}

// ═══════════════════════════════════════════════════════════════
// Twitter / X
// ═══════════════════════════════════════════════════════════════

/** Post a tweet. */
export async function createTweet(
  orgId: string,
  text: string,
): Promise<any> {
  return exec('TWITTER_CREATION_OF_A_POST', orgId, { text });
}

/** Reply to an existing tweet. */
export async function replyToTweet(
  orgId: string,
  text: string,
  replyToTweetId: string,
): Promise<any> {
  return exec('TWITTER_CREATION_OF_A_POST', orgId, {
    text,
    reply: { in_reply_to_tweet_id: replyToTweetId },
  });
}

/** Like a tweet. */
export async function likeTweet(
  orgId: string,
  tweetId: string,
): Promise<any> {
  return exec('TWITTER_LIKE_A_POST', orgId, { tweet_id: tweetId });
}

/** Retweet a tweet. */
export async function retweet(
  orgId: string,
  tweetId: string,
): Promise<any> {
  return exec('TWITTER_REPOST_A_POST', orgId, { tweet_id: tweetId });
}

/** Search recent tweets. */
export async function searchTweets(
  orgId: string,
  query: string,
  maxResults?: number,
): Promise<any> {
  return exec('TWITTER_SEARCH_TWEETS', orgId, {
    query,
    ...(maxResults !== undefined && { max_results: maxResults }),
  });
}

/** Get the authenticated Twitter user's info. */
export async function getTwitterUser(orgId: string): Promise<any> {
  return exec('TWITTER_GET_AUTHENTICATED_USER', orgId, {});
}

// ═══════════════════════════════════════════════════════════════
// GitHub — Extended Actions
// ═══════════════════════════════════════════════════════════════

/** Create a pull request. */
export async function createGitHubPR(
  orgId: string,
  owner: string,
  repo: string,
  title: string,
  body: string,
  head: string,
  base: string,
): Promise<any> {
  return exec('GITHUB_CREATE_A_PULL_REQUEST', orgId, {
    owner, repo, title, body, head, base,
  });
}

/** Star a GitHub repository. */
export async function starGitHubRepo(
  orgId: string,
  owner: string,
  repo: string,
): Promise<any> {
  return exec('GITHUB_STAR_A_REPOSITORY_FOR_THE_AUTHENTICATED_USER', orgId, {
    owner, repo,
  });
}

/** Create a comment on a GitHub issue or PR. */
export async function createGitHubComment(
  orgId: string,
  owner: string,
  repo: string,
  issueNumber: number,
  body: string,
): Promise<any> {
  return exec('GITHUB_CREATE_A_COMMENT', orgId, {
    owner, repo, issue_number: issueNumber, body,
  });
}

/** List commits for a GitHub repository. */
export async function getGitHubCommits(
  orgId: string,
  owner: string,
  repo: string,
): Promise<any> {
  return exec('GITHUB_LIST_COMMITS', orgId, { owner, repo });
}

// ═══════════════════════════════════════════════════════════════
// Instagram
// ═══════════════════════════════════════════════════════════════

/** Create a photo post on Instagram (Business/Creator account). */
export async function createInstagramPost(
  orgId: string,
  imageUrl: string,
  caption: string,
): Promise<any> {
  return exec('INSTAGRAM_CREATE_PHOTO_POST', orgId, {
    image_url: imageUrl,
    caption,
  });
}

/** Create a carousel post on Instagram. */
export async function createInstagramCarousel(
  orgId: string,
  mediaUrls: string[],
  caption: string,
): Promise<any> {
  return exec('INSTAGRAM_CREATE_CAROUSEL_POST', orgId, {
    media_urls: mediaUrls,
    caption,
  });
}

/** Get Instagram user profile info. */
export async function getInstagramProfile(orgId: string): Promise<any> {
  return exec('INSTAGRAM_GET_USER_PROFILE', orgId, {});
}

/** Get recent Instagram media for the user. */
export async function getInstagramMedia(orgId: string, limit = 25): Promise<any> {
  return exec('INSTAGRAM_GET_USER_MEDIA', orgId, { limit });
}

/** Get insights/analytics for an Instagram media object. */
export async function getInstagramInsights(orgId: string, mediaId: string): Promise<any> {
  return exec('INSTAGRAM_GET_MEDIA_INSIGHTS', orgId, { media_id: mediaId });
}

// ═══════════════════════════════════════════════════════════════
// Facebook
// ═══════════════════════════════════════════════════════════════

/** Create a text post on a Facebook Page. */
export async function createFacebookPost(
  orgId: string,
  pageId: string,
  message: string,
): Promise<any> {
  return exec('FACEBOOK_CREATE_PAGE_POST', orgId, {
    page_id: pageId,
    message,
  });
}

/** Create a photo post on a Facebook Page. */
export async function createFacebookPhotoPost(
  orgId: string,
  pageId: string,
  photoUrl: string,
  caption: string,
): Promise<any> {
  return exec('FACEBOOK_CREATE_PAGE_PHOTO', orgId, {
    page_id: pageId,
    url: photoUrl,
    caption,
  });
}

/** Get Facebook Pages managed by the user. */
export async function getFacebookPages(orgId: string): Promise<any> {
  return exec('FACEBOOK_GET_PAGES', orgId, {});
}

/** Get insights/analytics for a Facebook Page. */
export async function getFacebookPageInsights(
  orgId: string,
  pageId: string,
): Promise<any> {
  return exec('FACEBOOK_GET_PAGE_INSIGHTS', orgId, { page_id: pageId });
}

/** Get posts from a Facebook Page. */
export async function getFacebookPagePosts(
  orgId: string,
  pageId: string,
  limit = 25,
): Promise<any> {
  return exec('FACEBOOK_GET_PAGE_POSTS', orgId, { page_id: pageId, limit });
}

// ═══════════════════════════════════════════════════════════════
// YouTube
// ═══════════════════════════════════════════════════════════════

/** Get the authenticated user's YouTube channel info. */
export async function getYouTubeChannel(orgId: string): Promise<any> {
  return exec('YOUTUBE_GET_CHANNEL', orgId, { mine: true });
}

/** List videos on the user's YouTube channel. */
export async function getYouTubeVideos(orgId: string, maxResults = 25): Promise<any> {
  return exec('YOUTUBE_LIST_CHANNEL_VIDEOS', orgId, { max_results: maxResults });
}

/** Get analytics for a YouTube video. */
export async function getYouTubeVideoAnalytics(orgId: string, videoId: string): Promise<any> {
  return exec('YOUTUBE_GET_VIDEO_DETAILS', orgId, { video_id: videoId });
}

/** Search YouTube for videos by query. */
export async function searchYouTube(orgId: string, query: string, maxResults = 10): Promise<any> {
  return exec('YOUTUBE_SEARCH_VIDEOS', orgId, { query, max_results: maxResults });
}

/** List playlists on the user's YouTube channel. */
export async function getYouTubePlaylists(orgId: string): Promise<any> {
  return exec('YOUTUBE_LIST_PLAYLISTS', orgId, { mine: true });
}
