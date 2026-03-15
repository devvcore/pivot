// ═══════════════════════════════════════════════════════════════
// Pivot — OAuth Helpers
// OAuth flow support for all integration providers
// ═══════════════════════════════════════════════════════════════

import type { IntegrationProvider, OAuthConfig } from './types';

// ─── OAuth Provider Configurations ────────────────────────────────────────────

interface OAuthProviderConfig {
  authUrl: string;
  tokenUrl: string;
  revokeUrl?: string;
  clientIdEnv: string;
  clientSecretEnv: string;
  defaultScopes: string[];
  // Some providers need special params
  extraAuthParams?: Record<string, string>;
  extraTokenParams?: Record<string, string>;
  // Stripe uses API keys, not OAuth
  usesApiKey?: boolean;
}

const OAUTH_CONFIGS: Record<IntegrationProvider, OAuthProviderConfig> = {
  slack: {
    authUrl: 'https://slack.com/oauth/v2/authorize',
    tokenUrl: 'https://slack.com/api/oauth.v2.access',
    revokeUrl: 'https://slack.com/api/auth.revoke',
    clientIdEnv: 'SLACK_CLIENT_ID',
    clientSecretEnv: 'SLACK_CLIENT_SECRET',
    defaultScopes: ['channels:history', 'channels:read', 'users:read', 'reactions:read', 'groups:history', 'im:history'],
  },
  gmail: {
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    revokeUrl: 'https://oauth2.googleapis.com/revoke',
    clientIdEnv: 'GMAIL_CLIENT_ID',
    clientSecretEnv: 'GMAIL_CLIENT_SECRET',
    defaultScopes: ['https://www.googleapis.com/auth/gmail.readonly'],
    extraAuthParams: { access_type: 'offline', prompt: 'consent' },
  },
  adp: {
    authUrl: 'https://accounts.adp.com/auth/oauth/v2/authorize',
    tokenUrl: 'https://accounts.adp.com/auth/oauth/v2/token',
    clientIdEnv: 'ADP_CLIENT_ID',
    clientSecretEnv: 'ADP_CLIENT_SECRET',
    defaultScopes: ['worker-demographics', 'payroll', 'time-management'],
  },
  workday: {
    authUrl: 'https://impl.workday.com/ccx/oauth2/authorize',
    tokenUrl: 'https://impl.workday.com/ccx/oauth2/token',
    clientIdEnv: 'WORKDAY_CLIENT_ID',
    clientSecretEnv: 'WORKDAY_CLIENT_SECRET',
    defaultScopes: ['wd:workers', 'wd:compensation', 'wd:organizations'],
  },
  quickbooks: {
    authUrl: 'https://appcenter.intuit.com/connect/oauth2',
    tokenUrl: 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer',
    revokeUrl: 'https://developer.api.intuit.com/v2/oauth2/tokens/revoke',
    clientIdEnv: 'QUICKBOOKS_CLIENT_ID',
    clientSecretEnv: 'QUICKBOOKS_CLIENT_SECRET',
    defaultScopes: ['com.intuit.quickbooks.accounting'],
  },
  salesforce: {
    authUrl: 'https://login.salesforce.com/services/oauth2/authorize',
    tokenUrl: 'https://login.salesforce.com/services/oauth2/token',
    revokeUrl: 'https://login.salesforce.com/services/oauth2/revoke',
    clientIdEnv: 'SALESFORCE_CLIENT_ID',
    clientSecretEnv: 'SALESFORCE_CLIENT_SECRET',
    defaultScopes: ['api', 'refresh_token'],
  },
  hubspot: {
    authUrl: 'https://app.hubspot.com/oauth/authorize',
    tokenUrl: 'https://api.hubapi.com/oauth/v1/token',
    clientIdEnv: 'HUBSPOT_CLIENT_ID',
    clientSecretEnv: 'HUBSPOT_CLIENT_SECRET',
    defaultScopes: ['crm.objects.contacts.read', 'crm.objects.deals.read'],
  },
  stripe: {
    authUrl: '',
    tokenUrl: '',
    clientIdEnv: 'STRIPE_SECRET_KEY',
    clientSecretEnv: 'STRIPE_SECRET_KEY',
    defaultScopes: ['read_only'],
    usesApiKey: true,
  },
  jira: {
    authUrl: 'https://auth.atlassian.com/authorize',
    tokenUrl: 'https://auth.atlassian.com/oauth/token',
    clientIdEnv: 'JIRA_CLIENT_ID',
    clientSecretEnv: 'JIRA_CLIENT_SECRET',
    defaultScopes: ['read:jira-work', 'read:jira-user'],
    extraAuthParams: { audience: 'api.atlassian.com', prompt: 'consent' },
  },
  github: {
    authUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    clientIdEnv: 'GITHUB_CLIENT_ID',
    clientSecretEnv: 'GITHUB_CLIENT_SECRET',
    defaultScopes: ['repo', 'read:org', 'read:user'],
  },
};

