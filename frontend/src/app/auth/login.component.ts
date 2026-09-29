import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthErrorResponse } from './model/auth.interface';
import { AuthService } from './service/auth.service';
import { OverlayService } from '../ui/overlay.service';

@Component({
  selector: 'app-login',
  imports: [FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  private readonly overlayService = inject(OverlayService);
  readonly loginReason = this.overlayService.loginReason;
  email = '';
  password = '';
  isSubmitting = signal(false);
  successMessage = signal('');
  errorMessage = signal('');

  constructor(
    private readonly authService: AuthService,
    private readonly router: Router,
  ) {}

  submit(): void {
    this.isSubmitting.set(true);
    this.successMessage.set('');
    this.errorMessage.set('');

    this.authService.login({ email: this.email, password: this.password }).subscribe({
      next: () => {
        this.successMessage.set('Sesión iniciada.');
        this.isSubmitting.set(false);

        const returnUrl = this.overlayService.consumeReturnUrl();
        this.overlayService.close();
        if (returnUrl !== null) {
          void this.router.navigateByUrl(this.getSafeReturnUrl(returnUrl));
        }
      },
      error: (error: HttpErrorResponse) => {
        const errorBody = error.error as Partial<AuthErrorResponse> | null;
        this.errorMessage.set(
          errorBody?.code === 'INVALID_CREDENTIALS'
            ? 'Email o contraseña incorrectos.'
            : 'No se pudo iniciar sesión.',
        );

        setTimeout(() => {
          this.errorMessage.set('');
        }, 2500 );
        
        this.isSubmitting.set(false);
      },
    });
  }

  close(): void {
    this.overlayService.close();
  }

  goToRegister():void{
    this.overlayService.openRegister();
  }

  private getSafeReturnUrl(returnUrl:unknown):string{
    if (
      typeof returnUrl !== 'string'||
      !returnUrl.startsWith('/') ||
      returnUrl.startsWith('//') ||
      returnUrl === '/login' ||
      returnUrl === '/register'
    ) {
      return '/';
    }
    return returnUrl;
  }

}
