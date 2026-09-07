import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthErrorResponse } from './model/auth.interface';
import { AuthService } from './service/auth.service';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const accessToken = localStorage.getItem('accessToken');
  const authenticatedRequest = accessToken
    ? request.clone({
        setHeaders: { Authorization: `Bearer ${accessToken}` },
      })
    : request;

  return next(authenticatedRequest).pipe(
    catchError((error: HttpErrorResponse) => {
      const errorBody = error.error as Partial<AuthErrorResponse> | null;

      if (error.status === 401 && errorBody?.code === 'INVALID_SESSION') {
        authService.logout();
        void router.navigate(['/login'], { state: { invalidSession: true, returnUrl: router.url } });
      }

      return throwError(() => error);
    }),
  );
};
