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

  onSubmitDirect() {
    if (!this.name.trim()) return;

    this.statusMessage = 'Submitting directly to MPA database...';
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
          this.statusMessage = 'Direct Event successfully captured in MPA database!';
          this.statusType = 'success';
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

  onSubmitTracker() {
    if (!this.name.trim()) return;

    this.statusMessage = 'Dispatching event using Tracker snippet...';
    this.statusType = 'info';

    // Initialize the tracker with a test email ID
    Tracker.init('test-user@neotraders.com');

    // Call Tracker.track directly
    const categories = {
      category_a: this.category_a,
      category_b: this.category_b,
      category_c: this.category_c
    };

    Tracker.track(this.name.trim(), this.notes.trim() || null, categories)
      .then((response: any) => {
        this.statusMessage = 'Event successfully tracked via JS Snippet!';
        this.statusType = 'success';
        this.resetForm();
        this.clearStatusAfterDelay();
      })
      .catch((err: any) => {
        console.error(err);
        this.statusMessage = 'Tracker submission failed. Ensure backend is running.';
        this.statusType = 'error';
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
