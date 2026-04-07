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
    processNumber: new FormControl(''),
    startDate: new FormControl(''),
    endDate: new FormControl('')
  });

  appliedFilters = signal({
    userId: '',
    processNumber: '',
    startDate: '',
    endDate: ''
  });

  filteredLogs = computed(() => {
    const logs = this.auditLogs();
    const { userId, processNumber, startDate, endDate } = this.appliedFilters();

    return logs.filter(log => {
      const matchesUser = !userId || log.userId === userId;
      const logDate = new Date(log.createdAt).toISOString().split('T')[0];
      const matchesStart = !startDate || logDate >= startDate;
      const matchesEnd = !endDate || logDate <= endDate;
      
      let matchesProcess = true;
      if (processNumber) {
        const searchTerm = processNumber.toLowerCase();
        const detailsStr = log.details ? JSON.stringify(log.details).toLowerCase() : '';
        const actionStr = log.action.toLowerCase();
        const logProcessNumber = log.processNumber?.toLowerCase() || '';
        
        matchesProcess = logProcessNumber.includes(searchTerm) || 
                         detailsStr.includes(searchTerm) || 
                         actionStr.includes(searchTerm);
      }
      
      return matchesUser && matchesStart && matchesEnd && matchesProcess;
    });
  });

  applyFilters() {
    const values = this.filterForm.value;
    this.appliedFilters.set({
      userId: values.userId || '',
      processNumber: values.processNumber || '',
      startDate: values.startDate || '',
      endDate: values.endDate || ''
    });
  }

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

  getProcessNumber(log: AuditLog): string {
    if (log.processNumber) return log.processNumber;

    // Fallback to extraction from details
    if (log.details) {
      if (log.details['processNumber']) return log.details['processNumber'] as string;
      if (log.details['number']) return log.details['number'] as string;
      
      const oldValues = log.details['oldValues'] as Record<string, unknown> | undefined;
      if (oldValues && oldValues['number']) return oldValues['number'] as string;
      
      const process = log.details['process'] as Record<string, unknown> | undefined;
      if (process && process['number']) return process['number'] as string;
    }
    
    // Fallback to extraction from action string
    const match = log.action.match(/processo\s+([A-Z0-9.\-/]+)/i);
    if (match) return match[1];
    
    return '-';
  }
}
