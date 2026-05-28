import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';

interface SandboxEvent {
  id: number;
  name: string;
  category_a: boolean;
  category_b: boolean;
  category_c: boolean;
  notes: string | null;
  user_email: string | null;
  created_at: string;
}

@Component({
  selector: 'app-event-detail',
  imports: [CommonModule, RouterLink],
  templateUrl: './event-detail.html',
  styleUrl: './event-detail.css',
})
export class EventDetail implements OnInit {
  event: SandboxEvent | null = null;
  loading: boolean = true;
  errorMessage: string = '';

  constructor(
    private route: ActivatedRoute,
    private http: HttpClient,
    private router: Router
  ) {}

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.fetchEventDetails(id);
    } else {
      this.errorMessage = 'Invalid Event ID.';
      this.loading = false;
    }
  }

  fetchEventDetails(id: string) {
    this.loading = true;
    this.http.get<any>(`/api/test-events/${id}`).subscribe({
      next: (response) => {
        if (response.status === 'success') {
          this.event = response.data;
        } else {
          this.errorMessage = 'Failed to load details: ' + response.message;
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
