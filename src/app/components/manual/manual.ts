import {ChangeDetectionStrategy, Component, signal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {MatIconModule} from '@angular/material/icon';
import {Role} from '../../types';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-manual',
  imports: [CommonModule, MatIconModule],
  templateUrl: './manual.html',
})
export class Manual {
  activeTab = signal<Role | 'Geral'>('Geral');

  setTab(tab: Role | 'Geral') {
    this.activeTab.set(tab);
  }
}
