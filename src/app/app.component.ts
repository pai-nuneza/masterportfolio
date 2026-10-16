import { Component, HostListener, OnDestroy } from '@angular/core';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})
export class AppComponent implements OnDestroy {
  isNavOpen = false;
  showCameo = false;
  launching = false;
  rolling = false;
  private cameoTimer?: number;

  toggleNav(): void {
    this.isNavOpen = !this.isNavOpen;
  }

  closeNav(): void {
    this.isNavOpen = false;
  }

  @HostListener('window:scroll')
  onScroll(): void {
    const show = window.scrollY > window.innerHeight * 0.6;
    if (show !== this.showCameo) {
      this.showCameo = show;
    }
  }

  /** Waits a beat so a triple-click can become the easter egg instead of a launch. */
  onCameoClick(event: MouseEvent): void {
    window.clearTimeout(this.cameoTimer);
    if (event.detail >= 3) {
      this.rolling = true;
      this.cameoTimer = window.setTimeout(() => (this.rolling = false), 2600);
      return;
    }
    this.cameoTimer = window.setTimeout(() => this.launch(), 280);
  }

  private launch(): void {
    this.launching = true;
    window.scrollTo({ top: 0, behavior: 'smooth' });
    this.cameoTimer = window.setTimeout(() => (this.launching = false), 1200);
  }

  ngOnDestroy(): void {
    window.clearTimeout(this.cameoTimer);
  }
}
