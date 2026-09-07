import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of } from 'rxjs';
import { LoginComponent } from './auth/login.component';
import { RegisterComponent } from './auth/register.component';
import { AuthService } from './auth/service/auth.service';
import { routes } from './app.routes';

describe('app routes', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        {
          provide: AuthService,
          useValue: {
            login: () => of({ accessToken: 'jwt-token' }),
            register: () => of({ accessToken: 'jwt-token' }),
          },
        },
      ],
    });
  });

  it('loads LoginComponent at /login', async () => {
    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl('/login', LoginComponent);

    expect(harness.routeNativeElement?.textContent).toContain('Iniciar sesión');
  });

  it('loads RegisterComponent at /register', async () => {
    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl('/register', RegisterComponent);

    expect(harness.routeNativeElement?.textContent).toContain('Registrarse');
  });
});