// ─── Get Redirect URI ─────────────────────────────────────────────────────────

function getRedirectUri(provider: IntegrationProvider): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? 'http://localhost:3000';
  return `${baseUrl}/api/integrations/${provider}/callback`;
}

// ═══════════════════════════════════════════════════════════════
// Public API
// ═══════════════════════════════════════════════════════════════

/**
 * Returns the full OAuth configuration for a provider,
 * reading client credentials from environment variables.
 */
export function getOAuthConfig(provider: IntegrationProvider): OAuthConfig {
  const config = OAUTH_CONFIGS[provider];
  if (!config) {
    throw new Error(`Unknown integration provider: ${provider}`);
  }

  if (config.usesApiKey) {
    const apiKey = process.env[config.clientIdEnv];
    if (!apiKey) {
      throw new Error(`Missing environment variable: ${config.clientIdEnv}`);
    }
    return {
      provider,
      authUrl: '',
      tokenUrl: '',
      clientId: apiKey,
      clientSecret: apiKey,
      scopes: config.defaultScopes,
      redirectUri: '',
    };
  }

  const clientId = process.env[config.clientIdEnv];
  const clientSecret = process.env[config.clientSecretEnv];

  if (!clientId) {
    throw new Error(`Missing environment variable: ${config.clientIdEnv}`);
  }
  if (!clientSecret) {
    throw new Error(`Missing environment variable: ${config.clientSecretEnv}`);
  }

  return {
    provider,
    authUrl: config.authUrl,
    tokenUrl: config.tokenUrl,
    clientId,
    clientSecret,
    scopes: config.defaultScopes,
    redirectUri: getRedirectUri(provider),
  };
}

/**
 * Builds the OAuth authorization URL that redirects the user
 * to the provider's consent screen.
 */
export function buildAuthUrl(
  provider: IntegrationProvider,
  orgId: string,
  state: string
): string {
  const config = OAUTH_CONFIGS[provider];
  if (!config) {
    throw new Error(`Unknown integration provider: ${provider}`);
  }

  if (config.usesApiKey) {
    throw new Error(`${provider} uses API keys, not OAuth. No auth URL needed.`);
  }

  const clientId = process.env[config.clientIdEnv];
  if (!clientId) {
    throw new Error(`Missing environment variable: ${config.clientIdEnv}`);
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: getRedirectUri(provider),
    response_type: 'code',
    state: JSON.stringify({ orgId, state, provider }),
  });

  // Scope parameter varies by provider
  if (provider === 'slack') {
    // Slack uses user_scope for user tokens, scope for bot tokens
    params.set('scope', config.defaultScopes.join(','));
  } else {
    params.set('scope', config.defaultScopes.join(' '));
  }

  // Append any extra auth params (e.g., access_type=offline for Google)
  if (config.extraAuthParams) {
    for (const [key, value] of Object.entries(config.extraAuthParams)) {
      params.set(key, value);
    }
  }

  return `${config.authUrl}?${params.toString()}`;
}

/**
 * Exchanges an authorization code for access and refresh tokens.
 */
export async function exchangeCodeForTokens(
  provider: IntegrationProvider,
  code: string
): Promise<{
  accessToken: string;
  refreshToken: string | null;
  expiresIn: number | null;
  scopes: string[];
  raw: Record<string, any>;
}> {
  const config = OAUTH_CONFIGS[provider];
  if (!config) {
    throw new Error(`Unknown integration provider: ${provider}`);
  }

  if (config.usesApiKey) {
    throw new Error(`${provider} uses API keys, not OAuth. No token exchange needed.`);
  }

  const clientId = process.env[config.clientIdEnv];
  const clientSecret = process.env[config.clientSecretEnv];

  if (!clientId || !clientSecret) {
    throw new Error(`Missing OAuth credentials for ${provider}`);
  }

  const body: Record<string, string> = {
    grant_type: 'authorization_code',
    code,
    redirect_uri: getRedirectUri(provider),
    client_id: clientId,
    client_secret: clientSecret,
    ...config.extraTokenParams,
  };

  const response = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams(body).toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Token exchange failed for ${provider} (${response.status}): ${errorText}`
    );
  }

  const data = await response.json();

  // Normalize response — different providers return tokens differently
  return normalizeTokenResponse(provider, data);
}

/**
 * Refreshes an expired access token using the refresh token.
 */
export async function refreshAccessToken(
  provider: IntegrationProvider,
  refreshToken: string
): Promise<{
  accessToken: string;
  refreshToken: string | null;
  expiresIn: number | null;
  raw: Record<string, any>;
}> {
  const config = OAUTH_CONFIGS[provider];
  if (!config) {
    throw new Error(`Unknown integration provider: ${provider}`);
  }

  if (config.usesApiKey) {
    throw new Error(`${provider} uses API keys. Tokens do not expire.`);
  }

  const clientId = process.env[config.clientIdEnv];
  const clientSecret = process.env[config.clientSecretEnv];

  if (!clientId || !clientSecret) {
    throw new Error(`Missing OAuth credentials for ${provider}`);
  }

  const body: Record<string, string> = {
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
  };

  const response = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams(body).toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Token refresh failed for ${provider} (${response.status}): ${errorText}`
    );
  }

  const data = await response.json();

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? null,
    expiresIn: data.expires_in ?? null,
    raw: data,
  };
}

