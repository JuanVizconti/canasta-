import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { CheckoutData, DeliveryData } from '../model/checkout.interface';
import { CheckoutService } from '../service/checkout.service';
import { DeliveryComponent } from './delivery.component';

describe('DeliveryComponent', () => {
  let fixture: ComponentFixture<DeliveryComponent>;
  let component: DeliveryComponent;
  let checkoutData: ReturnType<typeof signal<CheckoutData>>;
  let savedDelivery: DeliveryData | undefined;

  const personalInfo = {
    nombre: 'Juan',
    apellido: 'Perez',
    dni: '12345678',
    telefono: '1122334455',
  };

  beforeEach(async () => {
    checkoutData = signal({
      currentStep: 'delivery' as const,
      personalInfo,
      delivery: null,
      cart: null,
      payment: null,
    });
    savedDelivery = undefined;

    await TestBed.configureTestingModule({
      imports: [DeliveryComponent],
      providers: [
        {
          provide: CheckoutService,
          useValue: {
            checkoutData: checkoutData.asReadonly(),
            updateDelivery: (delivery: DeliveryData) => {
              savedDelivery = delivery;
              checkoutData.update((current) => ({ ...current, delivery }));
            },
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DeliveryComponent);
    component = fixture.componentInstance;
  });

  it('renders without a selected method initially', () => {
    fixture.detectChanges();

    expect(component.selectedMethod()).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Retiro por el local');
    expect(fixture.nativeElement.textContent).not.toContain('Dirección de entrega');
  });

  it('shows pickup information and completes without a delivery address', () => {
    let completed = 0;
    component.completed.subscribe(() => completed++);

    component.selectMethod('PICKUP');
    fixture.detectChanges();
    component.continue();

    expect(fixture.nativeElement.textContent).toContain('Av. Siempre Viva 123, Buenos Aires');
    expect(savedDelivery).toEqual({ method: 'PICKUP' });
    expect(completed).toBe(1);
  });

  it('shows the address form when delivery is selected', () => {
    component.selectMethod('DELIVERY');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Dirección de entrega');
    expect(fixture.nativeElement.querySelector('#delivery-calle')).not.toBeNull();
  });

  it('does not complete delivery when required address fields are missing', () => {
    let completed = 0;
    component.completed.subscribe(() => completed++);
    component.selectMethod('DELIVERY');
    component.continue();
    fixture.detectChanges();

    expect(completed).toBe(0);
    expect(fixture.nativeElement.textContent).toContain(
      'Completá calle, número, localidad y código postal.',
    );
  });

  it('allows optional fields to remain empty when delivery is valid', () => {
    let completed = 0;
    component.completed.subscribe(() => completed++);
    component.selectMethod('DELIVERY');
    component.updateAddress('calle', 'Siempre Viva');
    component.updateAddress('numero', '123');
    component.updateAddress('localidad', 'Springfield');
    component.updateAddress('codigoPostal', '1000');
    component.continue();

    expect(completed).toBe(1);
    expect(savedDelivery).toEqual({
      method: 'DELIVERY',
      address: {
        calle: 'Siempre Viva',
        numero: '123',
        localidad: 'Springfield',
        codigoPostal: '1000',
        piso: '',
        departamento: '',
        especificaciones: '',
      },
    });
  });

  it('emits back when returning to personal information', () => {
    let backEvents = 0;
    component.back.subscribe(() => backEvents++);

    component.goBack();

    expect(backEvents).toBe(1);
  });

  it('restores a previously saved delivery selection and address', async () => {
    checkoutData.set({
      currentStep: 'delivery',
      personalInfo,
      delivery: {
        method: 'DELIVERY',
        address: {
          calle: 'Belgrano',
          numero: '456',
          localidad: 'CABA',
          codigoPostal: '1100',
          especificaciones: 'Portón negro',
        },
      },
      cart: null,
      payment: null,
    });
    const restoredFixture = TestBed.createComponent(DeliveryComponent);
    restoredFixture.detectChanges();
    await restoredFixture.whenStable();

    expect(restoredFixture.componentInstance.selectedMethod()).toBe('DELIVERY');
    expect(restoredFixture.componentInstance.address()).toMatchObject({
      calle: 'Belgrano',
      especificaciones: 'Portón negro',
    });
  });
});
