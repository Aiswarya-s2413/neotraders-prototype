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
    const initTracker = () => {
      if (typeof Tracker !== 'undefined') {
        let backendUrl = 'http://localhost:8080/api/tracker-events';
        const port = window.location.port;
        if (port && port !== '4200') {
          backendUrl = '/api/tracker-events';
        } else {
          // If on 4200, locate the script tag to determine which port tracker.js loaded from
          const scripts = document.getElementsByTagName('script');
          for (let i = 0; i < scripts.length; i++) {
            const src = scripts[i].src;
            if (src && src.includes('tracker.js')) {
              try {
                const url = new URL(src);
                backendUrl = `${url.protocol}//${url.host}/api/tracker-events`;
              } catch (e) {}
              break;
            }
          }
        }

        // Initialize the tracker snippet with the default MPA user
        Tracker.init('mpa-user@neotraders.com', backendUrl);

        // Auto-track page visits on navigation
        this.router.events.pipe(
          filter(event => event instanceof NavigationEnd)
        ).subscribe((event: any) => {
          Tracker.track('page_visited', `User navigated to: ${event.urlAfterRedirects}`, {
            category_a: true
          });
        });
      } else {
        // Retry in 100ms if script is not yet loaded
        setTimeout(initTracker, 100);
      }
    };

    initTracker();
  }
}
