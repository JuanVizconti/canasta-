import { Component } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { ProductListComponent } from './product/product-list.component';

@Component({
  selector: 'app-root',
  imports: [ProductListComponent, RouterLink, RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = 'Canasta';
}
