import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface SandboxEvent {
  id: number;
  name: string;
  category_a: boolean;
  category_b: boolean;
  category_c: boolean;
  notes: string | null;
  created_at: string;
}

@Component({
  selector: 'app-event-list',
  imports: [CommonModule, FormsModule],
  templateUrl: './event-list.html',
  styleUrl: './event-list.css',
})
export class EventList implements OnInit {
  events: SandboxEvent[] = [];
  filteredEvents: SandboxEvent[] = [];
  
  searchTerm: string = '';
  sortBy: string = 'id-desc';
  
  loading: boolean = true;
  errorMessage: string = '';

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.fetchEvents();
  }

  fetchEvents() {
    this.loading = true;
    this.errorMessage = '';
    
    this.http.get<any>('/api/test-events').subscribe({
      next: (response) => {
        if (response.status === 'success') {
          this.events = response.data || [];
          this.applyFilterAndSort();
        } else {
          this.errorMessage = 'Failed to load events: ' + response.message;
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

  applyFilterAndSort() {
    const term = this.searchTerm.trim().toLowerCase();
    let result = [...this.events];
    
    if (term) {
      result = result.filter(e => 
        e.id.toString().includes(term) ||
        e.name.toLowerCase().includes(term) ||
        (e.notes && e.notes.toLowerCase().includes(term))
      );
    }

    result.sort((a, b) => {
      switch (this.sortBy) {
        case 'id-asc':
          return a.id - b.id;
        case 'id-desc':
          return b.id - a.id;
        case 'name-asc':
          return a.name.localeCompare(b.name);
        case 'name-desc':
          return b.name.localeCompare(a.name);
        case 'date-asc':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'date-desc':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        default:
          return b.id - a.id;
      }
    });

    this.filteredEvents = result;
  }

  formatTimestamp(isoStr: string): string {
    if (!isoStr) return 'N/A';
    try {
      const date = new Date(isoStr);
      return date.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch {
      return isoStr;
    }
  }
}
