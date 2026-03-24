import {ChangeDetectionStrategy, Component, inject, OnInit, computed, signal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {ReactiveFormsModule, FormGroup, FormControl} from '@angular/forms';
import {MatIconModule} from '@angular/material/icon';
import {StoreService} from '../../services/store';
import {AuditLog} from '../../types';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-audit-logs',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatIconModule],
  templateUrl: './audit-logs.html',
  styleUrl: './audit-logs.css',
})
export class AuditLogs implements OnInit {
  private store = inject(StoreService);

  auditLogs = this.store.auditLogs;
  users = this.store.users;

  filterForm = new FormGroup({
    userId: new FormControl(''),
    startDate: new FormControl(''),
    endDate: new FormControl('')
  });

  filteredLogs = computed(() => {
    const logs = this.auditLogs();
    const { userId, startDate, endDate } = this.filterForm.value;

    return logs.filter(log => {
      const matchesUser = !userId || log.userId === userId;
      const logDate = new Date(log.createdAt).toISOString().split('T')[0];
      const matchesStart = !startDate || logDate >= startDate;
      const matchesEnd = !endDate || logDate <= endDate;
      return matchesUser && matchesStart && matchesEnd;
    });
  });

  expandedLogs = signal<Set<string>>(new Set());

  toggleDetails(id: string) {
    this.expandedLogs.update(set => {
      const newSet = new Set(set);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }

  isExpanded(id: string): boolean {
    return this.expandedLogs().has(id);
  }

  ngOnInit() {
    this.store.fetchAuditLogs();
  }

  formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleString('pt-BR');
  }

  getDetails(log: AuditLog): string {
    if (!log.details) return '';
    try {
      return JSON.stringify(log.details, null, 2);
    } catch {
      return '';
    }
  }
}
