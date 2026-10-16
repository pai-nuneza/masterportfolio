import { Injectable, signal } from '@angular/core';

/** Hands the repair robot over to the hire assistant: where it should dock, and whether it has. */
@Injectable({ providedIn: 'root' })
export class AssistantDockService {
  /** The assistant's robot, which the flying robot lines up with as it docks. */
  anchor?: SVGSVGElement;
  /** Set when the visitor needs the assistant before the repair is done (they've reached the bottom of the page). */
  summoned = false;
  readonly docked = signal(false);
}
