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
  readonly accountMenuOpen = signal(false);
  readonly isAuthenticated = this.authService.isAuthenticated;

  toggleAccountMenu(): void {
    this.accountMenuOpen.update((isOpen) => !isOpen);
  }

  closeAccountMenu(): void {
    this.accountMenuOpen.set(false);
  }

  logout(): void {
    this.authService.logout();
    this.closeAccountMenu();
    void this.router.navigateByUrl('/');
  }
}
