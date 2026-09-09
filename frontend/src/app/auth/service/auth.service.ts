import { HttpClient } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import { Observable, switchMap, tap } from 'rxjs';
import {
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RegisterResponse,
} from '../model/auth.interface';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly authUrl = 'http://localhost:3000/auth/login';
  private readonly usersUrl = 'http://localhost:3000/users';
  private readonly authenticated = signal(localStorage.getItem('accessToken') !== null);
  readonly isAuthenticated = this.authenticated.asReadonly();

  constructor(private readonly http: HttpClient) {}

  login(request: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(this.authUrl, request).pipe(
      tap(({ accessToken }) => {
        localStorage.setItem('accessToken', accessToken);
        this.authenticated.set(true);
      }),
    );
  }

  register(request: RegisterRequest): Observable<LoginResponse> {
    return this.http.post<RegisterResponse>(this.usersUrl, request).pipe(
      switchMap(() => this.login({ email: request.email, password: request.password })),
    );
  }

  logout(): void {
    localStorage.removeItem('accessToken');
    this.authenticated.set(false);
  }
}
