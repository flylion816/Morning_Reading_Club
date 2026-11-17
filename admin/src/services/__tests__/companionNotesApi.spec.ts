import { describe, expect, it } from 'vitest';
import { companionNotesApi } from '../api';

describe('companionNotesApi', () => {
  it('exposes the phase-one note and moderation operations', () => {
    expect(companionNotesApi).toBeDefined();
    expect(typeof companionNotesApi.getNotes).toBe('function');
    expect(typeof companionNotesApi.getNote).toBe('function');
    expect(typeof companionNotesApi.createNote).toBe('function');
    expect(typeof companionNotesApi.updateNote).toBe('function');
    expect(typeof companionNotesApi.deleteNote).toBe('function');
    expect(typeof companionNotesApi.publishNote).toBe('function');
    expect(typeof companionNotesApi.unpublishNote).toBe('function');
    expect(typeof companionNotesApi.sortNotes).toBe('function');
    expect(typeof companionNotesApi.uploadFile).toBe('function');
    expect(typeof companionNotesApi.uploadPage).toBe('function');
    expect(typeof companionNotesApi.getComments).toBe('function');
    expect(typeof companionNotesApi.updateComment).toBe('function');
    expect(typeof companionNotesApi.deleteComment).toBe('function');
    expect(typeof companionNotesApi.deleteReply).toBe('function');
  });
});
