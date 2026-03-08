import {Routes} from '@angular/router';
import {Dashboard} from './components/dashboard/dashboard';
import {Contadores} from './components/contadores/contadores';
import {Processos} from './components/processos/processos';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: 'dashboard', component: Dashboard },
  { path: 'contadores', component: Contadores },
  { path: 'processos', component: Processos },
];
