import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Observable, of, Subject, throwError } from 'rxjs';
import { vi } from 'vitest';
import { AuthenticatedUser } from '../auth/model/auth.interface';
import { AuthService } from '../auth/service/auth.service';
import { PedidoSummary } from '../pedido/model/pedido.interface';
import { PedidoService } from '../pedido/service/pedido.service';
import { AccountComponent } from './account.component';

describe('AccountComponent', () => {
  let fixture: ComponentFixture<AccountComponent>;
  let component: AccountComponent;
  let currentUser$: Observable<AuthenticatedUser>;
  let pedidos$: Observable<PedidoSummary[]>;

  const user: AuthenticatedUser = {
    id: 7,
    nombre: 'Juan Perez',
    email: 'juan@email.com',
  };
  const summaries: PedidoSummary[] = [{
    id: 42,
    createdAt: '2026-10-07T20:15:00.000Z',
    total: '12500.00',
    estado: 'CONFIRMED',
  }];

  beforeEach(async () => {
    currentUser$ = of(user);
    pedidos$ = of(summaries);

    await TestBed.configureTestingModule({
      imports: [AccountComponent],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: { getCurrentUser: () => currentUser$ },
        },
        {
          provide: PedidoService,
          useValue: { getPedidos: () => pedidos$ },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AccountComponent);
    component = fixture.componentInstance;
  });

  it('shows the authenticated user data and pedido history', () => {
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Juan Perez');
    expect(text).toContain('juan@email.com');
    expect(text).toContain('Pedido #42');
    expect(text).toContain('$12500.00');
    expect(text).toContain('Confirmado');
  });

  it('shows the empty state when the user has no pedidos', () => {
    pedidos$ = of([]);

    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Aún no tenés pedidos.');
  });

  it('shows loading while the account requests are pending', () => {
    currentUser$ = new Subject<AuthenticatedUser>();
    pedidos$ = new Subject<PedidoSummary[]>();

    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Cargando cuenta...');
  });

  it('shows a friendly error when pedido history loading fails', () => {
    pedidos$ = throwError(() => new HttpErrorResponse({ status: 500 }));

    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'No pudimos cargar el historial de pedidos. Intentá nuevamente.',
    );
  });

  it('navigates to the selected pedido detail', () => {
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    component.viewPedido(42);

    expect(navigate).toHaveBeenCalledWith(['/pedidos', 42]);
  });
});
