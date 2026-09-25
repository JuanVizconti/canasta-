import { Component, inject, output, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { PersonalInfo } from "../model/checkout.interface";
import { CheckoutService } from "../service/checkout.service";

@Component({
    selector: 'app-personal-info',
    imports: [FormsModule],
    templateUrl: './personal-info.component.html',
    styleUrl: './personal-info.component.scss',
})
export class PersonalInfoComponent {
  private readonly checkoutService = inject(CheckoutService);

  readonly personalInfo = signal<PersonalInfo>(
  this.checkoutService.checkoutData().personalInfo,
  );
  readonly hasSubmitted = signal(false);
  readonly completed = output<void>();
  readonly back = output<void>();

  updatePersonalInfo(field: keyof PersonalInfo, value: string): void {
    const personalInfo = { ...this.personalInfo(), [field]: value };

    this.personalInfo.set(personalInfo);
    this.checkoutService.updatePersonalInfo(personalInfo);
  }

  submit():void{
    this.hasSubmitted.set(true);

    if(!this.isValid()){
        return;
    }

    this.checkoutService.updatePersonalInfo(this.personalInfo());
    this.completed.emit();
  }

  goBack(): void {
    this.back.emit();
  }

  isNombreValid(): boolean {
    return this.personalInfo().nombre.trim().length >= 2;
  }

  isApellidoValid(): boolean {
    return this.personalInfo().apellido.trim().length >= 2;
  }

  isDniValid(): boolean {
    return /^\d{7,}$/.test(this.personalInfo().dni);
  }

  isTelefonoValid(): boolean {
    return /^\d{8,15}$/.test(this.personalInfo().telefono);
  }

  private isValid(): boolean {
    return (
      this.isNombreValid() &&
      this.isApellidoValid() &&
      this.isDniValid() &&
      this.isTelefonoValid()
    );
  }
}
