/**
 * Credential Status Handler
 * 
 * Checks if Azure credentials are available for the current user.
 */

import { DefaultAzureCredential } from '@azure/identity';

export interface CredentialStatus {
  available: boolean;
  message: string;
}

export async function handleCredentialStatus(): Promise<CredentialStatus> {
  try {
    const credential = new DefaultAzureCredential();
    
    // Try to get a token for Azure management to verify credentials work
    // Using a well-known scope that should be available
    await credential.getToken('https://management.azure.com/.default');
    
    return {
      available: true,
      message: 'Azure credentials available',
    };
  } catch (err) {
    const error = err as Error & { code?: string };
    
    if (error.code === 'CredentialUnavailableError') {
      return {
        available: false,
        message: 'Azure credentials not available. Please run "az login" in your terminal.',
      };
    }
    
    return {
      available: false,
      message: error.message || 'Failed to verify Azure credentials',
    };
  }
}
