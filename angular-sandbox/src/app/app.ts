import { Component, OnInit, signal } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';

declare var Tracker: any;

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit {
  protected readonly title = signal('angular-sandbox');

  constructor(private router: Router) {}

  ngOnInit() {
    if (typeof Tracker !== 'undefined') {
      // Initialize the tracker snippet with the default MPA user
      Tracker.init('mpa-user@neotraders.com');
      
      // Auto-track page visits on navigation
      this.router.events.pipe(
        filter(event => event instanceof NavigationEnd)
      ).subscribe((event: any) => {
        Tracker.track('page_visited', `User navigated to: ${event.urlAfterRedirects}`, {
          category_a: true
        });
      });
    }
  }
}
