import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

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

  onSubmit() {
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
        this.statusMessage = 'Event successfully captured in database!';
        this.statusType = 'success';
        this.resetForm();
        
        setTimeout(() => {
          if (this.statusType === 'success') {
            this.statusMessage = '';
            this.statusType = '';
          }
        }, 5000);
      })
      .catch((err: any) => {
        console.error(err);
        this.statusMessage = 'Tracker submission failed. Ensure backend is running.';
        this.statusType = 'error';
      });
  }

  resetForm() {
    this.name = '';
    this.category_a = false;
    this.category_b = false;
    this.category_c = false;
    this.notes = '';
  }
}
