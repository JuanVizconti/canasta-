import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { AuthService } from './auth/service/auth.service';
import { ProductListComponent } from './product/product-list.component';

@Component({
  selector: 'app-root',
  imports: [ProductListComponent, RouterLink, RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  readonly isAuthenticated = this.authService.isAuthenticated;
  readonly showLogoutConfirmation = signal(false);
  readonly logoutMessage = signal('');

  goToLogin():void{
    void this.router.navigate(['/login']);
  }
  
  openLogoutConfirmation():void{
    this.showLogoutConfirmation.set(true);
  }
  
  closeLogoutConfirmation():void{
    this.showLogoutConfirmation.set(false);
  }

  confirmLogout():void{
    this.authService.logout();
    this.closeLogoutConfirmation();

    this.logoutMessage.set('Cerraste sesión correctamente.');

    setTimeout(() => {
      this.logoutMessage.set('');
    }, 1500);

    void this.router.navigateByUrl('/');
  }
}
