import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppComponent } from './app.component';
import { ProjectsComponent } from './resume/projects/projects.component';
import { ContactMeComponent } from './resume/contact-me/contact-me.component';
import { HomeComponent } from './resume/home/home.component';
import { AppRoutingModule } from './app-routing.module';
import { ExperienceComponent } from './resume/experience/experience.component';
import { AboutComponent } from './resume/about/about.component';
import { ExperienceTimelineComponent } from './resume/experience-timeline/experience-timeline.component';
import { ExperiencePageComponent } from './resume/experience-page/experience-page.component';
import { ProjectDetailsPageComponent } from './resume/projects/project-details-page.component';
import { LegacyPlanetComponent } from './legacy-planet/legacy-planet.component';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { FormsModule } from '@angular/forms';

@NgModule({ declarations: [
        AppComponent,
        ProjectsComponent,
        ContactMeComponent,
        HomeComponent,
        ExperienceComponent,
        AboutComponent,
        ExperienceTimelineComponent,
        ExperiencePageComponent,
        ProjectDetailsPageComponent,
        LegacyPlanetComponent,
    ],
    bootstrap: [AppComponent],
    schemas: [CUSTOM_ELEMENTS_SCHEMA], imports: [BrowserModule,
        AppRoutingModule,
        FormsModule], providers: [provideHttpClient(withInterceptorsFromDi())] })
export class AppModule {}
