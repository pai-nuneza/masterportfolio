import { Component } from '@angular/core';

interface Modernization {
  before: string;
  after: string;
  meta: string;
}

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css'],
})
export class HomeComponent {
  stack = ['C# / .NET', 'React', 'Angular', 'Vue', 'SQL Server', 'Docker', 'Claude AI'];

  modernizations: Modernization[] = [
    { before: 'FoxPro desktop app', after: 'Web platform for 200K+ teachers', meta: 'PPSTA · Tech Lead' },
    { before: 'FoxPro DBF files', after: 'Relational MySQL, via a C# migration tool', meta: 'Migration tool' },
    { before: 'Legacy regulatory system', after: 'Secure web app (in progress)', meta: 'Civica · UK public sector' },
    { before: 'Paper branch requests', after: 'Online approval workflow', meta: 'M. Lhuillier' },
  ];
}
