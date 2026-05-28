import { Routes } from '@angular/router';
import { EventForm } from './event-form/event-form';
import { EventList } from './event-list/event-list';

export const routes: Routes = [
  { path: '', redirectTo: 'form', pathMatch: 'full' },
  { path: 'form', component: EventForm },
  { path: 'records', component: EventList }
];
