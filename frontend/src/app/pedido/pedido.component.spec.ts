import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { Observable, of, Subject, throwError } from 'rxjs';
import { Pedido } from './model/pedido.interface';
import { PedidoService } from './service/pedido.service';
import { PedidoComponent } from './pedido.component';

describe('PedidoComponent', () => {
  let fixture: ComponentFixture<PedidoComponent>;
  let component: PedidoComponent;
  let routeId: string | null;
  let getByIdCalls: number[];
  let response: Observable<Pedido>;

  const pedido: Pedido = {
    id: 27,
    estado: 'CONFIRMED',
    createdAt: '2026-09-28T18:30:00.000Z',
    personalInfo: { nombre: 'Juan', apellido: 'Perez', dni: '12345678', telefono: '1122334455' },
    delivery: {
      method: 'DELIVERY',
      address: {
        calle: 'Rivadavia', numero: '1234', localidad: 'Castelar', codigoPostal: '1712',
        piso: null, departamento: null, especificaciones: null,
      },
    },
    items: [{ productId: 11, nombre: 'Coca-Cola 2.25L', marca: 'Coca-Cola', cantidad: 2, unitPrice: '2500.50' }],
    subtotal: '20000.00',
    serviceFee: '500.00',
    deliveryFee: '2000.00',
    total: '22500.00',
    payment: { method: 'CASH', status: 'PENDING' },
  };

  beforeEach(async () => {
    routeId = '27';
    getByIdCalls = [];
    response = of(pedido);

    await TestBed.configureTestingModule({
      imports: [PedidoComponent],
      providers: [
        {
          provide: ActivatedRoute,
          useFactory: () => ({ snapshot: { paramMap: convertToParamMap({ id: routeId }) } }),
        },
        {
          provide: PedidoService,
          useValue: {
            getById: (id: number) => {
              getByIdCalls.push(id);
              return response;
            },
          },
        },
      ],
    }).compileComponents();
  });

  const createComponent = () => {
    fixture = TestBed.createComponent(PedidoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  };

  it('reads the route id, loads the persisted pedido and renders its snapshot', () => {
    createComponent();

    expect(getByIdCalls).toEqual([27]);
    expect(fixture.nativeElement.textContent).toContain('Pedido #27');
    expect(fixture.nativeElement.textContent).toContain('Confirmado');
    expect(fixture.nativeElement.textContent).toContain('Efectivo');
    expect(fixture.nativeElement.textContent).toContain('Pendiente');
    expect(fixture.nativeElement.textContent).toContain('Coca-Cola 2.25L');
    expect(fixture.nativeElement.textContent).toContain('Marca: Coca-Cola');
    expect(fixture.nativeElement.textContent).toContain('Precio unitario: $2500.50');
    expect(fixture.nativeElement.textContent).toContain('Juan Perez');
    expect(fixture.nativeElement.textContent).toContain('Rivadavia 1234');
    expect(fixture.nativeElement.textContent).toContain('Subtotal: $20000.00');
    expect(fixture.nativeElement.textContent).toContain('Total: $22500.00');
    expect(fixture.nativeElement.textContent).not.toContain('Piso:');
  });

  it('shows loading while the request is pending', () => {
    response = new Subject<Pedido>();
    createComponent();

    expect(fixture.nativeElement.textContent).toContain('Cargando pedido...');
  });

  it('renders PICKUP without address and handles null payment', () => {
    response = of({ ...pedido, delivery: { method: 'PICKUP' }, payment: null });
    createComponent();

    expect(fixture.nativeElement.textContent).toContain('Retiro');
    expect(fixture.nativeElement.textContent).toContain('Sin información de pago');
    expect(fixture.nativeElement.textContent).not.toContain('Rivadavia');
  });

  it('renders Mercado Pago and approved status from persisted values', () => {
    response = of({ ...pedido, payment: { method: 'MERCADO_PAGO', status: 'APPROVED' } });
    createComponent();

    expect(fixture.nativeElement.textContent).toContain('Mercado Pago');
    expect(fixture.nativeElement.textContent).toContain('Aprobado');
  });

  it('shows the not-found error using its semantic code', () => {
    response = throwError(() => ({ error: { code: 'PEDIDO_NOT_FOUND' } }));
    createComponent();

    expect(fixture.nativeElement.textContent).toContain('No encontramos este pedido.');
  });

  it('shows a generic error and retries the same id', () => {
    response = throwError(() => ({ error: { code: 'OTHER' } }));
    createComponent();

    expect(fixture.nativeElement.textContent).toContain('No pudimos cargar el pedido');
    component.retry();
    expect(getByIdCalls).toEqual([27, 27]);
  });

  it('does not call the backend for an invalid route id', () => {
    routeId = 'not-a-number';
    getByIdCalls = [];
    fixture = TestBed.createComponent(PedidoComponent);
    fixture.detectChanges();

    expect(getByIdCalls).toEqual([]);
    expect(fixture.nativeElement.textContent).toContain('El identificador del pedido no es válido.');
  });
});
