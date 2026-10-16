import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Project } from '../../models/project.model';
import projectsData from '../../../assets/data/projects-enhanced.json';

@Component({
  selector: 'app-project-details-page',
  templateUrl: './project-details-page.component.html',
  styleUrls: ['./project-details-page.component.css'],
})
export class ProjectDetailsPageComponent implements OnInit {
  project?: Project;
  imageLoaded = false;

  constructor(private route: ActivatedRoute) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      const project = (projectsData as Project[]).find(item => item.id === params.get('id'));
      this.project = project
        ? { ...project, projectType: project.isPersonal ? 'Personal' : 'Professional' }
        : undefined;
      this.imageLoaded = false;
    });
  }

  statusLabel(status: string): string {
    const labels: Record<string, string> = { released: 'Released', 'mvp ready': 'MVP ready', 'in progress': 'In progress', live: 'Live' };
    return labels[status?.toLowerCase()] ?? status;
  }

  highlightsOf(project: Project): string[] {
    return project.projectHighlights?.length ? project.projectHighlights : project.highlights ?? [];
  }

  markImageLoaded(): void {
    this.imageLoaded = true;
  }
}