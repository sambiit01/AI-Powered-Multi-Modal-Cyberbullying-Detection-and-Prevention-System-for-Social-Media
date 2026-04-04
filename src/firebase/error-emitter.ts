/**
 * @fileOverview A central event emitter for sharing Firestore permission errors.
 */

import { EventEmitter } from 'events';
import { FirestorePermissionError } from './errors';

class ErrorEmitter extends EventEmitter {}

export const errorEmitter = new ErrorEmitter();

export type ErrorEvents = {
  'permission-error': (error: FirestorePermissionError) => void;
};

declare interface ErrorEmitter {
  on<U extends keyof ErrorEvents>(event: U, listener: ErrorEvents[U]): this;
  emit<U extends keyof ErrorEvents>(event: U, ...args: Parameters<ErrorEvents[U]>): boolean;
}
