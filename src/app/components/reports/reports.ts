import {ChangeDetectionStrategy, Component, inject, signal, computed, effect, ElementRef, ViewChild, AfterViewInit} from '@angular/core';
import {CommonModule} from '@angular/common';
import {ReactiveFormsModule, FormControl, FormGroup} from '@angular/forms';
import {MatIconModule} from '@angular/material/icon';
import {StoreService} from '../../services/store';
import * as d3 from 'd3';

interface UserStat {
  userId: string;
  userName: string;
  count: number;
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-reports',
  imports: [CommonModule, ReactiveFormsModule, MatIconModule],
  templateUrl: './reports.html',
})
export class Reports implements AfterViewInit {
  private store = inject(StoreService);
  
  @ViewChild('chartContainer') chartContainer!: ElementRef;

  currentUser = this.store.currentUser;
  nucleos = this.store.nucleos;
  
  isLoading = signal(false);
  userStats = signal<UserStat[]>([]);
  pendingCount = signal(0);
  unassignedCount = signal(0);

  filterForm = new FormGroup({
    nucleus: new FormControl('Todos'),
    startDate: new FormControl(''),
    endDate: new FormControl('')
  });

  canFilterNucleus = computed(() => {
    const user = this.currentUser();
    return ['Administrador', 'Coordenador', 'Supervisor'].includes(user?.role || '');
  });

  constructor() {
    effect(() => {
      const user = this.currentUser();
      if (user && !this.canFilterNucleus()) {
        this.filterForm.patchValue({ nucleus: user.nucleus }, { emitEvent: false });
      }
      this.loadReport();
    });
  }

  ngAfterViewInit() {
    this.renderChart();
  }

  async loadReport() {
    const user = this.currentUser();
    if (!user) return;

    this.isLoading.set(true);
    const filters = {
      nucleus: this.filterForm.value.nucleus || undefined,
      startDate: this.filterForm.value.startDate || undefined,
      endDate: this.filterForm.value.endDate || undefined,
      user
    };

    try {
      const data = await this.store.fetchReportData(filters);
      this.userStats.set(data.userStats);
      this.pendingCount.set(data.pendingCount);
      this.unassignedCount.set(data.unassignedCount);
      this.renderChart();
    } catch (error) {
      console.error('Reports: Error loading report:', error);
    } finally {
      this.isLoading.set(false);
    }
  }

  renderChart() {
    if (!this.chartContainer) return;
    
    const container = this.chartContainer.nativeElement;
    d3.select(container).selectAll('*').remove();

    const data = this.userStats();
    if (data.length === 0) return;

    const margin = {top: 30, right: 30, bottom: 150, left: 60};
    const width = container.clientWidth - margin.left - margin.right;
    const height = 500 - margin.top - margin.bottom;

    const svg = d3.select(container)
      .append('svg')
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const x = d3.scaleBand()
      .range([0, width])
      .domain(data.map(d => d.userName))
      .padding(0.3);

    const y = d3.scaleLinear()
      .domain([0, d3.max(data, d => d.count) || 0])
      .nice()
      .range([height, 0]);

    // X Axis
    svg.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(x))
      .selectAll('text')
      .attr('transform', 'translate(-10,5)rotate(-45)')
      .style('text-anchor', 'end')
      .style('font-size', '12px')
      .style('font-weight', '500')
      .style('fill', '#64748b') // slate-500
      .style('font-family', 'Inter')
      .text((d: unknown) => {
        // Truncate very long names to avoid layout issues
        const name = String(d);
        return name.length > 20 ? name.substring(0, 17) + '...' : name;
      });

    // Y Axis
    svg.append('g')
      .call(d3.axisLeft(y).ticks(5))
      .selectAll('text')
      .style('fill', '#64748b')
      .style('font-size', '11px');

    svg.selectAll('.bar')
      .data(data)
      .enter()
      .append('rect')
      .attr('class', 'bar')
      .attr('x', d => x(d.userName) || 0)
      .attr('y', d => y(d.count))
      .attr('width', x.bandwidth())
      .attr('height', d => height - y(d.count))
      .attr('fill', '#059669') // emerald-600
      .attr('rx', 4);

    // Add labels on top of bars
    svg.selectAll('.label')
      .data(data)
      .enter()
      .append('text')
      .attr('class', 'label')
      .attr('x', d => (x(d.userName) || 0) + x.bandwidth() / 2)
      .attr('y', d => y(d.count) - 5)
      .attr('text-anchor', 'middle')
      .style('font-size', '10px')
      .style('font-weight', 'bold')
      .text(d => d.count);
  }
}
