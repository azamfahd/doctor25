
export const getApiBaseUrl = () => {
  // If we are in a browser (PWA) and not in a native app context, use relative paths
  if (typeof window !== 'undefined' && (window.location.hostname !== 'localhost' || !window.location.port)) {
    // For production PWA, it's safer to use the current origin
    return window.location.origin;
  }
  
  // For development or native apps (APK), we might need a specific environment variable
  // Or we can fallback to the development server if available
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  if (envUrl) return envUrl;

  // Fallback for AI Studio preview or default dev
  return typeof window !== 'undefined' ? window.location.origin : '';
};

export const getWebSocketUrl = (path: string) => {
  const baseUrl = getApiBaseUrl();
  const protocol = baseUrl.startsWith('https') ? 'wss:' : 'ws:';
  const host = baseUrl.replace(/^https?:\/\//, '');
  return `${protocol}//${host}${path}`;
};
