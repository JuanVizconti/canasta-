import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { environment } from '../../../enviroments/enviroment';
import { CommerceSettings } from '../model/commerce-settings.interface';

@Injectable({ providedIn: 'root' })
export class CommerceSettingsService {
  private readonly http = inject(HttpClient);
  private readonly settingsUrl = `${environment.apiUrl}/commerce-settings`;
  private readonly settingsState = signal<CommerceSettings | null>(null);

  readonly settings = this.settingsState.asReadonly();
  readonly isLoading = signal(false);
  readonly errorMessage = signal('');

  load(): void {
    if (this.isLoading()) {
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set('');
    this.http.get<CommerceSettings>(this.settingsUrl).subscribe({
      next: (settings) => {
        this.settingsState.set(settings);
        this.isLoading.set(false);
      },
      error: () => {
        this.settingsState.set(null);
        this.errorMessage.set('No se pudo cargar la configuración comercial.');
        this.isLoading.set(false);
      },
    });
  }
}
