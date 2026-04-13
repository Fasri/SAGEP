import {Routes} from '@angular/router';
import {Dashboard} from './components/dashboard/dashboard';
import {Contadores} from './components/contadores/contadores';
import {Processos} from './components/processos/processos';
import {AuditLogs} from './components/audit-logs/audit-logs';
import {Reports} from './components/reports/reports';

import {Manual} from './components/manual/manual';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: 'dashboard', component: Dashboard },
  { path: 'contadores', component: Contadores },
  { path: 'processos', component: Processos },
  { path: 'audit-logs', component: AuditLogs },
  { path: 'relatorios', component: Reports },
  { path: 'manual', component: Manual },
];
