
export interface ScopeMetadata {
  scope: string;
  description: string;
  adminConsentRequired: boolean;
  category: 'user' | 'mail' | 'calendar' | 'files' | 'directory' | 'teams' | 'azure' | 'custom';
}

export const GRAPH_SCOPES: ScopeMetadata[] = [
  // User Profile
  { scope: 'User.Read', description: 'Sign in and read user profile', adminConsentRequired: false, category: 'user' },
  { scope: 'User.Read.All', description: 'Read all users\' full profiles', adminConsentRequired: true, category: 'user' },
  { scope: 'User.ReadWrite', description: 'Read and write your profile', adminConsentRequired: false, category: 'user' },
  { scope: 'User.ReadWrite.All', description: 'Read and write all users\' profiles', adminConsentRequired: true, category: 'user' },
  { scope: 'User.Export.All', description: 'Export all users\' data', adminConsentRequired: true, category: 'user' },

  // Mail
  { scope: 'Mail.Read', description: 'Read your email', adminConsentRequired: false, category: 'mail' },
  { scope: 'Mail.ReadWrite', description: 'Read and write your email', adminConsentRequired: false, category: 'mail' },
  { scope: 'Mail.Send', description: 'Send mail as you', adminConsentRequired: false, category: 'mail' },
  { scope: 'Mail.Read.Shared', description: 'Read shared email', adminConsentRequired: false, category: 'mail' },
  { scope: 'Mail.ReadWrite.Shared', description: 'Read and write shared email', adminConsentRequired: false, category: 'mail' },

  // Calendar
  { scope: 'Calendars.Read', description: 'Read your calendar', adminConsentRequired: false, category: 'calendar' },
  { scope: 'Calendars.ReadWrite', description: 'Have full access to your calendars', adminConsentRequired: false, category: 'calendar' },
  { scope: 'Calendars.Read.Shared', description: 'Read shared calendars', adminConsentRequired: false, category: 'calendar' },
  { scope: 'Calendars.ReadWrite.Shared', description: 'Read and write shared calendars', adminConsentRequired: false, category: 'calendar' },

  // Files
  { scope: 'Files.Read', description: 'Read your files', adminConsentRequired: false, category: 'files' },
  { scope: 'Files.Read.All', description: 'Read all files that you can access', adminConsentRequired: false, category: 'files' },
  { scope: 'Files.ReadWrite', description: 'Have full access to your files', adminConsentRequired: false, category: 'files' },
  { scope: 'Files.ReadWrite.All', description: 'Have full access to all files you can access', adminConsentRequired: false, category: 'files' },
  { scope: 'Sites.Read.All', description: 'Read items in all site collections', adminConsentRequired: false, category: 'files' },
  { scope: 'Sites.ReadWrite.All', description: 'Read and write items in all site collections', adminConsentRequired: false, category: 'files' },

  // Directory
  { scope: 'Directory.Read.All', description: 'Read directory data', adminConsentRequired: true, category: 'directory' },
  { scope: 'Directory.ReadWrite.All', description: 'Read and write directory data', adminConsentRequired: true, category: 'directory' },
  { scope: 'Group.Read.All', description: 'Read all groups', adminConsentRequired: true, category: 'directory' },
  { scope: 'Group.ReadWrite.All', description: 'Read and write all groups', adminConsentRequired: true, category: 'directory' },

  // Teams
  { scope: 'Team.ReadBasic.All', description: 'Read the names and descriptions of teams', adminConsentRequired: false, category: 'teams' },
  { scope: 'ChannelMessage.Read.All', description: 'Read all channel messages', adminConsentRequired: true, category: 'teams' },
  { scope: 'Chat.Read', description: 'Read your chats', adminConsentRequired: false, category: 'teams' },

  // Azure / Other
  { scope: 'offline_access', description: 'Maintain access to data you have given it access to', adminConsentRequired: false, category: 'azure' },
  { scope: 'openid', description: 'Sign users in', adminConsentRequired: false, category: 'azure' },
  { scope: 'profile', description: 'View users\' basic profile', adminConsentRequired: false, category: 'azure' },
  { scope: 'email', description: 'View users\' email address', adminConsentRequired: false, category: 'azure' },
];

export const RESOURCE_PRESETS = [
  { label: 'Microsoft Graph', value: 'https://graph.microsoft.com/.default', description: 'Access Graph with app permissions' },
  { label: 'Azure Management', value: 'https://management.azure.com/.default', description: 'Manage Azure resources' },
  { label: 'Key Vault', value: 'https://vault.azure.net/.default', description: 'Access Key Vault secrets' },
  { label: 'Storage', value: 'https://storage.azure.com/.default', description: 'Access Azure Storage' },
  { label: 'SQL Database', value: 'https://database.windows.net/.default', description: 'Access Azure SQL Database' },
];

export const SCOPE_PRESETS = [
  { label: 'Profile', value: 'User.Read', description: 'Sign in and read basic profile' },
  { label: 'Mail Access', value: 'User.Read Mail.Read', description: 'Read your profile and email' },
  { label: 'Full Mail + Offline', value: 'User.Read Mail.Read offline_access', description: 'Mail access with refresh token' },
  { label: 'Admin: Directory', value: 'Directory.Read.All', description: 'Read all directory data (requires admin consent)' },
  { label: 'Calendar Manager', value: 'User.Read Calendars.ReadWrite', description: 'Full access to calendar' },
];
