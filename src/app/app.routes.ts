import {Routes} from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: 'dashboard', loadComponent: () => import('./components/dashboard/dashboard').then(m => m.Dashboard) },
  { path: 'contadores', loadComponent: () => import('./components/contadores/contadores').then(m => m.Contadores) },
  { path: 'processos', loadComponent: () => import('./components/processos/processos').then(m => m.Processos) },
  { path: 'audit-logs', loadComponent: () => import('./components/audit-logs/audit-logs').then(m => m.AuditLogs) },
  { path: 'relatorios', loadComponent: () => import('./components/reports/reports').then(m => m.Reports) },
  { path: 'manual', loadComponent: () => import('./components/manual/manual').then(m => m.Manual) },
];
