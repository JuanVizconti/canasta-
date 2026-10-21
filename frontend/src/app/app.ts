import { Component, computed, ElementRef, HostListener, inject, signal } from '@angular/core';
import { Router, NavigationEnd, RouterLink, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { AuthService } from './auth/service/auth.service';
import { LoginComponent } from './auth/login.component';
import { RegisterComponent } from './auth/register.component';
import { CartComponent } from './cart/cart.component';
import { OverlayService } from './ui/overlay.service';

@Component({
  selector: 'app-root',
  imports: [
    RouterLink,
    RouterOutlet,
    LoginComponent,
    RegisterComponent,
    CartComponent,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly overlayService = inject(OverlayService);
  private readonly hostElement = inject(ElementRef<HTMLElement>);
  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );
  readonly isAuthenticated = this.authService.isAuthenticated;
  readonly activeOverlay = this.overlayService.activeOverlay;
  readonly isCheckoutOrPedido = computed(() => {
    const url = this.currentUrl();
    return url === '/checkout' || /^\/pedidos\/[^/]+$/.test(url);
  });
  readonly showLogoutConfirmation = signal(false);
  readonly logoutMessage = signal('');
  readonly isProfileMenuOpen = signal(false);

  toggleProfileMenu(): void {
    this.isProfileMenuOpen.update((isOpen) => !isOpen);
  }

  goToLogin(): void {
    this.closeProfileMenu();
    this.overlayService.openLogin();
  }

  goToRegister(): void {
    this.closeProfileMenu();
    this.overlayService.openRegister();
  }

  goToAccount(): void {
    this.closeProfileMenu();
    void this.router.navigate(['/account']);
  }

  openCart(): void {
    this.overlayService.openCart();
  }

  goHome(): void {
    void this.router.navigate(['/']);
  }
  
  openLogoutConfirmation(): void {
    this.closeProfileMenu();
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

  closeOverlay(): void {
    this.overlayService.close();
  }

  @HostListener('document:click', ['$event'])
  closeProfileMenuOnOutsideClick(event: Event): void {
    const profileMenu = this.hostElement.nativeElement.querySelector('.profile-menu');

    if (event.target instanceof Node && !profileMenu?.contains(event.target)) {
      this.closeProfileMenu();
    }
  }

  private closeProfileMenu(): void {
    this.isProfileMenuOpen.set(false);
  }
}
