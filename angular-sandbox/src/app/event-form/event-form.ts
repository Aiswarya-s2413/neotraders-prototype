import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

declare var Tracker: any;

@Component({
  selector: 'app-event-form',
  imports: [CommonModule, FormsModule],
  templateUrl: './event-form.html',
  styleUrl: './event-form.css',
})
export class EventForm {
  name: string = '';
  category_a: boolean = false;
  category_b: boolean = false;
  category_c: boolean = false;
  notes: string = '';

  statusMessage: string = '';
  statusType: 'success' | 'error' | 'info' | '' = '';

  constructor(private http: HttpClient) {}

  onSubmit() {
    if (!this.name.trim()) return;

    this.statusMessage = 'Submitting to database...';
    this.statusType = 'info';

    const payload = {
      name: this.name.trim(),
      category_a: this.category_a,
      category_b: this.category_b,
      category_c: this.category_c,
      notes: this.notes.trim() || null
    };

    this.http.post<any>('/api/test-events', payload).subscribe({
      next: (response) => {
        if (response.status === 'success') {
          this.statusMessage = 'Event successfully captured in database!';
          this.statusType = 'success';
          
          // Auto-track the form submission action via JS Snippet
          if (typeof Tracker !== 'undefined') {
            const categories = {
              category_a: this.category_a,
              category_b: this.category_b,
              category_c: this.category_c
            };
            Tracker.track('form_submitted', `User submitted form for event: "${this.name.trim()}"`, categories)
              .catch((err: any) => console.error('Auto-track form failed:', err));
          }

          this.resetForm();
          this.clearStatusAfterDelay();
        } else {
          this.statusMessage = 'Error: ' + response.message;
          this.statusType = 'error';
        }
      },
      error: (err) => {
        console.error(err);
        this.statusMessage = 'Server submission failed. Ensure backend is running.';
        this.statusType = 'error';
      }
    });
  }

  clearStatusAfterDelay() {
    setTimeout(() => {
      if (this.statusType === 'success') {
        this.statusMessage = '';
        this.statusType = '';
      }
    }, 5000);
  }

  resetForm() {
    this.name = '';
    this.category_a = false;
    this.category_b = false;
    this.category_c = false;
    this.notes = '';
  }
}
