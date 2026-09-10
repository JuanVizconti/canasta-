import { HttpErrorResponse } from '@angular/common/http';
import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthErrorResponse } from './model/auth.interface';
import { AuthService } from './service/auth.service';

@Component({
  selector: 'app-login',
  imports: [FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  email = '';
  password = '';
  isSubmitting = signal(false);
  successMessage = signal('');
  errorMessage = signal('');
  sessionMessage = signal('');
  private returnUrl='/';

  constructor(
    private readonly authService: AuthService,
    private readonly router: Router,
  ) {
    const state= this.router.getCurrentNavigation()?.extras.state;
    
    if (state?.['invalidSession'] === true) {
      this.sessionMessage.set(
        'Tu sesión expiró o dejó de ser válida. Iniciá sesión nuevamente.',
      );
    }

    this.returnUrl = this.getSafeReturnUrl(state?.['returnUrl']);
  }

  submit(): void {
    this.isSubmitting.set(true);
    this.successMessage.set('');
    this.errorMessage.set('');

    this.authService.login({ email: this.email, password: this.password }).subscribe({
      next: () => {
        this.sessionMessage.set('');
        this.successMessage.set('Sesión iniciada.');
        this.isSubmitting.set(false);

        void this.router.navigateByUrl(this.returnUrl);
      },
      error: (error: HttpErrorResponse) => {
        const errorBody = error.error as Partial<AuthErrorResponse> | null;
        this.errorMessage.set(
          errorBody?.code === 'INVALID_CREDENTIALS'
            ? 'Email o contraseña incorrectos.'
            : 'No se pudo iniciar sesión.',
        );
        this.isSubmitting.set(false);
      },
    });
  }

  close(): void {
    void this.router.navigateByUrl('/');
  }

  goToRegister():void{
    void this.router.navigate(['/register'],{
      state:{
        returnUrl: this.returnUrl,
      },
    });
  }

  private getSafeReturnUrl(returnUrl:unknown):string{
    if (
      typeof returnUrl !== 'string'||
      returnUrl == '/login'||
      returnUrl == '/register'
    ) {
      return '/';
    }
    return returnUrl;
  }
}