/**
 * Revokes an access token, disconnecting the integration.
 */
export async function revokeToken(
  provider: IntegrationProvider,
  accessToken: string
): Promise<void> {
  const config = OAUTH_CONFIGS[provider];
  if (!config) {
    throw new Error(`Unknown integration provider: ${provider}`);
  }

  if (config.usesApiKey) {
    // Stripe API keys are managed in the Stripe dashboard, nothing to revoke
    return;
  }

  if (!config.revokeUrl) {
    // Some providers don't support token revocation
    // In that case, we just delete the token from our DB
    return;
  }

  try {
    // Different providers accept revocation differently
    if (provider === 'slack') {
      // Slack revocation uses a GET with token param
      await fetch(`${config.revokeUrl}?token=${accessToken}`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
    } else if (provider === 'gmail') {
      // Google uses POST with token in body
      await fetch(config.revokeUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ token: accessToken }).toString(),
      });
    } else if (provider === 'salesforce') {
      // Salesforce uses POST with token in body
      await fetch(config.revokeUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ token: accessToken }).toString(),
      });
    } else if (provider === 'quickbooks') {
      // QuickBooks uses POST with JSON body and Basic auth
      const clientId = process.env[config.clientIdEnv];
      const clientSecret = process.env[config.clientSecretEnv];
      const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
      await fetch(config.revokeUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Basic ${basicAuth}`,
        },
        body: JSON.stringify({ token: accessToken }),
      });
    } else {
      // Default: POST with token in form body
      await fetch(config.revokeUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ token: accessToken }).toString(),
      });
    }
  } catch (error) {
    // Revocation failures are non-critical — log but don't throw
    console.error(`Token revocation failed for ${provider}:`, error);
  }
}

// ─── Internal Helpers ─────────────────────────────────────────────────────────

/**
 * Normalizes the token response from different OAuth providers
 * into a consistent format.
 */
function normalizeTokenResponse(
  provider: IntegrationProvider,
  data: Record<string, any>
): {
  accessToken: string;
  refreshToken: string | null;
  expiresIn: number | null;
  scopes: string[];
  raw: Record<string, any>;
} {
  // Slack nests the token differently
  if (provider === 'slack') {
    return {
      accessToken: data.access_token ?? data.authed_user?.access_token ?? '',
      refreshToken: data.refresh_token ?? null,
      expiresIn: data.expires_in ?? null,
      scopes: (data.scope ?? '').split(',').filter(Boolean),
      raw: data,
    };
  }

  // Standard OAuth2 response
  const scopes = typeof data.scope === 'string'
    ? data.scope.split(/[, ]/).filter(Boolean)
    : Array.isArray(data.scope)
      ? data.scope
      : [];

  return {
    accessToken: data.access_token ?? '',
    refreshToken: data.refresh_token ?? null,
    expiresIn: data.expires_in ?? null,
    scopes,
    raw: data,
  };
}

/**
 * Returns the Workday OAuth URLs with the tenant substituted in.
 * Call this when you have the Workday tenant name from metadata.
 */
export function getWorkdayUrls(tenant: string): { authUrl: string; tokenUrl: string } {
  return {
    authUrl: `https://${tenant}.workday.com/ccx/oauth2/${tenant}/authorize`,
    tokenUrl: `https://${tenant}.workday.com/ccx/oauth2/${tenant}/token`,
  };
}

/**
 * Builds a Workday-specific auth URL with the tenant name.
 */
export function buildWorkdayAuthUrl(
  tenant: string,
  orgId: string,
  state: string
): string {
  const clientId = process.env.WORKDAY_CLIENT_ID;
  if (!clientId) {
    throw new Error('Missing environment variable: WORKDAY_CLIENT_ID');
  }

  const config = OAUTH_CONFIGS.workday;
  const urls = getWorkdayUrls(tenant);

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: getRedirectUri('workday'),
    response_type: 'code',
    scope: config.defaultScopes.join(' '),
    state: JSON.stringify({ orgId, state, provider: 'workday', tenant }),
  });

  return `${urls.authUrl}?${params.toString()}`;
}
