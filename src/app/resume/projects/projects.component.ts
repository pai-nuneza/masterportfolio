import { Component, OnInit } from '@angular/core';
import { Project } from '../../models/project.model';
import projectsData from '../../../assets/data/projects-enhanced.json';

@Component({
  selector: 'app-projects',
  templateUrl: './projects.component.html',
  styleUrls: ['./projects.component.css'],
})
export class ProjectsComponent implements OnInit {
  allProjects: Project[] = [];
  loadedImages = new Set<string>();

  ngOnInit(): void {
    const projects = projectsData as Project[];
    
    // Add project type property to each project and set featured to false by default
    this.allProjects = projects.map(p => ({
      ...p,
      projectType: p.isPersonal ? 'Personal' : 'Professional',
      featured: p.featured || false,
      isLargeCard: p.isLargeCard || false
    }));

    this.allProjects.sort((a: Project, b: Project) => {
      if (a.featured && !b.featured) return -1;
      if (!a.featured && b.featured) return 1;
      return 0;
    });
  }

  statusLabel(status: string): string {
    const labels: Record<string, string> = { released: 'Released', 'mvp ready': 'MVP ready', 'in progress': 'In progress', live: 'Live' };
    return labels[status?.toLowerCase()] ?? status;
  }

  highlightsOf(project: Project): string[] {
    return project.projectHighlights?.length ? project.projectHighlights : project.highlights ?? [];
  }

  visibleTechnologies(project: Project): string[] {
    return (project.technologies || []).slice(0, 4);
  }

  extraTechnologyCount(project: Project): number {
    return Math.max((project.technologies?.length || 0) - 4, 0);
  }

  markImageLoaded(imageUrl: string): void {
    window.setTimeout(() => this.loadedImages.add(imageUrl), 1000);
  }
}
