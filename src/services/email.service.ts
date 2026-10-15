import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface ContactMessage {
  name: string;
  email: string;
  projectType: string;
  message: string;
}

/**
 * Sends contact messages through Netlify Forms, so no mail credentials live in the frontend.
 * Netlify only accepts the post when a static form named "contact" with the same fields
 * exists in index.html; submissions then appear in the Netlify dashboard and email.
 */
@Injectable({
  providedIn: 'root',
})
export class EmailService {
  constructor(private http: HttpClient) {}

  sendEmail(content: ContactMessage): Observable<string> {
    const body = new HttpParams({ fromObject: { 'form-name': 'contact', ...content } });
    return this.http.post('/', body.toString(), {
      headers: new HttpHeaders({ 'Content-Type': 'application/x-www-form-urlencoded' }),
      responseType: 'text',
    });
  }
}
