export interface User {
  id: string;
  name: string;
  email: string;
  clientId?: string;
  isFirstLogin: boolean;
}

export interface AuthResponse {
  message: string;
  token: string;
  user: User;
}

export interface Tokens {
  tickFeedToken: string;
  marketDepthToken: string;
  optionChainToken: string;
  expiresAt: string;
  isExpired: boolean;
}

export interface TokensResponse {
  tokens: Tokens;
}

export interface SaveTokensData {
  clientId?: string;
  tickFeedToken: string;
  marketDepthToken: string;
  optionChainToken: string;
}
