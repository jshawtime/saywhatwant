/**
 * Domain Configuration System
 * Manages multi-domain deployment settings
 */

export interface DomainConfig {
  domain: string;
  title: string;
  description?: string;
  theme?: {
    primaryColor?: string;
    accentColor?: string;
  };
}

// Domain configurations
export const DOMAIN_CONFIGS: Record<string, DomainConfig> = {
  'saywhatwant.app': {
    domain: 'saywhatwant.app',
    title: 'Say What Want',
    description: 'Say whatever you want',
  },
  'shittosay.app': {
    domain: 'shittosay.app', 
    title: 'Shit To Say',
    description: 'Got shit to say?',
  },
  'localhost:3000': {
    domain: 'localhost:3000',
    title: 'Say What Want (Dev)',
    description: 'Development environment',
  },
  // Easy to add new domains here
};

/**
 * Get the current domain from window.location
 */
export function getCurrentDomain(): string {
  if (typeof window === 'undefined') {
    return 'localhost:3000';
  }
  
  // Get domain without protocol
  const host = window.location.host;
  return host;
}

/**
 * Get configuration for current domain
 */
export function getCurrentDomainConfig(): DomainConfig {
  const domain = getCurrentDomain();
  
  // Return matching config or default
  return DOMAIN_CONFIGS[domain] || {
    domain: domain,
    title: 'Say What Want',
    description: 'Express yourself',
  };
}

/**
 * Get configuration for a specific domain
 */
export function getDomainConfig(domain: string): DomainConfig | undefined {
  return DOMAIN_CONFIGS[domain];
}

/**
 * Check if domain filtering is enabled
 */
export function isDomainFilterEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  
  const stored = localStorage.getItem('sww-domain-filter');
  return stored === null ? true : stored === 'true'; // Default to true
}

/**
 * Toggle domain filter
 */
export function toggleDomainFilter(): boolean {
  if (typeof window === 'undefined') return true;
  
  const current = isDomainFilterEnabled();
  const newState = !current;
  localStorage.setItem('sww-domain-filter', String(newState));
  return newState;
}

export default {
  DOMAIN_CONFIGS,
  getCurrentDomain,
  getCurrentDomainConfig,
  getDomainConfig,
  isDomainFilterEnabled,
  toggleDomainFilter,
};
