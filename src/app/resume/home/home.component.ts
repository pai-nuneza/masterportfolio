import { Component } from '@angular/core';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css'],
})
export class HomeComponent {
  stack = ['C# / .NET', 'React', 'Angular', 'Vue', 'SQL Server', 'Docker', 'Claude AI'];
}
