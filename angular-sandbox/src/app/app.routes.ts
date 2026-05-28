import { Routes } from '@angular/router';
import { EventForm } from './event-form/event-form';
import { EventList } from './event-list/event-list';
import { EventDetail } from './event-detail/event-detail';

export const routes: Routes = [
  { path: '', redirectTo: 'form', pathMatch: 'full' },
  { path: 'form', component: EventForm },
  { path: 'records', component: EventList },
  { path: 'details/:id', component: EventDetail }
];
