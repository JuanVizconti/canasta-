import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from './service/auth.service';

@Component({
  selector: 'app-register',
  imports: [FormsModule],
  templateUrl: './register.component.html',
})
export class RegisterComponent {
  usuario = '';
  email = '';
  password = '';
  isSubmitting = signal(false);
  successMessage = signal('');
  errorMessage = signal('');

  constructor(private readonly authService: AuthService) {}

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
        },
        error: () => {
          this.errorMessage.set('No se pudo completar el registro.');
          this.isSubmitting.set(false);
        },
      });
  }
}
