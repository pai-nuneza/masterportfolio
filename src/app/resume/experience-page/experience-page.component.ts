import { Component } from '@angular/core';

@Component({
  selector: 'app-experience-page',
  template: `
    <div class="container experience-back">
      <a routerLink="/" fragment="experience"><i class="fas fa-arrow-left"></i> Back to home</a>
    </div>
    <app-experience [full]="true"></app-experience>
    <app-experience-timeline></app-experience-timeline>
  `,
  styles: [`
    .experience-back {
      padding-top: 1.5rem;
    }

    .experience-back a {
      color: #ffb547;
      font-weight: 700;
      text-decoration: none;
    }

    .experience-back a:hover {
      color: #ffffff;
    }
  `],
})
export class ExperiencePageComponent {}
