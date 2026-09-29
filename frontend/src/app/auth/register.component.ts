import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from './service/auth.service';
import { OverlayService } from '../ui/overlay.service';

@Component({
  selector: 'app-register',
  imports: [FormsModule],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss',
})
export class RegisterComponent {
  private readonly overlayService = inject(OverlayService);
  usuario = '';
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

    this.authService
      .register({ usuario: this.usuario, email: this.email, password: this.password })
      .subscribe({
        next: () => {
          this.successMessage.set('Registro exitoso.');
          this.isSubmitting.set(false);

          const returnUrl = this.overlayService.consumeReturnUrl();
          this.overlayService.close();
          if (returnUrl !== null) {
            void this.router.navigateByUrl(this.getSafeReturnUrl(returnUrl));
          }
        },
        error: () => {
          this.errorMessage.set('No se pudo completar el registro.');
          this.isSubmitting.set(false);
        },
      });
  }

  goToLogin():void{
    this.overlayService.openLogin();
  }

  close(): void {
    this.overlayService.close();
  }

  private getSafeReturnUrl(returnUrl: unknown):string{
    if(
      typeof returnUrl!== 'string' ||
      !returnUrl.startsWith('/') ||
      returnUrl.startsWith('//') ||
      returnUrl === '/login' ||
      returnUrl === '/register'
    ){
      return '/';
    }
    return returnUrl;
  }

}
