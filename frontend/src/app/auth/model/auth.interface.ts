export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
}

export interface RegisterRequest {
  usuario: string;
  email: string;
  password: string;
}

export interface RegisterResponse {
  id: number;
  usuario: string;
  email: string;
}

export type AuthErrorCode = 'INVALID_CREDENTIALS' | 'INVALID_SESSION';

export interface AuthErrorResponse {
  statusCode: number;
  code: AuthErrorCode;
  message: string;
}
