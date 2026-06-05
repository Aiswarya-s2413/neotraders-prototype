import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';

declare var Tracker: any;

interface SandboxEvent {
  id: number;
  name: string;
  category_a: boolean;
  category_b: boolean;
  category_c: boolean;
  notes: string | null;
  user_email: string | null;
  element_id: string | null;
  created_at: string;
}

@Component({
  selector: 'app-event-detail',
  imports: [CommonModule],
  templateUrl: './event-detail.html',
  styleUrl: './event-detail.css',
})
export class EventDetail implements OnInit {
  events: SandboxEvent[] = [];
  loading: boolean = true;
  errorMessage: string = '';

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.fetchEvents();
  }

  fetchEvents() {
    this.loading = true;
    this.errorMessage = '';
    
    let apiHost = '';
    if (typeof Tracker !== 'undefined' && Tracker.apiEndpoint) {
      try {
        const urlObj = new URL(Tracker.apiEndpoint);
        apiHost = `${urlObj.protocol}//${urlObj.host}`;
      } catch (e) {}
    }
    const apiUrl = apiHost ? `${apiHost}/api/tracker-events` : '/api/tracker-events';

    this.http.get<any>(apiUrl).subscribe({
      next: (response) => {
        if (response.status === 'success') {
          this.events = response.data || [];
        } else {
          this.errorMessage = 'Failed to load event details: ' + response.message;
        }
        this.loading = false;
      },
      error: (err) => {
        console.error(err);
        this.errorMessage = 'Network connection failed. Ensure server is online.';
        this.loading = false;
      }
    });
  }

  formatTimestamp(isoStr: string): string {
    if (!isoStr) return 'N/A';
    try {
      const date = new Date(isoStr);
      return date.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch {
      return isoStr;
    }
  }
}
