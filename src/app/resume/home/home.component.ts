import { Component } from '@angular/core';
import skills from '../../../personal-data/skills.json';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css'],
})
export class HomeComponent {
  /** Shared with the hire assistant; edit it in src/personal-data/skills.json. */
  stack = skills.mainStack;
}
