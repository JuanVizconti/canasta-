import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { RegisterComponent } from './register.component';
import { AuthService } from './service/auth.service';

describe('RegisterComponent', () => {
  let fixture: ComponentFixture<RegisterComponent>;
  let component: RegisterComponent;
  let registerResult = of({ accessToken: 'jwt-token' });
  let receivedRequest: unknown;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RegisterComponent],
      providers: [
        {
          provide: AuthService,
          useValue: {
            register: (request: unknown) => {
              receivedRequest = request;
              return registerResult;
            },
          },
        },
        {
          provide: Router,
          useValue: {
            navigateByUrl: () => Promise.resolve(true),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RegisterComponent);
    component = fixture.componentInstance;
  });

  it('calls AuthService.register and shows success', () => {
    component.usuario = 'Usuario';
    component.email = 'usuario@email.com';
    component.password = '12345678';

    component.submit();

    expect(receivedRequest).toEqual({
      usuario: 'Usuario',
      email: 'usuario@email.com',
      password: '12345678',
    });
    expect(component.successMessage()).toBe('Registro exitoso.');
  });

  it('shows an error when registration fails', () => {
    registerResult = throwError(() => new Error('Registration failed'));

    component.submit();

    expect(component.errorMessage()).toBe('No se pudo completar el registro.');
  });
});
